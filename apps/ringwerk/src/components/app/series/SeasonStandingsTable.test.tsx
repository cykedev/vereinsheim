import { describe, it, expect } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { SeasonStandingsTable } from "./SeasonStandingsTable"
import type {
  ResolvedSeasonSort,
  SortedSeasonStandingsEntry,
} from "@/lib/scoring/sortSeasonStandings"

// Markup-Test ohne jsdom: renderToStaticMarkup genügt für alles, was am gerenderten
// class-Attribut hängt — hier die mobile Spaltenwahl und die inerten Spaltenköpfe.

const MOBILE_HIDDEN = "hidden sm:table-cell"

function makeEntry(
  name: string,
  rings: number,
  teiler: number,
  ringteiler: number,
  alternatingBy: "rings" | "teiler" | null
): SortedSeasonStandingsEntry {
  return {
    participantId: name,
    participantName: name,
    seriesCount: 2,
    meetsMinSeries: true,
    bestRings: rings,
    bestRingsScoringType: "WHOLE",
    bestRings_rank: 1,
    bestCorrectedTeiler: teiler,
    bestTeiler_rank: 1,
    bestRingteiler: ringteiler,
    bestRingteiler_rank: 1,
    alternatingBy,
  }
}

function render(sort: ResolvedSeasonSort): string {
  const alternating = sort === "alt-rings" || sort === "alt-teiler"
  const entries = [
    makeEntry("Berta", 92, 3.5, 11.5, alternating ? "teiler" : null),
    makeEntry("Anton", 98, 12.0, 14.0, alternating ? "rings" : null),
  ]
  return renderToStaticMarkup(
    createElement(SeasonStandingsTable, { entries, minSeries: 2, sort, isMixed: true })
  )
}

/** Das <th> dieser Spalte — über den Spaltentitel gefunden. */
function headerCell(html: string, label: string): string {
  const labelAt = html.indexOf(`>${label}<`)
  expect(labelAt, `Spalte "${label}" nicht gefunden`).toBeGreaterThan(-1)
  return html.slice(html.lastIndexOf("<th", labelAt), labelAt)
}

const isHiddenOnMobile = (html: string, label: string) =>
  headerCell(html, label).includes(MOBILE_HIDDEN)

describe("SeasonStandingsTable — mobile Spaltenwahl", () => {
  // Neben dem Namen ist auf dem Telefon Platz für zwei Zahlenspalten. Sichtbar bleiben muss,
  // was die Reihenfolge bestimmt — sonst steht der maßgebliche Wert in einer unsichtbaren Spalte.
  it.each(["alt-teiler", "alt-rings"] as const)(
    "zeigt in '%s' beide beteiligten Spalten und blendet den Ringteiler aus",
    (sort) => {
      const html = render(sort)
      expect(isHiddenOnMobile(html, "Beste Ringe")).toBe(false)
      expect(isHiddenOnMobile(html, "Best. Teiler korr.")).toBe(false)
      expect(isHiddenOnMobile(html, "Best. Ringteiler")).toBe(true)
    }
  )

  it("zeigt in der klassischen Teiler-Wertung den Teiler statt des Ringteilers", () => {
    const html = render("teiler")
    expect(isHiddenOnMobile(html, "Best. Teiler korr.")).toBe(false)
    expect(isHiddenOnMobile(html, "Best. Ringteiler")).toBe(true)
  })

  it.each(["rings", "ringteiler"] as const)(
    "lässt '%s' bei den bisherigen Spalten (Ringe + Ringteiler)",
    (sort) => {
      const html = render(sort)
      expect(isHiddenOnMobile(html, "Beste Ringe")).toBe(false)
      expect(isHiddenOnMobile(html, "Best. Ringteiler")).toBe(false)
      expect(isHiddenOnMobile(html, "Best. Teiler korr.")).toBe(true)
    }
  )

  it.each(["alt-teiler", "alt-rings", "rings", "teiler", "ringteiler"] as const)(
    "stellt in '%s' keinen hervorgehobenen Wert in eine ausgeblendete Spalte",
    (sort) => {
      const cells = render(sort).split("<td").slice(1)
      const emphasizedButHidden = cells.filter(
        (cell) => cell.includes("font-medium text-foreground") && cell.includes(MOBILE_HIDDEN)
      )
      expect(emphasizedButHidden).toHaveLength(0)
    }
  )

  it("blendet die Serien-Spalte mobil aus (Mindestserien stehen dann am Namen)", () => {
    expect(isHiddenOnMobile(render("alt-teiler"), "Serien")).toBe(true)
  })
})

describe("SeasonStandingsTable — manuelles Sortieren", () => {
  it.each(["alt-teiler", "alt-rings"] as const)("macht die Spaltenköpfe in '%s' inert", (sort) => {
    const html = render(sort)
    expect(html).not.toContain("cursor-pointer")
  })

  it.each(["rings", "teiler", "ringteiler"] as const)(
    "lässt die Spaltenköpfe in '%s' klickbar",
    (sort) => {
      const html = render(sort)
      expect(headerCell(html, "Beste Ringe")).toContain("cursor-pointer")
    }
  )

  it("nennt die Sortierung nur in den alternierenden Modi über der Tabelle", () => {
    expect(render("alt-teiler")).toContain("Teiler/Ringe alternierend")
    expect(render("alt-rings")).toContain("Ringe/Teiler alternierend")
    expect(render("ringteiler")).not.toContain("Sortierung:")
  })
})
