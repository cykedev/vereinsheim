// Metazeile im Kopf einer Scheibe: Art, Liste aus Meyton, Wochentag mit Datum und Uhrzeit, wie die Scheiben-Liste sie
// zeigt (User, 9. Oktober 2026: „auf der Scheiben-Seite fehlt die Uhrzeit“; 15. Oktober 2026: „Rangliste anzeigen, zu der
// die Scheibe gehört“). Datum und Uhrzeit über `@vereinsheim/lib/format`
// mit der Anzeige-Zeitzone als Parameter.

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { formatTimeOfDay, formatWeekdayDate } from "@vereinsheim/lib/format"

import { KIND_TEXT } from "../list/KindMark"
import { kindOf, probeOnlyShots } from "../period/model"

/**
 * „Wettkampf · Liste RWK_LP · Sa 26.09.2026 · 10:30“ als Teile für `CardHeader` (`meta`); ohne Liste (PDF, eigene
 * Scheiben) fehlt sie. Das Datum ist der Kalendertag des Beginns; die Liste der Scheiben ordnet eine Scheibe vor 4 Uhr
 * dem Abend davor zu, die Seite der Scheibe nennt den echten Tag.
 */
export function cardMeta(
  card: PeriodCard,
  timeZone: string,
  list?: { name: string } | null
): string[] {
  const at = new Date(card.startedAtMs)
  const kind = KIND_TEXT[kindOf(card.kind, probeOnlyShots(card.shots))]
  return [
    kind,
    ...(list ? [`Liste ${list.name}`] : []),
    formatWeekdayDate(at, timeZone),
    formatTimeOfDay(at, timeZone),
  ]
}
