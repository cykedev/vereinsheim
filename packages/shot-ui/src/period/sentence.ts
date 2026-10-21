// Worte für den Vergleich und der Satz im Kopf der Seite eines Zeitraums. „deutlich“ (die Effektstärke) nur neben
// einem Urteil (B19: ohne Veränderung trifft es bei 5 gegen 5 Scheiben oft zu).

import type { PeriodComparison } from "@vereinsheim/shot-core/analysis"

import { formatDateOnly, zonedDayStartMs } from "@vereinsheim/lib/format"

import { formatValue } from "../format"
import { PREVIOUS_LABEL } from "./calendar"
import type { PeriodModel } from "./model"
import { CARD_WORDS, type PeriodWords } from "./words"

/**
 * Urteil in Alltagsworten: „deutlich besser“, „schwächer“, „kein klarer Unterschied“, „zu wenige Scheiben“;
 * ohne Richtung der Kennzahl (Tempo) „höher“ oder „tiefer“. Die Richtung der Zahl steht schon im Δ daneben.
 */
export function verdictText(
  comparison: PeriodComparison,
  better: "higher" | "lower" | "none",
  words: PeriodWords = CARD_WORDS
): string {
  if (comparison.test === null) return `zu wenige ${words.many}`
  if (comparison.verdict === "unclear") return "kein klarer Unterschied"
  const up = comparison.verdict === "higher"
  const word =
    better === "none"
      ? up
        ? "höher"
        : "tiefer"
      : (better === "higher") === up
        ? "besser"
        : "schwächer"
  return `${comparison.meaningful ? "deutlich " : ""}${word}`
}

/** unter diesem Abstand heißt es „gleichauf“: zwei Stellen nach dem Komma zeigten 0,00 */
const LEVEL = 0.005

/**
 * Ein Satz zum Zeitraum: Er beantwortet „Werde ich besser?“ im Ø je Schuss wie die Ergebnis-Box. Er
 * vergleicht mit dem gewählten Vergleich, sonst still mit dem Zeitraum davor, bei „Alles“ die letzten 90 Tage mit den
 * 90 davor (`PeriodModel.form`). „Ein klarer Unterschied“ steht nur bei einem Urteil, in denselben Worten wie `verdictText`.
 * Ohne Scheiben keiner.
 */
export function periodSentence(
  model: Pick<PeriodModel, "form">,
  words: PeriodWords = CARD_WORDS
): string | null {
  const form = model.form
  if (!form) return null
  const days = form.lastDays
  const other = days
    ? { dative: `den ${days} Tagen davor`, als: `in den ${days} Tagen davor` }
    : form.label === PREVIOUS_LABEL
      ? { dative: "dem Zeitraum davor", als: "im Zeitraum davor" }
      : { dative: `„${form.label}“`, als: `in „${form.label}“` }
  const subject = days
    ? `In den letzten ${days} Tagen liegt dein Ø je Schuss`
    : "Dein Ø je Schuss liegt"
  const c = form.comparison
  if (!c || c.test === null) {
    return days
      ? `Für einen Vergleich der letzten ${days} Tage mit den ${days} Tagen davor sind es zu wenige ${words.many}.`
      : `Für einen Vergleich mit ${other.dative} sind es zu wenige ${words.many}.`
  }
  if (Math.abs(c.delta) < LEVEL) return `${subject} gleichauf mit ${other.dative}.`
  // „…, nicht nachweisbar“ klingt wie ein Widerspruch zur Zahl davor
  const proven =
    c.verdict === "unclear"
      ? "Ein klarer Unterschied ist das aber nicht"
      : "Das ist ein klarer Unterschied"
  const direction = c.delta > 0 ? "höher" : "tiefer"
  return `${subject} ${formatValue(Math.abs(c.delta), 2)} ${direction} als ${other.als}. ${proven}.`
}

/**
 * Hinweis ohne Scheibe im Zeitraum: Nennt den letzten Abend der Familie in der gewählten Art (`calendar.all`), damit
 * ein leerer kurzer Zeitraum nicht wie ein Fehler aussieht; ohne jeden Abend der allgemeine Hinweis
 */
export function emptyPeriodText(
  lastDay: string | null,
  timeZone: string,
  words: PeriodWords = CARD_WORDS
): string {
  if (!lastDay)
    return `Keine ${words.one} in diesem Zeitraum. Wähle oben einen längeren Zeitraum oder eine andere Art.`
  const date = formatDateOnly(new Date(zonedDayStartMs(lastDay, timeZone)), timeZone)
  return `Keine ${words.one} in diesem Zeitraum. Deine letzte ${words.one} ist vom ${date}. Wähle oben einen anderen Zeitraum oder eine andere Art.`
}
