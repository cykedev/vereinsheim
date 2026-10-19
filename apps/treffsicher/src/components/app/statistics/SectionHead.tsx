"use client"

import { HelpButton } from "@vereinsheim/shot-ui/help/HelpButton"

import { helpTopic } from "@/lib/help/topics"

/**
 * Kopf eines Reiters der Analyse: Titel, Unterzeile und „?“ zu seinem Thema; mit „Erklärungen“ steht der Kurzsatz
 * darunter, wie bei den Karten aus `shot-ui`
 */
export function SectionHead({
  title,
  sub,
  helpId,
  explain,
  onHelp,
}: {
  title: string
  sub: string
  helpId: string
  explain: boolean
  onHelp: (id: string) => void
}) {
  const short = helpTopic(helpId)?.short
  return (
    <div className="grid min-w-0 gap-1">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
        <HelpButton label={title} helpId={helpId} onClick={() => onHelp(helpId)} />
      </div>
      <p className="text-[13px] text-muted-foreground">{sub}</p>
      {explain && short && (
        <p data-short="true" className="text-[12.5px] leading-snug text-foreground-2">
          {short}
        </p>
      )}
    </div>
  )
}
