// Abschnitte der Seite einer Scheibe und ihre Anker. Ein Anker ist ein einfaches
// englisches Wort ohne `=` wie Pfade und Schlüssel der Adresse: Im Artifact kommt nur so
// einer an. Reiter-Anker öffnen den Reiter und führen zur Analyse.

import type { AnalysisTab } from "../analysis/tabs"
import type { PeriodShow } from "../period/state"

// in Seitenreihenfolge: die Schüsse stehen neben der Scheibe (und auf dem Telefon gleich nach ihr), die Analyse
// darunter in voller Breite. Einen Abschnitt „Zahlen“ gibt es nicht: Der Überblick der Analyse ist die
// Zahlen-Ansicht
export const PAGE_SECTIONS = [
  { id: "target", label: "Scheibe" },
  { id: "shots", label: "Schüsse" },
  { id: "analysis", label: "Analyse" },
] as const

export type PageSection = (typeof PAGE_SECTIONS)[number]["id"]

/** Abschnitte der Seite eines Zeitraums: der Verlauf steht, wo auf der Scheibe die Scheibe steht */
export const PERIOD_SECTIONS = [
  { id: "history", label: "Verlauf" },
  { id: "cards", label: "Scheiben" },
  { id: "numbers", label: "Zahlen" },
  { id: "analysis", label: "Analyse" },
] as const

export type PeriodSection = (typeof PERIOD_SECTIONS)[number]["id"]

/** die Sprungleiste des Zeitraums: Zeigt das Hauptbild das Trefferbild, heißt sein Abschnitt so (Anker bleibt) */
export function periodSections(show: PeriodShow) {
  return PERIOD_SECTIONS.map((s) =>
    s.id === "history" && show === "target" ? { ...s, label: "Trefferbild" } : s
  )
}

/** Reiter der Analyse über den Zeitraum, in der Ordnung der Scheibe */
export type PeriodTab = Extract<AnalysisTab, "result" | "precision" | "position">

/** Abschnitt und Reiter der Seite eines Zeitraums aus `location.hash`; ein Reiter-Anker führt zur Analyse */
export function parsePeriodAnchor(
  hash: string
): { section: PeriodSection; tab?: PeriodTab } | null {
  const section = parsePeriodHash(hash)
  if (section) return { section }
  const word = hash.replace(/^#/, "")
  const tab = (["result", "precision", "position"] as const).find((t) => TAB_ANCHORS[t] === word)
  return tab ? { section: "analysis", tab } : null
}

/** Abschnitt der Seite eines Zeitraums aus `location.hash`; Unbekanntes null */
export function parsePeriodHash(hash: string): PeriodSection | null {
  const word = hash.replace(/^#/, "")
  return PERIOD_SECTIONS.find((s) => s.id === word)?.id ?? null
}

/** Anker der Reiter: englisch wie Pfade und Schlüssel der Adresse, gleich dem Reiter */
export const TAB_ANCHORS: Readonly<Record<AnalysisTab, string>> = {
  overview: "overview",
  result: "result",
  precision: "precision",
  position: "position",
  time: "time",
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
