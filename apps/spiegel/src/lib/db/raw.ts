// Rohdaten als Zeilenversionen (ADR-031): Ein Snapshot speichert nur Zeilen, die es für seine Scheibe mit diesem
// Inhalt noch nicht gibt, und verweist auf alle seine Zeilen. Ein offener Durchgang schickt nach jedem Schuss den
// ganzen Stand; so wächst die Ablage um die neuen Zeilen, nicht um den ganzen Stand.

import { createHash } from "node:crypto"

import { canonicalize, compareUtf16 } from "@vereinsheim/ingest-contract/canonical"
import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import type {
  RowV1,
  SnapshotDataV1,
  SnapshotV1,
  TableV1,
} from "@vereinsheim/ingest-contract/snapshot"

import type { Db } from "../db"
import { isKeyBlocked } from "./blocks"

const TABLES = ["scheiben", "serien", "treffer"] as const
type TableName = (typeof TABLES)[number]

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")

/**
 * so weit darf die Folgenummer (ms seit 1970, Uhr der Brücke) vor der Empfangszeit liegen. Ein Stand aus der Zukunft
 * würde jeden späteren richtig gestempelten als veraltet abweisen und die Scheibe still einfrieren; er wird abgelehnt,
 * die Brücke sieht den Fehler.
 */
export const MAX_SEQUENCE_AHEAD_MS = 10 * 60_000

/**
 * so weit darf die Beobachtung (Uhr der Brücke) vor der Empfangszeit liegen (SF-79). Ein Pi ohne Echtzeituhr startet
 * mit der Uhr vom Vorabend; Spiegel nähme die Stände sonst an und verschöbe die Scheibe um die Verspätung der Brücke
 * (der Adapter hält die Uhr der Brücke für richtig). Die Brücke stempelt jede Lesung neu, auch nach `Retry-After` (bis
 * 10 min) und beim Nachholen; zwischen Lesung und Ankunft liegen eine Runde und die Stapel. Abgelehnt, nichts geändert,
 * die Brücke schickt später neu (`RETRY_OUTCOMES`).
 */
export const MAX_OBSERVED_LAG_MS = 15 * 60_000

/**
 * Das Lebenszeichen der Quelle `meyton-ssmdb2`: `Scheiben.Zeitstempel` steigt alle 5 bis 10 s, solange der Stand belegt
 * ist ([[meyton-ssmdb2]]). Ändert sich nur das, legt Spiegel nichts Neues ab (Verfeinerung von
 * [[adr-031]]): sonst entstünde je belegtem Stand alle paar Sekunden ein Snapshot.
 */
export const LIFESIGN = { table: "scheiben", column: "Zeitstempel" } as const

/** die Prüfsumme des Stands ohne das Lebenszeichen, wie der Vertrag sie rechnet */
export function contentChecksumOf(data: SnapshotDataV1): string {
  const table = data[LIFESIGN.table]
  if (!Object.hasOwn(table.columns, LIFESIGN.column)) return computeChecksum(data)
  const without = <T extends Record<string, unknown>>(record: T) =>
    Object.fromEntries(Object.entries(record).filter(([key]) => key !== LIFESIGN.column))
  return computeChecksum({
    ...data,
    [LIFESIGN.table]: {
      columns: without(table.columns) as TableV1["columns"],
      rows: table.rows.map((row) => without(row) as RowV1),
    },
  })
}

/** das Lebenszeichen eines Snapshots als Text */
export const lifesignOfData = (data: SnapshotDataV1): string | null =>
  data[LIFESIGN.table].rows[0]?.[LIFESIGN.column] ?? null

/** was der Adapter über den Stand davor wissen muss: Lebenszeichen und wann es zuletzt beobachtet wurde */
export interface PreviousLifesign {
  previousLifesign: string | null
  previousLifesignAtMs: number | null
}

export type StoreResult =
  /** neu gespeichert, mit so vielen neuen Zeilen; dazu das Lebenszeichen des Stands davor (für den Adapter) */
  | ({ outcome: "stored"; snapshotId: bigint; newRows: number } & PreviousLifesign)
  /**
   * derselbe Stand wie zuletzt; nur seine letzte Folgenummer steigt. `handled`: der Stand ist gedeutet oder in
   * Quarantäne; sonst holt das Einlesen die Deutung nach (ein Fehler beim Deuten verlöre ihn sonst für immer)
   */
  | { outcome: "unchanged"; snapshotId: bigint; handled: boolean }
  /** nur das Lebenszeichen hat sich bewegt: am letzten Stand vermerkt, keine Zeile neu */
  | ({ outcome: "lifesign"; snapshotId: bigint; handled: boolean } & PreviousLifesign)
  /** älter als der zuletzt gesehene Stand (SF-26): nichts geändert */
  | { outcome: "stale"; latestSequence: bigint }
  /** Folgenummer weiter als `MAX_SEQUENCE_AHEAD_MS` in der Zukunft: abgelehnt, nichts geändert */
  | { outcome: "future"; sequence: bigint }
  /** Beobachtung mehr als `MAX_OBSERVED_LAG_MS` vor der Empfangszeit (SF-79): abgelehnt, nichts geändert */
  | { outcome: "past"; observedAt: Date }
  /** Grabstein oder Löschsperre, geprüft unter der Sperre der Scheibe (`startAtMs`): nichts gespeichert */
  | { outcome: "blocked" }

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
  {
    nowMs = Date.now(),
    startAtMs,
  }: {
    nowMs?: number
    /** Beginn des Stands (`startHintMs`): mit ihm prüft die Ablage Grabsteine und Sperren unter ihrer Sperre */
    startAtMs?: number
  } = {}
): Promise<StoreResult> {
  const { sourceId } = target
  const { scheibenId } = snapshot
  const sequence = BigInt(snapshot.sequence)
  const observedAt = new Date(snapshot.observedAt)
  if (snapshot.sequence > nowMs + MAX_SEQUENCE_AHEAD_MS) return { outcome: "future", sequence }
  if (observedAt.getTime() < nowMs - MAX_OBSERVED_LAG_MS) return { outcome: "past", observedAt }

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${sourceId}::int, ${scheibenId}::int)`
    // unter derselben Sperre wie `purgeCards`: was dort gerade entfernt wurde, kommt nicht zurück
    if (startAtMs !== undefined && (await isKeyBlocked(tx, { sourceId, scheibenId }, startAtMs)))
      return { outcome: "blocked" }
    const latest = await tx.rawSnapshot.findFirst({
      where: { sourceId, scheibenId },
      orderBy: { sequence: "desc" },
      select: {
        id: true,
        checksum: true,
        lastSequence: true,
        contentChecksum: true,
        lifesign: true,
        lifesignAt: true,
        adapterVersion: true,
        quarantine: true,
      },
    })
    const handled = !!latest && (latest.adapterVersion !== null || latest.quarantine !== null)
    const previous: PreviousLifesign = {
      previousLifesign: latest?.lifesign ?? null,
      previousLifesignAtMs: latest?.lifesignAt?.getTime() ?? null,
    }
    if (latest && latest.checksum === snapshot.checksum) {
      if (sequence > latest.lastSequence)
        await tx.rawSnapshot.update({
          where: { id: latest.id },
          data: { lastSequence: sequence, lastObservedAt: observedAt },
        })
      return { outcome: "unchanged", snapshotId: latest.id, handled }
    }
    if (latest && sequence <= latest.lastSequence)
      return { outcome: "stale", latestSequence: latest.lastSequence }

    const contentChecksum = contentChecksumOf(snapshot.data)
    const lifesign = lifesignOfData(snapshot.data)
    if (latest && latest.contentChecksum === contentChecksum) {
      await tx.rawSnapshot.update({
        where: { id: latest.id },
        data: {
          lastSequence: sequence,
          lastObservedAt: observedAt,
          lifesign,
          lifesignAt: observedAt,
        },
      })
      return { outcome: "lifesign", snapshotId: latest.id, handled, ...previous }
    }

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
    // erst nachsehen, welche Zeilen es schon gibt, und nur die fehlenden schicken: ein offener Durchgang bringt mit
    // jedem Schuss den ganzen Stand, neu ist davon meist eine Zeile
    const lookup = (checksums: string[]) =>
      tx.rawRow.findMany({
        where: { sourceId, scheibenId, checksum: { in: checksums } },
        select: { id: true, table: true, checksum: true },
      })
    const key = (r: { table: string; checksum: string }) => `${r.table}:${r.checksum}`
    const known = await lookup([...new Set(rows.map((r) => r.checksum))])
    const idOf = new Map(known.map((r) => [key(r), r.id]))
    const seen = new Set(idOf.keys())
    const missing = rows.filter((r) => !seen.has(key(r)) && seen.add(key(r)))
    const created = missing.length
      ? await tx.rawRow.createMany({
          data: missing.map((row) => ({ sourceId, scheibenId, ...row })),
          skipDuplicates: true,
        })
      : { count: 0 }
    if (missing.length)
      for (const r of await lookup([...new Set(missing.map((m) => m.checksum))]))
        idOf.set(key(r), r.id)
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
        contentChecksum,
        lifesign,
        lifesignAt: observedAt,
      },
      select: { id: true },
    })
    return {
      outcome: "stored",
      snapshotId: saved.id,
      newRows: created.count,
      ...previous,
    }
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

/**
 * Ein gespeicherter Stand als Snapshot v1, Hülle und Daten, wie er von der Brücke kam: für das Neulesen aus den
 * Rohdaten mit dem Adapter ([[adr-027]], Änderung vom 17. Oktober 2026).
 */
export async function loadSnapshot(db: Db, snapshotId: bigint): Promise<SnapshotV1> {
  const envelope = await db.rawSnapshot.findUniqueOrThrow({
    where: { id: snapshotId },
    select: {
      scheibenId: true,
      sequence: true,
      observedAt: true,
      contractVersion: true,
      sourceVersion: true,
      sessionTimeZone: true,
      source: { select: { epoch: true } },
    },
  })
  if (envelope.contractVersion !== 1)
    throw new RangeError(`Snapshot ${snapshotId}: Vertrag ${envelope.contractVersion}`)
  const { data, checksum } = await loadSnapshotData(db, snapshotId)
  return {
    contractVersion: 1,
    source: "meyton-ssmdb2",
    sourceVersion: envelope.sourceVersion,
    epoch: envelope.source.epoch,
    scheibenId: envelope.scheibenId,
    sequence: Number(envelope.sequence),
    observedAt: envelope.observedAt.toISOString(),
    sessionTimeZone: envelope.sessionTimeZone,
    data,
    checksum,
  }
}

/** Stände als gedeutet vermerken: mit welchem Adapter und in welchen Block der Scheibe (`Card.block`) */
export async function setSnapshotsRead(
  db: Db,
  snapshotIds: readonly bigint[],
  read: { adapterVersion: string; block: number }
): Promise<void> {
  if (!snapshotIds.length) return
  await db.rawSnapshot.updateMany({
    where: { id: { in: [...snapshotIds] } },
    data: { adapterVersion: read.adapterVersion, block: read.block },
  })
}
