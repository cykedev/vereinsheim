"use client"

import { helpTopic } from "@vereinsheim/shot-help/lookup"
import { createContext, useContext, type ReactNode } from "react"

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

const HelpTextsContext = createContext<HelpLookup>(shotHelp)

/**
 * Woher die Karten darunter Titel und Kurzsatz ihrer Erklärung nehmen; ohne aus `shot-help`. Treffsicher gibt seine
 * eigenen Texte (dieselbe Id öffnet dort sein Blatt).
 */
export function HelpTextsProvider({
  lookup,
  children,
}: {
  lookup: HelpLookup
  children?: ReactNode
}) {
  return <HelpTextsContext.Provider value={lookup}>{children}</HelpTextsContext.Provider>
}

export const useHelpTexts = () => useContext(HelpTextsContext)
