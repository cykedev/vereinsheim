import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { routeFromUrl, type CardRoute } from "@vereinsheim/shot-ui/nav/routes"
import { DEFAULT_TARGET_DISPLAY } from "@vereinsheim/shot-ui/target/display"

import type { PageCard } from "@/lib/db/reads"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}))

const { CardScreen } = await import("./CardScreen")

const START = Date.UTC(2026, 9, 9, 17, 17)
const shots: MetricShot[] = Array.from({ length: 10 }, (_, i) => ({
  seq: i + 1,
  xUm: (i - 5) * 900,
  yUm: (i % 3) * 700,
  decimalTenths: 100 - i * 2,
  ring: 10 - Math.floor(i / 5),
  innerTen: i === 0,
  firedAtMs: START + i * 40_000,
  kind: "match",
  series: 1,
}))
const card: PageCard = {
  id: "cmshare0000test0000000001",
  startedAtMs: START,
  kind: "training",
  complete: true,
  flags: [],
  revision: 1,
  disciplineId: 1,
  discipline: "LP 40",
  targetId: "lp-10m",
  family: { slug: "lp", name: "Luftpistole" },
  scoring: "rings",
  list: null,
  shots,
}
const route = routeFromUrl(`/cards/${card.id}`, "?from=cards", "") as CardRoute
const render = (own: Parameters<typeof CardScreen>[0]["own"]) =>
  renderToStaticMarkup(
    createElement(CardScreen, {
      card,
      route,
      own,
      path: own ? `/cards/${card.id}` : "/share/3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c",
      context: { timeZone: "Europe/Berlin", nowMs: START, named: [] },
      display: DEFAULT_TARGET_DISPLAY,
    })
  )

describe("Seite einer Scheibe: eigene und geteilte", () => {
  it("die eigene trägt Rückweg, Art und Wertung, Teilen und Löschen", () => {
    const html = render({ near: { prev: "a", next: "b" }, paging: true, share: null })
    expect(html).toContain("data-result-actions")
    expect(html).toContain("data-share-card")
    expect(html).toContain("data-delete-card")
    expect(html).toMatch(/<a [^>]*href="\/cards/)
  })

  it("die geteilte zeigt dieselbe Scheibe ohne alles davon und ohne Link aus der Seite", () => {
    const html = render(null)
    expect(html).toContain(`id="shot-table"`)
    for (const part of ["data-result-actions", "data-share-card", "data-delete-card"])
      expect(html).not.toContain(part)
    const leaving = [...html.matchAll(/<a [^>]*href="([^"]*)"/g)]
      .map((m) => m[1])
      .filter((href) => !href.startsWith("#"))
    expect(leaving).toEqual([])
  })
})
