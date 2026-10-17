// Scheiben mit Revisionen und Projektion (ADR-031). Eine Revision ist ein Satz Schüsse; eine neue entsteht nur bei einer
// Korrektur der Wertung (SF-67). Mit jeder Änderung an den Schüssen entsteht die Projektion neu (shot-core
// `cardProjection`), damit Liste, Fortschritt und Start ohne Schüsse auskommen.

import { createHash } from "node:crypto"

import { canonicalize } from "@vereinsheim/ingest-contract/canonical"
import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { plannedShotsOf } from "@vereinsheim/shot-core/discipline"
import {
  FLAG_OVER_TARGET,
  FLAG_SUSPICIOUS,
  type CardFlag,
  type MetricShot,
} from "@vereinsheim/shot-core/metrics"
import { cardMarks, cardProjection, projectionVersion } from "@vereinsheim/shot-core/projection"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"

import {
  Prisma,
  type CardKind,
  type CardOrigin,
  type CardState,
  type Scoring,
} from "@/generated/prisma/client"

import type { Db } from "../db"
import {
  baseShotFlags,
  DERIVED_SHOT_FLAGS,
  isComplete,
  MAPPING_FLAGS,
  mappingFlags,
  verifyShots,
} from "../ingest/card-checks"
import { standScoringOf } from "../scoring"
import { VISIBLE_CARD } from "./visible"

type Tx = Prisma.TransactionClient

/** ein Schuss, wie der Adapter ihn aus den Rohdaten oder dem Ausdruck liest */
export interface ShotInput {
  /** Abgabefolge über die ganze Scheibe (SF-30) */
  seq: number
  /** 0 = Probe */
  stellung: number
  treffer: number
  series: number | null
  xUm: number | null
  yUm: number | null
  ring: number | null
  decimalTenths: number | null
  /** Abstand zur Mitte in 0,1 µm (`Teiler001`) */
  distanceTenthsUm: number | null
  innerTen: boolean
  /** Anzeigeart am Monitor, nie die amtliche Wertung (SF-74) */
  displayMode: number | null
  firedAtMs: number | null
  flags: readonly string[]
}

export interface CardInput {
  sourceId: number | null
  scheibenId: number | null
  /**
   * Zyklus der ScheibenID (SF-77): Meyton zählt sie als Millisekunden-Zähler, der nach etwa 49,7 Tagen wiederkehrt.
   * Standard 0; meldet `writeRevision` einen `CardIdentityConflictError`, nimmt der Adapter den nächsten.
   */
  cycle?: number
  /** nur beim Anlegen; die Zuordnung ändert eine Revision nicht */
  ownerId?: string | null
  /** nur beim Anlegen: der Besitz wartet auf die Bestätigung der ersten Scheibe; fehlt: nicht */
  ownerPending?: boolean
  /** fehlt: nicht anfassen; null: leeren (Drei-Wege-Semantik, conventions §9) */
  sportpassId?: bigint | null
  disciplineId: number
  /**
   * `Discipline.version`, mit der der Adapter gerechnet hat; fehlt (`seed:own`, PDF): -1, dann rechnet
   * `refreshStaleDisciplineCards` die Scheibe einmal mit der Zuordnung nach
   */
  disciplineVersion?: number
  stand: string | null
  startedAtMs: number
  endedAtMs: number | null
  kind: CardKind
  /** die Rangliste der SSMDB2 (`Ranking`); fehlt: nicht anfassen (`seed:own`, PDF) */
  rankingId?: number | null
  state: CardState
  complete: boolean
  /** nur Kennungen aus `CARD_FLAGS`: Die Oberfläche benennt jede */
  flags: readonly CardFlag[]
  origin: CardOrigin
  /** zuletzt bewegtes Lebenszeichen (Adapter); fehlt: nicht anfassen */
  lifesignAtMs?: number | null
  /** Versatz der Uhr des Stands (Adapter, SF-73); fehlt: nicht anfassen */
  clockOffsetMs?: number | null
}

/**
 * Merkmale, die an der Scheibe bleiben, auch wenn ein späterer Stand sie nicht mehr zeigt: eine Korrektur bleibt eine
 * Korrektur, und eine Uhr, die einmal falsch ging, kann es wieder (SF-21, SF-73).
 */
export const STICKY_FLAGS: readonly CardFlag[] = ["korrigiert", "uhr-abweichung"]
/** eine neue Revision nach der ersten: die Standaufsicht hat korrigiert (SF-21) */
export const FLAG_CORRECTED = "korrigiert" satisfies CardFlag

export interface RevisionInput {
  /** die Scheibe; ohne `cardId` über Quelle, ScheibenID und Zyklus gefunden oder neu angelegt */
  card: CardInput
  cardId?: string
  shots: readonly ShotInput[]
  reason: string
  rawSnapshotId?: bigint | null
  /** Folgenummer des Snapshots (SF-26): eine, die nicht über der zuletzt geschriebenen liegt, ändert nichts */
  sequence?: bigint | number
}

/**
 * `created`: neue Revision (eine Korrektur der Wertung oder die erste); `updated`: dieselbe Revision mit neuen oder
 * weggefallenen Schüssen (offener Durchgang, Probe gelöscht oder neu begonnen, SF-03, SF-72); `unchanged`: dieselben
 * Schüsse, nur die Merkmale der Scheibe aktualisiert; `stale`: ein älterer Snapshot, nichts geändert.
 */
export type RevisionChange = "created" | "updated" | "unchanged" | "stale"

export interface RevisionResult {
  cardId: string
  revisionId: bigint
  number: number
  change: RevisionChange
  added: number
  removed: number
}

/** eine ScheibenID, die schon zu einer anderen Scheibe gehört (SF-77): der Adapter nimmt den nächsten Zyklus */
export class CardIdentityConflictError extends Error {
  constructor(
    readonly cardId: string,
    readonly cycle: number
  ) {
    super(`Scheibe ${cardId}: dieselbe ScheibenID im Zyklus ${cycle}, aber eine andere Scheibe`)
    this.name = "CardIdentityConflictError"
  }
}

/** so weit auseinander kann der Beginn derselben Scheibe nicht liegen; die ID kehrt erst nach 49,7 Tagen wieder */
const RECURRENCE_MIN_MS = 7 * 86_400_000

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")

/** derselbe Schuss über Revisionen hinweg: Zeit mit Millisekunden und Lage */
export function shotFingerprint(shot: Pick<ShotInput, "firedAtMs" | "xUm" | "yUm">): string {
  return [shot.firedAtMs, shot.xUm, shot.yUm].map((v) => v ?? "-").join(":")
}

/** der Schuss für den Fachkern */
export function toMetricShot(shot: ShotInput): MetricShot {
  return {
    seq: shot.seq,
    xUm: shot.xUm,
    yUm: shot.yUm,
    decimalTenths: shot.decimalTenths,
    ring: shot.ring,
    innerTen: shot.innerTen,
    distanceUm: shot.distanceTenthsUm === null ? null : shot.distanceTenthsUm / 10,
    firedAtMs: shot.firedAtMs,
    kind: shot.stellung === 0 ? "probe" : "match",
    series: shot.series,
    flags: [...shot.flags],
  }
}

const shotKey = (shot: Pick<ShotInput, "stellung" | "treffer">) =>
  `${shot.stellung}:${shot.treffer}`
const shotContent = (shot: ShotInput) => canonicalize({ ...shot, flags: [...shot.flags].sort() })

/**
 * Derselbe Wertungsschuss, auch wenn die Anzeigeart anders ist: Schaltet der Schütze am Monitor um, schreibt
 * Meyton `Wertung` und `Text` neu, Werte und Lage bleiben (SF-74); das ist keine Korrektur, nur eine Änderung der
 * aktuellen Revision. Ebenso `verdaechtig`: Das ist Spiegels Gegenprobe, nicht Meytons Wertung (SF-15, SF-67), und
 * kippt etwa, wenn spätere Schüsse oder eine neue Zuordnung der Disziplin das Scheibenbild bestätigen oder verwerfen.
 */
function sameScoring(a: ShotInput | undefined, b: ShotInput): boolean {
  if (!a) return false
  const scoring = (shot: ShotInput) =>
    shotContent({
      ...shot,
      displayMode: null,
      flags: shot.flags.filter((flag) => flag !== FLAG_SUSPICIOUS),
    })
  return scoring(a) === scoring(b)
}

/** Inhalt einer Revision: die Schüsse nach Stellung und Treffer, unabhängig von der Folge der Eingabe */
function contentHash(shots: readonly ShotInput[]): string {
  const sorted = [...shots].sort((a, b) => a.stellung - b.stellung || a.treffer - b.treffer)
  return sha256(`[${sorted.map(shotContent).join(",")}]`)
}

function assertUniqueShots(shots: readonly ShotInput[]): void {
  if (new Set(shots.map(shotKey)).size !== shots.length)
    throw new RangeError("Schüsse mit doppelter Stellung und Treffer")
}

export type ShotChange =
  | { kind: "same" }
  /** dieselbe Revision: Schüsse dazu, Probe weg oder neu (SF-03, SF-72) */
  | { kind: "update"; add: ShotInput[]; remove: ShotInput[] }
  /** ein Wertungsschuss geändert oder weg: neue Revision (SF-67) */
  | { kind: "correction" }

/**
 * Was der neue Stand gegenüber der aktuellen Revision ist. Eine Korrektur ist nur eine geänderte oder fehlende
 * Wertungszeile (SF-67). Die Probe dagegen kommt und geht: Meyton löscht sie mit dem ersten Wertungsschuss (SF-03) und
 * beim Neustart (SF-72, die Nummern beginnen wieder bei 1); das ist der Normalfall, wie am Ausdruck.
 */
export function shotChange(current: readonly ShotInput[], next: readonly ShotInput[]): ShotChange {
  assertUniqueShots(next)
  const nextByKey = new Map(next.map((shot) => [shotKey(shot), shot]))
  const currentByKey = new Map(current.map((shot) => [shotKey(shot), shot]))
  const differs = (a: ShotInput | undefined, b: ShotInput) =>
    !a || shotContent(a) !== shotContent(b)
  if (
    current.some((shot) => shot.stellung !== 0 && !sameScoring(nextByKey.get(shotKey(shot)), shot))
  )
    return { kind: "correction" }
  const add = next.filter((shot) => differs(currentByKey.get(shotKey(shot)), shot))
  const remove = current.filter((shot) => differs(nextByKey.get(shotKey(shot)), shot))
  return add.length || remove.length ? { kind: "update", add, remove } : { kind: "same" }
}

function shotRows(revisionId: bigint, cardId: string, shots: readonly ShotInput[]) {
  return shots.map((shot) => ({
    revisionId,
    cardId,
    seq: shot.seq,
    stellung: shot.stellung,
    treffer: shot.treffer,
    series: shot.series,
    xUm: shot.xUm,
    yUm: shot.yUm,
    ring: shot.ring,
    decimalTenths: shot.decimalTenths,
    distanceTenthsUm: shot.distanceTenthsUm,
    innerTen: shot.innerTen,
    displayMode: shot.displayMode,
    firedAt: shot.firedAtMs === null ? null : new Date(shot.firedAtMs),
    flags: [...shot.flags],
    fingerprint: shotFingerprint(shot),
  }))
}

/**
 * Merkmale, die jeder Stand neu setzt, auch die Wertung wie am Stand aus den Schüssen; die Kennung (Quelle, ScheibenID,
 * Zyklus), der Besitzer, die gewählte Wertung und die gewählte Art nicht
 */
function cardFeatures(card: CardInput, shots: readonly ShotInput[], familyId: number | null) {
  return {
    disciplineId: card.disciplineId,
    disciplineVersion: card.disciplineVersion ?? -1,
    familyId,
    stand: card.stand,
    startedAt: new Date(card.startedAtMs),
    endedAt: card.endedAtMs === null ? null : new Date(card.endedAtMs),
    kind: card.kind,
    state: card.state,
    complete: card.complete,
    standScoring: standScoringOf(shots),
    flags: [...card.flags],
    ...(card.sportpassId === undefined ? {} : { sportpassId: card.sportpassId }),
    ...(card.rankingId === undefined ? {} : { rankingId: card.rankingId }),
    ...(card.lifesignAtMs === undefined
      ? {}
      : { lifesignAt: card.lifesignAtMs === null ? null : new Date(card.lifesignAtMs) }),
    ...(card.clockOffsetMs === undefined ? {} : { clockOffsetMs: card.clockOffsetMs }),
  }
}

/** die Merkmale des neuen Stands, dazu die dauerhaften der Scheibe und `korrigiert` bei einer Korrektur */
function withSticky(
  flags: readonly string[],
  existing: readonly string[],
  corrected: boolean
): string[] {
  const out = new Set(flags)
  // gespeichert sind Texte: was nicht dauerhaft ist, fällt hier weg
  for (const flag of existing) if ((STICKY_FLAGS as readonly string[]).includes(flag)) out.add(flag)
  if (corrected) out.add(FLAG_CORRECTED)
  return [...out]
}

const EXISTING_SELECT = {
  id: true,
  flags: true,
  sourceId: true,
  scheibenId: true,
  cycle: true,
  origin: true,
  startedAt: true,
  lastSequence: true,
  currentRevision: { select: { id: true, number: true, contentHash: true } },
} satisfies Prisma.CardSelect

async function findCard(tx: Tx, input: RevisionInput, cycle: number) {
  if (input.cardId)
    return tx.card.findUniqueOrThrow({ where: { id: input.cardId }, select: EXISTING_SELECT })
  const { sourceId, scheibenId } = input.card
  if (sourceId === null || scheibenId === null) return null
  return tx.card.findUnique({
    where: { sourceId_scheibenId_cycle: { sourceId, scheibenId, cycle } },
    select: EXISTING_SELECT,
  })
}

/**
 * Den Stand einer Scheibe schreiben, in einer Transaktion:
 * - gesperrt über dasselbe Advisory-Lock wie die Ablage der Rohdaten (Quelle, ScheibenID), dann die Familie der
 *   Disziplin (`FOR SHARE`, gegen `setDisciplineFamily`) und die Zeile der Scheibe;
 * - ein Snapshot mit nicht größerer Folgenummer als der zuletzt geschriebene ändert nichts (SF-26);
 * - gleiche Schüsse: nur die Merkmale; Schüsse dazu oder Probe weg: dieselbe Revision; eine Korrektur der Wertung: eine
 *   neue, die vorige bleibt. Jede Änderung an den Schüssen rechnet die Projektion neu.
 */
export async function writeRevision(db: Db, input: RevisionInput): Promise<RevisionResult> {
  assertUniqueShots(input.shots)
  const hash = contentHash(input.shots)
  const sequence = input.sequence === undefined ? null : BigInt(input.sequence)
  const { sourceId, scheibenId } = input.card
  const cycle = input.card.cycle ?? 0

  return db.$transaction(async (tx) => {
    if (sourceId !== null && scheibenId !== null)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${sourceId}::int, ${scheibenId}::int)`
    const [discipline] = await tx.$queryRaw<{ familyId: number | null }[]>`
      SELECT "familyId" FROM "Discipline" WHERE id = ${input.card.disciplineId} FOR SHARE`
    if (!discipline) throw new RangeError(`Disziplin ${input.card.disciplineId} fehlt`)
    const features = cardFeatures(input.card, input.shots, discipline.familyId)

    const existing = await findCard(tx, input, cycle)
    if (!existing) {
      const { id: cardId } = await tx.card.create({
        data: {
          ...features,
          sourceId,
          scheibenId,
          cycle,
          origin: input.card.origin,
          ownerId: input.card.ownerId ?? null,
          ownerPending: input.card.ownerPending ?? false,
          lastSequence: sequence,
        },
        select: { id: true },
      })
      return newRevision(tx, cardId, 1, input, hash)
    }

    const cardId = existing.id
    await tx.$queryRaw`SELECT id FROM "Card" WHERE id = ${cardId} FOR UPDATE`
    const current = existing.currentRevision
    if (
      current &&
      sequence !== null &&
      existing.lastSequence !== null &&
      sequence <= existing.lastSequence
    )
      return {
        cardId,
        revisionId: current.id,
        number: current.number,
        change: "stale",
        added: 0,
        removed: 0,
      }

    const stored = current
      ? await tx.shot.findMany({ where: { revisionId: current.id }, orderBy: { seq: "asc" } })
      : []
    if (
      !input.cardId &&
      Math.abs(existing.startedAt.getTime() - input.card.startedAtMs) > RECURRENCE_MIN_MS
    ) {
      // dieselbe ScheibenID, aber ein Beginn Wochen entfernt: nur dieselbe Scheibe, wenn ein Schuss wiederkehrt
      const known = new Set(stored.map((row) => row.fingerprint))
      if (!input.shots.some((shot) => known.has(shotFingerprint(shot))))
        throw new CardIdentityConflictError(cardId, cycle)
    }
    const change =
      current && current.contentHash !== hash
        ? shotChange(stored.map(shotFromRow), input.shots)
        : null
    await tx.card.update({
      where: { id: cardId },
      data: {
        ...features,
        flags: withSticky(features.flags, existing.flags, change?.kind === "correction"),
        ...identityUpdate(existing, input.card, cycle),
        ...(sequence === null ? {} : { lastSequence: sequence }),
      },
    })

    if (!current) return newRevision(tx, cardId, 1, input, hash)
    if (!change)
      return {
        cardId,
        revisionId: current.id,
        number: current.number,
        change: "unchanged",
        added: 0,
        removed: 0,
      }
    if (change.kind === "same") {
      // derselbe Inhalt unter einer älteren Prüfsumme (etwa nachgerechnete Merkmale): keine neue Revision
      await tx.cardRevision.update({ where: { id: current.id }, data: { contentHash: hash } })
      return {
        cardId,
        revisionId: current.id,
        number: current.number,
        change: "unchanged",
        added: 0,
        removed: 0,
      }
    }
    if (change.kind !== "update") return newRevision(tx, cardId, current.number + 1, input, hash)

    const idOf = new Map(stored.map((row) => [shotKey(row), row.id]))
    await tx.shot.deleteMany({
      where: { id: { in: change.remove.map((shot) => idOf.get(shotKey(shot))!) } },
    })
    await tx.shot.createMany({ data: shotRows(current.id, cardId, change.add) })
    await tx.cardRevision.update({
      where: { id: current.id },
      data: {
        contentHash: hash,
        ...(input.rawSnapshotId ? { rawSnapshotId: input.rawSnapshotId } : {}),
      },
    })
    await saveProjection(tx, cardId, current.id, input.shots.map(toMetricShot))
    return {
      cardId,
      revisionId: current.id,
      number: current.number,
      change: "updated",
      added: change.add.length,
      removed: change.remove.length,
    }
  })
}

/**
 * Die Kennung ändert ein Stand nicht; nur eine Scheibe aus dem PDF bekommt beim ersten Snapshot ihre Rohdaten (Herkunft
 * dann „raw“). Eine andere Kennung als die vorhandene ist ein Fehler, kein stilles Umhängen.
 */
function identityUpdate(
  existing: {
    id: string
    sourceId: number | null
    scheibenId: number | null
    cycle: number
    origin: CardOrigin
  },
  card: CardInput,
  cycle: number
) {
  if (card.sourceId === null || card.scheibenId === null) return {}
  if (existing.sourceId === null)
    return { sourceId: card.sourceId, scheibenId: card.scheibenId, cycle, origin: "raw" as const }
  if (
    existing.sourceId !== card.sourceId ||
    existing.scheibenId !== card.scheibenId ||
    existing.cycle !== cycle
  )
    throw new RangeError(`Scheibe ${existing.id}: andere Quelle, ScheibenID oder anderer Zyklus`)
  return {}
}

async function newRevision(
  tx: Tx,
  cardId: string,
  number: number,
  input: RevisionInput,
  hash: string
): Promise<RevisionResult> {
  const revision = await tx.cardRevision.create({
    data: {
      cardId,
      number,
      contentHash: hash,
      rawSnapshotId: input.rawSnapshotId ?? null,
      reason: input.reason,
    },
    select: { id: true },
  })
  await tx.shot.createMany({ data: shotRows(revision.id, cardId, input.shots) })
  await tx.card.update({ where: { id: cardId }, data: { currentRevisionId: revision.id } })
  await saveProjection(tx, cardId, revision.id, input.shots.map(toMetricShot))
  return {
    cardId,
    revisionId: revision.id,
    number,
    change: "created",
    added: input.shots.length,
    removed: 0,
  }
}

/** die Projektion einer Revision speichern; sie hängt nur an den Schüssen */
async function saveProjection(
  tx: Tx,
  cardId: string,
  revisionId: bigint,
  shots: readonly MetricShot[]
): Promise<void> {
  // Merkmale der Scheibe gehen nicht ein (sie stehen in der Zeile der Scheibe); der Fachkern braucht nur die Schüsse
  const card: PeriodCard = { id: cardId, startedAtMs: 0, kind: "training", complete: true, shots }
  const projection = cardProjection(card)
  const data = {
    revisionId,
    version: projection.version,
    probeOnly: projection.probeOnly,
    suspicious: projection.suspicious,
    printedShots: projection.printedShots,
    values: projection.values,
    records: projection.records as unknown as Prisma.InputJsonObject,
    // die Lagen für die kleinen Scheiben der Übersichten, gelesen nur für die gezeigten Scheiben (`cardMarks` in reads)
    marks: cardMarks(shots) as unknown as Prisma.InputJsonArray,
    computedAt: new Date(),
  }
  await tx.cardProjection.upsert({
    where: { cardId },
    create: { cardId, ...data },
    update: data,
  })
}

/**
 * Projektionen neu rechnen, die veraltet sind (andere `version`, weil eine Kennzahl oder die Rechnung dahinter sich
 * geändert hat), zu einer früheren Revision gehören oder fehlen; je Scheibe in einer Transaktion unter der Sperre ihrer
 * Zeile, wie `writeRevision`, damit ein gleichzeitiger neuer Stand nicht von einer alten Projektion überschrieben wird.
 * In Stapeln; wahlweise nur eine Quelle. Gibt die Zahl der neu gerechneten zurück.
 */
export async function refreshProjections(
  db: Db,
  {
    limit = 200,
    sourceId,
    exclude = [],
    onFailure,
  }: {
    limit?: number
    sourceId?: number
    /** Scheiben, die hier nicht noch einmal versucht werden (sie sind in diesem Lauf schon gescheitert) */
    exclude?: readonly string[]
    /** mit: eine scheiternde Scheibe wird gemeldet und übergangen; ohne: der Fehler bricht ab */
    onFailure?: (cardId: string, error: unknown) => void
  } = {}
): Promise<number> {
  const version = projectionVersion()
  const onlySource =
    sourceId === undefined ? Prisma.empty : Prisma.sql`AND c."sourceId" = ${sourceId}`
  const notExcluded = exclude.length ? Prisma.sql`AND c.id <> ALL(${[...exclude]})` : Prisma.empty
  const stale = await db.$queryRaw<{ id: string }[]>`
    SELECT c.id FROM "Card" c LEFT JOIN "CardProjection" p ON p."cardId" = c.id
     WHERE c."currentRevisionId" IS NOT NULL
       AND (p."cardId" IS NULL OR p.version <> ${version} OR p."revisionId" <> c."currentRevisionId")
       ${onlySource}
       ${notExcluded}
     ORDER BY c.id
     LIMIT ${limit}`
  let done = 0
  for (const { id } of stale) {
    try {
      await db.$transaction(async (tx) => {
        const [card] = await tx.$queryRaw<{ currentRevisionId: bigint | null }[]>`
          SELECT "currentRevisionId" FROM "Card" WHERE id = ${id} FOR UPDATE`
        if (!card?.currentRevisionId) return
        const shots = await tx.shot.findMany({
          where: { revisionId: card.currentRevisionId },
          orderBy: { seq: "asc" },
        })
        await saveProjection(
          tx,
          id,
          card.currentRevisionId,
          shots.map(shotFromRow).map(toMetricShot)
        )
      })
      done++
    } catch (error) {
      if (!onFailure) throw error
      onFailure(id, error)
    }
  }
  return done
}

/** so viele Stapel höchstens: Schutz vor einer Schleife, falls eine Projektion veraltet bliebe */
const MAX_REFRESH_ROUNDS = 10_000

/**
 * Alle veralteten Projektionen nachrechnen, in Stapeln von `refreshProjections`, bis ein Stapel nicht mehr voll ist; eine
 * Scheibe, an der die Rechnung scheitert, wird gemeldet und in diesem Lauf nicht noch einmal versucht. Der
 * Server ruft das beim Start (`instrumentation-node.ts`), damit eine neue `projectionVersion` (neue Kennzahl, neue Form
 * der Projektion) ohne Zutun in den Übersichten ankommt. Gibt die Zahl der neu gerechneten zurück.
 */
export async function refreshStaleProjections(
  db: Db,
  {
    batch = 200,
    sourceId,
    onFailure = (cardId: string, error: unknown) =>
      console.error(`Projektion der Scheibe ${cardId} nicht gerechnet:`, error),
  }: {
    batch?: number
    sourceId?: number
    /** eine Scheibe, an der die Rechnung scheitert: gemeldet, übergangen, beim nächsten Start wieder versucht */
    onFailure?: (cardId: string, error: unknown) => void
  } = {}
): Promise<number> {
  // eine scheiternde Scheibe stünde in jedem Stapel wieder vorn (nach Id) und hielte alle nach ihr auf
  const failed = new Set<string>()
  let total = 0
  for (let round = 0; round < MAX_REFRESH_ROUNDS; round++) {
    let failures = 0
    const done = await refreshProjections(db, {
      limit: batch,
      sourceId,
      exclude: [...failed],
      onFailure: (cardId, error) => {
        failed.add(cardId)
        failures++
        onFailure(cardId, error)
      },
    })
    total += done
    if (done + failures < batch) break
  }
  return total
}

/**
 * Alle Scheiben mit veralteter Zuordnung ihrer Disziplin nachrechnen, in Stapeln von `refreshDisciplineCards`, wie
 * `refreshStaleProjections`. Der Server ruft das nach dem Speichern einer Zuordnung, beim Start und stündlich: Ein Stand,
 * der nach einem Lauf noch mit der alten Version geschrieben wurde, wartet so höchstens eine Stunde.
 */
export async function refreshStaleDisciplineCards(
  db: Db,
  {
    batch = 200,
    sourceId,
    onFailure = (cardId: string, error: unknown) =>
      console.error(
        `Scheibe ${cardId} nicht nachgerechnet:`,
        error instanceof Error ? error.name : "unbekannter Fehler"
      ),
  }: {
    batch?: number
    sourceId?: number
    onFailure?: (cardId: string, error: unknown) => void
  } = {}
): Promise<number> {
  const failed = new Set<string>()
  let total = 0
  for (let round = 0; round < MAX_REFRESH_ROUNDS; round++) {
    let failures = 0
    const done = await refreshDisciplineCards(db, {
      limit: batch,
      sourceId,
      exclude: [...failed],
      onFailure: (cardId, error) => {
        failed.add(cardId)
        failures++
        onFailure(cardId, error)
      },
    })
    total += done
    if (done + failures < batch) break
  }
  return total
}

/** ein gespeicherter Schuss als Eingabe */
export function shotFromRow(row: {
  seq: number
  stellung: number
  treffer: number
  series: number | null
  xUm: number | null
  yUm: number | null
  ring: number | null
  decimalTenths: number | null
  distanceTenthsUm: number | null
  innerTen: boolean
  displayMode: number | null
  firedAt: Date | null
  flags: string[]
}): ShotInput {
  return {
    seq: row.seq,
    stellung: row.stellung,
    treffer: row.treffer,
    series: row.series,
    xUm: row.xUm,
    yUm: row.yUm,
    ring: row.ring,
    decimalTenths: row.decimalTenths,
    distanceTenthsUm: row.distanceTenthsUm,
    innerTen: row.innerTen,
    displayMode: row.displayMode,
    firedAtMs: row.firedAt === null ? null : row.firedAt.getTime(),
    flags: row.flags,
  }
}

/**
 * Familie einer Disziplin umhängen (Admin): Die Scheiben führen die Familie für den Index der Übersichten mit, deshalb
 * ziehen sie in derselben Transaktion mit.
 */
export async function setDisciplineFamily(
  db: Db,
  disciplineId: number,
  familyId: number | null
): Promise<number> {
  return db.$transaction((tx) => moveDisciplineFamily(tx, disciplineId, familyId))
}

/** die Familie einer Disziplin und ihrer Scheiben in einer laufenden Transaktion umhängen (Admin) */
export async function moveDisciplineFamily(
  tx: Tx,
  disciplineId: number,
  familyId: number | null
): Promise<number> {
  await tx.discipline.update({ where: { id: disciplineId }, data: { familyId } })
  const { count } = await tx.card.updateMany({ where: { disciplineId }, data: { familyId } })
  return count
}

/**
 * Scheiben, deren Merkmale mit einer älteren Zuordnung ihrer Disziplin gerechnet sind (`Card.disciplineVersion`), aus
 * den gespeicherten Schüssen neu rechnen: Gegenprobe je Schuss, Merkmale der Disziplin, `complete`, Projektion. Je
 * Scheibe unter der Sperre ihrer Zeile; Rohdaten werden nicht neu gedeutet. Gibt die Zahl der neu gerechneten zurück.
 */
export async function refreshDisciplineCards(
  db: Db,
  {
    limit = 200,
    sourceId,
    exclude = [],
    onFailure,
  }: {
    limit?: number
    sourceId?: number
    /** Scheiben, die hier nicht noch einmal versucht werden (sie sind in diesem Lauf schon gescheitert) */
    exclude?: readonly string[]
    /** mit: eine scheiternde Scheibe wird gemeldet und übergangen; ohne: der Fehler bricht ab */
    onFailure?: (cardId: string, error: unknown) => void
  } = {}
): Promise<number> {
  const onlySource =
    sourceId === undefined ? Prisma.empty : Prisma.sql`AND c."sourceId" = ${sourceId}`
  const notExcluded = exclude.length ? Prisma.sql`AND c.id <> ALL(${[...exclude]})` : Prisma.empty
  const stale = await db.$queryRaw<{ id: string }[]>`
    SELECT c.id FROM "Card" c JOIN "Discipline" d ON d.id = c."disciplineId"
     WHERE c."disciplineVersion" <> d.version
       ${onlySource}
       ${notExcluded}
     ORDER BY c.id
     LIMIT ${limit}`
  let done = 0
  for (const { id } of stale) {
    try {
      await db.$transaction((tx) => recomputeDisciplineCard(tx, id))
      done++
    } catch (error) {
      if (!onFailure) throw error
      onFailure(id, error)
    }
  }
  return done
}

/** eine Scheibe mit der aktuellen Zuordnung ihrer Disziplin neu rechnen (`refreshDisciplineCards`) */
async function recomputeDisciplineCard(tx: Tx, cardId: string): Promise<void> {
  // dieselbe Sperre wie `writeRevision` (Quelle, ScheibenID), vor der Zeile: Ein Stand, der gleichzeitig geschrieben
  // wird, liest die Prüfsumme danach und hält die nachgerechnete nicht für eine Korrektur
  const [key] = await tx.$queryRaw<{ sourceId: number | null; scheibenId: number | null }[]>`
    SELECT "sourceId", "scheibenId" FROM "Card" WHERE id = ${cardId}`
  if (key?.sourceId != null && key.scheibenId != null)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${key.sourceId}::int, ${key.scheibenId}::int)`
  const [row] = await tx.$queryRaw<
    {
      currentRevisionId: bigint | null
      state: CardState
      flags: string[]
      targetId: string | null
      plannedShots: number | null
      meytonId: number
      version: number
    }[]
  >`
    SELECT c."currentRevisionId", c.state, c.flags, d."targetId", d."plannedShots", d."meytonId", d.version
      FROM "Card" c JOIN "Discipline" d ON d.id = c."disciplineId"
     WHERE c.id = ${cardId}
       FOR UPDATE OF c`
  if (!row) return
  const revisionId = row.currentRevisionId
  if (!revisionId) {
    await tx.card.update({ where: { id: cardId }, data: { disciplineVersion: row.version } })
    return
  }
  const targetId =
    row.targetId !== null && Object.hasOwn(TARGETS, row.targetId)
      ? (row.targetId as TargetId)
      : null
  const rows = await tx.shot.findMany({ where: { revisionId }, orderBy: { seq: "asc" } })
  const shots = rows.map(shotFromRow)
  // die Merkmale je Schuss neu aus den Werten; was nicht aus den Werten kommt, bleibt
  const checkables = shots.map((shot) => ({
    ...shot,
    flags: baseShotFlags({ ...shot, overTarget: shot.flags.includes(FLAG_OVER_TARGET) }),
  }))
  const { suspicious, targetMismatch } = verifyShots(targetId, checkables)
  const next = shots.map((shot, i) => ({
    ...shot,
    flags: [
      ...shot.flags.filter((flag) => !DERIVED_SHOT_FLAGS.includes(flag)),
      ...checkables[i].flags,
      ...(suspicious[i] ? [FLAG_SUSPICIOUS] : []),
    ],
  }))
  const sameFlags = (a: readonly string[], b: readonly string[]) =>
    [...a].sort().join("|") === [...b].sort().join("|")
  const changed = next.flatMap((shot, i) => (sameFlags(shot.flags, shots[i].flags) ? [] : [i]))
  for (const i of changed)
    await tx.shot.update({ where: { id: rows[i].id }, data: { flags: [...next[i].flags] } })
  if (changed.length)
    await tx.cardRevision.update({
      where: { id: revisionId },
      data: { contentHash: contentHash(next) },
    })

  const matchShots = shots.filter((shot) => shot.stellung !== 0).length
  const flags = [
    ...mappingFlags({
      sighterShots: shots.length - matchShots,
      matchShots,
      plannedShots: plannedShotsOf(row.meytonId, row.plannedShots),
      targetId,
      targetMismatch,
    }),
    ...row.flags.filter((flag) => !(MAPPING_FLAGS as readonly string[]).includes(flag)),
  ]
  await tx.card.update({
    where: { id: cardId },
    data: { flags, complete: isComplete(row.state, flags), disciplineVersion: row.version },
  })
  await saveProjection(tx, cardId, revisionId, next.map(toMetricShot))
}

/**
 * Die gewählte Wertung einer Scheibe setzen (Seite der Scheibe): nur die eigene, nicht gelöschte; false, wenn es sie für
 * den Schützen nicht gibt
 */
export async function chooseCardScoring(
  db: Db,
  query: { cardId: string; ownerId: string; scoring: Scoring }
): Promise<boolean> {
  const { count } = await db.card.updateMany({
    where: { id: query.cardId, ownerId: query.ownerId, ...VISIBLE_CARD },
    data: { scoringChoice: query.scoring },
  })
  return count === 1
}

/**
 * Die Wertung einer Familie für die Schnitte des Schützen speichern: nur eine Familie, in der er eigene, nicht gelöschte
 * Scheiben hat; false sonst
 */
export async function saveFamilyScoring(
  db: Db,
  query: { familySlug: string; ownerId: string; scoring: Scoring }
): Promise<boolean> {
  const family = await db.family.findFirst({
    where: { slug: query.familySlug, cards: { some: { ownerId: query.ownerId, ...VISIBLE_CARD } } },
    select: { id: true },
  })
  if (!family) return false
  await db.familyScoring.upsert({
    where: { userId_familyId: { userId: query.ownerId, familyId: family.id } },
    create: { userId: query.ownerId, familyId: family.id, scoring: query.scoring },
    update: { scoring: query.scoring },
  })
  return true
}

/**
 * Die gewählte Art einer Scheibe setzen (Seite der Scheibe): nur die eigene, nicht gelöschte; eine Scheibe nur aus Probe
 * ist immer Training. `missing`, wenn es sie für den Schützen nicht gibt
 */
export async function chooseCardKind(
  db: Db,
  query: { cardId: string; ownerId: string; kind: CardKind }
): Promise<"saved" | "missing" | "probeOnly"> {
  const own = { id: query.cardId, ownerId: query.ownerId, ...VISIBLE_CARD }
  // Prüfen und Schreiben in einem Befehl; erst wenn nichts geschrieben wurde, nachsehen, warum
  const { count } = await db.card.updateMany({
    where: { ...own, NOT: { projection: { is: { probeOnly: true } } } },
    data: { kindChoice: query.kind },
  })
  if (count === 1) return "saved"
  return (await db.card.count({ where: own })) ? "probeOnly" : "missing"
}
