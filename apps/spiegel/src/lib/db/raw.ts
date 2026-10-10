// Rohdaten als Zeilenversionen (ADR-031): Ein Snapshot speichert nur Zeilen, die es für seine Scheibe mit diesem
// Inhalt noch nicht gibt, und verweist auf alle seine Zeilen. Ein offener Durchgang schickt nach jedem Schuss den
// ganzen Stand; so wächst die Ablage um die neuen Zeilen, nicht um den ganzen Stand.

import { createHash } from "node:crypto"

import { canonicalize, compareUtf16 } from "@vereinsheim/ingest-contract/canonical"
import type {
  RowV1,
  SnapshotDataV1,
  SnapshotV1,
  TableV1,
} from "@vereinsheim/ingest-contract/snapshot"

import type { Db } from "../db"

const TABLES = ["scheiben", "serien", "treffer"] as const
type TableName = (typeof TABLES)[number]

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")

/**
 * so weit darf die Folgenummer (ms seit 1970, Uhr der Brücke) vor der Empfangszeit liegen. Ein Stand aus der Zukunft
 * würde jeden späteren richtig gestempelten als veraltet abweisen und die Scheibe still einfrieren; er wird abgelehnt,
 * die Brücke sieht den Fehler.
 */
export const MAX_SEQUENCE_AHEAD_MS = 10 * 60_000

export type StoreResult =
  /** neu gespeichert, mit so vielen neuen Zeilen */
  | { outcome: "stored"; snapshotId: bigint; newRows: number }
  /** derselbe Stand wie zuletzt; nur seine letzte Folgenummer steigt */
  | { outcome: "unchanged"; snapshotId: bigint }
  /** älter als der zuletzt gesehene Stand (SF-26): nichts geändert */
  | { outcome: "stale"; latestSequence: bigint }
  /** Folgenummer weiter als `MAX_SEQUENCE_AHEAD_MS` in der Zukunft: abgelehnt, nichts geändert */
  | { outcome: "future"; sequence: bigint }

export interface StoreTarget {
  sourceId: number
  bridgeId?: number | null
}

/**
 * Einen Snapshot ablegen, den der Vertrag schon geprüft hat (`parseSnapshot`). Eine Transaktion je Scheibe, gesperrt
 * über ein Advisory-Lock auf Quelle und ScheibenID, damit zwei Stände derselben Scheibe nicht gleichzeitig entscheiden,
 * welcher der neueste ist. `writeRevision` nimmt dasselbe Lock. Der Schlüsselraum `(int, int)` gehört in der Datenbank
 * `spiegel` allein diesem Paar (Quelle, ScheibenID); ein anderes Advisory-Lock braucht die Ein-Schlüssel-Form.
 */
export async function storeSnapshot(
  db: Db,
  target: StoreTarget,
  snapshot: SnapshotV1,
  { nowMs = Date.now() }: { nowMs?: number } = {}
): Promise<StoreResult> {
  const { sourceId } = target
  const { scheibenId } = snapshot
  const sequence = BigInt(snapshot.sequence)
  const observedAt = new Date(snapshot.observedAt)
  if (snapshot.sequence > nowMs + MAX_SEQUENCE_AHEAD_MS) return { outcome: "future", sequence }

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${sourceId}::int, ${scheibenId}::int)`
    const latest = await tx.rawSnapshot.findFirst({
      where: { sourceId, scheibenId },
      orderBy: { sequence: "desc" },
      select: { id: true, checksum: true, lastSequence: true },
    })
    if (latest && latest.checksum === snapshot.checksum) {
      if (sequence > latest.lastSequence)
        await tx.rawSnapshot.update({
          where: { id: latest.id },
          data: { lastSequence: sequence, lastObservedAt: observedAt },
        })
      return { outcome: "unchanged", snapshotId: latest.id }
    }
    if (latest && sequence <= latest.lastSequence)
      return { outcome: "stale", latestSequence: latest.lastSequence }

    const columns = Object.fromEntries(TABLES.map((name) => [name, snapshot.data[name].columns]))
    const columnsChecksum = sha256(canonicalize(columns))
    const columnSet = await tx.rawColumnSet.upsert({
      where: { checksum: columnsChecksum },
      create: { checksum: columnsChecksum, columns },
      update: {},
      select: { id: true },
    })

    const rows = TABLES.flatMap((table) =>
      canonicalRows(snapshot.data[table].rows).map(({ row, key }) => ({
        table,
        checksum: sha256(key),
        values: row,
      }))
    )
    const created = await tx.rawRow.createMany({
      data: rows.map((row) => ({ sourceId, scheibenId, ...row })),
      skipDuplicates: true,
    })
    const stored = await tx.rawRow.findMany({
      where: { sourceId, scheibenId, checksum: { in: [...new Set(rows.map((r) => r.checksum))] } },
      select: { id: true, table: true, checksum: true },
    })
    const idOf = new Map(stored.map((r) => [`${r.table}:${r.checksum}`, r.id]))
    const idsOf = (table: TableName) =>
      rows.filter((r) => r.table === table).map((r) => idOf.get(`${table}:${r.checksum}`)!)

    const saved = await tx.rawSnapshot.create({
      data: {
        sourceId,
        scheibenId,
        sequence,
        lastSequence: sequence,
        bridgeId: target.bridgeId ?? null,
        contractVersion: snapshot.contractVersion,
        sourceVersion: snapshot.sourceVersion,
        sessionTimeZone: snapshot.sessionTimeZone,
        observedAt,
        lastObservedAt: observedAt,
        checksum: snapshot.checksum,
        columnSetId: columnSet.id,
        scheibenRowIds: idsOf("scheiben"),
        serienRowIds: idsOf("serien"),
        trefferRowIds: idsOf("treffer"),
      },
      select: { id: true },
    })
    return { outcome: "stored", snapshotId: saved.id, newRows: created.count }
  })
}

/** die Zeilen in kanonischer Folge (wie die Prüfsumme sie sortiert), mit ihrer kanonischen Form */
function canonicalRows(rows: readonly RowV1[]): { row: RowV1; key: string }[] {
  return rows
    .map((row) => ({ row, key: canonicalize(row) }))
    .sort((a, b) => compareUtf16(a.key, b.key))
}

/**
 * Die Daten eines gespeicherten Snapshots, wieder zusammengesetzt; ihre Prüfsumme ist die gespeicherte. Für den
 * Adapter, der Scheiben aus den Rohdaten neu aufbaut.
 */
export async function loadSnapshotData(
  db: Db,
  snapshotId: bigint
): Promise<{ data: SnapshotDataV1; checksum: string }> {
  const snapshot = await db.rawSnapshot.findUniqueOrThrow({
    where: { id: snapshotId },
    select: {
      checksum: true,
      scheibenRowIds: true,
      serienRowIds: true,
      trefferRowIds: true,
      columnSet: { select: { columns: true } },
    },
  })
  const ids = [...snapshot.scheibenRowIds, ...snapshot.serienRowIds, ...snapshot.trefferRowIds]
  const rows = await db.rawRow.findMany({
    where: { id: { in: ids } },
    select: { id: true, values: true },
  })
  const valuesOf = new Map(rows.map((r) => [r.id, r.values as RowV1]))
  const columns = snapshot.columnSet.columns as Record<TableName, TableV1["columns"]>
  const rowOf = (id: bigint) => {
    const values = valuesOf.get(id)
    if (!values) throw new Error(`Snapshot ${snapshotId}: Zeile ${id} fehlt`)
    return values
  }
  const table = (name: TableName, rowIds: readonly bigint[]): TableV1 => ({
    columns: columns[name],
    rows: rowIds.map(rowOf),
  })
  return {
    checksum: snapshot.checksum,
    data: {
      scheiben: table("scheiben", snapshot.scheibenRowIds),
      serien: table("serien", snapshot.serienRowIds),
      treffer: table("treffer", snapshot.trefferRowIds),
    },
  }
}
