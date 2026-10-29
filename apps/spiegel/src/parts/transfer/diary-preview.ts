// Vorschau mit den Daten des Users (nur Dev-Datenbank): ein Konto aus Treffsicher als Scheiben „aus Treffsicher“ und
// Einträge im Tagebuch, mit Schlüsseln `treffsicher:preview-` (Scheiben) und `preview:` (Tagebuch). Nahtstelle, weil
// sie beide Teile schreibt; die Zuordnungen stehen in `src/lib/transfer/treffsicher-card.ts` und
// `src/diary/transfer/treffsicher-entry.ts`, damit die Übernahme (Stufe 3) sie wiederverwendet. Ein Lauf ist eine
// Transaktion; `dryRun` rechnet alles darin und rollt zurück.

import { z } from "zod"

import { plannedShotsOf } from "@vereinsheim/shot-core/discipline"

import { countedCards } from "@/diary/analysis/form"
import {
  entryFromSession,
  executionsOnCard,
  type TreffsicherSessionForEntry,
} from "@/diary/transfer/treffsicher-entry"
import {
  deletePreviewDiary,
  releaseImportedLinks,
  replaceExecutions,
  setImportedLinks,
  upsertImportedEntry,
} from "@/diary/transfer/write"
import type { Db } from "@/lib/db"
import { requestSiteId } from "@/lib/card-requests/queries"
import { writeEnteredCardIn } from "@/lib/db/entered"
import { purgeCards } from "@/lib/db/purge"
import { resultCards, resultCardSeries } from "@/lib/results-read"
import {
  disciplineForShots,
  familyForName,
  treffsicherDetails,
  type TreffsicherSessionForCard,
} from "@/lib/transfer/treffsicher-card"

/** Schlüssel der Vorschau-Scheiben; `IMPORT_KEY` nimmt nur `treffsicher:…` */
export const PREVIEW_CARD_PREFIX = "treffsicher:preview-"

const scale = z.number().int().min(0).max(100)
const seven = {
  fitness: scale,
  nutrition: scale,
  technique: scale,
  tactics: scale,
  mentalStrength: scale,
  environment: scale,
  equipment: scale,
}
const text = z.string().nullable()

/** die Zeile JSON aus `tools/transfer/treffsicher-sessions.sql` */
export const treffsicherExport = z.object({
  sessions: z.array(
    z.object({
      id: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
      date: z.string().datetime({ offset: true }),
      type: z.enum(["TRAINING", "WETTKAMPF", "TROCKENTRAINING", "MENTAL"]),
      location: text,
      trainingGoal: text,
      isFavourite: z.boolean(),
      discipline: z
        .object({
          name: z.string(),
          scoringType: z.enum(["WHOLE", "TENTH"]),
          shotsPerSeries: z.number().int().min(1),
        })
        .nullable(),
      hitLocation: z
        .object({
          xMm: z.number(),
          yMm: z.number(),
          horizontal: z.enum(["LEFT", "RIGHT"]),
          vertical: z.enum(["HIGH", "LOW"]),
        })
        .nullable(),
      wellbeing: z
        .object({ sleep: scale, energy: scale, stress: scale, motivation: scale })
        .nullable(),
      prognosis: z
        .object({
          ...seven,
          expectedScore: z.number().nullable(),
          expectedCleanShots: z.number().int().nullable(),
          performanceGoal: text,
        })
        .nullable(),
      feedback: z
        .object({
          ...seven,
          explanation: text,
          goalAchieved: z.boolean().nullable(),
          goalAchievedNote: text,
          progress: text,
          fiveBestShots: text,
          wentWell: text,
          insights: text,
        })
        .nullable(),
      reflection: z
        .object({
          observations: text,
          insight: text,
          learningQuestion: text,
          routineDeviation: text,
        })
        .nullable(),
      series: z.array(
        z.object({
          position: z.number().int(),
          isPractice: z.boolean(),
          scoreTotal: z.number().nullable(),
          shots: z.array(z.string()).nullable(),
          executionQuality: z.number().int().min(1).max(5).nullable(),
        })
      ),
    })
  ),
})
export type TreffsicherExport = z.infer<typeof treffsicherExport>

/** der Bericht eines Laufs, nur Zahlen (und Namen von Disziplinen, ohne Personenbezug) */
export interface PreviewReport {
  sessions: number
  entries: { created: number; updated: number; deleted: number }
  cards: {
    created: Record<"shots" | "series", number>
    replaced: Record<"shots" | "series", number>
    unchanged: Record<"shots" | "series", number>
    removed: number
  }
  withoutCard: {
    eveningHasCard: number
    noResult: number
    noDiscipline: number
    noFamily: number
    notShooting: number
  }
  executions: {
    placed: number
    series: number
    skipped: { twoSessions: number; severalCards: number; noCard: number; otherSeries: number }
    practiceSkipped: number
  }
  unmatchedDisciplines: Record<string, number>
  goals: number
  routines: number
  diaryEnabled: boolean
}

const emptyReport = (): PreviewReport => ({
  sessions: 0,
  entries: { created: 0, updated: 0, deleted: 0 },
  cards: {
    created: { shots: 0, series: 0 },
    replaced: { shots: 0, series: 0 },
    unchanged: { shots: 0, series: 0 },
    removed: 0,
  },
  withoutCard: { eveningHasCard: 0, noResult: 0, noDiscipline: 0, noFamily: 0, notShooting: 0 },
  executions: {
    placed: 0,
    series: 0,
    skipped: { twoSessions: 0, severalCards: 0, noCard: 0, otherSeries: 0 },
    practiceSkipped: 0,
  },
  unmatchedDisciplines: {},
  goals: 0,
  routines: 0,
  diaryEnabled: false,
})

/** wirft `dryRun` am Ende der Transaktion, damit nichts bleibt */
class DryRun extends Error {}

/** so lange darf ein Lauf in einer Transaktion dauern */
const TIMEOUT_MS = 300_000

type Session = TreffsicherExport["sessions"][number]
const forCard = (s: Session, dateMs: number): TreffsicherSessionForCard => ({ ...s, dateMs })
const forEntry = (s: Session, dateMs: number): TreffsicherSessionForEntry => ({ ...s, dateMs })
const evening = (day: string, familyId: number) => `${day}|${familyId}`

/**
 * Ein Konto aus Treffsicher als Vorschau in Spiegel: je Einheit ein Eintrag (über `preview:<Einheit>` ersetzt), eine
 * Scheibe „aus Treffsicher“ nur, wenn der Abend in der Familie noch keine hat, die Ausführung auf die eine Scheibe des
 * Eintrags. Vorschau-Scheiben, deren Abend inzwischen eine echte Scheibe hat, gehen. Ziele und Abläufe schreibt es nicht.
 */
export async function runPreview(
  db: Db,
  input: {
    export: TreffsicherExport
    toUserId: string
    timeZone: string
    dryRun: boolean
    /** die Anlage der Disziplinen; ohne die erste (`requestSiteId`), Tests geben ihre eigene */
    siteId?: number
  }
): Promise<PreviewReport> {
  const report = emptyReport()
  const { toUserId: ownerId, timeZone } = input
  const sessions = input.export.sessions.map((s) => ({ s, dateMs: Date.parse(s.date) }))
  report.sessions = sessions.length

  const siteId = input.siteId ?? (await requestSiteId(db))
  const [families, disciplines, used, previewCards, visible, settings] = await Promise.all([
    db.family.findMany({ select: { id: true, name: true } }),
    siteId === null
      ? []
      : db.discipline.findMany({
          where: {
            siteId,
            confirmedAt: { not: null },
            ignoredAt: null,
            targetId: { not: null },
            familyId: { not: null },
          },
          select: { id: true, familyId: true, meytonId: true, plannedShots: true },
        }),
    db.card.groupBy({
      by: ["disciplineId"],
      where: { ownerId, deletedAt: null },
      _count: { _all: true },
    }),
    db.card.findMany({
      where: { ownerId, importKey: { startsWith: PREVIEW_CARD_PREFIX } },
      select: { id: true, importKey: true, deletedAt: true },
    }),
    resultCards(db, { ownerId, timeZone }),
    db.diarySettings.findUnique({ where: { userId: ownerId }, select: { enabled: true } }),
  ])
  report.diaryEnabled = settings?.enabled ?? false
  const ownCards = new Map(used.map((row) => [row.disciplineId, row._count._all]))
  const candidates = (familyId: number) =>
    disciplines
      .filter((d) => d.familyId === familyId)
      .map((d) => ({
        id: d.id,
        plannedShots: plannedShotsOf(d.meytonId, d.plannedShots),
        ownCards: ownCards.get(d.id) ?? 0,
      }))
  const previewIds = new Set(previewCards.map((card) => card.id))
  const byEvening = new Map<string, typeof visible>()
  for (const card of visible)
    if (!previewIds.has(card.id) && card.family) {
      const key = evening(card.day, card.family.id)
      byEvening.set(key, [...(byEvening.get(key) ?? []), card])
    }
  // Einheiten je Abend und Familie: bei zweien bekommt keine eine Scheibe von selbst
  const perEvening = new Map<string, number>()
  const familyOf = new Map<string, number | null>()
  for (const { s, dateMs } of sessions) {
    const familyId = s.discipline ? familyForName(s.discipline.name, families) : null
    familyOf.set(s.id, familyId)
    if (s.discipline && familyId === null)
      report.unmatchedDisciplines[s.discipline.name] =
        (report.unmatchedDisciplines[s.discipline.name] ?? 0) + 1
    if (familyId !== null) {
      const key = evening(
        entryFromSession(forEntry(s, dateMs), { familyId, withCard: false, timeZone }).day,
        familyId
      )
      perEvening.set(key, (perEvening.get(key) ?? 0) + 1)
    }
  }
  // die Serien einer vorhandenen Scheibe, außerhalb der Transaktion gelesen (sie ändert sie nicht)
  const seriesOf = async (cardId: string) => (await resultCardSeries(db, { ownerId, cardId })) ?? []

  try {
    await db.$transaction(
      async (tx) => {
        // eine Vorschau-Scheibe im Papierkorb ginge nicht mehr zu ersetzen: erst weg, dann neu
        const trashed = previewCards.filter((card) => card.deletedAt).map((card) => card.id)
        if (trashed.length) {
          await releaseImportedLinks(tx, trashed)
          await purgeCards(tx, trashed, { lock: true })
        }
        const kept = new Set<string>()
        for (const { s, dateMs } of sessions) {
          const familyId = familyOf.get(s.id) ?? null
          const shooting = s.type === "TRAINING" || s.type === "WETTKAMPF"
          const base = entryFromSession(forEntry(s, dateMs), {
            familyId,
            withCard: false,
            timeZone,
          })
          const key = familyId === null ? null : evening(base.day, familyId)
          const existing = key ? (byEvening.get(key) ?? []) : []
          let created: { id: string; series: { series: number }[] } | null = null
          if (!shooting) report.withoutCard.notShooting += 1
          else if (familyId === null) report.withoutCard.noFamily += 1
          else if (existing.length) report.withoutCard.eveningHasCard += 1
          else {
            const card = treffsicherDetails(forCard(s, dateMs))
            const disciplineId = card && disciplineForShots(candidates(familyId), card.shots)
            if (!card) report.withoutCard.noResult += 1
            else if (!disciplineId) report.withoutCard.noDiscipline += 1
            else {
              const kind = s.type === "WETTKAMPF" ? "competition" : "training"
              const written = await writeEnteredCardIn(tx, {
                ownerId,
                origin: "treffsicher",
                disciplineId,
                startedAtMs: dateMs,
                kind,
                kindChoice: kind,
                place: s.location,
                importKey: `${PREVIEW_CARD_PREFIX}${s.id}`,
                details: card.details,
                reason: "Vorschau aus Treffsicher",
              })
              if (written.kind !== "saved")
                throw new Error(`Vorschau-Scheibe nicht geschrieben: ${written.kind}`)
              const change =
                written.change === "created"
                  ? "created"
                  : written.change === "revised"
                    ? "replaced"
                    : "unchanged"
              report.cards[change][card.level] += 1
              kept.add(written.cardId)
              created = {
                id: written.cardId,
                series: (card.details.series ?? []).map((sum) => ({ series: sum.series })),
              }
            }
          }
          const entry = entryFromSession(forEntry(s, dateMs), {
            familyId,
            withCard: existing.length > 0 || created !== null,
            timeZone,
          })
          const { id: entryId, created: isNew } = await upsertImportedEntry(tx, ownerId, entry)
          report.entries[isNew ? "created" : "updated"] += 1
          if (created) await setImportedLinks(tx, entryId, [created.id])

          report.executions.practiceSkipped += s.series.filter(
            (x) => x.isPractice && x.executionQuality !== null
          ).length
          const rated = s.series.some((x) => !x.isPractice && x.executionQuality !== null)
          let rows: { cardId: string; series: number; value: number }[] = []
          if (rated) {
            const counted = countedCards(existing)
            const target =
              created ??
              (key && (perEvening.get(key) ?? 0) > 1
                ? "twoSessions"
                : counted.length === 1
                  ? { id: counted[0].id, series: await seriesOf(counted[0].id) }
                  : counted.length > 1
                    ? "severalCards"
                    : "noCard")
            if (typeof target === "string") report.executions.skipped[target] += 1
            else {
              const placed = executionsOnCard(s, target.series)
              if (placed === null) report.executions.skipped.otherSeries += 1
              else {
                rows = placed.map((row) => ({ cardId: target.id, ...row }))
                report.executions.placed += 1
                report.executions.series += rows.length
              }
            }
          }
          await replaceExecutions(tx, entryId, rows)
        }
        const stale = previewCards
          .filter((card) => !card.deletedAt && !kept.has(card.id))
          .map((card) => card.id)
        if (stale.length) {
          await releaseImportedLinks(tx, stale)
          await purgeCards(tx, stale, { lock: true })
        }
        report.cards.removed = trashed.length + stale.length
        if (input.dryRun) throw new DryRun()
      },
      { timeout: TIMEOUT_MS, maxWait: 10_000 }
    )
  } catch (error) {
    if (!(error instanceof DryRun)) throw error
  }
  return report
}

/** alles der Vorschau eines Kontos löschen: Vorschau-Scheiben, Einträge, Ziele und Abläufe mit `preview:` */
export async function deletePreview(db: Db, toUserId: string): Promise<PreviewReport> {
  const report = emptyReport()
  await db.$transaction(
    async (tx) => {
      const cards = await tx.card.findMany({
        where: { ownerId: toUserId, importKey: { startsWith: PREVIEW_CARD_PREFIX } },
        select: { id: true },
      })
      await releaseImportedLinks(
        tx,
        cards.map((card) => card.id)
      )
      if (cards.length)
        await purgeCards(
          tx,
          cards.map((card) => card.id),
          { lock: true }
        )
      report.cards.removed = cards.length
      const deleted = await deletePreviewDiary(tx, toUserId)
      report.entries.deleted = deleted.entries
      report.goals = deleted.goals
      report.routines = deleted.routines
    },
    { timeout: TIMEOUT_MS, maxWait: 10_000 }
  )
  return report
}
