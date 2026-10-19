"use client"

import { createContext, useContext, type ReactNode } from "react"

import { shotHelp, type HelpLookup } from "./headings"

export type { HelpHeading, HelpLookup } from "./headings"

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
