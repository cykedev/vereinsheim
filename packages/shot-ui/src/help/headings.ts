// Titel und Kurzsatz einer Erklärung für den Kopf einer Karte, rein (ohne React): Spiegel nimmt sie aus `shot-help`,
// eine andere App gibt eigene (`HelpTextsProvider`).

import { helpTopic } from "@vereinsheim/shot-help/lookup"

import { helpEntry } from "./HelpDetails"

/** was eine Karte von einer Erklärung zeigt: Titel und Kurzsatz */
export interface HelpHeading {
  title: string
  short?: string
}

export type HelpLookup = (id: string) => HelpHeading

/** die Erklärungen aus `shot-help`: Thema oder Oberfläche; den Kurzsatz haben nur Themen */
export const shotHelp: HelpLookup = (id) => ({
  title: helpEntry(id).title,
  short: helpTopic(id)?.short,
})
