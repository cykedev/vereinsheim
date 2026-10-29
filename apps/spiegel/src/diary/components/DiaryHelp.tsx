"use client"

import { useState } from "react"

import { HelpButton } from "@vereinsheim/shot-ui/help/HelpButton"
import { HelpSheet } from "@vereinsheim/ui/design2/help-sheet"

import { ANALYSIS_HELP, type AnalysisHelpId } from "../analysis/texts"

/** ein „?“ wie in der App, das die Erklärung eines Teils der Auswertung als Blatt öffnet */
export function DiaryHelp({ id }: { id: AnalysisHelpId }) {
  const [open, setOpen] = useState(false)
  const help = ANALYSIS_HELP[id]
  return (
    <>
      <HelpButton label={help.title} helpId={`diary-${id}`} onClick={() => setOpen(true)} />
      <HelpSheet entry={open ? help : null} onClose={() => setOpen(false)} />
    </>
  )
}
