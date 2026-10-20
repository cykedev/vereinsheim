"use client"

import { cn } from "@vereinsheim/lib/utils"
import { HelpButton } from "@vereinsheim/ui/design2/help"
import { useHelp } from "@vereinsheim/ui/design2/help-sheet"

import { HELP_TOPICS, type HelpTopicId } from "@/lib/help/topics"

/**
 * „?“ an einer Zahl oder Überschrift: öffnet ihre Erklärung als Blatt (`AppShell`). Der Klick geht nicht weiter an
 * das Element darum, ein sortierbarer Spaltenkopf ordnet dabei nicht um. `className` sitzt an der Hülle, damit etwa
 * `ml-auto` das „?“ in einer Zeile nach rechts schiebt.
 */
export function HelpMark({ id, className }: { id: HelpTopicId; className?: string }) {
  const openHelp = useHelp()
  return (
    <span className={cn("inline-flex", className)} onClick={(event) => event.stopPropagation()}>
      <HelpButton label={HELP_TOPICS[id].title} helpId={id} onClick={() => openHelp(id)} />
    </span>
  )
}
