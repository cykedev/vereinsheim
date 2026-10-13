"use client"

import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { RoundToggle } from "@vereinsheim/ui/design2/round-toggle"

const NAME: Readonly<Record<Scoring, string>> = { decimal: "Zehntel", rings: "ganze Ringe" }
const TITLE: Readonly<Record<Scoring, string>> = { decimal: "Zehntel", rings: "Ganze Ringe" }
const other = (scoring: Scoring): Scoring => (scoring === "rings" ? "decimal" : "rings")

export interface ScoringToggleProps {
  scoring: Scoring
  /** amtliche Wertung der Scheibe, wenn bekannt: Ist sie die gezeigte, nennt der Name sie so */
  official?: Scoring
  /** Name der Wahl; „Wertung“, wo nicht nur ein Teil der Seite umgestellt wird */
  label?: string
  onChange: (scoring: Scoring) => void
  className?: string
}

/**
 * Wertung als Bruch im weichen Kreis (Plan `plans/2026-10-13-spiegel-symbole.md`): ¹⁄₁ ganze Ringe, ¹⁄₁₀ Zehntel; ein
 * Tippen stellt auf die andere. Ob die gezeigte die amtliche ist, sagen Name und Tooltip (kein Punkt: er erklärte sich
 * nicht, User, 13. Oktober 2026).
 */
export function ScoringToggle({
  scoring,
  official,
  label = "Wertung",
  onChange,
  className,
}: ScoringToggleProps) {
  const amtlich = official === scoring ? ", amtlich" : ""
  return (
    <RoundToggle
      label={`${label}: ${NAME[scoring]}${amtlich}, auf ${NAME[other(scoring)]} umstellen`}
      title={`${TITLE[scoring]}${amtlich}`}
      onClick={() => onChange(other(scoring))}
      data-scoring-toggle=""
      data-scoring={scoring}
      className={className}
    >
      <span
        aria-hidden="true"
        className="text-sm leading-none font-semibold tracking-[-0.04em] whitespace-nowrap text-foreground-2"
      >
        <sup className="align-[4px] text-xs">1</sup>⁄
        <sub className="align-[-2px] text-xs">{scoring === "rings" ? "1" : "10"}</sub>
      </span>
    </RoundToggle>
  )
}
