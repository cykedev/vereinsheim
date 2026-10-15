"use client"

import { cn } from "@vereinsheim/lib/utils"
import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { ArrowRightLeft } from "lucide-react"

const NAME: Readonly<Record<Scoring, string>> = { decimal: "Zehntel", rings: "ganze Ringe" }
const other = (scoring: Scoring): Scoring => (scoring === "rings" ? "decimal" : "rings")

export interface ScoringChipProps {
  scoring: Scoring
  /** was der Chip zeigt, je Wertung mit dem Bezug: „Ø in ganzen Ringen“ (Liste), „In Zehnteln“ (Fortschritt) */
  texts: Readonly<Record<Scoring, string>>
  /** Name für Screenreader vor Zustand und Wirkung: „Wertung für Ø und Abstand“ */
  label: string
  onChange: (scoring: Scoring) => void
  className?: string
}

/**
 * Wertung als Wechsel-Chip in einer Filterzeile: so groß wie der Chip
 * „Filter“, in Worten mit Bezug, ein Tippen stellt um. Neutral umrandet mit ⇄, damit er sich vom blauen Chip
 * unterscheidet, der ein Blatt öffnet. Eine beschriftete Auswahl „Ganze Ringe | Zehntel“ bräche am Telefon in eine
 * dritte Zeile um; neben einer Zahl steht stattdessen der Kreis (`ScoringToggle`).
 */
export function ScoringChip({ scoring, texts, label, onChange, className }: ScoringChipProps) {
  return (
    <button
      type="button"
      aria-label={`${label}: ${NAME[scoring]}, auf ${NAME[other(scoring)]} umstellen`}
      onClick={() => onChange(other(scoring))}
      data-scoring-chip=""
      data-scoring={scoring}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line-strong bg-card px-3 py-1.5 text-[13px] leading-tight font-semibold whitespace-nowrap text-foreground hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className
      )}
    >
      <ArrowRightLeft aria-hidden="true" />
      {texts[scoring]}
    </button>
  )
}
