// Scheiben mit Revisionen und Projektion (ADR-031). Eine Revision ist ein Satz Schüsse; gleicher Inhalt ergibt keine
// neue. Mit jeder neuen Revision entsteht die Projektion neu (shot-core `cardProjection`), damit Liste, Fortschritt
// und Start ohne Schüsse auskommen.

import { createHash } from "node:crypto"

import { canonicalize } from "@vereinsheim/ingest-contract/canonical"
import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { cardProjection, projectionVersion } from "@vereinsheim/shot-core/projection"

import type { CardKind, CardOrigin, CardState, Prisma, Scoring } from "@/generated/prisma/client"

import type { Db } from "../db"

type Tx = Prisma.TransactionClient

/** ein Schuss, wie der Adapter (SP-1.6) ihn aus den Rohdaten oder dem Ausdruck liest */
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
  /** nur beim Anlegen; die Zuordnung ändert eine Revision nicht */
  ownerId?: string | null
  sportpassId?: bigint | null
  disciplineId: number
  stand: string | null
  startedAtMs: number
  endedAtMs: number | null
  kind: CardKind
  state: CardState
  complete: boolean
  official: Scoring | null
  flags: readonly string[]
  origin: CardOrigin
}

export interface RevisionInput {
  /** die Scheibe; ohne `cardId` über Quelle und ScheibenID gefunden oder neu angelegt */
  card: CardInput
  cardId?: string
  shots: readonly ShotInput[]
  reason: string
  rawSnapshotId?: bigint | null
}

export interface RevisionResult {
  cardId: string
  revisionId: bigint
  number: number
  /** false: keine neue Revision (dieselben Schüsse oder nur neue dazu); die Merkmale der Scheibe sind aktualisiert */
  created: boolean
  /** an die aktuelle Revision angehängte Schüsse: ein offener Durchgang, der wächst (SF-03) */
  appended: number
}

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

const shotKey = (shot: ShotInput) => `${shot.stellung}:${shot.treffer}`
const shotContent = (shot: ShotInput) => canonicalize({ ...shot, flags: [...shot.flags].sort() })

/** Inhalt einer Revision: die Schüsse nach Stellung und Treffer, unabhängig von der Folge der Eingabe */
function contentHash(shots: readonly ShotInput[]): string {
  const sorted = [...shots].sort((a, b) => a.stellung - b.stellung || a.treffer - b.treffer)
  return sha256(`[${sorted.map(shotContent).join(",")}]`)
}

/**
 * Die neuen Schüsse, wenn `next` alle bisherigen unverändert enthält und nur Schüsse dazukommen (ein offener Durchgang
 * nach jedem Schuss); sonst null: Ein geänderter oder fehlender Schuss ist eine Korrektur und braucht eine neue Revision.
 */
export function appendedShots(
  current: readonly ShotInput[],
  next: readonly ShotInput[]
): ShotInput[] | null {
  const nextByKey = new Map(next.map((shot) => [shotKey(shot), shot]))
  if (nextByKey.size !== next.length || next.length <= current.length) return null
  for (const shot of current) {
    const same = nextByKey.get(shotKey(shot))
    if (!same || shotContent(same) !== shotContent(shot)) return null
  }
  const known = new Set(current.map(shotKey))
  return next.filter((shot) => !known.has(shotKey(shot)))
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

function cardColumns(card: CardInput, familyId: number | null) {
  return {
    sourceId: card.sourceId,
    scheibenId: card.scheibenId,
    sportpassId: card.sportpassId ?? null,
    disciplineId: card.disciplineId,
    familyId,
    stand: card.stand,
    startedAt: new Date(card.startedAtMs),
    endedAt: card.endedAtMs === null ? null : new Date(card.endedAtMs),
    kind: card.kind,
    state: card.state,
    complete: card.complete,
    official: card.official,
    flags: [...card.flags],
    origin: card.origin,
  }
}

async function findCard(tx: Tx, input: RevisionInput) {
  if (input.cardId) return tx.card.findUnique({ where: { id: input.cardId }, select: { id: true } })
  const { sourceId, scheibenId } = input.card
  if (sourceId === null || scheibenId === null) return null
  return tx.card.findUnique({
    where: { sourceId_scheibenId: { sourceId, scheibenId } },
    select: { id: true },
  })
}

/**
 * Den Stand einer Scheibe schreiben: Merkmale aktualisieren; kommen nur Schüsse dazu, die aktuelle Revision ergänzen,
 * sonst bei anderen Schüssen eine neue Revision anlegen; jeweils mit neuer Projektion. Eine Transaktion; die Zeile der
 * Scheibe ist gesperrt, damit zwei Schreiber nicht dieselbe Nummer vergeben.
 */
export async function writeRevision(db: Db, input: RevisionInput): Promise<RevisionResult> {
  const hash = contentHash(input.shots)
  return db.$transaction(async (tx) => {
    const { familyId } = await tx.discipline.findUniqueOrThrow({
      where: { id: input.card.disciplineId },
      select: { familyId: true },
    })
    const columns = cardColumns(input.card, familyId)
    const existing = await findCard(tx, input)
    const cardId = existing
      ? (await tx.card.update({ where: { id: existing.id }, data: columns, select: { id: true } }))
          .id
      : (
          await tx.card.create({
            data: { ...columns, ownerId: input.card.ownerId ?? null },
            select: { id: true },
          })
        ).id
    await tx.$queryRaw`SELECT id FROM "Card" WHERE id = ${cardId} FOR UPDATE`

    const { currentRevision } = await tx.card.findUniqueOrThrow({
      where: { id: cardId },
      select: { currentRevision: { select: { id: true, number: true, contentHash: true } } },
    })
    if (currentRevision?.contentHash === hash)
      return {
        cardId,
        revisionId: currentRevision.id,
        number: currentRevision.number,
        created: false,
        appended: 0,
      }
    if (currentRevision) {
      const stored = await tx.shot.findMany({ where: { revisionId: currentRevision.id } })
      const added = appendedShots(stored.map(shotFromRow), input.shots)
      if (added) {
        await tx.shot.createMany({ data: shotRows(currentRevision.id, cardId, added) })
        await tx.cardRevision.update({
          where: { id: currentRevision.id },
          data: {
            contentHash: hash,
            ...(input.rawSnapshotId ? { rawSnapshotId: input.rawSnapshotId } : {}),
          },
        })
        await saveProjection(tx, cardId, currentRevision.id, input.shots.map(toMetricShot))
        return {
          cardId,
          revisionId: currentRevision.id,
          number: currentRevision.number,
          created: false,
          appended: added.length,
        }
      }
    }

    const number = (currentRevision?.number ?? 0) + 1
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
    return { cardId, revisionId: revision.id, number, created: true, appended: 0 }
  })
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
    computedAt: new Date(),
  }
  await tx.cardProjection.upsert({
    where: { cardId },
    create: { cardId, ...data },
    update: data,
  })
}

/**
 * Projektionen neu rechnen, deren Version veraltet ist (eine Kennzahl hat eine neue `version`) oder die fehlen; in
 * Stapeln, damit ein Lauf nach einem Update die Datenbank nicht lange sperrt. Gibt die Zahl der neu gerechneten zurück.
 */
export async function refreshProjections(db: Db, { limit = 200 } = {}): Promise<number> {
  const version = projectionVersion()
  const stale = await db.card.findMany({
    where: {
      currentRevisionId: { not: null },
      OR: [{ projection: null }, { projection: { version: { not: version } } }],
    },
    take: limit,
    select: { id: true, currentRevisionId: true },
  })
  for (const { id, currentRevisionId } of stale) {
    const shots = await db.shot.findMany({
      where: { revisionId: currentRevisionId! },
      orderBy: { seq: "asc" },
    })
    await db.$transaction((tx) =>
      saveProjection(tx, id, currentRevisionId!, shots.map(shotFromRow).map(toMetricShot))
    )
  }
  return stale.length
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
  return db.$transaction(async (tx) => {
    await tx.discipline.update({ where: { id: disciplineId }, data: { familyId } })
    const { count } = await tx.card.updateMany({ where: { disciplineId }, data: { familyId } })
    return count
  })
}
