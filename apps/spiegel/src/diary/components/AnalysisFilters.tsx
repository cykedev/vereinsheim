"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"

import { Segmented } from "@vereinsheim/ui/design2/segmented"

import { analysisHref } from "../paths"
import { ANALYSIS_TEXTS } from "../analysis/texts"
import type { Family } from "../queries"

const CHIP =
  "inline-flex h-8 items-center rounded-full border border-line-strong px-3 text-[13px] font-semibold text-foreground-2 focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:border-primary aria-[current=page]:text-foreground"

const ALL = "all"

/**
 * Disziplin und Zeitraum der Auswertung: Chips der Disziplinen als Links (der Zeitraum bleibt), darunter „Alles“ und
 * die Saisons (die Disziplin bleibt). Ohne Disziplin weder Chips noch Zeitraum. Am Desktop in einer Zeile.
 */
export function AnalysisFilters({
  families,
  family,
  seasons,
  season,
}: {
  families: readonly Family[]
  family: Family | null
  seasons: readonly { key: string; label: string }[]
  season: string | null
}) {
  const router = useRouter()
  if (!family) return null
  return (
    <div data-analysis-filters className="grid gap-3 md:flex md:flex-wrap md:items-center">
      <nav aria-label={ANALYSIS_TEXTS.disciplines} className="flex flex-wrap gap-2">
        {families.map((f) => (
          <Link
            key={f.id}
            href={analysisHref(f.slug, season)}
            aria-current={f.id === family.id ? "page" : undefined}
            className={CHIP}
          >
            {f.name}
          </Link>
        ))}
      </nav>
      <Segmented
        label={ANALYSIS_TEXTS.period}
        wrap
        options={[
          { value: ALL, label: ANALYSIS_TEXTS.all },
          ...seasons.map((s) => ({ value: s.key, label: s.label })),
        ]}
        value={season ?? ALL}
        onChange={(value) => router.push(analysisHref(family.slug, value === ALL ? null : value))}
      />
    </div>
  )
}
