// Die Statistik als Seite eines Zeitraums wie Spiegels Fortschritt: Zustand aus der Adresse (Schlüssel wie in Spiegel,
// `shot-ui/nav/routes`), gerechnet auf dem Server mit `periodModel` aus den Einheiten einer Disziplin. Die Wertung folgt
// der Disziplin; nur Disziplinen in Zehnteln lassen ganze Ringe zu. Probe zählt in Treffsicher nie.

import type { Scoring } from "@vereinsheim/shot-core/metrics"
import {
  progressQueryFromParams,
  progressQueryToParams,
  type ProgressQuery,
} from "@vereinsheim/shot-ui/nav/routes"
import { lightPeriodModel, periodModel, type PeriodModel } from "@vereinsheim/shot-ui/period/model"
import type { PeriodMetricKey, PeriodState } from "@vereinsheim/shot-ui/period/state"

import { periodItems, scoringOf } from "@/lib/statistics/periodItems"
import type { StatisticsSession } from "@/lib/statistics/sessions"

/** Kacheln: Ø je Schuss (trägt den Vergleich), Zehnerquote, Lage aus dem Ausdruck */
export const STATISTICS_TILES = [
  "result.decimalMean",
  "result.tensRate",
  "group.mpiDistance",
] as const

/** Kennzahlen des Verlaufs: ohne Streuung und Tempo, Treffsicher kennt weder Lage je Schuss noch Zeit */
export const STATISTICS_METRICS: readonly { key: PeriodMetricKey; label: string }[] = [
  { key: "result.decimalMean", label: "Ø je Schuss" },
  { key: "result.tensRate", label: "Zehner" },
  { key: "group.mpiDistance", label: "Lage" },
]

export interface DisciplineOption {
  value: string
  label: string
  /** Zehntel: zwischen Zehnteln und ganzen Ringen umschaltbar; sonst nur ganze Ringe */
  switchable: boolean
}

/**
 * Die Disziplinen mit Einheiten, die mit der neuesten Einheit zuerst. Ausgeblendete fehlen, es sei denn, es gibt nur
 * ausgeblendete.
 */
export function disciplineOptions(
  sessions: readonly StatisticsSession[],
  hidden: readonly string[]
): DisciplineOption[] {
  const items = new Set(periodItems(sessions).map((item) => item.id))
  const options = new Map<string, DisciplineOption>()
  for (const session of [...sessions].reverse()) {
    const discipline = session.discipline
    if (!discipline || !items.has(session.id) || options.has(discipline.id)) continue
    options.set(discipline.id, {
      value: discipline.id,
      label: discipline.name,
      switchable: scoringOf(discipline.scoringType) === "decimal",
    })
  }
  const all = [...options.values()]
  const shown = all.filter((option) => !hidden.includes(option.value))
  return shown.length ? shown : all
}

/** die Adresse der Statistik zu einem Zustand: Vorgaben fallen weg, ganze Ringe nur, wo man sie wählt */
export function statisticsUrl(state: PeriodState, switchable: boolean): string {
  const query: ProgressQuery = { ...state, scoring: switchable ? state.scoring : "decimal" }
  const params = new URLSearchParams(progressQueryToParams(query).map(([k, v]) => [k, v]))
  const search = params.toString()
  return search ? `/statistics?${search}` : "/statistics"
}

/** der Zustand aus der Adresse: unbekannte Disziplin wie keine (die mit der neuesten Einheit) */
export function statisticsState(
  search: URLSearchParams,
  options: readonly DisciplineOption[]
): { state: PeriodState; option: DisciplineOption } | null {
  const query = progressQueryFromParams(search)
  const option = options.find((o) => o.value === query.family) ?? options[0]
  if (!option) return null
  const scoring: Scoring = option.switchable ? query.scoring : "rings"
  const metric = STATISTICS_METRICS.some((m) => m.key === query.metric)
    ? query.metric
    : "result.decimalMean"
  return {
    state: { ...query, family: option.value, scoring, metric, includeProbeOnly: true },
    option,
  }
}

export interface StatisticsPage {
  model: PeriodModel
  state: PeriodState
  options: DisciplineOption[]
  option: DisciplineOption
}

/** die Seite für den Browser: das leichte Modell der gewählten Disziplin; ohne Einheit mit Ergebnis null */
export function statisticsPage(input: {
  sessions: readonly StatisticsSession[]
  search: URLSearchParams
  hidden: readonly string[]
  nowMs: number
  timeZone: string
}): StatisticsPage | null {
  const options = disciplineOptions(input.sessions, input.hidden)
  const chosen = statisticsState(input.search, options)
  if (!chosen) return null
  const { state, option } = chosen
  const items = periodItems(input.sessions.filter((s) => s.discipline?.id === option.value))
  const model = periodModel({
    items,
    tileKeys: STATISTICS_TILES,
    state,
    nowMs: input.nowMs,
    timeZone: input.timeZone,
    named: [],
  })
  return { model: lightPeriodModel(model), state, options, option }
}
