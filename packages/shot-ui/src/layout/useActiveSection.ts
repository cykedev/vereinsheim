"use client"

import { useEffect, useState } from "react"

import { PAGE_SECTIONS, type PageSection } from "./sections"

const ORDER = PAGE_SECTIONS.map((s) => s.id as PageSection)

/**
 * Aktiver Abschnitt aus denen, die gerade die Mitte des Fensters schneiden: der späteste in der Seite (am
 * Desktop schneidet die feste Scheibe immer); schneidet keiner, bleibt der vorige (etwa über den Serien).
 */
export function pickActive(
  intersecting: ReadonlySet<PageSection>,
  previous: PageSection | null
): PageSection | null {
  const last = [...ORDER].reverse().find((id) => intersecting.has(id))
  return last ?? previous
}

/**
 * Beobachtet die Elemente mit `data-section` und liefert den aktiven Abschnitt für die Sprungleiste; ohne
 * `IntersectionObserver` (Server, Test) null. `key` beobachtet neu, wenn die Seite neu aufgebaut wird.
 */
export function useActiveSection(key?: unknown): PageSection | null {
  const [active, setActive] = useState<PageSection | null>(null)
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return
    const intersecting = new Set<PageSection>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.getAttribute("data-section") as PageSection
          if (entry.isIntersecting) intersecting.add(id)
          else intersecting.delete(id)
        }
        setActive((previous) => pickActive(intersecting, previous))
      },
      // ein schmaler Streifen etwas über der Mitte des Fensters
      { rootMargin: "-40% 0px -55% 0px" }
    )
    for (const node of document.querySelectorAll("[data-section]")) observer.observe(node)
    return () => observer.disconnect()
  }, [key])
  return active
}
