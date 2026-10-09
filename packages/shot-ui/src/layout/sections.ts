// Abschnitte der Seite einer Scheibe und ihre Anker (Plan Schritt 4, D1 und D7). Ein Anker ist ein einfaches
// englisches Wort ohne `=` wie Pfade und Schlüssel der Adresse (User, 9. Oktober 2026): Im Artifact kommt nur so
// einer an. Reiter-Anker öffnen den Reiter und führen zur Analyse.

import type { AnalysisTab } from "../analysis/tabs"

// in Seitenreihenfolge: die Schüsse stehen neben der Scheibe (und auf dem Telefon gleich nach ihr), Zahlen
// und Analyse darunter in voller Breite (User, 8. Oktober 2026)
export const PAGE_SECTIONS = [
  { id: "target", label: "Scheibe" },
  { id: "shots", label: "Schüsse" },
  { id: "numbers", label: "Zahlen" },
  { id: "analysis", label: "Analyse" },
] as const

export type PageSection = (typeof PAGE_SECTIONS)[number]["id"]

/** Abschnitte der Seite eines Zeitraums (Plan L3, D2): der Verlauf steht, wo auf der Scheibe die Scheibe steht */
export const PERIOD_SECTIONS = [
  { id: "history", label: "Verlauf" },
  { id: "cards", label: "Scheiben" },
  { id: "numbers", label: "Zahlen" },
  { id: "analysis", label: "Analyse" },
] as const

export type PeriodSection = (typeof PERIOD_SECTIONS)[number]["id"]

/** Abschnitt der Seite eines Zeitraums aus `location.hash`; Unbekanntes null */
export function parsePeriodHash(hash: string): PeriodSection | null {
  const word = hash.replace(/^#/, "")
  return PERIOD_SECTIONS.find((s) => s.id === word)?.id ?? null
}

/** Anker der Reiter: englisch wie Pfade und Schlüssel der Adresse (User, 9. Oktober 2026), gleich dem Reiter */
export const TAB_ANCHORS: Readonly<Record<AnalysisTab, string>> = {
  overview: "overview",
  result: "result",
  precision: "precision",
  position: "position",
  time: "time",
  sighters: "sighters",
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
  return tab ? { section: "analysis", tab } : null
}

/** Anker eines Abschnitts oder, mit Reiter, des Reiters der Analyse */
export function hashFor(section: PageSection, tab?: AnalysisTab): string {
  return `#${tab ? TAB_ANCHORS[tab] : section}`
}
