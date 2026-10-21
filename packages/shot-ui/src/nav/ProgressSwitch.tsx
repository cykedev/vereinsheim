"use client"

import { cn } from "@vereinsheim/lib/utils"

import { RouteLink } from "./RouteLink"
import type { Route } from "./routes"

const ENTRIES = [
  { key: "progress", label: "Zeitraum" },
  { key: "compare", label: "Vergleichen" },
] as const

/**
 * Oben im Bereich Fortschritt: „Zeitraum · Vergleichen“ als zwei Links im Look des Segment-Umschalters. So findet man
 * Vergleichen auch am Telefon, wo die untere Leiste keinen Platz mehr hat (Scannen, Tagebuch); am Desktop steht es
 * zusätzlich in der Seitenleiste unter Fortschritt. Die gezeigte Seite trägt `aria-current`.
 */
export function ProgressSwitch({
  current,
  progress,
  compare,
  className,
}: {
  current: "progress" | "compare"
  /** wohin „Zeitraum“ führt: der Fortschritt in der Familie */
  progress: Route
  /** wohin „Vergleichen“ führt: aus dem Fortschritt mit dem Paar seines Satzes */
  compare: Route
  className?: string
}) {
  const routes = { progress, compare }
  return (
    <nav
      aria-label="Fortschritt"
      data-progress-switch
      className={cn(
        "inline-flex w-max max-w-full rounded-full border border-border bg-surface-2 p-[3px]",
        className
      )}
    >
      {ENTRIES.map((entry) => (
        <RouteLink
          key={entry.key}
          route={routes[entry.key]}
          aria-current={current === entry.key ? "page" : undefined}
          className="inline-flex min-h-8 items-center rounded-full px-4 text-[13px] font-semibold text-foreground-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:bg-card aria-[current=page]:text-foreground aria-[current=page]:shadow-sm"
        >
          {entry.label}
        </RouteLink>
      ))}
    </nav>
  )
}
