// Herkunft und Grundlage einer Scheibe in Worten (Textbuch): eine Stelle für Seite, Liste, Start, Fortschritt und
// Vergleichen. Die Grundlage selbst (`CardDetail`) rechnet der Fachkern; hier steht nur, wie sie heißt.

import type { MetricDefinition } from "@vereinsheim/shot-core/metrics"
import type { CardDetail } from "@vereinsheim/shot-core/projection"

/**
 * Herkunft einer Scheibe, wie die Ansichten sie nennen: gemessen von der Anlage, vom Ausdruck, eingetragen (von Hand
 * oder aus Treffsicher). Nicht `CardOrigin`: Das ist in `nav` die Herkunft eines Wegs.
 */
export type CardProvenance = "measured" | "printout" | "entered"

export const PROVENANCES: readonly CardProvenance[] = ["measured", "printout", "entered"]

export const isCardProvenance = (value: unknown): value is CardProvenance =>
  typeof value === "string" && (PROVENANCES as readonly string[]).includes(value)

/** die Herkunft klein, im Kopf einer Scheibe, in der Liste und an Rekorden */
export const PROVENANCE_WORDS: Readonly<Record<CardProvenance, string>> = {
  measured: "gemessen",
  printout: "vom Ausdruck",
  entered: "eingetragen",
}

/** die Herkunft als Knopf im Blatt „Filter“ und im Chip */
export const PROVENANCE_LABELS: Readonly<Record<CardProvenance, string>> = {
  measured: "Gemessen",
  printout: "Vom Ausdruck",
  entered: "Eingetragen",
}

/** die Herkunft leise, wo „gemessen“ das Übliche ist (Liste, Start, Rekorde): null für gemessen und ohne Angabe */
export const quietProvenance = (provenance?: CardProvenance | null): string | null =>
  provenance && provenance !== "measured" ? PROVENANCE_WORDS[provenance] : null

/** warum eine Scheibe für eine Kennzahl keinen Wert hat; die Folge ordnet Gründe mit gleicher Zahl */
export type DetailReason =
  | "waiting"
  | "noValues"
  | "missingValue"
  | "noPositions"
  | "fewPositions"
  | "noTimes"
  | "fewTimes"
  | "noTenths"
  | "onlyTenths"
  | "sumsOnly"
  | "noValue"

export const DETAIL_REASONS: readonly DetailReason[] = [
  "waiting",
  "noValues",
  "missingValue",
  "noPositions",
  "fewPositions",
  "noTimes",
  "fewTimes",
  "noTenths",
  "onlyTenths",
  "sumsOnly",
  "noValue",
]

export const REASON_TEXT: Readonly<Record<DetailReason, string>> = {
  waiting: "wartet auf die Anlage",
  noValues: "ohne Werte",
  missingValue: "nicht jeder Schuss mit Wert",
  noPositions: "ohne Lage je Schuss",
  fewPositions: "zu wenige Schüsse mit Lage",
  noTimes: "ohne Zeit je Schuss",
  fewTimes: "zu wenige Schüsse mit Zeit",
  noTenths: "ohne Zehntel",
  onlyTenths: "nur in Zehnteln",
  sumsOnly: "nur Summen",
  noValue: "ohne Wert",
}

/** was eine Scheibe für den Grund mitbringt: ihre Grundlage, die Schüsse wie am Ausdruck und ihre Herkunft */
export interface DetailInput {
  detail?: CardDetail
  shots: number
  provenance?: CardProvenance
}

const fromSums = (source: CardDetail["rings"]) => source === "series" || source === "total"

/**
 * der Grund, warum eine Scheibe für eine Kennzahl ohne Wert ist, nach dem, was die Kennzahl braucht (`needs`,
 * `minShots`): ohne Grundlage (Treffsicher, alte Projektion) „ohne Wert“, ohne jedes Ergebnis die Werte, sonst die
 * fehlende Angabe; ein Ergebnis aus Summen trägt keine Kennzahl über Einzelschüsse
 */
export function detailReason(
  input: DetailInput,
  metric: Pick<MetricDefinition, "needs" | "minShots">
): DetailReason {
  const { detail } = input
  if (!detail) return "noValue"
  if (detail.rings === null && detail.tenths === null) {
    if (input.shots > 0) return "missingValue"
    return input.provenance === "printout" ? "waiting" : "noValues"
  }
  if (metric.needs === "position" || metric.needs === "distance") {
    if (detail.positions === 0) return "noPositions"
    if (detail.positions < metric.minShots) return "fewPositions"
  }
  if (metric.needs === "time") {
    if (detail.times === 0) return "noTimes"
    if (detail.times < metric.minShots) return "fewTimes"
  }
  if (metric.needs === "decimal" && detail.tenths === null) return "noTenths"
  if (metric.needs === "ring" && detail.rings === null) return "onlyTenths"
  if (fromSums(detail.rings) || fromSums(detail.tenths)) return "sumsOnly"
  return "noValue"
}

/**
 * wie viel eine Scheibe mitbringt: Schüsse auf der Seite, sonst Serien-Summen, sonst ein Gesamtergebnis, sonst
 * nichts
 */
export type DetailLevel = "shots" | "series" | "total" | "none"

export function detailLevel(detail: CardDetail, shown: number): DetailLevel {
  if (shown > 0) return "shots"
  if (detail.rings === "series" || detail.tenths === "series") return "series"
  if (detail.rings === "total" || detail.tenths === "total") return "total"
  return "none"
}

export const LEVEL_TEXT: Readonly<Record<"series" | "total", string>> = {
  series: "nur Serien-Summen",
  total: "nur Gesamtergebnis",
}

/** der Grund unter der großen Zahl einer Scheibe aus Summen: die Tiefe, dazu die fehlende Wertung */
export function summaryReasons(detail: CardDetail, level: "series" | "total"): string[] {
  return [
    LEVEL_TEXT[level],
    ...(detail.tenths === null ? [REASON_TEXT.noTenths] : []),
    ...(detail.rings === null ? [REASON_TEXT.onlyTenths] : []),
  ]
}

/** die Trefferlage als Summe einer Scheibe ohne Lagen je Schuss, nur Mitte (für das Kreuz); sonst null */
export function summaryCenterOf(
  detail: CardDetail | undefined
): { xUm: number; yUm: number } | null {
  const center = detail?.center
  return center?.from === "summary" ? { xUm: center.xUm, yUm: center.yUm } : null
}

/** neben dem goldenen Kreuz: die Trefferlage als Summe zeigt die Mitte, nicht wie die Schüsse lagen */
export const CENTER_ONLY_NOTE = "nur die Mitte der Schüsse, keine Streuung"

/** ein Satz, was einer Scheibe ohne Einzelschüsse fehlt; mit Trefferlage als Summe fehlt die Lage nicht */
export const missingSentence = (detail: CardDetail): string =>
  detail.center?.from === "summary"
    ? "Für Streuung und Tempo braucht es Einzelschüsse."
    : "Für Streuung, Lage und Tempo braucht es Einzelschüsse."

/** ein Satz für eine Scheibe ohne Werte: vom Ausdruck wartet sie auf die Anlage, eingetragen fehlt die Eingabe */
export const emptyText = (provenance?: CardProvenance | null): string =>
  provenance === "printout"
    ? "Sobald die Anlage die Scheibe liefert, stehen hier Ergebnis, Serien und Schüsse."
    : "Für diese Scheibe sind keine Werte eingetragen."
