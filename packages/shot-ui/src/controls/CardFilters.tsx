"use client"

import { Segmented } from "@vereinsheim/ui/design2/segmented"

import type { CardKind } from "../period/state"

export const KIND_OPTIONS: readonly { value: CardKind; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "training", label: "Training" },
  { value: "competition", label: "Wettkampf" },
]

export interface CardFiltersProps {
  /** die Familie, Pflicht (D5) */
  family: string
  /** Disziplin-Familien, die es gibt; erst ab zwei ein Umschalter */
  families: readonly { value: string; label: string }[]
  kind: CardKind
  onFamily: (family: string) => void
  onKind: (kind: CardKind) => void
}

/**
 * Familie und Art als Segmente, gemeinsam für die Seite eines Zeitraums (`PeriodControls`) und die Scheiben-Liste
 * (`ListControls`, Plan N2, D7). Ohne zweite Familie kein Umschalter „Familie“.
 */
export function CardFilters({ family, families, kind, onFamily, onKind }: CardFiltersProps) {
  return (
    <>
      {families.length > 1 && (
        <Segmented label="Familie" value={family} options={families} onChange={onFamily} />
      )}
      <Segmented label="Art" value={kind} options={KIND_OPTIONS} onChange={onKind} />
    </>
  )
}
