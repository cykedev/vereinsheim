"use client"

import { ArrowLeftRight } from "lucide-react"

import { compareCards } from "@vereinsheim/shot-ui/nav/navigate"
import { RouteLink } from "@vereinsheim/shot-ui/nav/RouteLink"

/**
 * Am Ende der Seite einer Scheibe, über dem Kasten „Diese Scheibe“: der Weg auf die Seite Vergleichen mit dieser Scheibe
 * als A und der Scheibe davor in ihrer Familie als B. Nur für den Besitzer und nur, wenn es eine Scheibe davor gibt.
 */
export function CompareWithPrevious({ cardId, previous }: { cardId: string; previous: string }) {
  return (
    <section data-compare-previous className="rounded-2xl border border-border bg-card p-4">
      <RouteLink
        route={compareCards(cardId, previous)}
        className="inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
      >
        <ArrowLeftRight aria-hidden="true" className="size-4" />
        Mit der Scheibe davor vergleichen
      </RouteLink>
    </section>
  )
}
