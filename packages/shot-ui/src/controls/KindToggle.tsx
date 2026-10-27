"use client"

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { RoundToggle } from "@vereinsheim/ui/design2/round-toggle"
import { Trophy } from "lucide-react"
import { useId } from "react"

type Kind = PeriodCard["kind"]

const NAME: Readonly<Record<Kind, string>> = { training: "Training", competition: "Wettkampf" }

export interface KindToggleProps {
  kind: Kind
  onChange: (kind: Kind) => void
  className?: string
}

/**
 * Art der Scheibe als Pokal im weichen Kreis: Training durchgestrichen und
 * leise, Wettkampf in Gold; ein Tippen stellt auf die andere. Auf jeder eigenen Scheibe, auch nur aus Probe.
 */
export function KindToggle({ kind, onChange, className }: KindToggleProps) {
  const next: Kind = kind === "competition" ? "training" : "competition"
  return (
    <RoundToggle
      label={`Art: ${NAME[kind]}, auf ${NAME[next]} umstellen`}
      title={NAME[kind]}
      tone={kind === "competition" ? "gold" : "default"}
      onClick={() => onChange(next)}
      data-kind-toggle=""
      data-kind={kind}
      className={className}
    >
      {kind === "competition" ? <Trophy aria-hidden="true" /> : <TrophyOff />}
    </RoundToggle>
  )
}

/** die Pfade des Pokals aus `lucide-react` (`trophy`, ISC) */
const TROPHY_PATHS = [
  "M10 14.66V17a1 1 0 0 1-1 1 2 2 0 0 0-2 2v2",
  "M14 14.66V17a1 1 0 0 0 1 1 2 2 0 0 1 2 2v2",
  "M17.916 10H19.5A2.5 2.5 0 0 0 22 7.5V5a1 1 0 0 0-1-1h-3",
  "M4 22h16",
  "M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z",
  "M6.084 10H4.5A2.5 2.5 0 0 1 2 7.5V5a1 1 0 0 1 1-1h3",
] as const

/**
 * Pokal durchgestrichen: `lucide-react` hat keinen. Wie dessen „-off“-Symbole schneidet der
 * Strich eine Lücke in den Pokal, über eine Maske statt einer Linie in der Hintergrundfarbe: sauber auf jedem Grund,
 * auch beim Darüberfahren.
 */
function TrophyOff() {
  const mask = `trophy-off-${useId().replace(/[^\w-]/g, "")}`
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="lucide lucide-trophy-off"
    >
      <mask id={mask}>
        <rect width="24" height="24" fill="white" stroke="none" />
        <path d="m2 2 20 20" stroke="black" strokeWidth={5} />
      </mask>
      <g mask={`url(#${mask})`}>
        {TROPHY_PATHS.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      <path d="m2 2 20 20" />
    </svg>
  )
}
