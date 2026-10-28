// Die Sätze zum Stand eines gemessenen Ziels: Zeile in der Liste, große Zahl, Kacheln, Grundlage, Zeile auf Start.
// Reine Funktionen über `measureGoal` (Textbuch Spiegel, „Tagebuch (2b)“).

import { formatValue } from "@vereinsheim/shot-ui/format"

import type { GoalMeasure, GoalRule, GoalScoring, GoalStand } from "./measure"

/** die Schwelle in der Wertung des Ziels („355“, „365,5“) */
export const thresholdText = (threshold: number, scoring: GoalScoring) =>
  formatValue(threshold, scoring === "decimal" ? 1 : 0)

const valueText = (value: number, scoring: GoalScoring) =>
  formatValue(value, scoring === "decimal" ? 1 : 0)

const meanText = (value: number) => formatValue(value, 1)

const unit = (measure: GoalMeasure, n: number) =>
  measure === "series" ? (n === 1 ? "Serie" : "Serien") : n === 1 ? "Scheibe" : "Scheiben"

const meanOf = (stand: GoalStand) =>
  stand.points.length ? stand.points.reduce((s, p) => s + p.value, 0) / stand.points.length : null

/** gezählt wird nichts: im Zeitraum keine Scheibe, oder es gibt welche und keine zählt */
export function nothingCounted(rule: GoalRule, stand: GoalStand): string {
  if (!stand.cards) return "Noch keine Scheibe in diesem Zeitraum."
  return rule.measure === "series"
    ? "Noch zählt keine Serie in diesem Zeitraum."
    : "Noch zählt keine Scheibe in diesem Zeitraum."
}

/** warum Scheiben nicht zählen, als Aufzählung („5 mit anderer Schusszahl, 1 ohne Ergebnis“); leer, wenn alle zählen */
function reasons(stand: GoalStand): string[] {
  return (
    [
      [stand.left.otherShots, "mit anderer Schusszahl"],
      [stand.left.noValue, "ohne Ergebnis"],
      [stand.left.noSeries, "ohne Serien"],
    ] as const
  )
    .filter(([n]) => n > 0)
    .map(([n, why]) => `${n} ${why}`)
}

/** die Zeile in der Liste und im Formular: „6 von 14 Scheiben ab 355“, „Schnitt 352,9 über 41 Scheiben“ */
export function standLine(rule: GoalRule, stand: GoalStand): string {
  if (rule.measure === "average")
    return stand.mean === null
      ? nothingCounted(rule, stand)
      : `Schnitt ${meanText(stand.mean)} über ${stand.counted} ${unit("card", stand.counted)}`
  if (!stand.counted) return nothingCounted(rule, stand)
  return `${stand.hits} von ${stand.counted} ${unit(rule.measure, stand.counted)} ab ${thresholdText(rule.threshold, rule.scoring)}`
}

/** die große Zahl und der Satz daneben auf der Seite eines Ziels; null, solange nichts zählt */
export function bigNumber(
  rule: GoalRule,
  stand: GoalStand
): { value: string; caption: string } | null {
  if (!stand.counted) return null
  const target = thresholdText(rule.threshold, rule.scoring)
  if (rule.measure === "average")
    return {
      value: meanText(stand.mean as number),
      caption: `Schnitt über ${stand.counted} ${unit("card", stand.counted)} · Ziel ${target}`,
    }
  return {
    value: String(stand.hits),
    caption: `von ${stand.counted} ${unit(rule.measure, stand.counted)} ab ${target} Ringen`,
  }
}

/** die drei Kacheln: die letzten zehn, das Beste mit Tag, der Schnitt; null, solange nichts zählt */
export function standTiles(
  rule: GoalRule,
  stand: GoalStand,
  dayText: (day: string) => string
): { recent: string; best: { value: string; day: string }; mean: string } | null {
  if (!stand.counted || !stand.best) return null
  return {
    recent: `${stand.recent.hits} von ${stand.recent.counted}`,
    best: { value: valueText(stand.best.value, rule.scoring), day: dayText(stand.best.day) },
    mean: meanText(meanOf(stand) as number),
  }
}

/** die Grundlage, nur wenn Scheiben im Zeitraum nicht zählen („über 14 Scheiben · 2 ohne Ergebnis zählen nicht“) */
export function basisLine(stand: GoalStand): string | null {
  const parts = [
    [stand.left.noValue, "ohne Ergebnis"],
    [stand.left.otherShots, "mit anderer Schusszahl"],
    [stand.left.noSeries, "ohne Serien"],
  ] as const
  const missing = parts.filter(([n]) => n > 0)
  if (!missing.length) return null
  return [
    `über ${stand.cards} ${unit("card", stand.cards)}`,
    ...missing.map(([n, why]) => `${n} ${why} ${n === 1 ? "zählt" : "zählen"} nicht`),
  ].join(" · ")
}

/**
 * der Zustand der Zeile auf Start: „6 von 14 Scheiben“, beim Schnitt „bisher 352,9“; zählt nichts, „noch keine Scheibe
 * zählt“ (bei Serie „noch keine Serie zählt“) statt „0 von 0“
 */
export function startState(rule: GoalRule, stand: GoalStand): string {
  if (!stand.counted || (rule.measure === "average" && stand.mean === null))
    return `noch keine ${unit(rule.measure === "series" ? "series" : "card", 1)} zählt`
  if (rule.measure === "average") return `bisher ${meanText(stand.mean!)}`
  return `${stand.hits} von ${stand.counted} ${unit(rule.measure, stand.counted)}`
}

/** der Satz unter dem Formular: was die Messung mit den Scheiben im Zeitraum ergäbe */
export function previewLine(rule: GoalRule, stand: GoalStand): string {
  if (!stand.cards) return "Bisher keine Scheibe in diesem Zeitraum."
  if (!stand.counted)
    return `Bisher zählt keine der ${stand.cards} ${unit("card", stand.cards)}: ${reasons(stand).join(", ")}.`
  return `Bisher in diesem Zeitraum: ${standLine(rule, stand)}.`
}
