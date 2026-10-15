import {
  groupShape,
  outlierLoss,
  outliers,
  ringWidths,
  sigmaEstimate,
} from "@vereinsheim/shot-core/analysis"
import {
  computeMetric,
  inScoring,
  metricByKey,
  type MetricShot,
} from "@vereinsheim/shot-core/metrics"
import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { describe, expect, it } from "vitest"

import { axisText, formatValue } from "../../format"
import { fortyCard } from "../testCard"
import { cardHtml, cardText, renderTab } from "../testPanel"

const BASE = fortyCard().filter((s) => s.kind === "match")
const mm2 = (um: number) => formatValue(um / 1000, 2)
const metric = (key: string) =>
  computeMetric(inScoring(metricByKey(key)!, "decimal"), BASE) as number

describe("Reiter Präzision", () => {
  const html = renderTab("precision")

  it("σ groß mit 95-%-Bereich als Balken bis zur aufgerundeten Obergrenze", () => {
    const sigma = sigmaEstimate(BASE)!
    const max = Math.ceil((sigma.high / 1000) * 1.25 * 2) / 2
    const text = cardText(html, "praezision-sigma")
    expect(text).toContain(`${mm2(sigma.sigma)} mm`)
    expect(text).toContain(`95-%-Bereich ${mm2(sigma.low)} bis ${mm2(sigma.high)} mm`)
    expect(text).toContain(`${formatValue(max, 1)} mm`)
    expect(text).toContain(`σ aus ${sigma.n} Schuss, für wenige Schüsse korrigiert`)
    const card = cardHtml(html, "praezision-sigma")
    const left = (sigma.low / 1000 / max) * 100
    expect(card).toMatch(new RegExp(`data-range="true"[^>]*style="left:${left}%`))
  })

  it("Maße der Gruppe aus den Kennzahlen, R50 in Ringbreiten", () => {
    const text = cardText(html, "masse-der-gruppe")
    expect(text).toContain(
      `Streukreis (Durchmesser) ${formatValue(metric("group.enclosingDiameter"), 2)} mm`
    )
    expect(text).toContain(`R50 ${formatValue(metric("group.r50"), 2)} mm`)
    expect(text).toContain(
      `R50 in Ringbreiten ${formatValue(ringWidths(metric("group.r50") * 1000, LP_10M), 2)} (R50 durch ${formatValue(LP_10M.ringWidthUm / 1000, 1)} mm)`
    )
    expect(text).toContain(
      `Streuung x · y ${formatValue(metric("group.sdX"), 2)} · ${formatValue(metric("group.sdY"), 2)} mm`
    )
  })

  it("Form der Gruppe: Ellipse unter den Punkten, Ausreißer rot, Grenze bei n Schuss", () => {
    const shape = groupShape(BASE)!
    const card = cardHtml(html, "form-der-gruppe")
    const fill = card.indexOf("<ellipse")
    const firstPoint = card.indexOf("data-group-point")
    expect(fill).toBeGreaterThan(-1)
    expect(fill).toBeLessThan(firstPoint)
    expect(card.lastIndexOf("<ellipse")).toBeGreaterThan(card.lastIndexOf("data-group-point"))
    const flagged = outliers(BASE)!.flagged
    expect(flagged.length).toBeGreaterThan(0)
    expect(
      [...card.matchAll(/data-group-point="(\d+)" data-outlier="true"/g)].map((m) => Number(m[1]))
    ).toEqual(flagged.map((f) => f.number))
    expect([...card.matchAll(/data-outlier="true"[^>]*fill="var\(--destructive\)"/g)]).toHaveLength(
      flagged.length
    )
    expect([...card.matchAll(/data-group-point=/g)]).toHaveLength(BASE.length)
    expect(card).toContain('data-overlay="mpi"')
    const text = cardText(html, "form-der-gruppe")
    // die Form rechnet ohne Ausreißer, σ und Streuung x · y mit ihnen
    expect(shape.without.length).toBeGreaterThan(0)
    expect(text).toContain(
      `Halbachsen (ohne Ausreißer) ${mm2(shape.majorUm)} · ${mm2(shape.minorUm)} mm`
    )
    expect(text).toContain(`gestreckt ab ${formatValue(shape.ratioLimit, 2)} bei ${shape.n} Schuss`)
    expect(text).toContain(shape.elongated ? "Gestreckt? ja, mit 95 %" : "nicht nachweisbar")
    expect(shape.showAngle).toBe(true)
    expect(text).toContain(`Ausrichtung ${axisText(shape.angleRad)}`)
    // die Ellipse ist 2a · 2b, die Zeile zeigt a · b
    expect(text).toContain(
      "Ellipse und Mitte ohne die Ausreißer (rote Punkte). Die Ellipse reicht doppelt so weit wie die Halbachsen (2a, 2b); bei einer runden Gruppe liegen etwa 86 % der Treffer darin."
    )
  })

  it("keine Fachwörter in der Oberfläche: kein Mauchly, kein Rayleigh, kein c4, kein n − 1", () => {
    // das Glossar unter der Analyse darf sie erklären, die Karten nicht
    const cards = ["praezision-sigma", "masse-der-gruppe", "form-der-gruppe", "ausreisser"]
    for (const word of ["Mauchly", "W ", "Rayleigh", "c4", "n − 1", "2 σ entlang"]) {
      for (const card of cards) expect(cardText(html, card), card).not.toContain(word)
    }
  })

  it("Ausreißer mit Schussnummer und Kosten", () => {
    const flagged = outliers(BASE)!.flagged
    const loss = outlierLoss(BASE, "decimal")!
    const text = cardText(html, "ausreisser")
    expect(text).toContain(`Ausreißer ${flagged.map((f) => `Schuss ${f.number}`).join(", ")}`)
    expect(text).toContain(`Kosten ${formatValue(loss.loss, 1)} Ringe gegen den Median der übrigen`)
  })

  it("ein Ausreißer zur Mitte hin: er bringt Ringe, keine negativen Kosten", () => {
    // zwölf Treffer eng um (3 | 0) mm, einer genau in der Mitte: Er liegt weit von der Gruppe, nah an der 10,9
    const points = [
      ...Array.from({ length: 12 }, (_, i) => [
        3000 + Math.round(300 * Math.cos((i * Math.PI) / 6)),
        Math.round(300 * Math.sin((i * Math.PI) / 6)),
      ]),
      [0, 0],
    ]
    const shots: MetricShot[] = points.map(([xUm, yUm], i) => {
      const score = scoreFromCoordinates(LP_10M, xUm, yUm)
      return {
        seq: i + 1,
        xUm,
        yUm,
        decimalTenths: score.decimalTenths,
        ring: score.ring,
        innerTen: score.innerTen,
        firedAtMs: null,
        kind: "match",
        series: 2,
      }
    })
    const loss = outlierLoss(shots, "decimal")!
    expect(outliers(shots)!.flagged.map((f) => f.number)).toEqual([13])
    expect(loss.loss).toBeLessThan(0)
    const text = cardText(renderTab("precision", { shots }), "ausreisser")
    expect(text).toContain(
      `Wirkung bringt ${formatValue(-loss.loss, 1)} Ringe mehr als der Median der übrigen (liegt zur Mitte hin)`
    )
    expect(text).not.toContain("Kosten")
  })

  it("wenige Schüsse: der Grund statt eines Werts", () => {
    const few = renderTab("precision", { shots: BASE.slice(0, 2) })
    expect(cardText(few, "praezision-sigma")).toContain("ab 3 Schuss")
    expect(cardText(few, "form-der-gruppe")).toContain("ab 3 Schuss")
    // derselbe Grund wie an der Kachel im Überblick (`reasons.ts`)
    expect(cardText(few, "ausreisser")).toContain("ab 5 Schuss mit Lage")
    const calm = [...BASE.keys()]
      .map((k) => BASE.slice(k, k + 5))
      .find((shots) => shots.length === 5 && outliers(shots)!.flagged.length === 0)!
    const round = renderTab("precision", { shots: calm })
    expect(cardText(round, "ausreisser")).toContain("Ausreißer keine")
    expect(cardHtml(round, "ausreisser")).not.toMatch(/<dt[^>]*>Kosten<\/dt>/)
    expect(cardHtml(html, "ausreisser")).toMatch(/<dt[^>]*>Kosten<\/dt>/)
  })

  it("Form ohne Ausreißer: Grundlage genannt, Ellipse auf dem Schwerpunkt der übrigen", () => {
    // acht im Kreis von 1 mm und zwei Abreißer, die V6 als 9 und 10 markiert (wie im Fachkern)
    const points = [
      ...[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => [
        Math.round(1000 * Math.cos((deg * Math.PI) / 180)),
        Math.round(1000 * Math.sin((deg * Math.PI) / 180)),
      ]),
      [4000, 0],
      [4000, 400],
    ]
    const shots: MetricShot[] = points.map(([xUm, yUm], i) => {
      const score = scoreFromCoordinates(LP_10M, xUm, yUm)
      return {
        seq: i + 1,
        xUm,
        yUm,
        decimalTenths: score.decimalTenths,
        ring: score.ring,
        innerTen: score.innerTen,
        firedAtMs: i * 50_000,
        kind: "match",
        series: 1,
      }
    })
    const page = renderTab("precision", { shots })
    expect(cardText(page, "form-der-gruppe")).toContain("bei 8 Schuss (ohne Ausreißer 9, 10)")
    expect(cardText(page, "form-der-gruppe")).toContain("nicht nachweisbar")
    // nicht nachweisbar heißt nicht rund
    expect(cardText(page, "form-der-gruppe")).toContain(
      "Ausrichtung kein Winkel: Streckung nicht nachweisbar"
    )
    const card = cardHtml(page, "form-der-gruppe")
    const ellipse = /<ellipse cx="([-\d.]+)" cy="([-\d.]+)"/.exec(card)
    // Punkte ohne Ausreißer: Bei ihnen folgt auf data-group-point direkt cx (kein data-outlier dazwischen)
    const group = [
      ...card.matchAll(/<circle data-group-point="\d+" cx="([-\d.]+)" cy="([-\d.]+)"/g),
    ].map((m) => [Number(m[1]), Number(m[2])])
    expect(group).toHaveLength(8)
    const meanX = group.reduce((sum, [x]) => sum + x, 0) / group.length
    const meanY = group.reduce((sum, [, y]) => sum + y, 0) / group.length
    expect(Math.abs(meanX - Number(ellipse?.[1]))).toBeLessThan(0.5)
    expect(Math.abs(meanY - Number(ellipse?.[2]))).toBeLessThan(0.5)
  })
})
