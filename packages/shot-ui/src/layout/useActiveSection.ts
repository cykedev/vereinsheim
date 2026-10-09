"use client"

import { useEffect, useState } from "react"

import { PAGE_SECTIONS, type PageSection } from "./sections"

const PAGE_IDS: readonly PageSection[] = PAGE_SECTIONS.map((section) => section.id)

/** ein Abschnitt zählt, sobald sein Anfang die Leiste erreicht hat: 56 px Leiste plus 40 px Luft */
const LINE_PX = 96

/**
 * Aktiver Abschnitt: der späteste in der Seite, dessen Anfang schon an der Leiste angekommen ist. Ein Sprung
 * über die Leiste legt den Abschnitt genau unter sie und macht ihn so aktiv, auch wenn er kürzer ist als das
 * Fenster (die Zahlen in voller Breite, User, 8. Oktober 2026); ein Anteil der Fensterhöhe hätte dann schon den
 * nächsten gezählt. Über den Serien bleibt die Scheibe aktiv, am Desktop löst ein Abschnitt rechts die feste
 * Scheibe ab. Oben auf der Seite, bevor einer die Leiste erreicht, der erste; am Ende der Seite der letzte, denn
 * ein kurzer letzter Abschnitt erreicht die Leiste sonst nie.
 */
export function activeSection<T extends string>(
  boxes: readonly { id: T; top: number }[],
  atBottom = false
): T | null {
  if (!boxes.length) return null
  if (atBottom) return boxes[boxes.length - 1].id
  const started = boxes.filter((b) => b.top < LINE_PX)
  return (started.length ? started[started.length - 1] : boxes[0]).id
}

/**
 * Aktiver Abschnitt für die Sprungleiste: misst bei jedem Scrollen und jeder Größenänderung die Kästen der
 * Elemente mit `data-section` aus `ids` (vier Stück, in Seitenreihenfolge; ohne Angabe die der Scheibe). Ein Scroll-Ereignis statt eines
 * `IntersectionObserver`: dessen Rückrufe bleiben in einem verborgenen Fenster und in der Skriptprüfung aus.
 * Ohne Fenster (Server) null.
 */
export function useActiveSection<T extends string = PageSection>(
  ids: readonly T[] = PAGE_IDS as readonly T[]
): T | null {
  const [active, setActive] = useState<T | null>(null)
  // als Text in die Abhängigkeiten: ein neues Feld mit denselben Ids misst nicht neu
  const key = ids.join(" ")
  useEffect(() => {
    const wanted = new Set<string>(key.split(" "))
    const measure = () => {
      const boxes = [...document.querySelectorAll<HTMLElement>("[data-section]")]
        .filter((node) => wanted.has(node.dataset.section ?? ""))
        .map((node) => ({
          id: node.dataset.section as T,
          top: node.getBoundingClientRect().top,
        }))
      const root = document.documentElement
      const atBottom = window.scrollY + window.innerHeight >= root.scrollHeight - 1
      setActive(activeSection(boxes, atBottom))
    }
    measure()
    window.addEventListener("scroll", measure, { passive: true })
    window.addEventListener("resize", measure)
    return () => {
      window.removeEventListener("scroll", measure)
      window.removeEventListener("resize", measure)
    }
  }, [key])
  return active
}
