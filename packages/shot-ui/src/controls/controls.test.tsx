import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ScoringSwitch } from "./ScoringSwitch"
import { SightAdjust } from "./SightAdjust"

const probe = (): MetricShot => ({
  xUm: 0,
  yUm: 0,
  decimalTenths: 100,
  ring: 10,
  innerTen: false,
  firedAtMs: null,
  kind: "probe",
  series: null,
})
const match: MetricShot = { ...probe(), kind: "match", series: 1 }

const scoring = (value: "decimal" | "rings", official?: "decimal" | "rings") =>
  renderToStaticMarkup(
    createElement(ScoringSwitch, { scoring: value, official, onChange: () => {} })
  )

const sight = (probes: number, adjustAfter: readonly number[] = []) =>
  renderToStaticMarkup(
    createElement(SightAdjust, {
      shots: [...Array.from({ length: probes }, probe), match],
      adjustAfter,
      onToggle: () => {},
    })
  )

describe("ScoringSwitch", () => {
  it("Zehntel oder ganze Ringe als Wahl „Wertung“", () => {
    const html = scoring("rings")
    expect(html).toContain('aria-label="Wertung"')
    expect(html).toMatch(/aria-checked="false"[^>]*>Zehntel</)
    expect(html).toMatch(/aria-checked="true"[^>]*>Ganze Ringe</)
  })

  it("die amtliche Wertung bleibt als Hinweis sichtbar, auch nach dem Umschalten", () => {
    expect(scoring("decimal", "decimal")).toContain("amtlich: Zehntel")
    expect(scoring("decimal", "rings")).toContain("amtlich: ganze Ringe")
    expect(scoring("rings")).not.toContain("amtlich")
  })
})

describe("SightAdjust", () => {
  it("Schalter nach P1 bis P(n−1): nach dem letzten Probeschuss gibt es keine Probe mehr", () => {
    const html = sight(5, [2])
    const labels = [...html.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) => m[1])
    expect(labels).toEqual(["P1", "P2", "P3", "P4"])
    expect(html).toMatch(/aria-pressed="true"[^>]*>P2</)
    expect([...html.matchAll(/aria-pressed="true"/g)]).toHaveLength(1)
  })

  it("eine benannte Gruppe", () => {
    const html = sight(3)
    const id = /<span id="([^"]+)"[^>]*>Visier verstellt nach<\/span>/.exec(html)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`role="group" aria-labelledby="${id}"`)
  })

  it("erst ab zwei Probeschüssen", () => {
    expect(sight(1)).toBe("")
    expect(sight(0)).toBe("")
  })
})
