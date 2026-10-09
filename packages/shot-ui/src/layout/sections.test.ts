import { describe, expect, it } from "vitest"

import { ANALYSIS_TABS } from "../analysis/AnalysisPanel"
import { hashFor, PAGE_SECTIONS, parseHash, TAB_ANCHORS } from "./sections"

describe("Abschnitte und Anker (D7)", () => {
  it("drei Abschnitte in der Reihenfolge der Seite, „Zahlen“ entfiel mit U1", () => {
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
    // den Reiter „Probe“ gibt es seit U4 nicht mehr: ein alter Anker gilt als Vorgabe (Review U4)
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
    // „Zahlen“ gibt es nur noch im Fortschritt: auf der Scheibe ein Anker ohne Bedeutung, also oben (U1)
    expect(parseHash("#numbers")).toBeNull()
  })
})
