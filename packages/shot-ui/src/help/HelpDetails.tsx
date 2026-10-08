import { VIEW_HELP } from "@vereinsheim/shot-help/guide"
import { helpTopic } from "@vereinsheim/shot-help/lookup"
import type { HelpTopic, ViewHelp } from "@vereinsheim/shot-help/types"
import { cn } from "@vereinsheim/lib/utils"

import { HelpBody } from "./HelpBody"
import { HelpIcon } from "./HelpButton"

/** Erklärung zu einer Karte (`helpTopic`) oder zur Oberfläche (`VIEW_HELP`); fehlt sie, ist das ein Fehler */
export function helpEntry(id: string): HelpTopic | ViewHelp {
  const entry = helpTopic(id) ?? VIEW_HELP.find((view) => view.id === id)
  if (!entry) throw new Error(`Keine Hilfe zu ${id}`)
  return entry
}

export interface HelpDetailsProps {
  /** Id der Erklärung in `shot-help` */
  id: string
  /** offen, solange der Schalter „Erklärungen“ an ist; einzeln auf- und zuklappbar */
  open: boolean
  className?: string
}

/** „Was heißt das?“ unter einer Karte: aufklappbar, mit dem Schalter „Erklärungen“ alle auf einmal */
export function HelpDetails({ id, open, className }: HelpDetailsProps) {
  const entry = helpEntry(id)
  return (
    <details data-help={id} open={open} className={cn("border-t border-border pt-2.5", className)}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-[7px] rounded text-[13px] font-semibold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <HelpIcon />
        Was heißt das?
      </summary>
      <HelpBody topic={entry} className="mt-2" />
    </details>
  )
}
