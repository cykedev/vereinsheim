// Einlesen eines Stapels von der Brücke: Epoche, Zustimmung, Sperren, verdeckte Wertung, Ablage der Rohdaten und
// Deutung durch den Adapter. Die HTTP-Schicht (`http.ts`) prüft vorher Token, Größe und Vertrag. Last: Rohdaten werden
// je Snapshot abgelegt (Zeilenversionen, billig), der Adapter deutet jeden neuen Stand (eine reine Funktion), geschrieben
// wird je Block der Scheibe nur der letzte (SF-03, SF-72); ändert sich nur das Lebenszeichen, wird es nur vermerkt. Was
// nicht zugestimmt ist, wird nicht gespeichert ([[spiegel-privacy]]).

import type { DiscardReason, SnapshotOutcome } from "@vereinsheim/ingest-contract/api"
import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import { plannedShotsOf } from "@vereinsheim/shot-core/discipline"
import type { TargetId } from "@vereinsheim/shot-core/targets"

import { eveningOfStart } from "../card-requests/id"
import { attachRequestCard, closeRequest, openRequestsFor } from "../card-requests/queries"
import { ACTIVE_CONSENT } from "../consent/status"
import type { Db } from "../db"
import {
  CardIdentityConflictError,
  currentShotsOf,
  writeRevision,
  type RevisionChange,
} from "../db/cards"
import { isKeyBlocked, maxCycleOfKey, SAME_CARD_MS, startHintMs } from "../db/blocks"
import { disciplineFor } from "../db/disciplines"
import { setSnapshotsRead, storeSnapshot, type PreviousLifesign } from "../db/raw"
import {
  adaptSnapshot,
  ADAPTER_VERSION,
  type AdaptedCard,
  disciplineOf,
  hasHeldShot,
  isComplete,
  schemaProblems,
  sportpassIdOf,
} from "./meyton-ssmdb2"
import { blockEnds } from "./probe-blocks"

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
export interface Owner {
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

/** die Scheiben einer Kennung über alle Zyklen (SF-77) und Blöcke, jüngster Zyklus und höchster Block zuerst */
export async function cardsOfKey(db: Db, sourceId: number, scheibenId: number) {
  return db.card.findMany({
    where: { sourceId, scheibenId },
    orderBy: [{ cycle: "desc" }, { block: "desc" }],
    select: {
      id: true,
      cycle: true,
      block: true,
      startedAt: true,
      ownerId: true,
      sportpassId: true,
      clockOffsetMs: true,
    },
  })
}

export type KeyCard = Awaited<ReturnType<typeof cardsOfKey>>[number]

/**
 * nur das Lebenszeichen bewegt: die Scheibe des jüngsten Zyklus mit dem höchsten Block ist wieder offen (SF-10), sonst
 * nichts. Das Lebenszeichen wandert nur vorwärts, auch wenn ein älterer Stand gleichzeitig geschrieben wird.
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

/** die Disziplin des Stands, wie Spiegel sie kennt (undefined: noch nicht angelegt), oder warum er nicht zu deuten ist */
export async function disciplineContext(
  db: Db,
  target: IngestTarget,
  snapshot: SnapshotV1
): Promise<{ problems: string[] } | { known: KnownDiscipline | null }> {
  const named = disciplineOf(snapshot)
  const problems = schemaProblems(snapshot)
  if (!named || problems.length)
    return { problems: problems.length ? problems : ["DisziplinID fehlt"] }
  const known = await db.discipline.findUnique({
    where: { siteId_meytonId_name: { siteId: target.siteId, ...named } },
    select: { id: true, targetId: true, meytonId: true, plannedShots: true, version: true },
  })
  return { known }
}

export type KnownDiscipline = {
  id: number
  targetId: string | null
  meytonId: number
  plannedShots: number | null
  version: number
}

/** einen gespeicherten Stand deuten (reine Funktion des Adapters, dazu die Uhr der Anlage) */
export async function adaptStored(
  db: Db,
  target: IngestTarget,
  snapshot: SnapshotV1,
  stored: PreviousLifesign,
  known: KnownDiscipline | null,
  previousClockOffsetMs: number | null
) {
  return adaptSnapshot(snapshot, {
    timeZone: target.timeZone,
    targetId: known ? (known.targetId as TargetId | null) : undefined,
    plannedShots: known ? plannedShotsOf(known.meytonId, known.plannedShots) : undefined,
    previousLifesign: stored.previousLifesign,
    previousLifesignAtMs: stored.previousLifesignAtMs,
    previousClockOffsetMs,
    siteClockOffsetMs: await siteClockAt(db, target.siteId, Date.parse(snapshot.observedAt)),
  })
}

/** wohin ein gedeuteter Stand gehört: Zyklus, Block und die jüngste Scheibe dieses Zyklus, wenn es sie gibt */
export interface Placement {
  cycle: number
  block: number
  latest: KeyCard | undefined
}

/** was beim Schreiben eines gedeuteten Stands geschah; mit `change` und `cardId`, wenn geschrieben */
export interface Written {
  handled: Handled
  change?: RevisionChange
  cardId?: string
}

/** einen gedeuteten Stand als Scheibe schreiben; `quarantined`, wenn das nicht geht oder nicht darf */
export async function writeAdapted(
  db: Db,
  target: IngestTarget,
  sourceId: number,
  owner: Owner,
  card: AdaptedCard,
  known: KnownDiscipline | null,
  { cycle, block, latest }: Placement,
  stored: { snapshotId: bigint; sequence: number }
): Promise<Written> {
  const ownerId = owner.userId
  // eine Scheibe gehört dem, dessen Zustimmung sie brachte; trägt sie danach eine andere SportpassID, wird nichts
  // geschrieben, sonst landeten fremde Schüsse beim ersten Besitzer (SF-37). Der Admin klärt es.
  if (
    latest &&
    (latest.ownerId !== ownerId ||
      (latest.sportpassId !== null &&
        card.sportpassId !== null &&
        latest.sportpassId !== card.sportpassId))
  )
    return {
      handled: await quarantine(db, stored.snapshotId, "SportpassID oder Besitzer gewechselt"),
    }
  // eine neue Disziplin mit übernommener Zuordnung (umbenannt) passt nicht zum Vorschlag, mit dem der Adapter gerechnet
  // hat: -1, dann rechnet `refreshStaleDisciplineCards` die Scheibe nach
  const discipline = known
    ? { id: known.id, version: known.version }
    : await disciplineFor(db, target.siteId, card.discipline).then((d) => ({
        id: d.id,
        version: d.copied ? -1 : d.version,
      }))
  const rankingId = await rankingFor(db, target.siteId, card.ranking)
  try {
    const result = await writeRevision(db, {
      card: {
        sourceId,
        scheibenId: card.scheibenId,
        cycle,
        block,
        ownerId,
        // nur beim Anlegen: bis der Schütze die erste Scheibe bestätigt, wartet jede neue
        ownerPending: owner.pending,
        sportpassId: card.sportpassId,
        disciplineId: discipline.id,
        disciplineVersion: discipline.version,
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
      sequence: stored.sequence,
    })
    return { handled: "stored", change: result.change, cardId: result.cardId }
  } catch (error) {
    if (isDeterministic(error))
      return {
        handled: await quarantine(
          db,
          stored.snapshotId,
          `nicht schreibbar: ${(error as Error).name}`
        ),
      }
    throw error
  }
}

/** ein zu deutender Stand einer Scheibe aus dem Stapel */
interface AdaptItem {
  index: number
  snapshot: SnapshotV1
  stored: { snapshotId: bigint } & PreviousLifesign
}

/**
 * Die Stände einer Scheibe aus dem Stapel deuten, in Folge der Folgenummer, und je Block den letzten schreiben (SF-03,
 * SF-72, [[adr-027]]): Kommen der letzte Stand eines Blocks und der erste des nächsten im selben Stapel, geht so keiner
 * verloren. Liefert die Indizes der Stände, die in Quarantäne gingen.
 */
async function adaptKey(
  db: Db,
  target: IngestTarget,
  sourceId: number,
  owner: Owner,
  items: readonly AdaptItem[]
): Promise<number[]> {
  const quarantined: number[] = []
  const scheibenId = items[0].snapshot.scheibenId
  const cards = await cardsOfKey(db, sourceId, scheibenId)
  const adapted: { item: AdaptItem; card: AdaptedCard; known: KnownDiscipline | null }[] = []
  for (const item of items) {
    const context = await disciplineContext(db, target, item.snapshot)
    if ("problems" in context) {
      await quarantine(db, item.stored.snapshotId, context.problems.join("; "))
      quarantined.push(item.index)
      continue
    }
    const result = await adaptStored(
      db,
      target,
      item.snapshot,
      item.stored,
      context.known,
      cards[0]?.clockOffsetMs ?? null
    )
    if (result.kind === "quarantine") {
      await quarantine(db, item.stored.snapshotId, result.problems.join("; "))
      quarantined.push(item.index)
      continue
    }
    adapted.push({ item, card: result.card, known: context.known })
  }
  if (!adapted.length) return quarantined

  // derselbe Durchgang ist ein Zyklus mit nahem Beginn, sonst ein neuer (SF-77); darin die Scheibe mit dem höchsten Block
  const startedAtMs = adapted[0].card.startedAtMs
  const latest = cards.find((c) => Math.abs(c.startedAt.getTime() - startedAtMs) <= SAME_CARD_MS)
  // ein neuer Zyklus über allen bisherigen, auch denen entfernter Scheiben (Grabstein, Sperre)
  const cycle = latest
    ? latest.cycle
    : ((await maxCycleOfKey(db, { sourceId, scheibenId })) ?? -1) + 1
  const ends = blockEnds(
    latest ? await currentShotsOf(db, latest.id) : null,
    adapted.map((a) => a.card.shots)
  )
  let block = latest?.block ?? 0
  let from = 0
  for (const end of ends) {
    if (end.newBlock) block += 1
    const last = adapted[end.index]
    const { handled } = await writeAdapted(
      db,
      target,
      sourceId,
      owner,
      last.card,
      last.known,
      { cycle, block, latest },
      { snapshotId: last.item.stored.snapshotId, sequence: last.item.snapshot.sequence }
    )
    if (handled === "stored")
      await setSnapshotsRead(
        db,
        adapted.slice(from, end.index + 1).map((a) => a.item.stored.snapshotId),
        { adapterVersion: ADAPTER_VERSION, block }
      )
    else quarantined.push(last.item.index)
    from = end.index + 1
  }
  return quarantined
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
   * je Scheibe die Stände dieses Stapels, die der Adapter deuten muss, in Folge der Folgenummer: neu gespeichert, oder
   * schon da, aber noch nicht gedeutet (ein Fehler beim letzten Mal); derselbe Stand nur einmal
   */
  const toAdapt = new Map<string, { sourceId: number; owner: Owner; items: AdaptItem[] }>()
  /** je Scheibe das zuletzt nur vermerkte Lebenszeichen */
  const lifesigns = new Map<string, { sourceId: number; scheibenId: number; atMs: number }>()
  /** Sperren je Scheibe nur einmal je Stapel nachsehen (die meisten Stände sind Lebenszeichen derselben Scheiben) */
  const blocked = new Map<string, boolean>()
  /**
   * offene Aufträge per ID (`CardRequest`) für die Scheiben dieses Stapels: Ein Auftrag gilt wie eine Zustimmung für genau
   * diese Scheibe, wenn ihr Beginn auf den genannten Abend fällt, auch für spätere Stände, bis sie endgültig ist.
   * Geschlossen wird er hier (anderer Abend, gehalten, vergeben) oder nach dem Schreiben (`claims`)
   */
  const requests = await openRequestsFor(
    db,
    target.siteId,
    snapshots.map((s) => s.scheibenId)
  )
  const closed = new Set<number>()
  const close = async (id: number, status: "mismatch" | "held" | "taken") => {
    if (closed.has(id)) return
    closed.add(id)
    await closeRequest(db, { id, status, nowMs })
  }
  /** Auftrag → Scheibe, die ihn erfüllen soll; nach dem Schreiben hängt sie am Auftrag, wenn sie beim Auftraggeber liegt */
  const claims = new Map<
    number,
    { userId: string; sourceId: number; scheibenId: number; startMs: number }
  >()

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
    let owner = sportpassId === null ? undefined : consents.get(sportpassId.toString())
    // ein Auftrag per ID: nur für den Abend, den der Schütze genannt hat; eine Zustimmung per Sportpass geht vor
    let claim: (typeof requests)[number] | undefined
    const open = requests.filter((r) => r.scheibenId === snapshot.scheibenId && !closed.has(r.id))
    if (open.length) {
      const evening = eveningOfStart(startOf(snapshot))
      for (const r of open) if (r.day !== evening) await close(r.id, "mismatch")
      const matching = open.filter((r) => r.day === evening)
      claim = owner ? matching.find((r) => r.userId === owner!.userId) : matching[0]
      for (const r of matching) if (r !== claim) await close(r.id, "taken")
      // eine Sportpassnummer, die ein anderes Konto eingetragen hat (auch wartend oder abgelehnt): Die Scheibe gehört
      // nicht dem Auftraggeber, auch wenn die Zustimmung (noch) nicht gilt
      if (!owner && claim && sportpassId !== null) {
        const claimed = await db.sportpassConsent.findFirst({
          where: { siteId: target.siteId, sportpassId, userId: { not: claim.userId } },
          select: { id: true },
        })
        if (claimed) {
          await close(claim.id, "taken")
          claim = undefined
        }
      }
      if (!owner && claim) owner = { userId: claim.userId, pending: false }
    }
    if (!owner) {
      result("discarded", "no-consent")
      continue
    }
    if (hasHeldShot(snapshot)) {
      if (claim) await close(claim.id, "held")
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
      if (claim) await close(claim.id, "held")
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
      if (claim) await close(claim.id, "held")
      result("discarded", "blocked")
      continue
    }
    if (claim)
      claims.set(claim.id, {
        userId: claim.userId,
        sourceId: source.sourceId,
        scheibenId: snapshot.scheibenId,
        startMs: startOf(snapshot),
      })
    const adapt = (previous: PreviousLifesign) => {
      const snapshotId = (stored as { snapshotId: bigint }).snapshotId
      const entry = toAdapt.get(key) ?? { sourceId: source.sourceId, owner, items: [] }
      if (!entry.items.some((item) => item.stored.snapshotId === snapshotId))
        entry.items.push({ index, snapshot, stored: { snapshotId, ...previous } })
      toAdapt.set(key, entry)
    }
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
  for (const entry of toAdapt.values()) {
    try {
      for (const index of await adaptKey(db, target, entry.sourceId, entry.owner, entry.items)) {
        const result = results.find((r) => r.index === index)
        if (result) result.outcome = "quarantined"
      }
    } catch (error) {
      failure ??= error
    }
  }
  for (const { sourceId, scheibenId, atMs } of lifesigns.values())
    await touchLifesign(db, sourceId, scheibenId, atMs)
  // Aufträge mit geschriebener Scheibe (dieselbe Kennung, Beginn nahe dem Stand; die ScheibenID kehrt wieder, SF-77): beim
  // Auftraggeber hängt sie am Auftrag, endgültig ist er erledigt, sonst bleibt er offen, damit weitere Schüsse
  // nachkommen (`finishRequests` beim Heartbeat). Gehört sie (schon vorher) einem anderen, ist sie vergeben. Ohne
  // Scheibe (Quarantäne, Fehler) bleibt der Auftrag, wie er ist; der nächste Stand versucht es wieder
  for (const [id, claim] of claims) {
    const card = await db.card.findFirst({
      where: {
        sourceId: claim.sourceId,
        scheibenId: claim.scheibenId,
        startedAt: {
          gte: new Date(claim.startMs - SAME_CARD_MS),
          lte: new Date(claim.startMs + SAME_CARD_MS),
        },
      },
      orderBy: [{ cycle: "desc" }, { block: "desc" }],
      select: { id: true, ownerId: true, state: true },
    })
    if (!card) continue
    if (card.ownerId !== claim.userId) await closeRequest(db, { id, status: "taken", nowMs })
    else if (card.state === "final")
      await closeRequest(db, { id, status: "done", cardId: card.id, nowMs })
    else await attachRequestCard(db, id, card.id)
  }
  if (failure) throw failure

  return results.sort((a, b) => a.index - b.index)
}
