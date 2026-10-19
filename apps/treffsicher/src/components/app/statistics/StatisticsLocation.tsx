"use client"

import { useState } from "react"

import { ChartSlot } from "@vereinsheim/shot-ui/analysis/charts/frame"
import { countOf } from "@vereinsheim/shot-ui/period/words"

import type { LocationSummary } from "@/lib/statistics/location"
import { locationText } from "@/lib/statistics/locationText"
import { SESSION_WORDS } from "@/lib/statistics/words"

import { LocationCloud } from "./LocationCloud"
import { LocationCourse } from "./LocationCourse"

const box = "grid min-w-0 content-start gap-3 rounded-2xl border border-border bg-card p-4"

/**
 * Reiter „Trefferlage“: die Lage vom Ausdruck je Einheit als Wolke mit dem Mittel und ihr Verlauf je Achse. Das
 * Lineal im Verlauf wählt eine Einheit, die Wolke hebt sie hervor.
 */
export function StatisticsLocation({
  summary,
  timeZone,
}: {
  summary: LocationSummary
  timeZone: string
}) {
  const [chosen, setChosen] = useState<string | null>(null)
  return (
    <section aria-label="Trefferlage" className="@container grid gap-4">
      <div className="grid min-w-0 gap-1">
        <h2 className="font-display text-xl font-bold tracking-tight">Trefferlage</h2>
        <p className="text-[13px] text-muted-foreground">
          {summary.mean
            ? `Lage vom Ausdruck, im Mittel über ${countOf(summary.points.length, SESSION_WORDS)}: ${locationText(summary.mean)}.`
            : "Im Zeitraum hast du keine Trefferlage eingetragen."}
        </p>
      </div>
      {summary.mean && (
        <div className="grid gap-4 @min-[48rem]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <article className={box}>
            <h3 className="font-display text-base font-bold">Lage je Einheit</h3>
            <LocationCloud summary={summary} chosen={chosen} />
          </article>
          <article className={box}>
            <h3 className="font-display text-base font-bold">Lage im Verlauf</h3>
            <ChartSlot height={300}>
              {(width) => (
                <LocationCourse
                  width={width}
                  summary={summary}
                  timeZone={timeZone}
                  chosen={chosen}
                  onChoose={setChosen}
                />
              )}
            </ChartSlot>
          </article>
        </div>
      )}
    </section>
  )
}
