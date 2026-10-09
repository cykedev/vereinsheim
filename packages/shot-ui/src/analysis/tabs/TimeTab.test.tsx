import {
  cardTrend,
  fatigue,
  movingAverage,
  mpiPath,
  pauseRecovery,
  rhythmProfile,
  seriesCurve,
  seriesSpread,
  tempoSpread,
} from "@vereinsheim/shot-core/analysis"
import { computeMetric, inScoring, metricByKey } from "@vereinsheim/shot-core/metrics"
import { describe, expect, it } from "vitest"

import { durationText, formatSigned, formatValue, percentText } from "../../format"
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
      `Trend: Wert je Schuss ${formatSigned(trend.perTenShots, 2)} Ringe alle zehn Schuss (je Zehnerserie ${formatSigned(trend.perTenShots * 10, 1)}), ${trend.clear ? `klar ${trend.direction === "up" ? "steigend" : "fallend"}` : "nicht klar"}`
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

describe("Reiter Zeit und Verlauf, Karten", () => {
  const html = renderTab("time")

  it("Tempo und Dauer aus dem Fachkern", () => {
    const pace = tempoSpread(BASE)!
    const duration = computeMetric(inScoring(metricByKey("time.duration")!, "decimal"), BASE)!
    const text = cardText(html, "tempo-und-dauer")
    expect(text).toContain(`Tempo (Median) ${formatValue(pace.medianMs / 1000, 0)} s`)
    expect(text).toContain(
      `Mittlere Hälfte (IQR) ${formatValue(pace.iqrMs / 1000, 0)} s (${percentText(pace.relative!)} vom Median)`
    )
    expect(text).toContain(`Dauer ${durationText(duration * 1000)}`)
  })

  it("Tempo nennt dieselbe Mindestzahl wie die Kachel", () => {
    const three = renderTab("time", { shots: BASE.slice(0, 3) })
    expect(tempoSpread(BASE.slice(0, 3))).toBeNull()
    expect(cardText(three, "tempo-und-dauer")).toContain("ab 4 Schuss mit Zeit")
    const timeless = BASE.map((s) => ({ ...s, firedAtMs: null }))
    expect(cardText(renderTab("time", { shots: timeless }), "tempo-und-dauer")).toContain(
      "ab 4 Schuss mit Zeit"
    )
  })

  it("Pausen: je Pause Dauer und Wirkung danach", () => {
    const recovery = pauseRecovery(BASE, "decimal")!
    const profile = rhythmProfile(BASE)
    const text = cardText(html, "pausen")
    expect(text).toContain(
      `Pausen ${recovery.pauses} · zusammen ${durationText(recovery.totalPauseMs)}`
    )
    for (const e of recovery.effects) {
      const interval = profile.find((p) => p.number === e.afterShot)!.intervalMs!
      expect(text).toContain(
        `Vor Schuss ${e.afterShot} ${durationText(interval)} Pause · danach ${formatSigned(e.deltaRings!, 2)} Ringe`
      )
    }
    const calm = renderTab("time", { shots: BASE.slice(0, 20) })
    expect(cardText(calm, "pausen")).toContain("Keine Pause über drei Minuten.")
  })

  it("Ermüdung erst ab 20 Wertungsschüssen", () => {
    const tired = fatigue(BASE, "decimal")!
    const text = cardText(html, "ermuedung")
    expect(text).toContain(`Erste zehn Ø ${formatValue(tired.firstMeanRings, 2)}`)
    expect(text).toContain(`Letzte zehn Ø ${formatValue(tired.lastMeanRings, 2)}`)
    expect(text).toContain(`Unterschied ${formatSigned(tired.deltaRings, 2)} Ringe`)
    expect(text).toContain(`R50 letzte gegen erste ${formatSigned(tired.deltaR50Um! / 1000, 2)} mm`)
    expect(cardText(renderTab("time", { shots: BASE.slice(0, 19) }), "ermuedung")).toContain(
      "ab 20 Wertungsschüssen"
    )
  })

  it("Serien im Vergleich: eine Zeile je Serie mit Ergebnis, R50 und Versatz", () => {
    const series = seriesCurve(BASE, "decimal")
    const spreads = seriesSpread(BASE)
    const path = mpiPath(BASE)
    const card = cardHtml(html, "serien-im-vergleich")
    const rows = [...card.matchAll(/<tr data-series-row="(\d+)"[^>]*>(.*?)<\/tr>/g)]
    expect(rows.map((m) => Number(m[1]))).toEqual(series.map((p) => p.series))
    for (const [i, p] of series.entries()) {
      const cells = [...rows[i][2].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map((m) =>
        m[1].replace(/<[^>]+>/g, "")
      )
      const r50 = spreads.find((q) => q.series === p.series)!.r50Um
      const offset = path.find((q) => q.series === p.series)!.offsetUm
      expect(cells).toEqual([
        `S${p.series} (${p.shots})`,
        formatValue(p.total!, 1),
        r50 === null ? "–" : formatValue(r50 / 1000, 2),
        formatValue(offset / 1000, 2),
      ])
    }
    // schmal: mit Tempo, Pausen und Ermüdung zwei volle Zeilen im Raster
    expect(html).not.toMatch(/data-card="serien-im-vergleich" data-wide/)
  })
})
