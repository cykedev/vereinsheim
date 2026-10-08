import { describe, expect, it } from "vitest"

import { ANALYSIS_TABS } from "../analysis/AnalysisPanel"
import { hashFor, PAGE_SECTIONS, parseHash, TAB_ANCHORS } from "./sections"

describe("Abschnitte und Anker (D7)", () => {
  it("vier Abschnitte in der Reihenfolge der Seite", () => {
    expect(PAGE_SECTIONS.map((s) => s.label)).toEqual(["Scheibe", "Schüsse", "Zahlen", "Analyse"])
  })

  it("jeder Abschnitt hin und zurück", () => {
    for (const { id } of PAGE_SECTIONS) expect(parseHash(hashFor(id))).toEqual({ section: id })
  })

  it("jeder Reiter hin und zurück, öffnet die Analyse", () => {
    for (const { value } of ANALYSIS_TABS) {
      expect(parseHash(hashFor("analyse", value))).toEqual({ section: "analyse", tab: value })
    }
    expect(hashFor("analyse", "position")).toBe("#lage")
    expect(parseHash("#zeit")).toEqual({ section: "analyse", tab: "time" })
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
  })
})
