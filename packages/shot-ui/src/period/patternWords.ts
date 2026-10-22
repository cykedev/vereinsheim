// Die Worte zum Trefferbild über einen Zeitraum: Antwort unter dem Bild, Grundlage und die Urteile der Reiter
// Präzision und Lage, aus den Urteilen des Fachkerns (`periodPattern`). Rein, ohne React; der Wortlaut steht nur hier
// (Textbuch).

import type {
  OutlierDirection,
  PeriodPattern,
  PeriodShape,
  PositionOverTime,
} from "@vereinsheim/shot-core/analysis"
import { formatInteger } from "@vereinsheim/lib/format"

import { directionName, formatValue } from "../format"

/** ein Urteil in Worten: der erste Satz trägt die Antwort (fett), der Rest erklärt */
export interface PatternSentence {
  lead: string
  more: string | null
}

export const LEGEND_POINTS = "Jeder Punkt ist ein Schuss."
/** Legende der Umrisse, im Trefferbild und beim Vergleichen */
export const LEGEND_OUTLINES = "Durchgezogen: die Hälfte der Schüsse. Gestrichelt: 9 von 10."
/** Name des Knopfs, der statt der Treffer die Umrisse zeigt */
export const OUTLINES_LABEL = "Umrisse statt Treffer zeigen"

/** „1 Schuss liegt außerhalb des Bilds.“ */
export const outsideText = (n: number) =>
  `${n} ${n === 1 ? "Schuss liegt" : "Schüsse liegen"} außerhalb des Bilds.`
export const CENTER_NOTE = "Der geviertelte Kreis ist die Mitte aller Schüsse."
/** unter dem Trefferbild, wenn es ein Urteil über die Lage gibt */
export const REGION_NOTE =
  "Der feine Rahmen um ihn zeigt, wo deine Mitte sicher liegt. Liegt die Mitte der Scheibe darin, ist ein Versatz noch nicht sicher."
export const PATTERN_LOADING = "Trefferbild wird gerechnet …"
export const PATTERN_FAILED = "Das Trefferbild ließ sich nicht laden."

/** Richtung der langen Seite: Winkel von der x-Achse gegen den Uhrzeigersinn, in [0, π) */
export function axisWords(angleRad: number): string {
  const degrees = (angleRad * 180) / Math.PI
  if (degrees < 22.5 || degrees >= 157.5) return "eher waagrecht"
  if (degrees >= 67.5 && degrees < 112.5) return "eher senkrecht"
  return degrees < 90 ? "schräg nach rechts oben" : "schräg nach rechts unten"
}

/** Form über mehrere Scheiben (L9) */
export function shapeWords(shape: PeriodShape | null): PatternSentence {
  if (!shape || shape.verdict === "few")
    return {
      lead: "Für ein Urteil über die Form fehlen noch Schüsse.",
      more: "Es braucht 100 Schuss aus 5 Scheiben.",
    }
  if (shape.verdict === "elongated")
    return { lead: `Deine Gruppe ist länglich, ${axisWords(shape.angleRad)}.`, more: null }
  return { lead: "Deine Gruppe zieht in keine klare Richtung.", more: null }
}

/** Richtung einer Lage wie auf der Seite einer Scheibe: „rechts tief“, „links hoch“ */
const positionDirection = (point: { xUm: number; yUm: number }) =>
  directionName(point).replace("oben", "hoch").replace("unten", "tief")

/** die Form als zweiter Satz unter dem Trefferbild; ohne Urteil über die Form keiner */
function shapeSentence(shape: PeriodShape | null): string | null {
  if (!shape || shape.verdict === "few") return null
  return shape.verdict === "elongated"
    ? `Die Gruppe ist länglich, ${axisWords(shape.angleRad)}.`
    : "Die Gruppe zieht in keine klare Richtung."
}

/** die Antwort unter dem Trefferbild: die Lage (L10), dann die Form (L9) */
export function pictureWords(pattern: Pick<PeriodPattern, "overTime" | "shape">): PatternSentence {
  const position = positionWords(pattern.overTime)
  const more = [position.more, shapeSentence(pattern.shape)].filter(Boolean).join(" ")
  return { lead: position.lead, more: more || null }
}

/** Lage über Zeit (L10) */
export function positionWords(overTime: PositionOverTime): PatternSentence {
  if (overTime.verdict === "few" || !overTime.mean)
    return {
      lead: "Für ein Urteil über die Lage fehlen noch Scheiben.",
      more: "Es braucht 5 Scheiben mit Lage.",
    }
  if (overTime.verdict === "offset")
    return {
      lead: `Deine Lage ist versetzt: ${positionDirection(overTime.mean)}, im Mittel ${formatValue((overTime.offsetUm ?? 0) / 1000, 1)} mm.`,
      more: null,
    }
  // ohne gesicherten Versatz sagt der Satz, was das Bild zeigt, und wie sicher es ist; nie „passt“ neben einem Kreis,
  // der sichtbar daneben liegt
  const offset = overTime.offsetUm ?? 0
  const where =
    offset < 50
      ? "Deine Mitte liegt in der Mitte."
      : `Deine Mitte liegt ${formatValue(offset / 1000, 1)} mm ${positionDirection(overTime.mean)}.`
  return {
    lead: where,
    more: `Ob das so bleibt, ist mit ${formatInteger(overTime.points.length)} Scheiben noch nicht sicher.`,
  }
}

/** Ausreißerrichtung (L7) */
export function outlierWords(outliers: OutlierDirection | null): PatternSentence {
  if (!outliers || outliers.verdict === "few")
    return { lead: "Unter 30 Ausreißern ist die Uhr ein Bild, kein Befund.", more: null }
  if (outliers.verdict === "directed") {
    const towards = {
      xUm: 1000 * Math.sin(outliers.meanRad),
      yUm: 1000 * Math.cos(outliers.meanRad),
    }
    return { lead: `Deine Ausreißer gehen meist nach ${directionName(towards)}.`, more: null }
  }
  return { lead: "Deine Ausreißer gehen in alle Richtungen.", more: null }
}

export const OUTLIER_NOTE =
  "Gezählt ist je Scheibe das weiteste Zehntel der Schüsse, gemessen von der Mitte der Scheibe."
export const ROUND_NOTE = "Gestrichelt: So sähe eine runde Gruppe mit derselben Streuung aus."
export const POSITION_NOTE = "Jeder Punkt ist eine Scheibe, die Linie der Schnitt der letzten fünf."

const cardsText = (n: number) => `${formatInteger(n)} ${n === 1 ? "Scheibe" : "Scheiben"}`

/** Grundlage: „Über 1.240 Schuss aus 31 Scheiben, 7 ohne Lage.“ */
export function basisText(
  pattern: Pick<PeriodPattern, "shots" | "cards" | "cardsWithoutPosition">
): string {
  const without = pattern.cardsWithoutPosition
  return `Über ${formatInteger(pattern.shots)} Schuss aus ${cardsText(pattern.cards - without)}${without ? `, ${formatInteger(without)} ohne Lage` : ""}.`
}

/** Notiz der Karte „Form über mehrere Scheiben“ */
export const shapeNote = (shape: Pick<PeriodShape, "shots" | "cards">) =>
  `Gerechnet über ${formatInteger(shape.shots)} Schuss aus ${cardsText(shape.cards)}, jede um ihre eigene Mitte.`
