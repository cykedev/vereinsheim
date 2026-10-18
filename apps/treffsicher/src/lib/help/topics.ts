import type { HelpText } from "@vereinsheim/ui/design2/help"

/** Erklärungen der App, je Thema ein Schlüssel; das Blatt der Hilfe im Rahmen zeigt sie */
export const HELP_TOPICS: Readonly<Record<string, HelpText>> = {}

/** die Erklärung zu einem Thema; null: unbekannt */
export const helpTopic = (id: string | null): HelpText | null =>
  (id !== null && HELP_TOPICS[id]) || null
