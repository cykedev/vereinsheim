"use client"

import { createContext, useContext } from "react"

/** öffnet das Blatt der Hilfe zu einem Thema (`shot-help`); das Blatt liegt einmal im Rahmen der App */
export const HelpContext = createContext<(helpId: string) => void>(() => {})

export const useHelp = () => useContext(HelpContext)
