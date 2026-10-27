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
  standDiscipline: null,
  targetId: "lp-10m",
  family: { slug: "lp", name: "Luftpistole" },
  scoring: "rings",
  list: null,
  provenance: "measured",
  place: null,
  shots,
}
const route = routeFromUrl(`/cards/${card.id}`, "?from=cards", "") as CardRoute
const render = (own: Parameters<typeof CardScreen>[0]["own"], shown: PageCard = card) =>
  renderToStaticMarkup(
    createElement(CardScreen, {
      card: shown,
      route,
      own,
      path: own ? `/cards/${card.id}` : "/share/3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c",
      context: { timeZone: "Europe/Berlin", nowMs: START, named: [] },
      display: DEFAULT_TARGET_DISPLAY,
    })
  )

describe("Seite einer Scheibe: eigene und geteilte", () => {
  it("die eigene trägt Rückweg, Art und Wertung, Teilen und Löschen", () => {
    const html = render({
      near: { prev: "a", next: "b" },
      paging: true,
      share: null,
      previous: null,
      disciplines: [],
      fetch: { hex: "ff914420", printouts: [], request: null },
    })
    expect(html).toContain("data-result-actions")
    expect(html).toContain('data-printed-id="ff914420"')
    expect(html).toContain("data-card-actions")
    expect(html).toContain("data-card-discipline")
    expect(html).toContain("data-share-card")
    expect(html).toContain("data-delete-card")
    expect(html).toMatch(/<a [^>]*href="\/cards/)
  })

  it("mit einer Scheibe davor der Weg auf die Seite Vergleichen, ohne keiner", () => {
    const own = { near: null, paging: false, share: null, disciplines: [], fetch: null }
    const html = render({ ...own, previous: "c0" })
    expect(html).toContain("data-compare-previous")
    expect(html).toContain(`href="/compare?type=cards&amp;a=${card.id}&amp;b=c0"`)
    expect(html).toContain("Mit der Scheibe davor vergleichen")
    // Vergleichen steht über dem Kasten „Diese Scheibe“
    expect(html.indexOf("data-compare-previous")).toBeLessThan(html.indexOf("data-card-actions"))
    expect(render({ ...own, previous: null })).not.toContain("data-compare-previous")
  })

  it("die geteilte zeigt dieselbe Scheibe ohne alles davon und ohne Link aus der Seite", () => {
    const html = render(null)
    expect(html).toContain(`id="shot-table"`)
    for (const part of [
      "data-result-actions",
      "data-card-actions",
      "data-card-discipline",
      "data-share-card",
      "data-delete-card",
      "data-compare-previous",
      "data-card-printout",
      "data-card-fetch",
    ])
      expect(html).not.toContain(part)
    const leaving = [...html.matchAll(/<a [^>]*href="([^"]*)"/g)]
      .map((m) => m[1])
      .filter((href) => !href.startsWith("#"))
    expect(leaving).toEqual([])
  })
})

describe("Seite einer Scheibe je Detailtiefe", () => {
  const OWN = {
    near: null,
    paging: false,
    share: null,
    previous: null,
    disciplines: [],
    fetch: null,
  }
  const meta = (html: string) => {
    const header = html.slice(html.indexOf("data-card-header"))
    return /<p class="text-\[13px\][^"]*">([^<]*)<\/p>/.exec(header)?.[1] ?? ""
  }
  const SERIES = {
    series: [921, 905, 934, 912].map((decimalTenths, i) => ({
      series: i + 1,
      shots: 10,
      rings: Math.floor(decimalTenths / 10) - 4,
      decimalTenths,
    })),
    total: null,
    center: null,
  }
  const entered: PageCard = {
    ...card,
    shots: [],
    sums: SERIES,
    provenance: "entered",
    place: "Vereinsheim Nord",
  }

  /** das Gerüst einer Seite: Abschnitte in ihrer Folge, Box des Ergebnisses, Serien, Leiste, Reiter der Analyse */
  const frame = (html: string) => ({
    sections: [...html.matchAll(/data-section="([^"]+)"/g)].map((m) => m[1]),
    resultBox: html.includes("data-result-box"),
    series: html.includes('id="series"'),
    nav: html.includes('aria-label="Abschnitte"'),
    tabs: [...html.matchAll(/role="radio"[^>]*>([^<]+)</g)]
      .map((m) => m[1])
      .filter((t) => t === "Lage"),
  })

  it("ein Gerüst für jede Detailtiefe: dieselben Abschnitte an denselben Stellen", () => {
    const measured = frame(render(OWN))
    for (const other of [
      entered,
      {
        ...entered,
        sums: { series: [], total: { shots: 40, rings: 362, decimalTenths: null }, center: null },
      },
      { ...card, shots: [], provenance: "printout" as const },
      { ...card, shots: [] },
    ])
      expect(frame(render(OWN, other))).toEqual(measured)
    expect(measured.sections.length).toBeGreaterThan(2)
  })

  it("Serien-Summen eingetragen: Serien unter der Scheibe, Schüsse und Analyse mit kurzem Satz, Herkunft und Ort im Kopf", () => {
    const html = render(OWN, entered)
    expect(html).toContain('data-card-summary="series"')
    expect(html).not.toContain('id="shot-table"')
    expect(html).toMatch(/id="series"[\s\S]*data-sum-series="true"/)
    expect(html).toMatch(/data-shots-missing[^>]*><p[^>]*>Keine Einzelschüsse\.</)
    expect(html).toContain("Für Streuung, Lage und Tempo braucht es Einzelschüsse.")
    expect(meta(html)).toContain("eingetragen")
    expect(meta(html)).toContain("Vereinsheim Nord")
  })

  it("Gesamtergebnis mit Trefferlage aus Treffsicher: Zeichen der Mitte, eingetragen", () => {
    const html = render(OWN, {
      ...entered,
      sums: {
        series: [],
        total: { shots: 40, rings: 362, decimalTenths: null },
        center: { xUm: 1400, yUm: -900, shots: 40 },
      },
      place: null,
    })
    expect(html).toContain('data-card-summary="total"')
    expect(html).toContain("data-summary-center")
    expect(html).toMatch(/data-series-missing="true"[^>]*>Keine Serien\.</)
    expect(meta(html)).toContain("eingetragen")
  })

  it("vom Ausdruck ohne Werte: der Grund in der Ergebnis-Box, an den übrigen Stellen ein kurzer Satz ohne ihn", () => {
    const html = render(OWN, { ...card, shots: [], provenance: "printout" })
    expect(html).toContain('data-card-summary="none"')
    expect(html).toMatch(/data-summary-reason="true"[^>]*>wartet auf die Anlage</)
    expect(html).toMatch(/data-series-missing="true"[^>]*>Noch keine Serien\.</)
    expect(html).toMatch(/data-shots-missing[^>]*><p[^>]*>Noch keine Schüsse\.</)
    expect(html).toMatch(/data-summary-missing="true"[^>]*><p[^>]*>Noch keine Werte\.</)
    // außerhalb der Ergebnis-Box steht der Grund nicht noch einmal
    const outside = html.replace(/<div data-card-summary="none"[\s\S]*?<\/div><\/div><\/div>/g, "")
    expect(outside).not.toMatch(
      /data-(series|shots|summary)-missing[^>]*>[^<]*wartet auf die Anlage/
    )
    expect(meta(html)).toContain("vom Ausdruck")
  })

  it("vom Ausdruck ohne offenen Auftrag: ohne „noch“", () => {
    const html = render(OWN, { ...card, shots: [], provenance: "printout", waiting: false })
    expect(html).toMatch(/data-summary-reason="true"[^>]*>ohne Werte</)
    expect(html).toMatch(/data-series-missing="true"[^>]*>Keine Serien\.</)
    expect(html).toMatch(/data-shots-missing[^>]*><p[^>]*>Keine Schüsse\.</)
  })

  it("ohne bekannte Uhrzeit nennt der Kopf nur den Tag", () => {
    const html = render(OWN, { ...card, shots: [], provenance: "printout", timeUnknown: true })
    expect(meta(html)).not.toMatch(/\d\d:\d\d/)
  })

  it("gemessen ohne Schuss: dasselbe Gerüst, „noch kein Schuss“ als Grund", () => {
    const html = render(OWN, { ...card, shots: [] })
    expect(html).toContain('data-card-summary="none"')
    expect(html).toContain("noch kein Schuss")
    expect(html).toMatch(/data-series-missing="true"[^>]*>Noch keine Serien\.</)
  })

  it("Probe neben Serien-Summen: die Summen, und die Art ist Training mit Kreis", () => {
    const html = render(OWN, {
      ...entered,
      shots: shots.slice(0, 3).map((shot) => ({ ...shot, kind: "probe", series: null })),
    })
    expect(html).toContain('data-card-summary="series"')
    expect(html).toContain("data-kind-toggle")
    expect(meta(html)).toMatch(/^Training ·/)
    expect(meta(html)).not.toContain("nur Probe")
  })

  it("nur aus Probe: der Kreis der Art wie bei jeder eigenen Scheibe, Training ohne Wahl", () => {
    const probe = shots.map((shot) => ({ ...shot, kind: "probe" as const, series: null }))
    const html = render(OWN, { ...card, shots: probe })
    expect(html).toContain('data-kind-toggle=""')
    expect(html).toMatch(/data-kind-toggle="" data-kind="training"/)
    expect(meta(html)).toMatch(/^Training nur Probe ·/)
    // die geteilte zeigt keinen
    expect(render(null, { ...card, shots: probe })).not.toContain("data-kind-toggle")
  })

  it("Wettkampf nur aus Probe: Pokal gesetzt, die Wertung der Disziplin heißt amtlich", () => {
    const probe = shots.map((shot) => ({ ...shot, kind: "probe" as const, series: null }))
    const html = render(OWN, {
      ...card,
      shots: probe,
      kind: "competition",
      official: "rings",
      competitionOfficial: "rings",
    })
    expect(html).toMatch(/data-kind-toggle="" data-kind="competition"/)
    expect(html).toContain("Wertung: ganze Ringe, amtlich")
    expect(meta(html)).toMatch(/^Wettkampf nur Probe ·/)
    expect(html).toContain("10 Probeschüsse als Wettkampf")
    // der Kreis der Wertung nennt die amtliche aus der Disziplin, auch bevor die Seite nach dem Umstellen neu lädt
    const before = render(OWN, {
      ...card,
      shots: probe,
      kind: "competition",
      competitionOfficial: "rings",
    })
    expect(before).toContain("Wertung: ganze Ringe, amtlich")
    // im Training nie „amtlich“
    expect(render(OWN, { ...card, shots: probe, competitionOfficial: "rings" })).toContain(
      "Wertung: ganze Ringe, auf Zehntel umstellen"
    )
    expect(html).toContain("10 Probeschüsse, als Wettkampf wie Wertung gezählt")
  })

  it("gemessen mit Schüssen: „gemessen“ im Kopf", () => {
    const html = render(OWN)
    expect(meta(html)).toContain("gemessen")
    expect(html).toContain('id="shot-table"')
  })
})
