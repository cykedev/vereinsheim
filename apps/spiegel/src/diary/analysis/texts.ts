// Sichtbare Texte der Auswertung im Tagebuch an einer Stelle (Textbuch Spiegel, „Tagebuch (2c)“) und die Hilfe hinter
// den „?“. Reine Funktionen und Daten.

import type { HelpText } from "@vereinsheim/ui/design2/help"
import type { PeriodComparison } from "@vereinsheim/shot-core/analysis"
import { formatSigned, formatValue } from "@vereinsheim/shot-ui/format"
import { verdictText } from "@vereinsheim/shot-ui/period/sentence"

import type { WellbeingAspect } from "./influences"

/** Stellen eines Abstands je Schuss */
const DIGITS = 2
/** darunter heißt es „gleichauf“: zwei Stellen zeigten 0,00 */
const LEVEL = 0.005
/** ab so vielen je Seite ein Urteil (wie zwei Zeiträume) */
const MIN_SIDE = 5

const entries = (n: number) => (n === 1 ? "1 Eintrag" : `${n} Einträge`)
const abs = (x: number) => formatValue(Math.abs(x), DIGITS)

/** Name eines Merkmals und seiner beiden Gruppen */
export const ASPECT_WORDS: Readonly<
  Record<WellbeingAspect, { name: string; high: string; low: string }>
> = {
  sleep: { name: "Schlaf", high: "Guter Schlaf", low: "Schlechter" },
  energy: { name: "Energie", high: "Viel Energie", low: "Wenig" },
  stress: { name: "Stress", high: "Viel Stress", low: "Wenig" },
  motivation: { name: "Motivation", high: "Hohe Motivation", low: "Niedrige" },
}

/** wie ein Urteil aussieht: besser, schwächer oder keins */
export type Tone = "better" | "worse" | "none"

export const ANALYSIS_TEXTS = {
  tab: "Auswertung",
  all: "Alles",
  disciplines: "Disziplin",
  period: "Zeitraum",

  influences: "Einflüsse",
  influencesLead: (n: number) =>
    `Wie lagst du gegenüber deiner Form, je nach Befinden vor dem Training? ${entries(n)} mit Befinden.`,
  influencesEmpty:
    "Noch kein Eintrag mit Befinden. Trag es vor dem Training in einem Eintrag unter „Vorher“ ein. Ab 10 Einträgen zeigt Spiegel hier, ob es mit deinem Ergebnis zusammenhängt.",
  unclear: "Kein klarer Unterschied",
  undecided: "Noch kein Urteil",
  allSame: "Alle Einträge haben hier denselben Wert. So gibt es nichts zu vergleichen.",
  legendHigh: "hoher Wert",
  legendLow: "niedriger Wert",
  legendForm: "deine Form",
  stripForm: "Form",

  back: "Auswertung",
  legendAbove: "über der Mitte",
  legendBelow: "unter der Mitte",
  scatterHint:
    "Jeder Punkt ist ein Eintrag. Oben lagst du über deiner Form, unten darunter. Ein Tipp öffnet den Eintrag.",
  showAll: (n: number) => `Alle ${n} Einträge zeigen`,

  selfImage: "Selbstbild",

  execution: "Merkst du, wann eine Serie gut ist?",
  executionEmpty: "Noch keine bewertete Serie. Bewerte Serien im Eintrag unter „Nachher“.",

  expected: "Erwartet und geschossen",
  expectedColumns: { entry: "Eintrag", expected: "erwartet", shot: "geschossen", delta: "Abstand" },
  expectedEmpty:
    "Noch kein Eintrag mit erwartetem Ergebnis. Trag es im Eintrag bei der Prognose ein.",

  beforeAfter: "Vorher und nachher",
  before: "vorher",
  after: "nachher",
  meanOf: (n: number) => `Mittel aus ${entries(n)}`,
  noPair: "kein Eintrag mit beidem",
  beforeAfterEmpty:
    "Noch kein Eintrag mit Prognose und Feedback. Trag die Prognose vor dem Training ein und das Feedback danach.",
} as const

/** das Urteil eines Merkmals als Pille, von der hohen Gruppe aus („Viel Energie: besser“) */
export function influencePill(
  aspect: WellbeingAspect,
  comparison: PeriodComparison | null
): { text: string; tone: Tone } {
  if (!comparison || comparison.test === null)
    return { text: ANALYSIS_TEXTS.undecided, tone: "none" }
  if (comparison.verdict === "unclear") return { text: ANALYSIS_TEXTS.unclear, tone: "none" }
  return {
    text: `${ASPECT_WORDS[aspect].high}: ${verdictText(comparison, "higher")}`,
    tone: comparison.verdict === "higher" ? "better" : "worse",
  }
}

/** eine Gruppe gegenüber der Form: „0,21 über deiner Form“, „gleichauf mit deiner Form“ */
function toForm(mean: number, first: boolean): string {
  if (Math.abs(mean) < LEVEL) return first ? "gleichauf mit deiner Form" : "gleichauf"
  const side = mean > 0 ? "über" : "unter"
  return first ? `${abs(mean)} ${side} deiner Form` : `${abs(mean)} ${side}`
}

/**
 * Der Satz unter einem Merkmal: mit beiden Gruppen ihre Lage zur Form, sonst wie viele für ein Urteil fehlen, alle
 * gleich, dass es nichts zu vergleichen gibt
 */
export function influenceSentence(
  aspect: WellbeingAspect,
  row: {
    entered: number
    high: { n: number; mean: number | null }
    low: { n: number; mean: number | null }
  }
): string {
  const words = ASPECT_WORDS[aspect]
  const { high, low } = row
  if (row.entered && !high.n && !low.n) return ANALYSIS_TEXTS.allSame
  if (high.n < MIN_SIDE && low.n < MIN_SIDE)
    return `Über der Mitte ${high.n === 1 ? "liegt" : "liegen"} ${entries(high.n)}, darunter ${low.n}. Für ein Urteil braucht es auf jeder Seite ${MIN_SIDE}.`
  if (low.n < MIN_SIDE)
    return `Unter der Mitte ${low.n === 1 ? "liegt" : "liegen"} erst ${entries(low.n)}. Für ein Urteil braucht es ${MIN_SIDE}.`
  if (high.n < MIN_SIDE)
    return `Über der Mitte ${high.n === 1 ? "liegt" : "liegen"} erst ${entries(high.n)}. Für ein Urteil braucht es ${MIN_SIDE}.`
  return `${words.high}: ${toForm(high.mean ?? 0, true)} (${high.n}). ${words.low}: ${toForm(low.mean ?? 0, false)} (${low.n}).`
}

/** die Grundlage unter den Einflüssen: wer nicht zählt; null, wenn alle zählen */
export function influenceBasis(left: { noCard: number; noForm: number }): string | null {
  const { noCard, noForm } = left
  if (noCard && noForm)
    return `${entries(noCard)} ohne Scheibe und ${noForm} ohne fünf Scheiben davor zählen nicht mit.`
  if (noCard)
    return `${entries(noCard)} ohne Scheibe ${noCard === 1 ? "zählt" : "zählen"} nicht mit.`
  if (noForm)
    return `${entries(noForm)} ohne fünf Scheiben davor ${noForm === 1 ? "zählt" : "zählen"} nicht mit.`
  return null
}

/** die Unterzeile der Seite eines Merkmals („Luftpistole · Saison 26/27 · 14 Einträge“) */
export const factorSubline = (family: string, period: string, n: number) =>
  `${family} · ${period} · ${entries(n)}`

/** der Abstand der hohen zur niedrigen Gruppe („Abstand +0,35“) */
export const factorDelta = (delta: number) => `Abstand ${formatSigned(delta, DIGITS)}`

/** eine Zeile der Liste auf der Seite eines Merkmals („Training · Energie 4“) */
export const factorRow = (competition: boolean, aspect: WellbeingAspect, stage: number) =>
  `${competition ? "Wettkampf" : "Training"} · ${ASPECT_WORDS[aspect].name} ${stage}`

/** ein Abstand zur Form mit Vorzeichen („+0,21“) */
export const signedDistance = (distance: number) => formatSigned(distance, DIGITS)

/** ein Punkt der Wolke für Screenreader („Fr 13.03., Energie 4, +0,21 zur Form“) */
export const pointLabel = (day: string, aspect: WellbeingAspect, stage: number, distance: number) =>
  `${day}, ${ASPECT_WORDS[aspect].name} ${stage}, ${signedDistance(distance)} zur Form`

/** das Urteil der Ausführung als Pille */
export function executionPill(comparison: PeriodComparison | null): { text: string; tone: Tone } {
  if (!comparison || comparison.test === null)
    return { text: ANALYSIS_TEXTS.undecided, tone: "none" }
  if (comparison.verdict === "unclear") return { text: ANALYSIS_TEXTS.unclear, tone: "none" }
  if (comparison.verdict === "lower") return { text: "Eher umgekehrt", tone: "worse" }
  return { text: comparison.meaningful ? "Ja, deutlich" : "Ja", tone: "better" }
}

/** leise neben der Pille: „24 Serien an 6 Abenden“ */
export const executionCount = (series: number, evenings: number) =>
  `${series === 1 ? "1 Serie" : `${series} Serien`} an ${evenings === 1 ? "1 Abend" : `${evenings} Abenden`}`

/** der Satz der Ausführung: mit Test der Abstand, sonst wie viele fehlen */
export function executionSentence(result: {
  high: number
  low: number
  comparison: PeriodComparison | null
}): string {
  const c = result.comparison
  if (!c || c.test === null)
    return `Erst ${result.high} besser und ${result.low} schwächer bewertete Serien. Für ein Urteil braucht es je ${MIN_SIDE}.`
  const side = c.delta >= 0 ? "über" : "unter"
  return `Serien, die du besser bewertet hast, lagen ${abs(c.delta)} Ringe je Schuss ${side} den schwächer bewerteten derselben Scheibe.`
}

/** die Grundlage der Ausführung; null, wenn alle zählen */
export const executionBasis = (sameRated: number) =>
  sameRated
    ? `${sameRated === 1 ? "1 Scheibe" : `${sameRated} Scheiben`} mit gleich bewerteten Serien ${sameRated === 1 ? "zählt" : "zählen"} nicht mit.`
    : null

/** das Mittel von „Erwartet und geschossen“ */
export function expectedMean(mean: number, n: number): string {
  const rounded = Math.abs(mean) < 0.05
  const first = rounded
    ? "Im Mittel genau wie erwartet."
    : `Im Mittel ${formatValue(Math.abs(mean), 1)} Ringe ${mean < 0 ? "unter" : "über"} deiner Erwartung.`
  return `${first} ${entries(n)}. Für mehr als die Zahl reicht das nicht.`
}

/** die Grundlage von „Erwartet und geschossen“; null, wenn keiner fehlt */
export const expectedBasis = (left: number) =>
  left
    ? `${entries(left)} mit erwartetem Ergebnis ${left === 1 ? "hat" : "haben"} nicht genau eine Scheibe mit Ergebnis und ${left === 1 ? "fehlt" : "fehlen"} hier.`
    : null

/** Erklärungen hinter den „?“ der Auswertung */
export const ANALYSIS_HELP = {
  influences: {
    title: "Einflüsse",
    what: "Hier siehst du, ob dein Ergebnis mit deinem Befinden vor dem Training zusammenhängt. Jeder Eintrag zählt mit dem Abstand seines Ø je Schuss zu deiner Form.",
    read: "Deine Form ist der Schnitt deiner fünf Scheiben derselben Disziplin vor diesem Abend. Das ist dieselbe Linie wie der Schnitt der letzten fünf im Fortschritt. Je Merkmal teilt Spiegel deine Einträge am mittleren Wert. Der gefüllte Punkt zeigt die Einträge mit hohem Wert, der hohle die mit niedrigem.",
    caution:
      "Ein Zusammenhang ist noch kein Grund. Wer müde ist, trainiert vielleicht auch anders.",
    minimum:
      "Ein Urteil gibt es ab 5 Einträgen über und 5 unter der Mitte. Ein Eintrag zählt erst, wenn es fünf Scheiben davor gibt.",
  },
  selfImage: {
    title: "Selbstbild",
    what: "Hier siehst du, wie gut du dich selbst einschätzt: ob du gute Serien erkennst, wie nah dein erwartetes Ergebnis lag und wie du die Bereiche vorher und nachher gesehen hast.",
    read: "Bei den Serien vergleicht Spiegel nur Serien derselben Scheibe. So zählt die Tagesform nicht mit.",
    minimum:
      "Ein Urteil gibt es ab 5 Serien auf jeder Seite. Erwartet und geschossen sowie vorher und nachher zeigen nur Zahlen.",
  },
} as const satisfies Record<string, HelpText>

export type AnalysisHelpId = keyof typeof ANALYSIS_HELP
