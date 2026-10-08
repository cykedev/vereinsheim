"use client"

import { helpForMetric } from "@vereinsheim/shot-help/lookup"
import { Sheet } from "@vereinsheim/ui/design2/sheet"

import { HelpBody } from "./HelpBody"

export interface HelpSheetProps {
  /** Kennzahl, deren Erklärung offen ist; null: Blatt zu */
  metricKey: string | null
  onClose: () => void
}

/**
 * Die Erklärung einer Kennzahl als Blatt (spiegel-ui-design: auf dem Handy von unten, auf dem Desktop als
 * Karte daneben). Titel ist das Thema aus `shot-help`; das Blatt bleibt eingehängt, damit der Browser den
 * Fokus beim Schließen zurückgibt.
 */
export function HelpSheet({ metricKey, onClose }: HelpSheetProps) {
  const topic = metricKey ? helpForMetric(metricKey) : undefined
  return (
    <Sheet open={!!topic} title={topic?.title ?? ""} onClose={onClose}>
      {topic && <HelpBody topic={topic} />}
    </Sheet>
  )
}
