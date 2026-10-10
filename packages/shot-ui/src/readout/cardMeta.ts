// Metazeile im Kopf einer Scheibe: Art, Wochentag mit Datum und Uhrzeit, wie die Scheiben-Liste sie zeigt
// (User, 9. Oktober 2026: „auf der Scheiben-Seite fehlt die Uhrzeit“). Datum und Uhrzeit über `@vereinsheim/lib/format`
// mit der Anzeige-Zeitzone als Parameter.

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { formatTimeOfDay, formatWeekdayDate } from "@vereinsheim/lib/format"

import { KIND_TEXT } from "../list/KindMark"
import { kindOf, probeOnlyShots } from "../period/model"

/**
 * „Wettkampf · Sa 26.09.2026 · 10:30“ als Teile für `CardHeader` (`meta`). Das Datum ist der Kalendertag des Beginns;
 * die Liste ordnet eine Scheibe vor 4 Uhr dem Abend davor zu, die Seite der Scheibe nennt den echten Tag.
 */
export function cardMeta(card: PeriodCard, timeZone: string): string[] {
  const at = new Date(card.startedAtMs)
  const kind = KIND_TEXT[kindOf(card.kind, probeOnlyShots(card.shots))]
  return [kind, formatWeekdayDate(at, timeZone), formatTimeOfDay(at, timeZone)]
}
