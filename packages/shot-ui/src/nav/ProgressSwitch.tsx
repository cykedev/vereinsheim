"use client"

import { TabBar } from "@vereinsheim/ui/design2/tab-bar"

import { RouteLink } from "./RouteLink"
import type { Route } from "./routes"

const ENTRIES = [
  { key: "progress", label: "Zeitraum" },
  { key: "compare", label: "Vergleichen" },
] as const

/**
 * Oben im Bereich Fortschritt: „Zeitraum · Vergleichen“ als Reiter (`TabBar`) mit zwei Links. So findet man Vergleichen
 * auch am Telefon, wo die untere Leiste keinen Platz mehr hat (Scannen, Tagebuch); am Desktop steht es zusätzlich in
 * der Seitenleiste unter Fortschritt. Die gezeigte Seite trägt `aria-current`.
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
    <TabBar
      label="Fortschritt"
      items={ENTRIES}
      current={current}
      className={className}
      renderLink={(entry, props) => <RouteLink route={routes[entry.key]} {...props} />}
    />
  )
}
