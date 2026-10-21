import { describe, expect, it } from "vitest"

import { ANALYSIS_TABS } from "../analysis/AnalysisPanel"
import {
  hashFor,
  PAGE_SECTIONS,
  parseHash,
  parsePeriodAnchor,
  PERIOD_SECTIONS,
  periodSections,
  TAB_ANCHORS,
} from "./sections"

describe("Abschnitte und Anker", () => {
  it("drei Abschnitte in der Reihenfolge der Seite, ohne „Zahlen“", () => {
    expect(PAGE_SECTIONS.map((s) => s.label)).toEqual(["Scheibe", "Schüsse", "Analyse"])
    expect(PAGE_SECTIONS.map((s) => s.id)).toEqual(["target", "shots", "analysis"])
  })

  it("jeder Abschnitt hin und zurück", () => {
    for (const { id } of PAGE_SECTIONS) expect(parseHash(hashFor(id))).toEqual({ section: id })
  })

  it("jeder Reiter hin und zurück, öffnet die Analyse", () => {
    for (const { value } of ANALYSIS_TABS) {
      expect(parseHash(hashFor("analysis", value))).toEqual({ section: "analysis", tab: value })
    }
    expect(hashFor("analysis", "position")).toBe("#position")
    expect(parseHash("#time")).toEqual({ section: "analysis", tab: "time" })
    // einen Reiter „Probe“ gibt es nicht: ein alter Anker gilt als Vorgabe
    expect(parseHash("#sighters")).toBeNull()
  })

  it("nur einfache Anker ohne = (im Artifact kommt nur so einer an), alle verschieden", () => {
    const anchors = [...PAGE_SECTIONS.map((s) => s.id), ...Object.values(TAB_ANCHORS)]
    for (const anchor of anchors) expect(anchor).toMatch(/^[a-z]+$/)
    expect(new Set(anchors).size).toBe(anchors.length)
  })

  it("Unbekanntes und leerer Anker ergeben nichts", () => {
    expect(parseHash("")).toBeNull()
    expect(parseHash("#")).toBeNull()
    expect(parseHash("#pruefen")).toBeNull()
    expect(parseHash("#Lage")).toBeNull()
    // „Zahlen“ gibt es nur im Fortschritt: auf der Scheibe ein Anker ohne Bedeutung, also oben
    expect(parseHash("#numbers")).toBeNull()
  })
})

describe("Seite eines Zeitraums", () => {
  it("mit dem Trefferbild heißt der erste Abschnitt so, der Anker bleibt", () => {
    expect(periodSections("history")).toEqual(PERIOD_SECTIONS)
    expect(periodSections("target").map((s) => s.label)).toEqual([
      "Trefferbild",
      "Scheiben",
      "Zahlen",
      "Analyse",
    ])
    expect(periodSections("target")[0].id).toBe("history")
  })

  it("Abschnitte und die drei Reiter der Analyse aus dem Anker", () => {
    expect(parsePeriodAnchor("#cards")).toEqual({ section: "cards" })
    expect(parsePeriodAnchor("#position")).toEqual({ section: "analysis", tab: "position" })
    expect(parsePeriodAnchor("#precision")).toEqual({ section: "analysis", tab: "precision" })
    expect(parsePeriodAnchor("#result")).toEqual({ section: "analysis", tab: "result" })
    // den Reiter „Zeit und Verlauf“ hat der Zeitraum (noch) nicht
    expect(parsePeriodAnchor("#time")).toBeNull()
    expect(parsePeriodAnchor("#gibts-nicht")).toBeNull()
  })
})
