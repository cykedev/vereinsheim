// Modell von Start (`vault/spiegel/spiegel-navigation.md`, „Start“): der letzte Abend je Familie im
// Formband, neue Rekorde und die Form der letzten 90 Tage. Reine Funktion; alle Zahlen aus dem Fachkern, aus den
// Projektionen der Scheiben (ADR-031). Einheit ist
// die Scheibe (Regel „Über viele Scheiben“): Der Streifen zeigt Scheiben, das Band ist das des Fortschritts, seine
// Mitte der gleitende Schnitt bis zum Abend; der Satz misst gegen den Schnitt der fünf Scheiben davor.

import { periodTrend, type PeriodComparison } from "@vereinsheim/shot-core/analysis"
import { metricByKey, type Scoring } from "@vereinsheim/shot-core/metrics"
import { pooledMean, projectedRecords, projectedValues } from "@vereinsheim/shot-core/projection"

import { cardListModel, lastEvening, type ListInputCard, type ListRow } from "../list/evenings"
import { progressRoute } from "../nav/navigate"
import { DEFAULT_LIST, type ProgressRoute } from "../nav/routes"
import type { NamedPeriod } from "../period/calendar"
import { byStart, periodModel } from "../period/model"
import { recordRows, type RecordRow } from "../period/records"
import { initialPeriodState } from "../period/state"

/** so viele Scheiben vor dem Abend ergeben den Schnitt */
const BEFORE = 5
/** so viele Scheiben zeigt der Streifen */
const STRIP = 20

export type { RecordRow }

/** ein Block auf Start: der letzte Abend einer Familie */
export interface EveningBlock {
  family: string
  /** die Wertung der Familie: in ihr rechnen Zahl, Streifen, Ø der Zeilen und Rekorde; ein Rekord öffnet in ihr */
  scoring: Scoring
  /** ISO-Tag des Abends */
  day: string
  /** die Scheiben des Abends wie in der Liste (Ergebnis in beiden Wertungen, Ø, Abstand) */
  rows: ListRow[]
  /** Wertungsschüsse des Abends, nur Probe wie Wertung */
  shots: number
  /** Ø je Schuss über alle Wertungsschüsse des Abends, in der Wertung */
  mean: number | null
  /** Scheiben der Familie vor dem Abend, auch ohne Wert (für „Dein erster Abend“) */
  cardsBefore: number
  /** Schnitt der bis zu fünf Scheiben vor dem Abend; null ohne Werte davor */
  average: { value: number; n: number } | null
  /**
   * Formband wie im Verlauf des Fortschritts über alle Scheiben: an der letzten Scheibe des Abends, mit ihr gerechnet
   * (Mitte ist der gleitende Schnitt bis zu ihr); null unter zehn Scheiben oder ohne Schwankung
   */
  band: { low: number; high: number } | null
  /** der Abend gegen das Band; null ohne Band */
  verdict: "above" | "within" | "below" | null
  /**
   * die letzten bis zu 20 Scheiben bis einschließlich des Abends, zeitlich, je mit dem gleitenden Schnitt und dem
   * Formband an ihrer Stelle wie im Verlauf des Fortschritts
   */
  strip: {
    id: string
    value: number
    tonight: boolean
    mean: number
    /** der Schnitt über weniger als fünf Scheiben (die ersten der Familie), gestrichelt wie im Fortschritt */
    partial: boolean
    band: { low: number; high: number } | null
  }[]
  /** Rekorde der Familie, deren Scheibe am Abend liegt */
  records: RecordRow[]
}

/** „Form der letzten 90 Tage“ rechts auf Start */
export interface StartForm {
  family: string
  mean: number | null
  cards: number
  comparison: PeriodComparison | null
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
  /**
   * die Wertung einer Familie (in der App gespeichert, sonst die häufigste ihrer Scheiben): jeder Block und die Form
   * rechnen in ihrer
   */
  scoringOf: (family: string) => Scoring
  /** die zuletzt gewählte Familie, für die Form */
  family: string | null
}

export function startModel(input: StartInput): StartModel {
  const all = [...input.cards].sort((a, b) => byStart(a.card, b.card))
  const last = lastEvening(all, input.timeZone)
  if (!last) return { day: null, blocks: [], form: null }
  const { day, cards: tonight } = last
  const families = [...new Set(tonight.map((c) => c.family))]

  const blocks = families.map((family): EveningBlock => {
    const scoring = input.scoringOf(family)
    const context = {
      timeZone: input.timeZone,
      nowMs: input.nowMs,
      named: input.named,
      scoring,
    }
    const ofFamily = all.filter((c) => c.family === family).map((c) => c.card)
    const evening = tonight.filter((c) => c.family === family).map((c) => c.card)
    const ids = new Set(evening.map((c) => c.id))
    const firstMs = evening[0].startedAtMs
    const rows =
      cardListModel(all, { ...DEFAULT_LIST, family }, context).evenings.find((e) => e.day === day)
        ?.rows ?? []
    // Schüsse wie am Ausdruck; der Ø über alle zusammen, nicht das Mittel der Mittel
    const shots = evening.reduce((sum, card) => sum + card.projection.printedShots, 0)
    const mean = pooledMean(evening, scoring)
    // Werte je Scheibe in der Wertung, nur Probe dabei (wie im Fortschritt mit seiner Grundeinstellung)
    const values = projectedValues(ofFamily, metricByKey("result.decimalMean")!, scoring, {
      includeProbeOnly: true,
    })
    // der Abend ist der neueste Tag: davor liegt alles, was vor seiner ersten Scheibe beginnt
    const earlier = values.filter((v) => v.atMs < firstMs)
    const window = earlier.slice(-BEFORE)
    const average = window.length
      ? { value: window.reduce((sum, v) => sum + v.value, 0) / window.length, n: window.length }
      : null
    // das Band wie im Verlauf des Fortschritts über alle Scheiben („Alles“): an der letzten Scheibe des Abends, mit
    // ihr gerechnet; so sagen Start und Fortschritt dasselbe
    const trend = periodTrend(values)
    const band = trend.points.at(-1)?.band ?? null
    const verdict =
      band && mean !== null
        ? mean > band.high
          ? "above"
          : mean < band.low
            ? "below"
            : "within"
        : null
    const strip = trend.points.slice(-STRIP).map((p) => ({
      id: p.id,
      value: p.value,
      tonight: ids.has(p.id),
      mean: p.mean,
      partial: p.partial,
      band: p.band,
    }))
    const records = recordRows(
      projectedRecords(ofFamily, scoring, { includeProbeOnly: true }),
      scoring
    ).filter((row) => ids.has(row.record.cardId))
    return {
      family,
      scoring,
      day,
      rows,
      shots,
      mean,
      cardsBefore: ofFamily.filter((c) => c.startedAtMs < firstMs).length,
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

/** Form der letzten 90 Tage gegen die 90 Tage davor, wie der Fortschritt mit diesem Vergleich, in der Wertung der Familie */
function formOf(all: readonly ListInputCard[], family: string, input: StartInput): StartForm {
  const state = {
    ...initialPeriodState({ family, scoring: input.scoringOf(family) }),
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
    route: progressRoute(state, null),
  }
}
