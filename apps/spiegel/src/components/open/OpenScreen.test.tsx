import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { PendingItem } from "@/lib/open"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }))
vi.mock("@/lib/first-card-actions", () => ({
  confirmFirstCard: async () => ({ success: true }),
  rejectFirstCard: async () => ({ success: true }),
}))

const { OpenScreen } = await import("./OpenScreen")

const item = (more: number): PendingItem => ({
  cardId: "c1",
  sportpassId: "4711",
  more,
  when: "Di 13.10.2026 · 19:12",
  stand: "6",
  family: "Luftpistole",
  shots: 40,
  result: "376 Ringe",
  targetId: "lp-10m",
})
const render = (items: PendingItem[]) =>
  renderToStaticMarkup(createElement(OpenScreen, { items, marks: {} }))

describe("Offen", () => {
  it("die gezeigte wartende Scheibe mit Abend, Stand, Familie, Schuss, Ergebnis und beiden Knöpfen", () => {
    const html = render([item(2)])
    expect(html).toContain("Di 13.10.2026 · 19:12")
    expect(html).toContain("Stand 6 · Luftpistole · 40 Schuss · 376 Ringe")
    expect(html).toContain("und 2 weitere unter dieser Nummer")
    expect(html).toContain(">Ja, meine<")
    expect(html).toContain(">Nicht meine<")
  })

  it("eine weitere in der Einzahl, keine ohne Satz", () => {
    expect(render([item(1)])).toContain("und 1 weitere unter dieser Nummer")
    expect(render([item(0)])).not.toContain("weitere")
  })

  it("die kleine Scheibe steht um die Mitte, der Spiegel so groß wie überall", () => {
    // Lagen in 10 µm: Treffer auf 0 und 0,1 mm, Luftpistole also 29,75 · 1,6 · 2 = 95,2
    const html = renderToStaticMarkup(
      createElement(OpenScreen, {
        items: [item(0)],
        marks: {
          c1: [
            [0, 0, 10],
            [10, 0, 9],
          ],
        },
      })
    )
    expect(html).toContain('<svg viewBox="-47.6 -47.6 95.2 95.2"')
  })

  it("ohne Wartendes der Satz", () => {
    const html = render([])
    expect(html).toContain("Nichts zu prüfen.")
    expect(html).not.toContain("Ja, meine")
    // die Einleitung nur, wenn etwas wartet
    expect(html).not.toContain("geholt")
    expect(render([item(0)])).toContain("Spiegel hat Scheiben unter deiner Sportpassnummer geholt.")
  })
})
