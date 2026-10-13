"use client"

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { cn } from "@vereinsheim/lib/utils"
import { Segmented } from "@vereinsheim/ui/design2/segmented"

type Kind = PeriodCard["kind"]

export interface KindSwitchProps {
  kind: Kind
  onChange: (kind: Kind) => void
  className?: string
}

/**
 * Art der Scheibe umschalten (Plan `plans/2026-10-12-spiegel-art.md`): Training oder Wettkampf. Eine Scheibe nur aus Probe
 * ist immer Training; dort zeigt die Seite keinen Schalter.
 */
export function KindSwitch({ kind, onChange, className }: KindSwitchProps) {
  // im selben Rahmen wie `ScoringSwitch`: in einem Raster nicht auf die ganze Breite gezogen
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Segmented
        label="Art"
        value={kind}
        options={[
          { value: "training", label: "Training" },
          { value: "competition", label: "Wettkampf" },
        ]}
        onChange={onChange}
      />
    </div>
  )
}
