"use client"

import { cn } from "@vereinsheim/lib/utils"
import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { Segmented } from "@vereinsheim/ui/design2/segmented"

const OPTIONS = [
  { value: "rings", label: "Ganze Ringe" },
  { value: "decimal", label: "Zehntel" },
] as const satisfies readonly { value: Scoring; label: string }[]

export interface ScoringSegmentProps {
  scoring: Scoring
  /** sichtbar davor, der Bezug: „Ø in“ (Liste), „Wertung“ (Fortschritt) */
  prefix: string
  /** Name der Gruppe für Screenreader: „Wertung für Ø und Abstand“ */
  label: string
  onChange: (scoring: Scoring) => void
  className?: string
}

/**
 * Wertung als beschriftete Auswahl in einer Filterzeile (User, 13. Oktober 2026: „sprechender … der platz ist da und der
 * direkte bezug fehlt“): davor der Bezug, dann „Ganze Ringe | Zehntel“. Der Kreis (`ScoringToggle`) bleibt für die
 * Stelle direkt neben einer Zahl.
 */
export function ScoringSegment({
  scoring,
  prefix,
  label,
  onChange,
  className,
}: ScoringSegmentProps) {
  return (
    <span
      data-scoring-segment={scoring}
      className={cn("inline-flex items-center gap-2", className)}
    >
      <span aria-hidden="true" className="text-[13px] text-muted-foreground">
        {prefix}
      </span>
      <Segmented label={label} options={OPTIONS} value={scoring} onChange={onChange} />
    </span>
  )
}
