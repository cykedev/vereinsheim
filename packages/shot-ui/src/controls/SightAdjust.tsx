"use client"

import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { cn } from "@vereinsheim/lib/utils"
import { ToggleChip } from "@vereinsheim/ui/design2/toggle-chip"
import { useId } from "react"

export interface SightAdjustProps {
  /** alle Schüsse der Scheibe in Abgabefolge (`inShotOrder`) */
  shots: readonly MetricShot[]
  /** Nummern der Probeschüsse, nach denen das Visier verstellt wurde */
  adjustAfter: readonly number[]
  /** Schalter nach Probeschuss `after` an oder aus */
  onToggle: (after: number) => void
  className?: string
}

/**
 * Visier verstellt nach Probeschuss Pn (Spielwiese Version 13): je Probeschuss außer dem letzten ein
 * Schalter, ein zweiter Tipp nimmt die Verstellung zurück. Nach dem letzten Probeschuss gibt es keine
 * Probe mehr, die danach zählen könnte (`sightAdjustCut` verwirft sie). Ab zwei Probeschüssen.
 */
export function SightAdjust({ shots, adjustAfter, onToggle, className }: SightAdjustProps) {
  const id = useId()
  const probes = shots.filter((shot) => shot.kind === "probe").length
  if (probes < 2) return null
  return (
    <div className={cn("grid gap-2", className)}>
      <span id={id} className="text-[13px] text-muted-foreground">
        Visier verstellt nach
      </span>
      <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {Array.from({ length: probes - 1 }, (_, i) => i + 1).map((after) => (
          <ToggleChip
            key={after}
            pressed={adjustAfter.includes(after)}
            onPressedChange={() => onToggle(after)}
            className="min-h-9 min-w-11 justify-center px-2.5 tabular-nums"
          >
            {`P${after}`}
          </ToggleChip>
        ))}
      </div>
    </div>
  )
}
