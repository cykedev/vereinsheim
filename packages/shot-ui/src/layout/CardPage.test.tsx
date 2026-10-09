import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CardPage } from "./CardPage"
import { NoShots } from "./NoShots"
import { MIN_TARGET_PX, targetRoom } from "./useTargetFit"

const html = renderToStaticMarkup(
  h(CardPage, {
    header: h("p", null, "KOPF"),
    nav: h("nav", null, "LEISTE"),
    target: h("p", null, "SCHEIBE"),
    result: h("p", null, "ERGEBNIS"),
    under: h("p", null, "SERIEN"),
    aside: h("p", null, "SEITE"),
    beside: [{ id: "shots", node: h("p", null, "SCHÜSSE") }],
    below: [
      { id: "numbers", node: h("p", null, "ZAHLEN") },
      { id: "analysis", node: h("p", null, "ANALYSE") },
    ],
  })
)

describe("Rahmen der Seite (D2, D5)", () => {
  it("auf dem Telefon eine Spalte: Kopf, Leiste, Scheibe, Serien, Seite, Abschnitte", () => {
    const order = [
      "KOPF",
      "LEISTE",
      "SCHEIBE",
      "SERIEN",
      "SEITE",
      "SCHÜSSE",
      "ZAHLEN",
      "ANALYSE",
    ].map((t) => html.indexOf(t))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
  })

  it("jeder Abschnitt mit Anker-Id, data-section und Abstand für die Leiste", () => {
    // der Anker der Scheibe sitzt auf dem Raster, das nicht klebt; die Scheibe selbst trägt data-section
    expect(html).toMatch(
      /<div id="target" class="[^"]*scroll-mt-14[^"]*"><div data-section="target" class="[^"]*scroll-mt-14/
    )
    for (const id of ["numbers", "shots", "analysis"]) {
      expect(html).toMatch(
        new RegExp(`<div[^>]*id="${id}"[^>]*data-section="${id}"[^>]*class="[^"]*scroll-mt-14`)
      )
    }
  })

  it("ab 768 px zwei Spalten, die Scheibe bleibt links unter der Leiste stehen", () => {
    expect(html).toContain("md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]")
    expect(html).toMatch(/data-section="target"[^>]*class="[^"]*md:sticky md:top-14 md:self-start/)
  })

  it("neben der Scheibe die Schüsse, Zahlen und Analyse darunter in voller Breite", () => {
    // die rechte Spalte endet vor den Zahlen: Zahlen und Analyse liegen außerhalb des Rasters mit der Scheibe
    const grid = html.slice(html.indexOf('id="target"'), html.indexOf('id="numbers"'))
    expect(grid).toContain("SCHÜSSE")
    const closes = (grid.match(/<\/div>/g) ?? []).length
    const opens = (grid.match(/<div/g) ?? []).length
    // ab dem Anker der Scheibe (ihr <div fehlt) bis in den Block der Zahlen (sein <div zählt): ausgeglichen
    // heißt, die Zahlen sind Geschwister des Rasters und nicht in der rechten Spalte
    expect(opens).toBe(closes)
  })

  it("ab 768 px das Ergebnis als Box oben rechts, über der Ablesung; auf dem Telefon nicht", () => {
    expect(html).toMatch(
      /<div data-result-box="[^"]*" class="[^"]*max-md:hidden[^"]*"><p>ERGEBNIS<\/p><\/div><p>SEITE<\/p>/
    )
  })

  it("die Serien in der Spalte der Scheibe, die Schüsse rechts füllen die Höhe", () => {
    // die Spalte der Scheibe schließt erst nach den Serien
    const column = html.slice(
      html.indexOf('data-section="target"'),
      html.indexOf("data-result-box")
    )
    expect(column).toContain("SERIEN")
    expect(column.match(/<\/div>/g)).toHaveLength(1)
    expect(html).toMatch(
      /id="shots" data-section="shots" class="[^"]*md:flex-1[^"]*md:\[contain:size\]/
    )
    expect(html).not.toMatch(/id="numbers"[^>]*md:flex-1/)
    // nur der letzte Abschnitt ist mindestens fensterhoch (die Sprungleiste erreicht sonst „Zahlen“ nie)
    expect(html).toMatch(/id="analysis"[^>]*min-h-\[calc\(100svh-3\.5rem\)\]/)
    expect(html).not.toMatch(/id="numbers"[^>]*min-h-\[calc/)
  })
})

describe("ohne Schüsse (empty)", () => {
  const blank = renderToStaticMarkup(
    h(CardPage, {
      header: h("p", null, "KOPF"),
      nav: h("nav", null, "LEISTE"),
      target: h("p", null, "SCHEIBE"),
      result: h("p", null, "ERGEBNIS"),
      under: h("p", null, "SERIEN"),
      aside: h("p", null, "SEITE"),
      beside: [{ id: "shots", node: h("p", null, "SCHÜSSE") }],
      below: [{ id: "numbers", node: h("p", null, "ZAHLEN") }],
      empty: h(NoShots),
    })
  )

  it("nur Kopf, Scheibe und der Hinweis: keine Leiste, keine leeren Kästen", () => {
    for (const part of ["KOPF", "SCHEIBE", "Noch kein Schuss"]) expect(blank).toContain(part)
    for (const part of ["LEISTE", "ERGEBNIS", "SERIEN", "SEITE", "SCHÜSSE", "ZAHLEN"])
      expect(blank).not.toContain(part)
    expect(blank).toMatch(/data-section="target"/)
  })
})

describe("Platz für die Scheibe (useTargetFit)", () => {
  it("Fenster minus Leiste, Luft und alles außer der Scheibe in ihrer Spalte", () => {
    // 900 px Fenster, Spalte 900 px hoch mit 640 px Scheibe: 260 px Rahmen und Serien
    expect(targetRoom(900, 900, 640)).toBe(900 - 56 - 16 - 260)
    // der Wert hängt nicht an der gerade gezeichneten Größe der Scheibe
    expect(targetRoom(900, 828, 568)).toBe(targetRoom(900, 900, 640))
  })

  it("unter 280 px keine Begrenzung: dann bleibt die Scheibe allein im Fenster", () => {
    expect(targetRoom(600, 540, 300)).toBe(MIN_TARGET_PX + 8)
    expect(targetRoom(600, 548, 300)).toBe(MIN_TARGET_PX)
    expect(targetRoom(600, 549, 300)).toBeNull()
    expect(targetRoom(375, 470, 271)).toBeNull()
  })

  it("über der unteren Leiste (Plan N3, D2): ihr Platz geht von der Fensterhöhe ab", () => {
    // Tablet hochkant: 1024 px Fenster, 72 px Leiste
    expect(targetRoom(1024, 900, 640, 72)).toBe(1024 - 56 - 16 - 72 - 260)
    expect(targetRoom(1024, 900, 640, 0)).toBe(targetRoom(1024, 900, 640))
    expect(targetRoom(600, 540, 300, 72)).toBeNull()
  })
})
