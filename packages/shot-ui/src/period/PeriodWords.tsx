"use client"

import { createContext, useContext, type ReactNode } from "react"

import { CARD_WORDS, type PeriodWords } from "./words"

const WordsContext = createContext<PeriodWords>(CARD_WORDS)

/** die Wörter für die Bausteine darunter; ohne gelten die von Spiegel (`CARD_WORDS`) */
export function PeriodWordsProvider({
  words,
  children,
}: {
  words: PeriodWords
  children?: ReactNode
}) {
  return <WordsContext.Provider value={words}>{children}</WordsContext.Provider>
}

export const usePeriodWords = () => useContext(WordsContext)
