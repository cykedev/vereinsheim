// Einlesen eines Stapels von der Brücke: Epoche, Zustimmung, Sperren, verdeckte Wertung, Ablage der Rohdaten und
// Deutung durch den Adapter. Die HTTP-Schicht (`http.ts`) prüft vorher Token, Größe und Vertrag. Last: Rohdaten werden
// je Snapshot abgelegt (Zeilenversionen, billig), der Adapter läuft je Scheibe nur für den neuesten Stand des Stapels;
// ändert sich nur das Lebenszeichen, wird es nur vermerkt. Was nicht zugestimmt ist, wird nicht gespeichert
// ([[spiegel-privacy]]).

import type { DiscardReason, SnapshotOutcome } from "@vereinsheim/ingest-contract/api"
import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import type { TargetId } from "@vereinsheim/shot-core/targets"

import { ACTIVE_CONSENT } from "../consent/status"
import type { Db } from "../db"
import { CardIdentityConflictError, writeRevision } from "../db/cards"
import { isKeyBlocked, maxCycleOfKey, SAME_CARD_MS, startHintMs } from "../db/blocks"
import { storeSnapshot, type PreviousLifesign } from "../db/raw"
import { FAMILY_NAMES } from "../families"
import {
  adaptSnapshot,
  ADAPTER_VERSION,
  disciplineOf,
  hasHeldShot,
  isComplete,
  schemaProblems,
  sportpassIdOf,
  type AdaptedCard,
} from "./meyton-ssmdb2"

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
 * Die Quelle einer Epoche (SF-23): Die erste Epoche einer Anlage gilt mit dem ersten Snapshot. Eine weitere legt Spiegel
 * nur unbestätigt an und nimmt aus ihr nichts an: Grabsteine und Sperren gelten je Epoche, eine fremde Epoche brächte
 * sonst Entferntes zurück. Die Brücke eröffnet nie selbst eine (sie meldet nur `possible-reset`); käme eine, zeigt die
 * Übersicht des Admins einen Hinweis (kein Knopf dafür).
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

/** wem eine Scheibe gehört und ob der Besitz noch auf die Bestätigung der ersten Scheibe wartet */
interface Owner {
  userId: string
  pending: boolean
}

/** aktive Zustimmungen der Anlage (bestätigt, nicht abgelehnt; `consentStatus`): SportpassID → Besitzer */
async function consentsOf(db: Db, siteId: number): Promise<Map<string, Owner>> {
  const rows = await db.sportpassConsent.findMany({
    where: { siteId, ...ACTIVE_CONSENT, user: { isActive: true } },
    select: { sportpassId: true, userId: true, firstCardConfirmedAt: true },
  })
  return new Map(
    rows.map((r) => [
      r.sportpassId.toString(),
      { userId: r.userId, pending: r.firstCardConfirmedAt === null },
    ])
  )
}

/** Beginn eines Stands aus seinen Trefferzeiten (`startHintMs`, eine Stelle mit Ablage und Entfernen) */
const startOf = (snapshot: SnapshotV1) =>
  startHintMs(
    snapshot.data.treffer.rows.map((row) => row.Zeitstempel),
    Date.parse(snapshot.observedAt)
  )

/**
 * die Rangliste der Anlage (`Ranking`), beim ersten Sehen angelegt, noch ohne Art; ihre Art ordnet der Admin zu und gilt
 * beim Lesen (`kindOfRow`). Ohne Rangliste null.
 */
async function rankingFor(db: Db, siteId: number, name: string | null): Promise<number | null> {
  if (!name) return null
  const ranking = await db.ranking.upsert({
    where: { siteId_name: { siteId, name } },
    create: { siteId, name },
    update: {},
    select: { id: true },
  })
  return ranking.id
}

/** die Disziplin der Anlage; neu angelegt mit dem, was der Fachkern über sie weiß */
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

/** die Scheiben einer Kennung über alle Zyklen (SF-77), jüngster Zyklus zuerst */
async function cardsOfKey(db: Db, sourceId: number, scheibenId: number) {
  return db.card.findMany({
    where: { sourceId, scheibenId },
    orderBy: { cycle: "desc" },
    select: {
      id: true,
      cycle: true,
      startedAt: true,
      ownerId: true,
      sportpassId: true,
      clockOffsetMs: true,
    },
  })
}

/**
 * nur das Lebenszeichen bewegt: die Scheibe des jüngsten Zyklus ist wieder offen (SF-10), sonst nichts. Das
 * Lebenszeichen wandert nur vorwärts, auch wenn ein älterer Stand gleichzeitig geschrieben wird.
 */
async function touchLifesign(db: Db, sourceId: number, scheibenId: number, atMs: number) {
  const [card] = await cardsOfKey(db, sourceId, scheibenId)
  if (!card) return
  const at = new Date(atMs)
  await db.$executeRaw`
    UPDATE "Card" SET "lifesignAt" = GREATEST(COALESCE("lifesignAt", ${at}), ${at}), "state" = 'open',
      "complete" = false, "updatedAt" = now()
    WHERE "id" = ${card.id}`
}

/** Fehler beim Deuten, die bei jeder Wiederholung wiederkämen: Quarantäne statt erneut versuchen */
const isDeterministic = (error: unknown) =>
  error instanceof RangeError || error instanceof CardIdentityConflictError

type Handled = "stored" | "quarantined"

async function quarantine(db: Db, snapshotId: bigint, reason: string): Promise<Handled> {
  await db.rawSnapshot.update({ where: { id: snapshotId }, data: { quarantine: reason } })
  return "quarantined"
}

/** einen gespeicherten Stand deuten und als Scheibe schreiben; `quarantined`, wenn das nicht geht oder nicht darf */
async function adaptAndWrite(
  db: Db,
  target: IngestTarget,
  sourceId: number,
  owner: Owner,
  snapshot: SnapshotV1,
  stored: { snapshotId: bigint } & PreviousLifesign
): Promise<Handled> {
  const ownerId = owner.userId
  const named = disciplineOf(snapshot)
  const problems = schemaProblems(snapshot)
  if (!named || problems.length)
    return quarantine(
      db,
      stored.snapshotId,
      (problems.length ? problems : ["DisziplinID fehlt"]).join("; ")
    )
  const known = await db.discipline.findUnique({
    where: { siteId_meytonId_name: { siteId: target.siteId, ...named } },
    select: { id: true, targetId: true },
  })
  const cards = await cardsOfKey(db, sourceId, snapshot.scheibenId)
  const result = adaptSnapshot(snapshot, {
    timeZone: target.timeZone,
    targetId: known ? (known.targetId as TargetId | null) : undefined,
    previousLifesign: stored.previousLifesign,
    previousLifesignAtMs: stored.previousLifesignAtMs,
    previousClockOffsetMs: cards[0]?.clockOffsetMs ?? null,
    siteClockOffsetMs: await siteClockAt(db, target.siteId, Date.parse(snapshot.observedAt)),
  })
  if (result.kind === "quarantine")
    return quarantine(db, stored.snapshotId, result.problems.join("; "))
  const card = result.card
  // derselbe Durchgang ist die Scheibe eines Zyklus mit nahem Beginn; sonst ein neuer Zyklus (SF-77)
  const same = cards.find((c) => Math.abs(c.startedAt.getTime() - card.startedAtMs) <= SAME_CARD_MS)
  // ein neuer Zyklus über allen bisherigen, auch denen entfernter Scheiben (Grabstein, Sperre)
  const cycle = same
    ? same.cycle
    : ((await maxCycleOfKey(db, { sourceId, scheibenId: snapshot.scheibenId })) ?? -1) + 1
  // eine Scheibe gehört dem, dessen Zustimmung sie brachte; trägt sie danach eine andere SportpassID, wird nichts
  // geschrieben, sonst landeten fremde Schüsse beim ersten Besitzer (SF-37). Der Admin klärt es.
  if (
    same &&
    (same.ownerId !== ownerId ||
      (same.sportpassId !== null &&
        card.sportpassId !== null &&
        same.sportpassId !== card.sportpassId))
  )
    return quarantine(db, stored.snapshotId, "SportpassID oder Besitzer gewechselt")
  const discipline = known ?? (await disciplineFor(db, target.siteId, card.discipline))
  const rankingId = await rankingFor(db, target.siteId, card.ranking)
  try {
    await writeRevision(db, {
      card: {
        sourceId,
        scheibenId: card.scheibenId,
        cycle,
        ownerId,
        // nur beim Anlegen: bis der Schütze die erste Scheibe bestätigt, wartet jede neue
        ownerPending: owner.pending,
        sportpassId: card.sportpassId,
        disciplineId: discipline.id,
        stand: card.stand,
        startedAtMs: card.startedAtMs,
        endedAtMs: card.endedAtMs,
        kind: card.kind,
        rankingId,
        state: card.state,
        complete: isComplete(card.state, card.flags),
        flags: card.flags,
        origin: "raw",
        lifesignAtMs: card.lifesignAtMs,
        clockOffsetMs: card.clockOffsetMs,
      },
      shots: card.shots,
      reason: "snapshot",
      rawSnapshotId: stored.snapshotId,
      sequence: snapshot.sequence,
    })
  } catch (error) {
    if (isDeterministic(error))
      return quarantine(db, stored.snapshotId, `nicht schreibbar: ${(error as Error).name}`)
    throw error
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
  /**
   * je Scheibe der neueste Stand dieses Stapels, den der Adapter deuten muss: neu gespeichert, oder schon da, aber noch
   * nicht gedeutet (ein Fehler beim letzten Mal)
   */
  const toAdapt = new Map<
    string,
    {
      index: number
      snapshot: SnapshotV1
      sourceId: number
      owner: Owner
      stored: { snapshotId: bigint } & PreviousLifesign
    }
  >()
  /** je Scheibe das zuletzt nur vermerkte Lebenszeichen */
  const lifesigns = new Map<string, { sourceId: number; scheibenId: number; atMs: number }>()
  /** Sperren je Scheibe nur einmal je Stapel nachsehen (die meisten Stände sind Lebenszeichen derselben Scheiben) */
  const blocked = new Map<string, boolean>()

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
    const owner = sportpassId === null ? undefined : consents.get(sportpassId.toString())
    if (!owner) {
      result("discarded", "no-consent")
      continue
    }
    if (hasHeldShot(snapshot)) {
      result("discarded", "hidden")
      continue
    }
    const key = `${source.sourceId}:${snapshot.scheibenId}`
    // vorab, je Stapel einmal je Scheibe (die meisten Stände sind Lebenszeichen); `storeSnapshot` prüft unter seiner
    // Sperre noch einmal, damit ein „Nicht meine“ mitten im Stapel nicht überschrieben wird
    if (!blocked.has(key))
      blocked.set(
        key,
        await isKeyBlocked(
          db,
          { sourceId: source.sourceId, scheibenId: snapshot.scheibenId },
          startOf(snapshot)
        )
      )
    if (blocked.get(key)) {
      result("discarded", "blocked")
      continue
    }
    const stored = await storeSnapshot(
      db,
      { sourceId: source.sourceId, bridgeId: target.bridgeId },
      snapshot,
      { nowMs, startAtMs: startOf(snapshot) }
    )
    if (stored.outcome === "blocked") {
      blocked.set(key, true)
      result("discarded", "blocked")
      continue
    }
    const adapt = (previous: PreviousLifesign) =>
      toAdapt.set(key, {
        index,
        snapshot,
        sourceId: source.sourceId,
        owner,
        stored: { snapshotId: (stored as { snapshotId: bigint }).snapshotId, ...previous },
      })
    if (stored.outcome === "stored") {
      adapt(stored)
      lifesigns.delete(key)
    } else if (stored.outcome === "unchanged" || stored.outcome === "lifesign") {
      // noch nicht gedeutet: nachholen, mit dem Stand, wie er gespeichert ist (ohne Messung der Uhr)
      if (!stored.handled) adapt({ previousLifesign: null, previousLifesignAtMs: null })
      if (stored.outcome === "lifesign")
        lifesigns.set(key, {
          sourceId: source.sourceId,
          scheibenId: snapshot.scheibenId,
          atMs: Date.parse(snapshot.observedAt),
        })
    }
    result(stored.outcome)
  }

  // jede Scheibe für sich: ein Fehler bei einer hält die übrigen nicht auf; ein unerwarteter Fehler (Datenbank)
  // kommt am Ende als Fehler der Anfrage zurück, die Brücke wiederholt, und das Nachholen oben deutet dann
  let failure: unknown = null
  for (const item of toAdapt.values()) {
    try {
      const outcome = await adaptAndWrite(
        db,
        target,
        item.sourceId,
        item.owner,
        item.snapshot,
        item.stored
      )
      if (outcome === "quarantined") {
        const entry = results.find((r) => r.index === item.index)
        if (entry) entry.outcome = "quarantined"
      }
    } catch (error) {
      failure ??= error
    }
  }
  for (const { sourceId, scheibenId, atMs } of lifesigns.values())
    await touchLifesign(db, sourceId, scheibenId, atMs)
  if (failure) throw failure

  return results.sort((a, b) => a.index - b.index)
}
