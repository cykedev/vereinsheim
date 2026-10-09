// Modell von Start (Plan N5, `vault/spiegel/spiegel-navigation.md`, Entscheidung 1): der letzte Abend je Familie im
// Formband, neue Rekorde und die Form der letzten 90 Tage. Reine Funktion; alle Zahlen aus dem Fachkern. Einheit ist
// die Scheibe (Regel „Über viele Scheiben“): Der Streifen zeigt Scheiben, das Band ist das des Fortschritts, seine
// Mitte der Schnitt der fünf Scheiben vor dem Abend (Entscheidung 13).

import {
  cardValues,
  periodRecords,
  periodTrend,
  type PeriodComparison,
} from "@vereinsheim/shot-core/analysis"
import {
  computeMetric,
  inScoring,
  metricByKey,
  type MetricShot,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"

import { cardListModel, eveningDay, type ListInputCard, type ListRow } from "../list/evenings"
import { progressRoute } from "../nav/navigate"
import { DEFAULT_LIST, type ProgressRoute } from "../nav/routes"
import type { NamedPeriod } from "../period/calendar"
import { byStart, periodModel } from "../period/model"
import { recordRows } from "../period/PeriodInsights"
import { initialPeriodState } from "../period/state"
import { matchShots } from "../shots"

/** so viele Scheiben vor dem Abend ergeben den Schnitt (Entscheidung 13) */
const BEFORE = 5
/** so viele Scheiben zeigt der Streifen */
const STRIP = 20

export type RecordRow = ReturnType<typeof recordRows>[number]

/** ein Block auf Start: der letzte Abend einer Familie (D2–D6) */
export interface EveningBlock {
  family: string
  /** ISO-Tag des Abends */
  day: string
  /** die Scheiben des Abends wie in der Liste (Ergebnis in beiden Wertungen, Ø, Abstand) */
  rows: ListRow[]
  /** Wertungsschüsse des Abends, nur Probe wie Wertung */
  shots: number
  /** Ø je Schuss über alle Wertungsschüsse des Abends, in der Wertung */
  mean: number | null
  /** Schnitt der bis zu fünf Scheiben vor dem Abend; null ohne Scheiben davor */
  average: { value: number; n: number } | null
  /** Formband des Fachkerns an der letzten Scheibe davor; null unter zehn Scheiben oder ohne Schwankung */
  band: { low: number; high: number } | null
  /** der Abend gegen das Band; null ohne Band */
  verdict: "above" | "within" | "below" | null
  /** die letzten bis zu 20 Scheiben bis einschließlich des Abends, zeitlich */
  strip: { id: string; value: number; tonight: boolean }[]
  /** Rekorde der Familie, deren Scheibe am Abend liegt (D6) */
  records: RecordRow[]
}

/** die Zeile „Form, letzte 90 Tage“ (D7) */
export interface StartForm {
  family: string
  mean: number | null
  cards: number
  comparison: PeriodComparison | null
  compareLabel: string | null
  /** der Fortschritt mit dieser Familie und dem Vergleich */
  route: ProgressRoute
}

export interface StartModel {
  day: string | null
  blocks: EveningBlock[]
  form: StartForm | null
}

export interface StartInput {
  cards: readonly ListInputCard[]
  timeZone: string
  nowMs: number
  named: readonly NamedPeriod[]
  scoring: Scoring
  /** die zuletzt gewählte Familie, für die Form */
  family: string | null
}

export function startModel(input: StartInput): StartModel {
  const all = [...input.cards].sort((a, b) => byStart(a.card, b.card))
  const newest = all.at(-1)
  if (!newest) return { day: null, blocks: [], form: null }
  const day = eveningDay(newest.card.startedAtMs, input.timeZone)
  const tonight = all.filter((c) => eveningDay(c.card.startedAtMs, input.timeZone) === day)
  const families = [...new Set(tonight.map((c) => c.family))]
  const meanMetric = inScoring(metricByKey("result.decimalMean")!, input.scoring)
  const context = {
    timeZone: input.timeZone,
    nowMs: input.nowMs,
    named: input.named,
    scoring: input.scoring,
  }

  const blocks = families.map((family): EveningBlock => {
    const ofFamily = all.filter((c) => c.family === family).map((c) => c.card)
    const evening = tonight.filter((c) => c.family === family).map((c) => c.card)
    const ids = new Set(evening.map((c) => c.id))
    const firstMs = evening[0].startedAtMs
    const lastMs = evening.at(-1)!.startedAtMs
    const rows =
      cardListModel(all, { ...DEFAULT_LIST, family }, context).evenings.find((e) => e.day === day)
        ?.rows ?? []
    const shots: MetricShot[] = evening.flatMap((card) => [...matchShots(card.shots)])
    const mean = shots.length ? computeMetric(meanMetric, shots) : null
    // Werte je Scheibe in der Wertung, nur Probe dabei (wie im Fortschritt mit seiner Grundeinstellung)
    const values = cardValues(ofFamily, metricByKey("result.decimalMean")!, input.scoring, {
      includeProbeOnly: true,
    })
    const earlier = values.filter((v) => v.atMs < firstMs && !ids.has(v.id))
    const window = earlier.slice(-BEFORE)
    const average = window.length
      ? { value: window.reduce((sum, v) => sum + v.value, 0) / window.length, n: window.length }
      : null
    const band = periodTrend(earlier).points.at(-1)?.band ?? null
    const verdict =
      band && mean !== null
        ? mean > band.high
          ? "above"
          : mean < band.low
            ? "below"
            : "within"
        : null
    const strip = values
      .filter((v) => v.atMs <= lastMs)
      .slice(-STRIP)
      .map((v) => ({ id: v.id, value: v.value, tonight: ids.has(v.id) }))
    const records = recordRows(
      periodRecords(ofFamily, input.scoring, { includeProbeOnly: true }),
      input.scoring
    ).filter((row) => ids.has(row.record.cardId))
    return {
      family,
      day,
      rows,
      shots: shots.length,
      mean,
      average,
      band,
      verdict,
      strip,
      records,
    }
  })

  const family = input.family ?? blocks[0]?.family ?? null
  return { day, blocks, form: family ? formOf(all, family, input) : null }
}

/** Form der letzten 90 Tage gegen die 90 Tage davor, wie der Fortschritt mit diesem Vergleich (D7) */
function formOf(all: readonly ListInputCard[], family: string, input: StartInput): StartForm {
  const state = {
    ...initialPeriodState({ family, scoring: input.scoring }),
    compare: { type: "previous" as const },
  }
  const model = periodModel({
    cards: all.filter((c) => c.family === family).map((c) => c.card),
    state,
    nowMs: input.nowMs,
    timeZone: input.timeZone,
    named: input.named,
  })
  return {
    family,
    mean: model.summary.mean,
    cards: model.summary.cards,
    comparison: model.comparison,
    compareLabel: model.compareRange?.label ?? null,
    route: progressRoute(state, null),
  }
}
