// Adressen von Spiegel (Plan N1, `vault/spiegel/spiegel-navigation.md`): reine Funktionen von der Adresse zum
// Zustand und zurück. Pfade und Schlüssel englisch, Anker deutsch; Vorgaben fallen weg, Ungültiges gilt als
// Vorgabe, nie ein Fehler (D2). Im Artifact kommt nur ein einfacher Anker an, das Labor zeigt die Adresse nur.

import type { Scoring } from "@vereinsheim/shot-core/metrics"

import { DEFAULT_CHOICE, type CompareChoice, type PeriodChoice } from "../period/calendar"
import type { CardKind, PeriodMetricKey } from "../period/state"

/** Id eines benannten Zeitraums, einer Familie oder eines Merkmals: klein, Ziffern, Bindestriche */
const SLUG = /^[a-z0-9][a-z0-9-]*$/
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/
/** Id einer Scheibe: Buchstaben, Ziffern, Unterstrich, Bindestrich */
const ID = /^[A-Za-z0-9_-]+$/

/** ein echter Kalendertag im Format JJJJ-MM-TT (kein 30. Februar) */
function isDay(text: string): boolean {
  const match = ISO_DAY.exec(text)
  if (!match) return false
  const [y, m, d] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

const ROLLING_CODES: readonly [30 | 90 | 365, string][] = [
  [30, "30d"],
  [90, "90d"],
  [365, "12m"],
]

/** ein Zeitraum als Wert von `range`: `30d`, `90d`, `12m`, `all`, `JJJJ-MM-TT..JJJJ-MM-TT` oder die Id */
export function encodeChoice(choice: PeriodChoice): string {
  switch (choice.type) {
    case "rolling":
      return ROLLING_CODES.find(([days]) => days === choice.days)?.[1] ?? "90d"
    case "all":
      return "all"
    case "free":
      return `${choice.from}..${choice.to}`
    case "named":
      return choice.id
  }
}

/** Wert von `range` als Zeitraum; die festen Werte gehen vor, Ungültiges ergibt `fallback` */
export function decodeChoice<F extends PeriodChoice | null>(
  value: string | null,
  fallback: F
): PeriodChoice | F {
  if (!value) return fallback
  const rolling = ROLLING_CODES.find(([, code]) => code === value)
  if (rolling) return { type: "rolling", days: rolling[0] }
  if (value === "all") return { type: "all" }
  const parts = value.split("..")
  if (parts.length === 2) {
    const [from, to] = parts
    return isDay(from) && isDay(to) && from <= to ? { type: "free", from, to } : fallback
  }
  return SLUG.test(value) ? { type: "named", id: value } : fallback
}

/** der Vergleich als Wert von `compare`; ohne Vergleich kein Schlüssel */
export function encodeCompare(compare: CompareChoice): string | null {
  return compare.type === "none" ? null : compare.type === "previous" ? "previous" : compare.id
}

export function decodeCompare(value: string | null): CompareChoice {
  if (value === "previous") return { type: "previous" }
  return value && SLUG.test(value) ? { type: "named", id: value } : { type: "none" }
}

/** Schlüssel und Wert in fester Reihenfolge (D2) */
export type Param = readonly [string, string]

/** Filter der Scheiben-Liste */
export interface ListQuery {
  /** Familie; null: die zuletzt benutzte, die Seite setzt sie ein */
  family: string | null
  kind: CardKind
  /** Merkmal wie `nur-pdf` */
  flag: string | null
  /** null: alle Abende */
  range: PeriodChoice | null
}

/** Zustand der Seite eines Zeitraums, wie `PeriodState`, nur mit Familie auch ohne Wert */
export interface ProgressQuery {
  choice: PeriodChoice
  compare: CompareChoice
  family: string | null
  kind: CardKind
  includeProbeOnly: boolean
  scoring: Scoring
  metric: PeriodMetricKey
  view: "cards" | "months" | null
  chosen: string | null
}

export const DEFAULT_LIST: ListQuery = { family: null, kind: "all", flag: null, range: null }

/** die Vorgaben wie `initialPeriodState` */
export const DEFAULT_PROGRESS: ProgressQuery = {
  choice: DEFAULT_CHOICE,
  compare: { type: "none" },
  family: null,
  kind: "all",
  includeProbeOnly: true,
  scoring: "decimal",
  metric: "result.decimalMean",
  view: null,
  chosen: null,
}

const METRIC_CODES: readonly [PeriodMetricKey, string][] = [
  ["result.decimalMean", "mean"],
  ["group.sigma", "sigma"],
  ["result.tensRate", "tens"],
  ["time.intervalMedian", "tempo"],
]

const slugOrNull = (value: string | null) => (value && SLUG.test(value) ? value : null)
const idOrNull = (value: string | null) => (value && ID.test(value) ? value : null)
const kindOf = (value: string | null): CardKind =>
  value === "training" || value === "competition" ? value : "all"
const scoringOf = (value: string | null): Scoring => (value === "rings" ? "rings" : "decimal")

/** nur die Schlüssel, deren Wert nicht die Vorgabe ist, in der Reihenfolge der Liste */
const present = (pairs: readonly (readonly [string, string | null])[]): Param[] =>
  pairs.flatMap(([key, value]) => (value === null ? [] : [[key, value] as const]))

const kindParams = (kind: CardKind) => (kind === "all" ? null : kind)

export function listQueryToParams(query: ListQuery): Param[] {
  return present([
    ["range", query.range ? encodeChoice(query.range) : null],
    ["family", query.family],
    ["kind", kindParams(query.kind)],
    ["flag", query.flag],
  ])
}

export function listQueryFromParams(params: URLSearchParams): ListQuery {
  const range = decodeChoice(params.get("range"), null)
  return {
    family: slugOrNull(params.get("family")),
    kind: kindOf(params.get("kind")),
    flag: slugOrNull(params.get("flag")),
    // „all“ und ohne Angabe heißen dasselbe: alle Abende
    range: range?.type === "all" ? null : range,
  }
}

/** Schlüssel des Fortschritts; ohne `chosen` und `scoring` fehlen `pick` und `scoring` (eine Scheibe trägt sie selbst) */
function progressPairs(
  query: Omit<ProgressQuery, "chosen" | "scoring"> & Partial<ProgressQuery>
): (readonly [string, string | null])[] {
  const range = encodeChoice(query.choice)
  return [
    ["range", range === encodeChoice(DEFAULT_CHOICE) ? null : range],
    ["compare", encodeCompare(query.compare)],
    ["family", query.family],
    ["kind", kindParams(query.kind)],
    ["probe", query.includeProbeOnly ? null : "0"],
    ["scoring", query.scoring === "rings" ? "rings" : null],
    [
      "metric",
      query.metric === DEFAULT_PROGRESS.metric
        ? null
        : (METRIC_CODES.find(([key]) => key === query.metric)?.[1] ?? null),
    ],
    ["view", query.view],
    ["pick", query.chosen ?? null],
  ]
}

export function progressQueryToParams(query: ProgressQuery): Param[] {
  return present(progressPairs(query))
}

export function progressQueryFromParams(params: URLSearchParams): ProgressQuery {
  const view = params.get("view")
  return {
    choice: decodeChoice(params.get("range"), DEFAULT_CHOICE),
    compare: decodeCompare(params.get("compare")),
    family: slugOrNull(params.get("family")),
    kind: kindOf(params.get("kind")),
    includeProbeOnly: params.get("probe") !== "0",
    scoring: scoringOf(params.get("scoring")),
    metric:
      METRIC_CODES.find(([, code]) => code === params.get("metric"))?.[0] ??
      DEFAULT_PROGRESS.metric,
    view: view === "cards" || view === "months" ? view : null,
    chosen: idOrNull(params.get("pick")),
  }
}
