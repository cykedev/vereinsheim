import { outliers } from "@vereinsheim/shot-core/analysis"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { HelpDetails } from "../help/HelpDetails"
import { SeriesStrip } from "../series/SeriesStrip"
import { initialViewState } from "../view-state"
import { fortyCard } from "./testCard"
import { cardHtml, renderTab } from "./testPanel"

// Mobil-Grundlagen (Plan Task 13a, gemessen bei 375 px): nichts macht die Seite breiter als den Bildschirm,
// Bedienelemente in der Optik des Desktops (User, 8. Oktober 2026), Schrift ab 12 px, Punkte mit Rand,
// Ausreißer nicht nur über die Farbe.

const CARD = fortyCard()
const BASE = CARD.filter((s) => s.kind === "match")

describe("Analyse auf dem Telefon", () => {
  const overview = renderTab("overview")
  const result = renderTab("result")

  it("der Abschnitt wächst nicht mit seinem Inhalt, die Reiter scrollen in einer Zeile", () => {
    expect(overview).toMatch(
      /^<section aria-label="Analyse" class="[^"]*grid-cols-\[minmax\(0,1fr\)\]/
    )
    expect(overview).toMatch(/role="radiogroup" aria-label="Thema"[^>]*class="[^"]*overflow-x-auto/)
    // nur diese Leiste: Knöpfe schrumpfen nicht und brechen nicht um (andere Umschalter dürfen umbrechen)
    expect(overview).toMatch(
      /role="radiogroup" aria-label="Thema"[^>]*class="[^"]*\[&amp;&gt;button\]:shrink-0 \[&amp;&gt;button\]:whitespace-nowrap/
    )
    expect(overview).not.toMatch(/role="radiogroup" aria-label="Thema"[^>]*class="[^"]*flex-wrap/)
    expect(overview).toMatch(/role="radiogroup" aria-label="Thema"[^>]*class="[^"]*max-w-full/)
  })

  it("zwei Kartenspalten erst ab 861 px wie D3, als Raster in Zeilen", () => {
    expect(result).toContain("min-[861px]:grid-cols-2")
    // Spalten (columns) ließen unter der kürzeren Spalte Lücken und verschluckten Ränder am Spaltenende
    expect(result).not.toMatch(/columns-2/)
    // eine einzelne Karte in der letzten Zeile über die volle Breite, kein Loch daneben
    expect(result).toContain("min-[861px]:[&amp;&gt;:last-child:nth-child(odd)]:col-span-2")
  })

  it("Glossar und Fehlschlüsse auf dem Telefon so knapp wie am Desktop", () => {
    const summaries = overview.match(/<summary[^>]*>/g)!
    // nur noch Glossar und Fehlschlüsse; die Karten erklären sich über „?“ (Plan Schritt 4, D3)
    expect(summaries).toHaveLength(2)
    for (const summary of summaries) expect(summary).not.toContain("pointer-coarse")
    const help = renderToStaticMarkup(createElement(HelpDetails, { id: "ergebnis", open: false }))
    expect(help).not.toMatch(/<summary[^>]*pointer-coarse/)
  })

  it("Diagrammschrift 12 px, Prozent der Ringbalken nicht kleiner", () => {
    const svgs = result.match(/<svg[^>]*role="img"[^>]*>/g)!
    expect(svgs.length).toBeGreaterThan(0)
    for (const svg of svgs) {
      expect(svg).toContain("text-xs")
      expect(svg).not.toContain("text-[11px]")
    }
    for (const small of cardHtml(result, "ringverteilung").match(/<small[^>]*>/g)!) {
      expect(small).toContain("text-xs")
    }
  })

  it("Punkte in Verlauf, Serienkurve und Form mit dunklem Rand", () => {
    const time = renderTab("time")
    for (const point of cardHtml(time, "verlauf-und-trend").match(
      /<circle data-course-point[^>]*>/g
    )!) {
      expect(point).toContain('stroke="var(--shot-edge)"')
    }
    for (const point of result.match(/<circle data-series-point="\d+"(?! data-short)[^>]*>/g)!) {
      expect(point).toContain('stroke="var(--shot-edge)"')
    }
    const precision = renderTab("precision")
    for (const point of cardHtml(precision, "form-der-gruppe").match(
      /<circle data-group-point[^>]*>/g
    )!) {
      expect(point).toContain('stroke="var(--shot-edge)"')
    }
  })

  it("Ausreißer tragen zusätzlich einen Ring, nicht nur die rote Farbe", () => {
    const precision = cardHtml(renderTab("precision"), "form-der-gruppe")
    const flagged = outliers(BASE)!.flagged.map((f) => String(f.number))
    expect(flagged.length).toBeGreaterThan(0)
    expect([...precision.matchAll(/data-outlier-ring="(\d+)"/g)].map((m) => m[1])).toEqual(flagged)
  })
})

describe("Bedienelemente auf dem Telefon", () => {
  it("„Alle“ und „Ohne Probe“ in derselben Optik wie am Desktop", () => {
    const html = renderToStaticMarkup(
      createElement(SeriesStrip, {
        target: LP_10M,
        shots: CARD,
        state: initialViewState({ selection: "match", home: "match" }),
        onSelect: () => {},
        onSelectWhole: () => {},
      })
    )
    for (const label of ["Alle", "Ohne Probe"]) {
      expect(html).toMatch(new RegExp(`<button[^>]*>${label}</button>`))
      expect(html).not.toMatch(new RegExp(`<button[^>]*min-h-11[^>]*>${label}</button>`))
    }
  })
})
