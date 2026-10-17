// Neu lesen aus den Rohdaten ([[adr-027]], Änderung vom 17. Oktober 2026): Mit einer neuen Version des Adapters liest
// Spiegel jede ScheibenID noch einmal aus ihren gespeicherten Ständen. So kommen die Blöcke zurück, die eine Scheibe
// früher ersetzt hatte (Neustart der Probe SF-72, Probe vor der Wertung SF-03). Die Zeilenversionen halten jeden Stand
// ([[adr-031]]); was nie live ankam, holt auch das nicht zurück.

import { shotFingerprint, currentShotsOf, type ShotInput } from "../db/cards"
import type { Db } from "../db"
import { isKeyBlocked, SAME_CARD_MS } from "../db/blocks"
import { loadSnapshot, setSnapshotsRead } from "../db/raw"
import {
  adaptStored,
  disciplineContext,
  writeAdapted,
  type IngestTarget,
  type KnownDiscipline,
} from "./ingest"
import { ADAPTER_VERSION, type AdaptedCard } from "./meyton-ssmdb2"
import { blockEnds } from "./probe-blocks"

/** so lange ruht eine ScheibenID, bevor sie neu gelesen wird: Ein offener Durchgang schreibt sonst gleichzeitig */
export const REREAD_QUIET_MS = 30 * 60_000
/** höchstens so viele ScheibenIDs je Lauf, die ältesten zuerst; der nächste Lauf nimmt die übrigen */
export const REREAD_KEYS_PER_RUN = 200

interface Key {
  sourceId: number
  scheibenId: number
}

/**
 * ScheibenIDs mit einer Scheibe und einem Stand ohne Quarantäne, den der aktuelle Adapter noch nicht gelesen hat, deren
 * jüngster Stand vor mehr als `REREAD_QUIET_MS` zuletzt beobachtet wurde. Rohdaten ohne Scheibe bleiben liegen: Was
 * entfernt wurde, kommt nicht zurück.
 */
async function outdatedKeys(db: Db, nowMs: number, sourceId: number | undefined): Promise<Key[]> {
  const quietBefore = new Date(nowMs - REREAD_QUIET_MS)
  const sourceIds = sourceId === undefined ? null : [sourceId]
  return db.$queryRaw<Key[]>`
    SELECT s."sourceId", s."scheibenId"
    FROM "RawSnapshot" s
    WHERE s."quarantine" IS NULL
      AND s."adapterVersion" IS DISTINCT FROM ${ADAPTER_VERSION}
      AND (${sourceIds}::int[] IS NULL OR s."sourceId" = ANY(${sourceIds}::int[]))
      AND EXISTS (
        SELECT 1 FROM "Card" c WHERE c."sourceId" = s."sourceId" AND c."scheibenId" = s."scheibenId")
      AND NOT EXISTS (
        SELECT 1 FROM "RawSnapshot" r
        WHERE r."sourceId" = s."sourceId" AND r."scheibenId" = s."scheibenId"
          AND r."lastObservedAt" >= ${quietBefore})
    GROUP BY s."sourceId", s."scheibenId"
    ORDER BY min(s."observedAt")
    LIMIT ${REREAD_KEYS_PER_RUN}`
}

interface Read {
  snapshotId: bigint
  sequence: number
  card: AdaptedCard
  known: KnownDiscipline | null
}

const sharesShot = (a: readonly ShotInput[], b: readonly ShotInput[]) => {
  const known = new Set(a.map(shotFingerprint))
  return b.some((shot) => known.has(shotFingerprint(shot)))
}

/** eine ScheibenID neu lesen; liefert die Zahl der neu angelegten Blöcke */
async function rereadKey(db: Db, { sourceId, scheibenId }: Key): Promise<number> {
  const source = await db.source.findUniqueOrThrow({
    where: { id: sourceId },
    select: { siteId: true, site: { select: { timeZone: true } } },
  })
  // die Brücke spielt hier keine Rolle: geschrieben wird nur Scheibe und Revision
  const target: IngestTarget = {
    bridgeId: 0,
    siteId: source.siteId,
    timeZone: source.site.timeZone,
  }
  const cards = await db.card.findMany({
    where: { sourceId, scheibenId },
    orderBy: [{ cycle: "desc" }, { block: "asc" }],
    select: {
      id: true,
      cycle: true,
      block: true,
      startedAt: true,
      ownerId: true,
      ownerPending: true,
      sportpassId: true,
      clockOffsetMs: true,
      deletedAt: true,
    },
  })
  const snapshots = await db.rawSnapshot.findMany({
    where: { sourceId, scheibenId, quarantine: null },
    orderBy: { sequence: "asc" },
    select: { id: true },
  })

  // jeden Stand deuten und dem Zyklus einer vorhandenen Scheibe zuordnen (SF-77); ohne Zyklus nur als gelesen vermerken
  const byCycle = new Map<number, Read[]>()
  const unplaced: bigint[] = []
  for (const { id } of snapshots) {
    const snapshot = await loadSnapshot(db, id)
    const context = await disciplineContext(db, target, snapshot)
    if ("problems" in context) {
      unplaced.push(id)
      continue
    }
    const result = await adaptStored(
      db,
      target,
      snapshot,
      { previousLifesign: null, previousLifesignAtMs: null },
      context.known,
      cards[0]?.clockOffsetMs ?? null
    )
    if (result.kind === "quarantine") {
      unplaced.push(id)
      continue
    }
    const startedAtMs = result.card.startedAtMs
    const near = cards.find((c) => Math.abs(c.startedAt.getTime() - startedAtMs) <= SAME_CARD_MS)
    if (!near) {
      unplaced.push(id)
      continue
    }
    const reads = byCycle.get(near.cycle) ?? []
    reads.push({
      snapshotId: id,
      sequence: snapshot.sequence,
      card: result.card,
      known: context.known,
    })
    byCycle.set(near.cycle, reads)
  }

  let created = 0
  for (const [cycle, reads] of byCycle) {
    const own = cards.filter((c) => c.cycle === cycle)
    const ends = blockEnds(
      null,
      reads.map((r) => r.card.shots)
    )
    // jeder Block die vorhandene Scheibe, die einen seiner Schüsse trägt
    const shotsOf = new Map(
      await Promise.all(own.map(async (c) => [c.id, await currentShotsOf(db, c.id)] as const))
    )
    const matched = ends.map(
      (end) =>
        own.find((c) => sharesShot(shotsOf.get(c.id) ?? [], reads[end.index].card.shots)) ?? null
    )
    // durchnummerieren: die Blöcke in Folge, danach vorhandene Scheiben ohne Block; erst negativ, damit sich keine zwei
    // Scheiben kurz dieselbe Nummer teilen
    const order = [
      ...matched.filter((c): c is (typeof own)[number] => c !== null),
      ...own.filter((c) => !matched.includes(c)),
    ]
    const finalBlock = new Map<string, number>()
    let next = ends.length
    for (const c of order) {
      const index = matched.indexOf(c)
      finalBlock.set(c.id, index >= 0 ? index : next++)
    }
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${sourceId}::int, ${scheibenId}::int)`
      for (const [i, c] of own.entries())
        await tx.card.update({ where: { id: c.id }, data: { block: -1 - i } })
      for (const c of own)
        await tx.card.update({ where: { id: c.id }, data: { block: finalBlock.get(c.id)! } })
    })

    // die fehlenden Blöcke anlegen, mit Besitzer, Warten und Papierkorb der vorhandenen Scheibe
    const reference = own[0]
    const allDeleted = own.every((c) => c.deletedAt !== null)
    const deletedAt = allDeleted
      ? new Date(Math.max(...own.map((c) => c.deletedAt!.getTime())))
      : null
    let from = 0
    for (const [block, end] of ends.entries()) {
      const last = reads[end.index]
      const ids = reads.slice(from, end.index + 1).map((r) => r.snapshotId)
      from = end.index + 1
      if (!matched[block]) {
        if (
          !reference?.ownerId ||
          (await isKeyBlocked(db, { sourceId, scheibenId }, last.card.startedAtMs))
        ) {
          await setSnapshotsRead(db, ids, { adapterVersion: ADAPTER_VERSION, block: null })
          continue
        }
        const handled = await writeAdapted(
          db,
          target,
          sourceId,
          { userId: reference.ownerId, pending: reference.ownerPending },
          last.card,
          last.known,
          { cycle, block, latest: reference },
          { snapshotId: last.snapshotId, sequence: last.sequence }
        )
        if (handled !== "stored") continue
        created += 1
        if (deletedAt)
          await db.card.updateMany({
            where: { sourceId, scheibenId, cycle, block },
            data: { deletedAt },
          })
      }
      await setSnapshotsRead(db, ids, { adapterVersion: ADAPTER_VERSION, block })
    }
  }
  await setSnapshotsRead(db, unplaced, { adapterVersion: ADAPTER_VERSION, block: null })
  return created
}

/**
 * ScheibenIDs neu lesen, die der aktuelle Adapter noch nicht gelesen hat (beim Start und stündlich). `sourceId` grenzt
 * auf eine Quelle ein (Tests).
 */
export async function rereadOutdatedKeys(
  db: Db,
  { nowMs = Date.now(), sourceId }: { nowMs?: number; sourceId?: number } = {}
): Promise<{ keys: number; created: number }> {
  const keys = await outdatedKeys(db, nowMs, sourceId)
  let created = 0
  for (const key of keys) created += await rereadKey(db, key)
  return { keys: keys.length, created }
}
