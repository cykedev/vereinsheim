"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { HelpButton } from "@vereinsheim/ui/design2/help"
import { useHelp } from "@vereinsheim/ui/design2/help-sheet"
import { ToggleChip } from "@vereinsheim/ui/design2/toggle-chip"
import { HELP_TOPICS, type HelpTopicId } from "@/lib/help/topics"

const ExplainContext = createContext<{ on: boolean; set: (on: boolean) => void }>({
  on: false,
  set: () => {},
})

/** der Schalter „Erklärungen“ einer Seite: an, steht unter jedem Titel mit „?“ der Kurzsatz (wie Spiegel) */
export function ExplainProvider({ children }: { children: ReactNode }) {
  const [on, set] = useState(false)
  return <ExplainContext.Provider value={{ on, set }}>{children}</ExplainContext.Provider>
}

export function ExplainSwitch() {
  const { on, set } = useContext(ExplainContext)
  return (
    <ToggleChip pressed={on} onPressedChange={set}>
      Erklärungen
    </ToggleChip>
  )
}

/** „?“ neben einem Titel; öffnet die Erklärung als Blatt */
export function HelpMark({ id }: { id: HelpTopicId }) {
  const openHelp = useHelp()
  return (
    <HelpButton
      label={HELP_TOPICS[id].title}
      helpId={id}
      onClick={() => openHelp(id)}
      className="ml-auto"
    />
  )
}

/** der Kurzsatz unter einem Titel, solange „Erklärungen“ an ist */
export function HelpShort({ id }: { id: HelpTopicId }) {
  const { on } = useContext(ExplainContext)
  if (!on) return null
  return (
    <p data-help-short={id} className="text-[13px] font-normal text-foreground-2">
      {HELP_TOPICS[id].short}
    </p>
  )
}
