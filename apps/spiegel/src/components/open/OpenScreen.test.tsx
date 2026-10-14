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
  it("die älteste wartende Scheibe mit Abend, Stand, Familie, Schuss, Ergebnis und beiden Knöpfen", () => {
    const html = render([item(2)])
    expect(html).toContain("Di 13.10.2026 · 19:12")
    expect(html).toContain("Stand 6 · Luftpistole · 40 Schuss · 376 Ringe")
    expect(html).toContain("und 2 weitere Scheiben unter dieser SportpassID")
    expect(html).toContain(">Ja, meine<")
    expect(html).toContain(">Nicht meine<")
  })

  it("eine weitere in der Einzahl, keine ohne Satz", () => {
    expect(render([item(1)])).toContain("und 1 weitere Scheibe unter")
    expect(render([item(0)])).not.toContain("weitere")
  })

  it("ohne Wartendes der Satz", () => {
    const html = render([])
    expect(html).toContain("Nichts offen.")
    expect(html).not.toContain("Ja, meine")
  })
})
