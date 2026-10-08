import { directionClock } from "@vereinsheim/shot-core/analysis"
import { centroid } from "@vereinsheim/shot-core/geometry"
import { selectShots } from "@vereinsheim/shot-core/metrics"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { fortyCard } from "../testCard"
import { cardText, renderTab } from "../testPanel"
import { ClockCard } from "./ClockCard"

const BASE = fortyCard().filter((s) => s.kind === "match")
const hours = (html: string) => [...html.matchAll(/data-hour="(\d+)"/g)].map((m) => Number(m[1]))
const occupied = (counts: readonly number[]) => counts.flatMap((c, hour) => (c ? [hour] : []))
const render = (reference: "center" | "mpi", shots = BASE) =>
  renderToStaticMarkup(
    createElement(ClockCard, { shots, explain: false, initialReference: reference })
  )

describe("Richtungsuhr", () => {
  it("im Reiter Lage zwischen Ringverlust und Drift, um die Mitte", () => {
    const html = renderTab("position")
    const order = [...html.matchAll(/data-card="([^"]+)"/g)].map((m) => m[1])
    expect(order).toEqual([
      "lage-echt",
      "ringverlust-nach-ursache",
      "richtungsuhr",
      "drift-und-wanderung",
    ])
    expect(hours(html)).toEqual(occupied(directionClock(BASE).counts))
    expect(html).toMatch(/aria-checked="true"[^>]*>um die Mitte/)
  })

  it("ein Keil je besetzter Stunde, um den Schwerpunkt anders gezählt", () => {
    const points = selectShots(BASE, { need: "position" }).map((s) => ({
      xUm: s.xUm as number,
      yUm: s.yUm as number,
    }))
    const around = directionClock(BASE, centroid(points)!)
    const html = render("mpi")
    expect(hours(html)).toEqual(occupied(around.counts))
    expect(html).toMatch(/aria-checked="true"[^>]*>um den Schwerpunkt/)
    expect(occupied(around.counts)).not.toEqual(occupied(directionClock(BASE).counts))
  })

  it("Keil nach der Fläche: Radius mit der Wurzel der Zahl", () => {
    const counts = directionClock(BASE).counts
    const max = Math.max(...counts)
    const html = render("center")
    const radii = [...html.matchAll(/data-hour="(\d+)" data-radius="([\d.]+)"/g)]
    const top = Number(radii.find((m) => counts[Number(m[1])] === max)![2])
    for (const [, hour, r] of radii) {
      expect(Number(r) / top).toBeCloseTo(Math.sqrt(counts[Number(hour)] / max), 6)
    }
  })

  it("unter 30 Schuss der Hinweis, ohne Schuss mit Lage der Grund", () => {
    expect(cardText(render("center"), "richtungsuhr")).not.toContain("kein Befund")
    expect(cardText(render("center", BASE.slice(0, 20)), "richtungsuhr")).toContain(
      "Unter 30 Schuss ist die Uhr ein Bild, kein Befund."
    )
    const blind = BASE.slice(0, 3).map((s) => ({ ...s, xUm: null, yUm: null }))
    expect(cardText(render("center", blind), "richtungsuhr")).toContain("ab 1 Schuss mit Lage")
  })
})
