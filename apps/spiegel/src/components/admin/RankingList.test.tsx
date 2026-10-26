import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { RankingRow } from "@/lib/admin/rankings"

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }) }))
vi.mock("@/lib/admin/site-actions", () => ({
  setRankingKind: async () => ({ success: true }),
}))

const { RankingList } = await import("./RankingList")
const { RankingForm } = await import("./RankingForm")

const row = (id: number, kind: RankingRow["kind"], cards = 3): RankingRow => ({
  id,
  name: `Liste ${id}`,
  kind,
  cards,
  lastCardMonth: cards ? "Oktober 2026" : null,
})

describe("Listen (Markup)", () => {
  it("Abschnitte: nicht festgelegt, Wettkampf, Training; leere fallen weg", () => {
    const html = renderToStaticMarkup(
      createElement(RankingList, { rows: [row(1, "training"), row(2, null), row(3, "training")] })
    )
    expect([...html.matchAll(/data-ranking-section="(\w+)"/g)].map((m) => m[1])).toEqual([
      "open",
      "training",
    ])
    expect(html.indexOf(">Nicht festgelegt<")).toBeLessThan(html.indexOf(">Training<"))
    expect(html).not.toContain(">Wettkampf<")
  })

  it("jede Zeile führt aufs Blatt der Liste, ohne Umschalter in der Liste", () => {
    const html = renderToStaticMarkup(
      createElement(RankingList, { rows: [row(1, "competition"), row(2, null, 0)] })
    )
    expect(html).toContain('href="/admin/lists/1"')
    expect(html).toContain('href="/admin/lists/2"')
    expect(html).toContain("3 Scheiben · zuletzt im Oktober 2026")
    expect(html).toContain("noch keine Scheibe")
    expect(html).not.toContain('role="radiogroup"')
  })
})

describe("Blatt einer Liste (Markup)", () => {
  it("drei Möglichkeiten, die gespeicherte gewählt, „Übernehmen“ ohne Änderung aus", () => {
    const html = renderToStaticMarkup(
      createElement(RankingForm, { row: row(4, "competition", 23) })
    )
    expect(html).toContain('aria-label="Art der Liste"')
    for (const label of ["Nicht festgelegt", "Training", "Wettkampf"])
      expect(html).toContain(`>${label}<`)
    expect(html).toMatch(/aria-checked="true"[^>]*>Wettkampf</)
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Übernehmen</)
    expect(html).toContain("23 Scheiben · zuletzt im Oktober 2026")
  })

  it("„Nicht festgelegt“ ist gewählt, solange die Liste keine Art hat", () => {
    const html = renderToStaticMarkup(createElement(RankingForm, { row: row(5, null) }))
    expect(html).toMatch(/aria-checked="true"[^>]*>Nicht festgelegt</)
  })
})
