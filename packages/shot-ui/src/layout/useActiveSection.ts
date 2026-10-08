"use client"

import { useEffect, useState } from "react"

import type { PageSection } from "./sections"

/** ein Abschnitt zählt, sobald er oberhalb dieser Höhe des Fensters begonnen hat (Anteil) */
const LINE = 0.45

/**
 * Aktiver Abschnitt: der späteste in der Seite, der schon oberhalb von 45 % der Fensterhöhe begonnen hat.
 * Über den Serien bleibt so die Scheibe aktiv, am Desktop löst ein Abschnitt rechts die feste Scheibe ab;
 * ganz oben, solange noch keiner begonnen hat, keiner.
 */
export function activeSection(
  boxes: readonly { id: PageSection; top: number }[],
  viewportHeight: number
): PageSection | null {
  const started = boxes.filter((b) => b.top < viewportHeight * LINE)
  return started.length ? started[started.length - 1].id : null
}

/**
 * Aktiver Abschnitt für die Sprungleiste: misst bei jedem Scrollen und jeder Größenänderung die Kästen der
 * Elemente mit `data-section` (vier Stück, in Seitenreihenfolge). Ein Scroll-Ereignis statt eines
 * `IntersectionObserver`: dessen Rückrufe bleiben in einem verborgenen Fenster und in der Skriptprüfung aus.
 * Ohne Fenster (Server) null.
 */
export function useActiveSection(): PageSection | null {
  const [active, setActive] = useState<PageSection | null>(null)
  useEffect(() => {
    const measure = () => {
      const boxes = [...document.querySelectorAll<HTMLElement>("[data-section]")].map((node) => ({
        id: node.dataset.section as PageSection,
        top: node.getBoundingClientRect().top,
      }))
      setActive(activeSection(boxes, window.innerHeight))
    }
    measure()
    window.addEventListener("scroll", measure, { passive: true })
    window.addEventListener("resize", measure)
    return () => {
      window.removeEventListener("scroll", measure)
      window.removeEventListener("resize", measure)
    }
  }, [])
  return active
}
