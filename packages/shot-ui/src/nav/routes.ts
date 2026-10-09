// Adressen von Spiegel (Plan N1, `vault/spiegel/spiegel-navigation.md`): reine Funktionen von der Adresse zum
// Zustand und zurück. Pfade und Schlüssel englisch, Anker deutsch; Vorgaben fallen weg, Ungültiges gilt als
// Vorgabe, nie ein Fehler (D2). Im Artifact kommt nur ein einfacher Anker an, das Labor zeigt die Adresse nur.

import type { Scoring } from "@vereinsheim/shot-core/metrics"

import {
  hashFor,
  parseHash,
  parsePeriodHash,
  type PageAnchor,
  type PeriodSection,
} from "../layout/sections"
import { DEFAULT_CHOICE, type CompareChoice, type PeriodChoice } from "../period/calendar"
import type { CardKind, PeriodMetricKey } from "../period/state"
import type { Selection } from "../types"

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

/** woher eine Scheibe geöffnet wurde, mit dem Zustand dort (D6); null: ein direkter Link */
export type CardOrigin =
  | null
  | { from: "start" }
  | { from: "list"; query: ListQuery }
  | { from: "progress"; query: Omit<ProgressQuery, "chosen" | "scoring"> }

/** die Seite einer Scheibe: Herkunft, Auswahl, Schuss als Nummer (D5), Wertung, Abschnitt oder Reiter */
export interface CardRoute {
  page: "card"
  id: string
  origin: CardOrigin
  /** null: die Grundauswahl der Scheibe (`defaultWhole`) */
  selection: Selection | null
  /** Nummer wie `shotLabels` („23“, „P3“) */
  shot: string | null
  scoring: Scoring
  anchor: PageAnchor | null
}

const SHOT = /^P?[1-9]\d*$/
const SERIES = /^[1-9]\d*$/

function selectionOf(value: string | null): Selection | null {
  if (value === "all" || value === "match" || value === "probe") return value
  return value && SERIES.test(value) ? Number(value) : null
}

function originFrom(params: URLSearchParams): CardOrigin {
  switch (params.get("from")) {
    case "start":
      return { from: "start" }
    case "list":
      return { from: "list", query: listQueryFromParams(params) }
    case "progress": {
      // `pick` wäre die Scheibe selbst, die Wertung trägt die Scheibe (D6)
      const { chosen: _chosen, scoring: _scoring, ...query } = progressQueryFromParams(params)
      return { from: "progress", query }
    }
    default:
      return null
  }
}

function originPairs(origin: CardOrigin): Param[] {
  if (!origin) return []
  if (origin.from === "start") return [["from", "start"]]
  if (origin.from === "list") return [["from", "list"], ...listQueryToParams(origin.query)]
  return [["from", "progress"], ...present(progressPairs(origin.query))]
}

/** die Seite einer Scheibe aus Id, Query und Anker */
export function cardFromParts(id: string, params: URLSearchParams, hash: string): CardRoute {
  return {
    page: "card",
    id,
    origin: originFrom(params),
    selection: selectionOf(params.get("series")),
    shot: SHOT.test(params.get("shot") ?? "") ? (params.get("shot") as string) : null,
    scoring: scoringOf(params.get("scoring")),
    anchor: parseHash(hash),
  }
}

/** Schlüssel der Seite einer Scheibe: Herkunft mit ihrem Zustand, dann Serie, Schuss, Wertung */
export function cardToParams(card: CardRoute): Param[] {
  return [
    ...originPairs(card.origin),
    ...present([
      ["series", card.selection === null ? null : String(card.selection)],
      ["shot", card.shot],
      ["scoring", card.scoring === "rings" ? "rings" : null],
    ]),
  ]
}

/** Anker der Seite einer Scheibe; ohne Abschnitt keiner */
export const cardHash = (card: CardRoute) =>
  card.anchor ? hashFor(card.anchor.section, card.anchor.tab) : ""

/** jede Seite von Spiegel (D3); was keine ist, ist `unknown` mit ihrem Pfad */
export type Route =
  | { page: "start" }
  /** `evening`: der Abend als ISO-Tag aus dem Anker (`#2026-09-25`) */
  | { page: "cards"; query: ListQuery; evening: string | null }
  | CardRoute
  | { page: "progress"; query: ProgressQuery; section: PeriodSection | null }
  | { page: "compare"; origin: CardOrigin; a: string; b: string }
  | { page: "scan" }
  | { page: "open" }
  | { page: "profile" }
  | { page: "trash" }
  | { page: "admin"; section: string | null }
  | { page: "unknown"; path: string }

export type ListRoute = Extract<Route, { page: "cards" }>
export type ProgressRoute = Extract<Route, { page: "progress" }>

/** Pfad in Teile; ein Schrägstrich am Ende zählt nicht; ein kaputtes `%` ergibt null */
function segmentsOf(pathname: string): string[] | null {
  try {
    return pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
  } catch {
    return null
  }
}

/** die Route einer Adresse aus Pfad, Query und Anker, wie `location` sie liefert (mit oder ohne `?`, `#`) */
export function routeFromUrl(pathname: string, search: string, hash: string): Route {
  const unknown: Route = { page: "unknown", path: pathname }
  const segments = segmentsOf(pathname)
  if (!segments) return unknown
  const params = new URLSearchParams(search)
  const word = hash.replace(/^#/, "")
  const [first, second, ...rest] = segments
  if (rest.length) return unknown
  switch (first) {
    case undefined:
      return { page: "start" }
    case "cards":
      if (second === undefined) {
        return {
          page: "cards",
          query: listQueryFromParams(params),
          evening: isDay(word) ? word : null,
        }
      }
      return ID.test(second) ? cardFromParts(second, params, hash) : unknown
    case "progress":
      return second === undefined
        ? {
            page: "progress",
            query: progressQueryFromParams(params),
            section: parsePeriodHash(hash),
          }
        : unknown
    case "compare": {
      const a = idOrNull(params.get("a"))
      const b = idOrNull(params.get("b"))
      return second === undefined && a && b
        ? { page: "compare", origin: originFrom(params), a, b }
        : unknown
    }
    case "scan":
    case "open":
      return second === undefined ? { page: first } : unknown
    case "profile":
      if (second === undefined) return { page: "profile" }
      return second === "trash" ? { page: "trash" } : unknown
    case "admin":
      if (second === undefined) return { page: "admin", section: null }
      return SLUG.test(second) ? { page: "admin", section: second } : unknown
    default:
      return unknown
  }
}

const withQuery = (path: string, params: readonly Param[], hash = "") =>
  `${path}${
    params.length
      ? `?${params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}`
      : ""
  }${hash}`

/** die kanonische Adresse einer Route (D2): Vorgaben fehlen, Schlüssel in fester Reihenfolge */
export function urlFromRoute(route: Route): string {
  switch (route.page) {
    case "start":
      return "/"
    case "cards":
      return withQuery(
        "/cards",
        listQueryToParams(route.query),
        route.evening ? `#${route.evening}` : ""
      )
    case "card":
      return withQuery(
        `/cards/${encodeURIComponent(route.id)}`,
        cardToParams(route),
        cardHash(route)
      )
    case "progress":
      return withQuery(
        "/progress",
        progressQueryToParams(route.query),
        route.section ? `#${route.section}` : ""
      )
    case "compare":
      return withQuery("/compare", [...originPairs(route.origin), ["a", route.a], ["b", route.b]])
    case "scan":
      return "/scan"
    case "open":
      return "/open"
    case "profile":
      return "/profile"
    case "trash":
      return "/profile/trash"
    case "admin":
      return route.section ? `/admin/${route.section}` : "/admin"
    case "unknown":
      return route.path
  }
}
