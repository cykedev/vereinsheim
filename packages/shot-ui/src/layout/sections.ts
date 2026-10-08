// Abschnitte der Seite einer Scheibe und ihre Anker (Plan Schritt 4, D1 und D7). Ein Anker ist ein einfaches
// Wort ohne `=`: Im Artifact kommt nur so einer an. Reiter-Anker öffnen den Reiter und führen zur Analyse.

import type { AnalysisTab } from "../analysis/tabs"

// in Seitenreihenfolge: die Schüsse stehen neben der Scheibe (und auf dem Telefon gleich nach ihr), Zahlen
// und Analyse darunter in voller Breite (User, 8. Oktober 2026)
export const PAGE_SECTIONS = [
  { id: "scheibe", label: "Scheibe" },
  { id: "schuesse", label: "Schüsse" },
  { id: "zahlen", label: "Zahlen" },
  { id: "analyse", label: "Analyse" },
] as const

export type PageSection = (typeof PAGE_SECTIONS)[number]["id"]

export const TAB_ANCHORS: Readonly<Record<AnalysisTab, string>> = {
  overview: "ueberblick",
  result: "ergebnis",
  precision: "praezision",
  position: "lage",
  time: "zeit",
  sighters: "probe",
}

export interface PageAnchor {
  section: PageSection
  tab?: AnalysisTab
}

/** Abschnitt und Reiter aus `location.hash`; Unbekanntes null */
export function parseHash(hash: string): PageAnchor | null {
  const word = hash.replace(/^#/, "")
  const section = PAGE_SECTIONS.find((s) => s.id === word)
  if (section) return { section: section.id }
  const tab = (Object.keys(TAB_ANCHORS) as AnalysisTab[]).find((t) => TAB_ANCHORS[t] === word)
  return tab ? { section: "analyse", tab } : null
}

/** Anker eines Abschnitts oder, mit Reiter, des Reiters der Analyse */
export function hashFor(section: PageSection, tab?: AnalysisTab): string {
  return `#${tab ? TAB_ANCHORS[tab] : section}`
}
