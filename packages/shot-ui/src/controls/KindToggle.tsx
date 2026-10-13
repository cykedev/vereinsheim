"use client"

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import { RoundToggle } from "@vereinsheim/ui/design2/round-toggle"
import { Trophy } from "lucide-react"

type Kind = PeriodCard["kind"]

const NAME: Readonly<Record<Kind, string>> = { training: "Training", competition: "Wettkampf" }

export interface KindToggleProps {
  kind: Kind
  onChange: (kind: Kind) => void
  className?: string
}

/**
 * Art der Scheibe als Pokal im weichen Kreis (Plan `plans/2026-10-13-spiegel-symbole.md`): Training gedämpft, Wettkampf
 * in Gold; ein Tippen stellt auf die andere. Ohne Strich: `lucide-react` hat keinen durchgestrichenen Pokal, Farbe und
 * Tönung trennen beide ruhiger. Eine Scheibe nur aus Probe ist Training; dort zeigt die Seite keinen Kreis.
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
      <Trophy aria-hidden="true" />
    </RoundToggle>
  )
}
