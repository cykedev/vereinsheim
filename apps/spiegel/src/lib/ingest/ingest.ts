// Einlesen eines Stapels von der Brücke (SP-1.6 b, Plan `plans/2026-10-13-spiegel-ingest.md`): Epoche, Zustimmung,
// Sperren, verdeckte Wertung, Ablage der Rohdaten und Deutung durch den Adapter. Die HTTP-Schicht (`http.ts`) prüft
// vorher Token, Größe und Vertrag. Last: Rohdaten werden je Snapshot abgelegt (Zeilenversionen, billig), der Adapter
// läuft je Scheibe nur für den neuesten Stand des Stapels (D5); ändert sich nur das Lebenszeichen, wird es nur vermerkt
// (D1). Was nicht zugestimmt ist, wird nicht gespeichert (D12, [[spiegel-privacy]]).

import type { DiscardReason, SnapshotOutcome } from "@vereinsheim/ingest-contract/api"
import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import type { TargetId } from "@vereinsheim/shot-core/targets"

import type { Db } from "../db"
import { CardIdentityConflictError, writeRevision } from "../db/cards"
import { storeSnapshot } from "../db/raw"
import { FAMILY_NAMES } from "../families"
import {
  adaptSnapshot,
  ADAPTER_VERSION,
  disciplineOf,
  hasHeldShot,
  schemaProblems,
  sportpassIdOf,
  type AdaptedCard,
} from "./meyton-ssmdb2"

/** so viele Zyklen einer ScheibenID probiert der Ablauf (SF-77: die ID kehrt nach rund 49,7 Tagen wieder) */
const MAX_CYCLES = 3
/** Grabsteine und Löschsperren gelten für eine ScheibenID, deren Beginn so nah liegt (dieselbe Scheibe, SF-28) */
const BLOCK_WINDOW_MS = 30 * 86_400_000

export interface IngestTarget {
  bridgeId: number
  siteId: number
  timeZone: string
}

export interface SnapshotResult {
  index: number
  scheibenId: number
  outcome: SnapshotOutcome
  reason?: DiscardReason
}

export interface IngestOptions {
  /** „jetzt“ für die Prüfung der Folgenummer; Tests spielen Fälle mit ihrer Beobachtungszeit */
  nowMs?: number
}

type SourceState = { sourceId: number; confirmed: boolean }

/**
 * Die Quelle einer Epoche (SF-23): Die erste Epoche einer Anlage gilt mit dem ersten Snapshot; jede weitere legt Spiegel
 * nur an, unbestätigt, bis der Admin sie bestätigt. Bis dahin nimmt Spiegel aus ihr nichts an.
 */
async function sourceOf(db: Db, siteId: number, epoch: number): Promise<SourceState> {
  const existing = await db.source.findUnique({
    where: { siteId_epoch: { siteId, epoch } },
    select: { id: true, confirmedAt: true },
  })
  if (existing) return { sourceId: existing.id, confirmed: existing.confirmedAt !== null }
  const any = await db.source.count({ where: { siteId } })
  const created = await db.source.upsert({
    where: { siteId_epoch: { siteId, epoch } },
    create: { siteId, epoch, confirmedAt: any === 0 ? new Date() : null },
    update: {},
    select: { id: true, confirmedAt: true },
  })
  return { sourceId: created.id, confirmed: created.confirmedAt !== null }
}

/** bestätigte Zustimmungen der Anlage: SportpassID → Konto */
async function consentsOf(db: Db, siteId: number): Promise<Map<string, string>> {
  const rows = await db.sportpassConsent.findMany({
    where: { siteId, confirmedAt: { not: null }, user: { isActive: true } },
    select: { sportpassId: true, userId: true },
  })
  return new Map(rows.map((r) => [r.sportpassId.toString(), r.userId]))
}

/** Grabstein oder Löschsperre für diese ScheibenID mit einem Beginn nahe der Beobachtung (SF-28) */
async function isBlocked(db: Db, sourceId: number, snapshot: SnapshotV1): Promise<boolean> {
  const at = Date.parse(snapshot.observedAt)
  const window = {
    gte: new Date(at - BLOCK_WINDOW_MS),
    lte: new Date(at + BLOCK_WINDOW_MS),
  }
  const where = { sourceId, scheibenId: snapshot.scheibenId, startedAt: window }
  const [tombstones, locks] = await Promise.all([
    db.tombstone.count({ where }),
    db.deleteLock.count({ where }),
  ])
  return tombstones + locks > 0
}

/** die Disziplin der Anlage; neu angelegt mit dem, was der Fachkern über sie weiß (D20) */
async function disciplineFor(
  db: Db,
  siteId: number,
  guess: {
    meytonId: number
    name: string
    targetId: TargetId | null
    family: AdaptedCard["discipline"]["family"]
  }
) {
  const where = { siteId_meytonId_name: { siteId, meytonId: guess.meytonId, name: guess.name } }
  const existing = await db.discipline.findUnique({
    where,
    select: { id: true, targetId: true },
  })
  if (existing) return { id: existing.id, targetId: existing.targetId as TargetId | null }
  const family = guess.family
    ? await db.family.upsert({
        where: { slug: guess.family },
        create: { slug: guess.family, name: FAMILY_NAMES[guess.family] },
        update: {},
        select: { id: true },
      })
    : null
  const created = await db.discipline.upsert({
    where,
    create: {
      siteId,
      meytonId: guess.meytonId,
      name: guess.name,
      targetId: guess.targetId,
      familyId: family?.id ?? null,
      // amtliche Wertung unbekannt, bis der Admin sie setzt (SF-74); nie aus der Anzeigeart
      officialScoring: null,
    },
    update: {},
    select: { id: true, targetId: true },
  })
  return { id: created.id, targetId: created.targetId as TargetId | null }
}

/** die Uhrabweichung der Anlage, die der Beobachtung am nächsten liegt (SF-29) */
async function siteClockAt(db: Db, siteId: number, atMs: number): Promise<number | null> {
  const at = new Date(atMs)
  const [before, after] = await Promise.all([
    db.clockReading.findFirst({
      where: { siteId, measuredAt: { lte: at } },
      orderBy: { measuredAt: "desc" },
      select: { measuredAt: true, offsetMs: true },
    }),
    db.clockReading.findFirst({
      where: { siteId, measuredAt: { gt: at } },
      orderBy: { measuredAt: "asc" },
      select: { measuredAt: true, offsetMs: true },
    }),
  ])
  const nearest = [before, after]
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort(
      (a, b) => Math.abs(a.measuredAt.getTime() - atMs) - Math.abs(b.measuredAt.getTime() - atMs)
    )[0]
  return nearest?.offsetMs ?? null
}

/** die Scheibe der Kennung im jüngsten Zyklus, für den gemerkten Versatz der Uhr */
async function latestCard(db: Db, sourceId: number, scheibenId: number) {
  return db.card.findFirst({
    where: { sourceId, scheibenId },
    orderBy: { cycle: "desc" },
    select: { id: true, cycle: true, clockOffsetMs: true },
  })
}

/** nur das Lebenszeichen bewegt: die Scheibe ist wieder offen (SF-10), sonst nichts (D1) */
async function touchLifesign(db: Db, sourceId: number, scheibenId: number, atMs: number) {
  const card = await latestCard(db, sourceId, scheibenId)
  if (!card) return
  await db.card.update({
    where: { id: card.id },
    data: { lifesignAt: new Date(atMs), state: "open", complete: false },
  })
}

/** endgültig und nicht zu wenige Wertungsschüsse: erst dann zählt die Scheibe für Rekorde (SF-66) */
const completeOf = (card: AdaptedCard) =>
  card.state === "final" && card.completeness !== "unvollstaendig" && card.completeness !== "leer"

/** einen gespeicherten Stand deuten und als Scheibe schreiben; null: Quarantäne */
async function adaptAndWrite(
  db: Db,
  target: IngestTarget,
  sourceId: number,
  ownerId: string,
  snapshot: SnapshotV1,
  stored: { snapshotId: bigint; previousLifesign: string | null }
): Promise<"stored" | "quarantined"> {
  const named = disciplineOf(snapshot)
  const problems = schemaProblems(snapshot)
  if (!named || problems.length) {
    await db.rawSnapshot.update({
      where: { id: stored.snapshotId },
      data: { quarantine: (problems.length ? problems : ["DisziplinID fehlt"]).join("; ") },
    })
    return "quarantined"
  }
  const known = await db.discipline.findUnique({
    where: { siteId_meytonId_name: { siteId: target.siteId, ...named } },
    select: { targetId: true },
  })
  const previous = await latestCard(db, sourceId, snapshot.scheibenId)
  const result = adaptSnapshot(snapshot, {
    timeZone: target.timeZone,
    targetId: known ? (known.targetId as TargetId | null) : undefined,
    previousLifesign: stored.previousLifesign,
    previousClockOffsetMs: previous?.clockOffsetMs ?? null,
    siteClockOffsetMs: await siteClockAt(db, target.siteId, Date.parse(snapshot.observedAt)),
  })
  if (result.kind === "quarantine") {
    await db.rawSnapshot.update({
      where: { id: stored.snapshotId },
      data: { quarantine: result.problems.join("; ") },
    })
    return "quarantined"
  }
  const card = result.card
  const discipline = await disciplineFor(db, target.siteId, card.discipline)
  const input = {
    card: {
      sourceId,
      scheibenId: card.scheibenId,
      ownerId,
      sportpassId: card.sportpassId,
      disciplineId: discipline.id,
      stand: card.stand,
      startedAtMs: card.startedAtMs,
      endedAtMs: card.endedAtMs,
      kind: card.kind,
      state: card.state,
      complete: completeOf(card),
      flags: card.flags,
      origin: "raw" as const,
      lifesignAtMs: card.lifesignAtMs,
      clockOffsetMs: card.clockOffsetMs,
    },
    shots: card.shots,
    reason: "snapshot",
    rawSnapshotId: stored.snapshotId,
    sequence: snapshot.sequence,
  }
  for (let cycle = previous?.cycle ?? 0; ; cycle++) {
    try {
      await writeRevision(db, { ...input, card: { ...input.card, cycle } })
      break
    } catch (error) {
      if (!(error instanceof CardIdentityConflictError) || cycle + 1 >= MAX_CYCLES) throw error
    }
  }
  await db.rawSnapshot.update({
    where: { id: stored.snapshotId },
    data: { adapterVersion: ADAPTER_VERSION },
  })
  return "stored"
}

/**
 * Einen Stapel einlesen, den der Vertrag schon geprüft hat (`parseSnapshotBatch`). Das Ergebnis je Snapshot steht in der
 * Reihenfolge des Stapels; gespeichert wird in der Folge der Folgenummern.
 */
export async function ingestBatch(
  db: Db,
  target: IngestTarget,
  snapshots: readonly SnapshotV1[],
  { nowMs = Date.now() }: IngestOptions = {}
): Promise<SnapshotResult[]> {
  const results: SnapshotResult[] = []
  const sources = new Map<number, SourceState>()
  const consents = await consentsOf(db, target.siteId)
  /** je Scheibe der neueste gespeicherte Stand dieses Stapels, für den Adapter */
  const toAdapt = new Map<
    string,
    {
      index: number
      snapshot: SnapshotV1
      sourceId: number
      ownerId: string
      stored: { snapshotId: bigint; previousLifesign: string | null }
    }
  >()
  /** je Scheibe das zuletzt nur vermerkte Lebenszeichen */
  const lifesigns = new Map<string, { sourceId: number; scheibenId: number; atMs: number }>()

  const order = snapshots
    .map((snapshot, index) => ({ snapshot, index }))
    .sort((a, b) => a.snapshot.sequence - b.snapshot.sequence || a.index - b.index)
  for (const { snapshot, index } of order) {
    const result = (outcome: SnapshotOutcome, reason?: DiscardReason) =>
      results.push({
        index,
        scheibenId: snapshot.scheibenId,
        outcome,
        ...(reason ? { reason } : {}),
      })
    let source = sources.get(snapshot.epoch)
    if (!source) {
      source = await sourceOf(db, target.siteId, snapshot.epoch)
      sources.set(snapshot.epoch, source)
    }
    if (!source.confirmed) {
      result("epoch-unconfirmed")
      continue
    }
    const sportpassId = sportpassIdOf(snapshot)
    const ownerId = sportpassId === null ? undefined : consents.get(sportpassId.toString())
    if (!ownerId) {
      result("discarded", "no-consent")
      continue
    }
    if (hasHeldShot(snapshot)) {
      result("discarded", "hidden")
      continue
    }
    if (await isBlocked(db, source.sourceId, snapshot)) {
      result("discarded", "blocked")
      continue
    }
    const stored = await storeSnapshot(
      db,
      { sourceId: source.sourceId, bridgeId: target.bridgeId },
      snapshot,
      { nowMs }
    )
    const key = `${source.sourceId}:${snapshot.scheibenId}`
    if (stored.outcome === "stored") {
      toAdapt.set(key, {
        index,
        snapshot,
        sourceId: source.sourceId,
        ownerId,
        stored: { snapshotId: stored.snapshotId, previousLifesign: stored.previousLifesign },
      })
      lifesigns.delete(key)
    } else if (stored.outcome === "lifesign") {
      lifesigns.set(key, {
        sourceId: source.sourceId,
        scheibenId: snapshot.scheibenId,
        atMs: Date.parse(snapshot.observedAt),
      })
    }
    result(stored.outcome)
  }

  for (const item of toAdapt.values()) {
    const outcome = await adaptAndWrite(
      db,
      target,
      item.sourceId,
      item.ownerId,
      item.snapshot,
      item.stored
    )
    if (outcome === "quarantined") {
      const entry = results.find((r) => r.index === item.index)
      if (entry) entry.outcome = "quarantined"
    }
  }
  for (const { sourceId, scheibenId, atMs } of lifesigns.values())
    await touchLifesign(db, sourceId, scheibenId, atMs)

  return results.sort((a, b) => a.index - b.index)
}
