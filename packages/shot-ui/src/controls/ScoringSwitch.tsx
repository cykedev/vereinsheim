"use client"

import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { cn } from "@vereinsheim/lib/utils"
import { Segmented } from "@vereinsheim/ui/design2/segmented"

const LABELS: Readonly<Record<Scoring, string>> = { decimal: "Zehntel", rings: "Ganze Ringe" }

export interface ScoringSwitchProps {
  scoring: Scoring
  /** amtliche Wertung der Scheibe, wenn bekannt; bleibt als Hinweis sichtbar */
  official?: Scoring
  onChange: (scoring: Scoring) => void
  className?: string
}

/**
 * Wertung umschalten (spiegel-ui-design „Ganze Ringe oder Zehntel, jederzeit“): Zehntel oder ganze Ringe,
 * daneben die amtliche Wertung als Hinweis, auch wenn umgeschaltet ist.
 */
export function ScoringSwitch({ scoring, official, onChange, className }: ScoringSwitchProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Segmented
        label="Wertung"
        value={scoring}
        options={[
          { value: "decimal", label: LABELS.decimal },
          { value: "rings", label: LABELS.rings },
        ]}
        onChange={onChange}
      />
      {official && (
        <span className="text-[13px] text-muted-foreground">
          {`amtlich: ${official === "rings" ? "ganze Ringe" : LABELS.decimal}`}
        </span>
      )}
    </div>
  )
}
