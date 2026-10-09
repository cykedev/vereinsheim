import { metricByKey } from "@vereinsheim/shot-core/metrics"
import { LG_10M } from "@vereinsheim/shot-core/targets"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CardLine, CardReadout, cardKindText, deltaText } from "./CardReadout"
import { periodCard, TZ } from "./testSeason"

const metric = metricByKey("result.decimalMean")!
const card = periodCard("k1", 2, [100, 102, 98], { kind: "competition" })
const value = { id: "k1", atMs: card.startedAtMs, value: 10, n: 3 }
const point = { ...value, mean: 9.9, partial: false, band: { low: 9.6, high: 10.2 } }
const render = (props: Partial<Parameters<typeof CardReadout>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(CardReadout, {
      card,
      target: LG_10M,
      value,
      point,
      delta: { delta: 0.12, n: 5 },
      metric,
      timeZone: TZ,
      chosen: true,
      cardRoute: (id: string) => ({
        page: "card" as const,
        id,
        origin: null,
        selection: null,
        shot: null,
        scoring: "decimal" as const,
        anchor: null,
      }),
      ...props,
    })
  )

describe("Ablesung einer Scheibe (D9)", () => {
  it("„?“ am Abstand zum Schnitt davor, nur mit `onHelp` (U2, D2)", () => {
    expect(render({ onHelp: () => {} })).toMatch(
      /data-delta="true"[\s\S]*?<button type="button" aria-label="Erklärung: Abstand zum Schnitt davor" data-help="gegen-den-schnitt"/
    )
    expect(render()).not.toContain('data-help="gegen-den-schnitt"')
    // die Erklärung gilt dem Ø je Schuss; zeigt der Verlauf eine andere Kennzahl, kein „?“ (Review U2)
    expect(render({ onHelp: () => {}, metric: metricByKey("group.sigma")! })).not.toContain(
      'data-help="gegen-den-schnitt"'
    )
  })

  it("gewählt: Datum, Art, Wert, Schusszahl, Abstand zum Schnitt davor, Formband, kleine Scheibe", () => {
    const html = render()
    expect(html).toContain("Gewählte Scheibe")
    expect(html).toContain("28.09.2026 · Wettkampf")
    expect(html).toMatch(/10,00<small[^>]*>Ringe<\/small>/)
    expect(html).toContain("3 Schuss")
    expect(html).toContain("+0,12 zum Schnitt der 5 Scheiben davor")
    expect(html).toContain('data-in-band="true"')
    expect(html).toMatch(/<svg viewBox=/)
    // „Scheibe öffnen“ ist ein Link auf die Adresse der Scheibe (Plan N3, D3)
    expect(html).toMatch(/<a href="\/cards\/[^"]+"[^>]*>Scheibe öffnen<\/a>/)
  })

  it("ohne Wahl die neueste; erste Scheibe ohne Schnitt; außerhalb des Bands; ohne Band nichts", () => {
    expect(render({ chosen: false })).toContain("Neueste Scheibe")
    expect(render({ delta: undefined })).toContain("erste Scheibe, kein Schnitt davor")
    const outside = render({ point: { ...point, band: { low: 10.1, high: 10.4 } } })
    expect(outside).toContain("liegt außerhalb des Formbands")
    expect(render({ point: { ...point, band: null } })).not.toContain("Formband")
  })

  it("ohne Wert ein Strich, kein Abstand", () => {
    const html = render({ value: null })
    expect(html).toContain("Ø je Schuss: ohne Wert")
    expect(html).not.toContain("data-delta")
  })

  it("Art und Abstand in Worten", () => {
    expect(cardKindText(periodCard("t", 1, [100]))).toBe("Training")
    expect(cardKindText(periodCard("p", 1, [100], { probe: true }))).toBe("Training nur Probe")
    expect(deltaText({ delta: -0.05, n: 1 }, 2)).toBe("−0,05 zum Schnitt der Scheibe davor")
  })
})

describe("Ablesezeile auf dem Telefon", () => {
  it("Tag, Wert, Abstand und „Scheibe öffnen“", () => {
    const html = renderToStaticMarkup(
      createElement(CardLine, {
        card,
        value,
        delta: { delta: 0.03, n: 5 },
        metric,
        timeZone: TZ,
        cardRoute: (id: string) => ({
          page: "card" as const,
          id,
          origin: null,
          selection: null,
          shot: null,
          scoring: "decimal" as const,
          anchor: null,
        }),
      })
    )
    expect(html).toContain("28.09. · 10,00 · +0,03 zum Schnitt davor")
    expect(html).toMatch(/<a href="\/cards\/[^"]+"[^>]*>Scheibe öffnen<\/a>/)
  })

  it("„?“ am Abstand auch auf dem Telefon, nur mit `onHelp` und beim Ø je Schuss (Review U2)", () => {
    const line = (extra: Record<string, unknown>) =>
      renderToStaticMarkup(
        createElement(CardLine, {
          card,
          value,
          delta: { delta: 0.03, n: 5 },
          metric,
          timeZone: TZ,
          cardRoute: (id: string) => ({
            page: "card" as const,
            id,
            origin: null,
            selection: null,
            shot: null,
            scoring: "decimal" as const,
            anchor: null,
          }),
          ...extra,
        })
      )
    expect(line({ onHelp: () => {} })).toMatch(
      /zum Schnitt davor[\s\S]*?<button type="button" aria-label="Erklärung: Abstand zum Schnitt davor" data-help="gegen-den-schnitt"/
    )
    expect(line({})).not.toContain("data-help")
    expect(line({ onHelp: () => {}, metric: metricByKey("group.sigma")! })).not.toContain(
      "data-help"
    )
  })
})
