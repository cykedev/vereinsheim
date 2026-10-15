"use client"

import { cn } from "@vereinsheim/lib/utils"
import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { RoundToggle } from "@vereinsheim/ui/design2/round-toggle"

const NAME: Readonly<Record<Scoring, string>> = { decimal: "Zehntel", rings: "ganze Ringe" }
const TITLE: Readonly<Record<Scoring, string>> = { decimal: "Zehntel", rings: "Ganze Ringe" }
const other = (scoring: Scoring): Scoring => (scoring === "rings" ? "decimal" : "rings")

export interface ScoringToggleProps {
  scoring: Scoring
  /** amtliche Wertung der Scheibe, wenn bekannt: Der Name nennt sie so, als Zustand oder als Wirkung */
  official?: Scoring
  /** Name der Wahl; „Wertung“, wo nicht nur ein Teil der Seite umgestellt wird */
  label?: string
  onChange: (scoring: Scoring) => void
  className?: string
}

/**
 * Wertung im weichen Kreis: 1 ganze Ringe, ⅒ Zehntel; ein
 * Tippen stellt auf die andere. Ob die gezeigte die amtliche ist, sagen Name und Tooltip (kein Punkt: er erklärt sich
 * nicht); ist es die andere, nennt der Name sie in der Wirkung.
 */
export function ScoringToggle({
  scoring,
  official,
  label = "Wertung",
  onChange,
  className,
}: ScoringToggleProps) {
  const amtlich = official === scoring ? ", amtlich" : ""
  const next = other(scoring)
  const nextAmtlich = official === next ? " (amtlich)" : ""
  return (
    <RoundToggle
      label={`${label}: ${NAME[scoring]}${amtlich}, auf ${NAME[next]}${nextAmtlich} umstellen`}
      title={`${TITLE[scoring]}${amtlich}`}
      onClick={() => onChange(next)}
      data-scoring-toggle=""
      data-scoring={scoring}
      className={className}
    >
      {/* Zehntel als Bruch der Schrift (Geist `frac`): die tiefgestellten Zeichen ₀–₉ fehlen in den geladenen Teilen
          von Geist; ganze Ringe als 1, in 13 px so ruhig wie die kleinen Ziffern des Bruchs */}
      <span
        aria-hidden="true"
        className={cn(
          // die Größe zuerst: eine spätere Schriftgröße nimmt tailwind-merge als Zeilenhöhe und striche `leading-none`
          scoring === "decimal" ? "text-base diagonal-fractions" : "text-[13px]",
          "leading-none font-medium text-muted-foreground"
        )}
      >
        {scoring === "rings" ? "1" : "1/10"}
      </span>
    </RoundToggle>
  )
}
