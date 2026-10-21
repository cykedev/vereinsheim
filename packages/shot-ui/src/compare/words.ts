// Worte der Seite Vergleichen (Textbuch Spiegel): die Namen der Seiten, der Satz als Antwort, das Urteil je Zeile, die
// Grundlage, die Legende des Bilds und die Hinweise, wenn kein Vergleich geht. Rein, Datum über `@vereinsheim/lib/format`
// mit der Zeitzone als Parameter.

import {
  formatInteger,
  formatShortDay,
  formatTimeOfDay,
  formatWeekdayDay,
} from "@vereinsheim/lib/format"

import { directionName, formatValue } from "../format"
import { PREVIOUS_LABEL, type DateRange, type PeriodChoice } from "../period/calendar"
import type { CardKind } from "../period/state"
import type { CompareModel, CompareRow, SideName } from "./model"

/** die drei Arten des Vergleichs, wie das Segment oben sie nennt */
export const COMPARE_TYPES = [
  { value: "cards", label: "Zwei Scheiben" },
  { value: "periods", label: "Zwei Zeiträume" },
  { value: "kind", label: "Wettkampf und Training" },
] as const

/** die Art für beide Zeiträume */
export const COMPARE_KINDS: readonly { value: CardKind; label: string }[] = [
  { value: "all", label: "Alle Arten" },
  { value: "training", label: "Training" },
  { value: "competition", label: "Wettkampf" },
]

/** unter dieser Differenz heißt es „gleich viele“: zwei Stellen nach dem Komma zeigten 0,00 */
const LEVEL = 0.005

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Seiten bei Wettkampf und Training: A ist Wettkampf, B Training */
export const KIND_NAMES: { a: SideName; b: SideName } = {
  a: { name: "Wettkampf", at: "im Wettkampf" },
  b: { name: "Training", at: "im Training" },
}

/** ein Zeitraum als Seite: der Name wie im Fortschritt, im Satz mit Präposition */
export function periodSideName(choice: PeriodChoice | "previous", range: DateRange): SideName {
  if (choice === "previous") return { name: PREVIOUS_LABEL, at: "im Zeitraum davor" }
  switch (choice.type) {
    case "rolling":
      return {
        name: range.label,
        at:
          choice.days === 182
            ? "in den letzten 6 Monaten"
            : choice.days === 365
              ? "in den letzten 12 Monaten"
              : `in den letzten ${choice.days} Tagen`,
      }
    case "all":
      return { name: range.label, at: "in allem" }
    case "named":
      return { name: range.label, at: `in „${range.label}“` }
    case "free":
      return { name: range.label, at: `vom ${range.label.replace(" – ", " bis ")}` }
  }
}

/**
 * zwei Scheiben als Seiten: im Chip Wochentag, Tag und Ergebnis („Do 09.10., 362,4“), im Satz der Tag („am 09.10.“),
 * an demselben Tag mit Uhrzeit
 */
export function cardSideNames(
  a: { startedAtMs: number; total: string | null },
  b: { startedAtMs: number; total: string | null },
  timeZone: string
): { a: SideName; b: SideName } {
  const day = (ms: number) => formatShortDay(new Date(ms), timeZone)
  const sameDay = day(a.startedAtMs) === day(b.startedAtMs)
  const name = (card: typeof a): SideName => {
    const at = new Date(card.startedAtMs)
    const when = formatWeekdayDay(at, timeZone)
    return {
      name: card.total === null ? when : `${when}, ${card.total}`,
      at: sameDay
        ? `am ${day(card.startedAtMs)} um ${formatTimeOfDay(at, timeZone)}`
        : `am ${day(card.startedAtMs)}`,
    }
  }
  return { a: name(a), b: name(b) }
}

const unitWord = (model: Pick<CompareModel, "unit">) =>
  model.unit === "shot" ? "Schüsse" : "Scheiben"

/** ein Hinweis statt des Vergleichs, wenn eine Seite leer ist; sonst null */
export function emptySideText(model: Pick<CompareModel, "type" | "a" | "b">): string | null {
  if (model.a.cards && model.b.cards) return null
  if (model.type === "kind")
    return model.a.cards
      ? "In diesem Zeitraum gibt es kein Training."
      : "In diesem Zeitraum gibt es keinen Wettkampf."
  const empty = model.a.cards ? model.b : model.a
  return `${empty.name} hat keine Scheibe. Wähle einen anderen Zeitraum.`
}

/**
 * Die Antwort als Satz: zuerst das Ergebnis je Schuss (A gegen B), dann Streuung und Lage. Ein Urteil nur mit Test;
 * „gleich viele“ unter 0,005 Ringen.
 */
export function compareSentence(model: CompareModel): { lead: string; more: string | null } {
  const empty = emptySideText(model)
  if (empty) return { lead: empty, more: null }
  const c = model.result.comparison
  if (!c || c.test === null)
    return { lead: `Für einen Vergleich sind es zu wenige ${unitWord(model)}.`, more: null }
  const a = model.a.at
  const b = model.b.at
  const lead =
    Math.abs(c.delta) < LEVEL
      ? `${capital(a)} gleich viele Ringe je Schuss wie ${b}.`
      : `${capital(a)} ${formatValue(Math.abs(c.delta), 2)} Ringe je Schuss ${
          c.delta > 0 ? "mehr" : "weniger"
        } als ${b}. ${
          c.verdict === "unclear"
            ? "Ein klarer Unterschied ist das nicht."
            : "Das ist ein klarer Unterschied."
        }`
  const spread = model.spread.comparison
  const spreadClear = spread !== null && spread.verdict !== "unclear"
  const shift = model.position?.verdict === "shifted" ? model.position : null
  const more = [
    spreadClear
      ? `Die Streuung ist ${a} klar ${spread.verdict === "lower" ? "kleiner" : "größer"}.`
      : null,
    shift
      ? `Die Mitte lag ${a} ${formatValue(shift.distanceUm / 1000, 1)} mm weiter ${directionName(shift.shiftUm)}.`
      : null,
  ].filter(Boolean)
  return {
    lead,
    more: more.length ? more.join(" ") : "Streuung und Lage zeigen keinen klaren Unterschied.",
  }
}

/** das Urteil unter einer Zeile in Worten: wer klar besser ist, sonst kein klarer Unterschied oder zu wenige */
export function rowVerdict(row: CompareRow, model: CompareModel): string {
  const c = row.comparison
  if (!c || c.test === null) return `Zu wenige ${unitWord(model)}.`
  if (c.verdict === "unclear") return "Kein klarer Unterschied."
  const aHigher = c.verdict === "higher"
  if (row.better === "none") return `Klar höher: ${(aHigher ? model.a : model.b).name}.`
  const aBetter = aHigher === (row.better === "higher")
  return `Klar besser: ${(aBetter ? model.a : model.b).name}.`
}

/** der Abstand der Mitten als Wert der Zeile Lage („1,1 mm auseinander“); ohne Lage null */
export function positionValue(model: CompareModel): string | null {
  const p = model.position
  return p ? `${formatValue(p.distanceUm / 1000, 1)} mm auseinander` : null
}

/** das Urteil unter der Zeile Lage */
export function positionVerdict(model: CompareModel): string {
  const p = model.position
  if (!p || p.verdict === "few") return `Zu wenige ${unitWord(model)}.`
  if (p.verdict === "none") return "Kein klarer Unterschied."
  return `Klar versetzt: ${model.a.at} weiter ${directionName(p.shiftUm)}.`
}

/** warum eine Zeile ohne Wert ist („–“ mit Grund) */
export function missingReason(row: Pick<CompareRow, "key">): string {
  if (row.key.startsWith("group.")) return "Ohne Lage der Schüsse."
  if (row.key.startsWith("time.")) return "Ohne Zeit der Schüsse."
  return "Ohne Wertungsschuss."
}

const cards = (n: number) => `${formatInteger(n)} ${n === 1 ? "Scheibe" : "Scheiben"}`

/** die Grundlage unter den Zeilen: Scheiben und Schüsse je Seite, geteilte Scheiben, bei zwei Scheiben die Schüsse */
export function basisText(model: CompareModel): string {
  if (model.unit === "shot")
    return `Verglichen Schuss für Schuss: ${formatInteger(model.a.shots)} gegen ${formatInteger(model.b.shots)} Wertungsschüsse.`
  const side = (label: string, s: CompareModel["a"]) =>
    `${label}: ${cards(s.cards)}, ${formatInteger(s.shots)} Schuss${
      s.withoutPosition ? `, ${formatInteger(s.withoutPosition)} ohne Lage` : ""
    }.`
  const shared = model.shared
    ? model.shared === 1
      ? " 1 Scheibe liegt in beiden Zeiträumen. Sie zählt nur in A."
      : ` ${formatInteger(model.shared)} Scheiben liegen in beiden Zeiträumen. Sie zählen nur in A.`
    : ""
  return `${side("A", model.a)} ${side("B", model.b)}${shared}`
}

/** die Legende unter dem Bild; ohne jede Lage der Hinweis, dass das Bild fehlt */
export function pictureLegend(picture: CompareModel["picture"]): string {
  if (picture.style === "outlines")
    return "Durchgezogen: die Hälfte der Schüsse. Gestrichelt: 9 von 10."
  if (!picture.a.points.length && !picture.b.points.length)
    return "Für das Bild fehlen die Lagen der Schüsse."
  return "Jeder Punkt ist ein Schuss. Der Ringwert steht in den Zahlen."
}

/** warum zwei Scheiben nicht verglichen werden */
export type CardProblem = "missing" | "same" | "families"

export function problemText(problem: CardProblem): string {
  switch (problem) {
    case "missing":
      return "Wähle zwei Scheiben."
    case "same":
      return "Wähle zwei verschiedene Scheiben."
    case "families":
      return "Die beiden Scheiben gehören zu verschiedenen Disziplinen. Wähle zwei aus einer."
  }
}
