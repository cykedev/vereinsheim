"use client"

import { createContext, useContext } from "react"

/**
 * wohin „Scheiben“ führt: die zuletzt besuchte Liste (`areaLinks` in `AppShell`), ohne Rahmen `/cards`. Der Reiter
 * „Scheiben“ im Tagebuch liest es hier, damit er wie die Leiste zur gemerkten Liste führt.
 */
const CardsLinkContext = createContext("/cards")

export const CardsLinkProvider = CardsLinkContext.Provider

export function useCardsLink(): string {
  return useContext(CardsLinkContext)
}
