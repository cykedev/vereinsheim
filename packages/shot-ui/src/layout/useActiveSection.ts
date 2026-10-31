"use client"

import { useEffect, useState } from "react"

import { BAR_PX } from "@vereinsheim/ui/design2/bar"
import { PAGE_SECTIONS, type PageSection } from "./sections"

const PAGE_IDS: readonly PageSection[] = PAGE_SECTIONS.map((section) => section.id)

/** ein Abschnitt zählt, sobald sein Anfang die Leiste erreicht hat: Leiste plus 40 px Luft */
const LINE_PX = BAR_PX + 40

/** so nah beieinander beginnen Abschnitte, die nebeneinander stehen */
const SAME_ROW_PX = 2

/**
 * Aktiver Abschnitt: der späteste in der Seite, dessen Anfang schon an der Leiste angekommen ist. Ein Sprung
 * über die Leiste legt den Abschnitt genau unter sie und macht ihn so aktiv, auch wenn er kürzer ist als das
 * Fenster (die Zahlen in voller Breite); ein Anteil der Fensterhöhe hätte dann schon den
 * nächsten gezählt. Über den Serien bleibt die Scheibe aktiv, am Desktop löst ein Abschnitt rechts die feste
 * Scheibe ab. Oben auf der Seite, bevor einer die Leiste erreicht, der erste; am Ende der Seite der letzte, denn
 * ein kurzer letzter Abschnitt erreicht die Leiste sonst nie. Stehen Abschnitte nebeneinander (gleicher Anfang, etwa
 * Bild und Zahlen auf Vergleichen ab 768 px), gilt unter ihnen der zuletzt angesprungene (`jumped`, der Anker der
 * Adresse); sonst der späteste.
 */
export function activeSection<T extends string>(
  boxes: readonly { id: T; top: number }[],
  atBottom = false,
  jumped: string | null = null
): T | null {
  if (!boxes.length) return null
  if (atBottom) return boxes[boxes.length - 1].id
  const started = boxes.filter((b) => b.top < LINE_PX)
  if (!started.length) return boxes[0].id
  const latest = started[started.length - 1]
  const beside = started.filter((b) => Math.abs(b.top - latest.top) < SAME_ROW_PX)
  return (beside.find((b) => b.id === jumped) ?? latest).id
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
      setActive(activeSection(boxes, atBottom, window.location.hash.slice(1) || null))
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
