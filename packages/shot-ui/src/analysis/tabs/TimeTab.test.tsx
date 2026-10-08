import {
  cardTrend,
  movingAverage,
  pauseRecovery,
  rhythmProfile,
} from "@vereinsheim/shot-core/analysis"
import { describe, expect, it } from "vitest"

import { durationText, formatSigned } from "../../format"
import { fortyCard } from "../testCard"
import { cardHtml, cardText, renderTab } from "../testPanel"

const BASE = fortyCard().filter((s) => s.kind === "match")
const all = (html: string, pattern: RegExp) => [...html.matchAll(pattern)].map((m) => m[1])

describe("Reiter Zeit und Verlauf, Diagramme", () => {
  const html = renderTab("time")

  it("Verlauf: ein Punkt je Schuss mit Wert, Schnitt erst gestrichelt, dann voll", () => {
    const avg = movingAverage(BASE, "decimal", 10)
    const card = cardHtml(html, "verlauf-und-trend")
    expect(all(card, /data-course-point="(\d+)"/g).map(Number)).toEqual(avg.map((p) => p.number))
    expect(card).toContain('data-average="partial"')
    expect(card).toContain('data-average="full"')
    expect(card).toMatch(/data-average="partial"[^>]*stroke-dasharray="4 4"/)
  })

  it("Verlauf: Trenner zwischen den Serien und eine Linie je Pause", () => {
    const card = cardHtml(html, "verlauf-und-trend")
    expect(all(card, /data-series-separator="(\d+)"/g).map(Number)).toEqual([10, 20, 30])
    const recovery = pauseRecovery(BASE, "decimal")!
    expect(all(card, /data-pause-line="(\d+)"/g).map(Number)).toEqual(
      recovery.effects.map((e) => e.afterShot)
    )
    expect(recovery.effects.map((e) => e.afterShot)).toEqual([21])
    expect(card).toMatch(/data-pause-line="21"[^>]*stroke="var\(--warning\)"/)
  })

  it("Verlauf: der Trend-Satz aus dem Fachkern, breite Karte", () => {
    const trend = cardTrend(BASE, "decimal")!
    expect(cardText(html, "verlauf-und-trend")).toContain(
      `Trend ${formatSigned(trend.perTenShots, 2)} Ringe je zehn Schuss: ${trend.clear ? `klar ${trend.direction === "up" ? "steigend" : "fallend"}` : "nicht klar"}`
    )
    expect(html).toMatch(/data-card="verlauf-und-trend" data-wide="true"/)
    expect(html).toMatch(/data-card="rhythmus" data-wide="true"/)
  })

  it("Rhythmus: eine Säule je Abstand, die Pause markiert und beschriftet", () => {
    const profile = rhythmProfile(BASE, 5)
    const timed = profile.filter((p) => p.intervalMs !== null)
    const card = cardHtml(html, "rhythmus")
    expect(all(card, /data-interval="(\d+)"/g).map(Number)).toEqual(timed.map((p) => p.number))
    const pauses = timed.filter((p) => p.pause)
    expect(pauses.map((p) => p.number)).toEqual([21])
    expect(all(card, /data-interval="(\d+)" data-pause="true"/g).map(Number)).toEqual(
      pauses.map((p) => p.number)
    )
    for (const p of pauses)
      expect(cardText(html, "rhythmus")).toContain(durationText(p.intervalMs!))
    expect(card).toContain('data-median="true"')
  })

  it("wenige Schüsse oder ohne Zeit: der Grund statt eines Diagramms", () => {
    const one = renderTab("time", { shots: BASE.slice(0, 1) })
    expect(cardText(one, "verlauf-und-trend")).toContain("ab 2 Schuss")
    const timeless = BASE.map((s) => ({ ...s, firedAtMs: null }))
    expect(cardText(renderTab("time", { shots: timeless }), "rhythmus")).toContain(
      "ab 3 Schuss mit Zeit"
    )
    const short = renderTab("time", { shots: BASE.slice(0, 5) })
    expect(cardText(short, "verlauf-und-trend")).toContain("Einen Trend gibt es ab 10 Schuss.")
  })
})
