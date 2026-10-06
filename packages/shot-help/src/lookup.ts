// Nachschlagen für die Oberfläche: Das „?“ an einer Kachel fragt nach der Kennzahl, eine Karte nach
// ihrem Thema.

import { HELP_TOPICS } from "./topics"
import type { HelpTopic } from "./types"

export function helpTopic(id: string): HelpTopic | undefined {
  return HELP_TOPICS.find((topic) => topic.id === id)
}

/** das eine Thema zu einer Registry-Kennzahl (der Test erzwingt genau eins) */
export function helpForMetric(key: string): HelpTopic | undefined {
  return HELP_TOPICS.find((topic) => topic.metrics.includes(key))
}

/** alle Themen mit dieser Katalog-ID, in der Reihenfolge der Oberfläche */
export function helpForCatalog(id: string): HelpTopic[] {
  return HELP_TOPICS.filter((topic) => topic.catalog.includes(id))
}
