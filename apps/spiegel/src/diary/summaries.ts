// Wie das Tagebuch einen Eintrag in einer Zeile nennt: Titel, Tag, Scheiben mit Ergebnis. Reine Funktionen.

import { formatWeekdayDay, zonedDayStartMs } from "@vereinsheim/lib/format"
import { formatValue } from "@vereinsheim/shot-ui/format"

import type { ResultValue } from "@/lib/results-read"

export type DiaryKindValue = "shooting" | "dry" | "mental"

/** der Tag wie in den Listen von Spiegel („Fr 13.03.“) */
export function dayLabel(day: string, timeZone: string): string {
  return formatWeekdayDay(new Date(zonedDayStartMs(day, timeZone) + 12 * 3_600_000), timeZone)
}

/** ein Ergebnis in Ringen in der Wertung, in der es steht („374,3 Ringe“) */
export const resultText = (result: ResultValue) =>
  `${formatValue(result.value, result.digits)} Ringe`

/** eine Scheibe eines Eintrags, soweit das Ergebnis des Eintrags sie braucht */
export type EntryResultCard = { result: ResultValue | null; probeOnly: boolean }

/**
 * Was ein Eintrag geschossen hat. Hängt mindestens eine Scheibe mit Wertung am Eintrag (verknüpft oder dazugekommen),
 * zählen nur diese, Probe-Scheiben daneben nicht. Ohne Wertung zählen die Probe-Scheiben. Ist es dann genau eine, ist
 * ihr Ergebnis das des Eintrags; null ohne Scheibe, bei mehreren oder ohne Ergebnis. Gefiltert wird nach `probeOnly`,
 * nicht nach `warmup`: Auch eine Probe nach der Wertung ist nicht das, was geschossen wurde. Die Seite eines Eintrags,
 * die Zeile der Liste und „Erwartet und geschossen“ nehmen diese eine Regel.
 */
export function shotResult(cards: readonly EntryResultCard[]): ResultValue | null {
  const scored = cards.filter((card) => !card.probeOnly)
  const counted = scored.length ? scored : cards
  return counted.length === 1 ? counted[0].result : null
}

export const KIND_WORDS: Readonly<Record<Exclude<DiaryKindValue, "shooting">, string>> = {
  dry: "Trockentraining",
  mental: "Mentaltraining",
}

/**
 * die Scheiben eines Eintrags in Worten: Art ohne Scheibe, sonst die Zahl aller Scheiben und das Ergebnis des Eintrags
 * (`shotResult`), wenn er eins hat („2 Scheiben · 374,3 Ringe“)
 */
export function cardsText(kind: DiaryKindValue, cards: readonly EntryResultCard[]): string {
  if (kind !== "shooting") return KIND_WORDS[kind]
  if (cards.length === 0) return "Noch keine Scheibe"
  const count = cards.length === 1 ? "1 Scheibe" : `${cards.length} Scheiben`
  const result = shotResult(cards)
  return result ? `${count} · ${resultText(result)}` : count
}

/** der Titel einer Karte in der Liste: das Vorhaben, sonst die Disziplin, sonst die Art */
export function entryTitle(entry: {
  intention: string | null
  family: string | null
  kind: DiaryKindValue
}): string {
  if (entry.intention) return entry.intention
  if (entry.family) return entry.family
  return entry.kind === "shooting" ? "Ohne Disziplin" : KIND_WORDS[entry.kind]
}

/**
 * Die Zeile unter dem Titel: Tag, die Disziplin nur, wenn das Vorhaben Titel ist, dann die Scheiben bzw. die Art
 * („Fr 13.03. · Luftpistole · 1 Scheibe · 374,3 Ringe“)
 */
export function entryLine(
  entry: {
    day: string
    intention: string | null
    family: string | null
    kind: DiaryKindValue
    cards: readonly EntryResultCard[]
  },
  timeZone: string
): string {
  const parts = [dayLabel(entry.day, timeZone)]
  if (entry.intention && entry.family) parts.push(entry.family)
  // ohne Vorhaben und ohne Disziplin ist die Art schon Titel
  if (entry.kind === "shooting" || entry.intention || entry.family)
    parts.push(cardsText(entry.kind, entry.cards))
  return parts.join(" · ")
}

/** die Metazeile im Kopf eines Eintrags: Disziplin und Art („Luftpistole · Training“, „Mentaltraining“) */
export function entryMeta(entry: {
  family: string | null
  kind: DiaryKindValue
  competition: boolean
}): string {
  if (entry.kind !== "shooting")
    return entry.family ? `${KIND_WORDS[entry.kind]} · ${entry.family}` : KIND_WORDS[entry.kind]
  const art = entry.competition ? "Wettkampf" : "Training"
  return entry.family ? `${entry.family} · ${art}` : art
}
