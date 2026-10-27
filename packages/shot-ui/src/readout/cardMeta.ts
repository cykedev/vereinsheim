// Metazeile im Kopf einer Scheibe: Art, Liste aus Meyton, Wochentag mit Datum und Uhrzeit, wie die Scheiben-Liste sie
// zeigt. Datum und Uhrzeit über `@vereinsheim/lib/format` mit der Anzeige-Zeitzone als Parameter.

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { probeOnlyCard } from "@vereinsheim/shot-core/projection"
import { formatTimeOfDay, formatWeekdayDate } from "@vereinsheim/lib/format"

import { PROVENANCE_WORDS, type CardProvenance } from "../detail"
import { KIND_TEXT } from "../list/KindMark"
import { kindOf } from "../period/model"

/** leise statt der Uhrzeit, solange sie nicht bekannt ist (getippte ID ohne Ausdruck, bis die Anlage liefert) */
export const TIME_UNKNOWN = "ohne Uhrzeit"

/** die Uhrzeit einer Scheibe („19:12“); null, wenn sie nicht bekannt ist (`timeUnknown`) */
export const cardTime = (startedAtMs: number, timeZone: string, timeUnknown?: boolean) =>
  timeUnknown ? null : formatTimeOfDay(new Date(startedAtMs), timeZone)

/**
 * „Wettkampf · Liste RWK_LP · gemessen · Sa 26.09.2026 · 10:30“ oder „Training · eingetragen · Vereinsheim Nord ·
 * Sa 26.09.2026 · 10:30“ als Teile für `CardHeader` (`meta`); ohne Liste (PDF, eigene Scheiben), Herkunft oder Ort
 * fehlt der Teil, ohne bekannte Uhrzeit (`timeUnknown`) auch sie. Das Datum ist der Kalendertag des Beginns; die Liste der Scheiben ordnet eine Scheibe vor 4 Uhr
 * dem Abend davor zu, die Seite der Scheibe nennt den echten Tag.
 */
export function cardMeta(
  card: PeriodCard,
  timeZone: string,
  list?: { name: string } | null,
  extra: { provenance?: CardProvenance; place?: string | null; timeUnknown?: boolean } = {}
): string[] {
  const at = new Date(card.startedAtMs)
  const kind = KIND_TEXT[kindOf(card.kind, probeOnlyCard(card.shots, card.sums))]
  return [
    kind,
    ...(list ? [`Liste ${list.name}`] : []),
    ...(extra.provenance ? [PROVENANCE_WORDS[extra.provenance]] : []),
    ...(extra.place ? [extra.place] : []),
    formatWeekdayDate(at, timeZone),
    ...(extra.timeUnknown ? [] : [formatTimeOfDay(at, timeZone)]),
  ]
}
