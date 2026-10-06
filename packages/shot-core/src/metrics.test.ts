import { describe, expect, it } from "vitest"

import {
  computeMetric,
  defineMetric,
  inScoring,
  METRICS,
  metricByKey,
  type MetricDefinition,
  type MetricShot,
} from "./metrics"

// Die sechs Wertungsschüsse vom Ausdruck des 2. Oktober 2026, auf die Achsen gelegt wie in der
// Spielwiese, im Abstand von 50 s; davor fünf Probeschüsse um (1000, −1000) µm.
const MATCH: MetricShot[] = (
  [
    [0, 3318, 105, true],
    [-3964, 0, 105, true],
    [5474, 0, 103, false],
    [0, -26560, 76, false],
    [33690, 0, 67, false],
    [-38310, 0, 62, false],
  ] as const
).map(([xUm, yUm, decimalTenths, innerTen], i) => ({
  xUm,
  yUm,
  decimalTenths,
  ring: Math.floor(decimalTenths / 10),
  innerTen,
  firedAtMs: 300_000 + i * 50_000,
  kind: "match",
  series: 1,
}))

const PROBE: MetricShot[] = (
  [
    [1000, -1000],
    [1200, -900],
    [900, -1100],
    [1100, -1000],
    [1000, -1200],
  ] as const
).map(([xUm, yUm], i) => ({
  xUm,
  yUm,
  decimalTenths: 104,
  ring: 10,
  innerTen: false,
  firedAtMs: i * 50_000,
  kind: "probe",
  series: null,
}))

const CARD = [...PROBE, ...MATCH]
const value = (key: string, shots: readonly MetricShot[]) => {
  const metric = metricByKey(key)
  if (!metric) throw new Error(`Kennzahl ${key} fehlt`)
  return computeMetric(metric, shots)
}

describe("Ergebnis-Kennzahlen", () => {
  it("rechnen die Wertung des Ausdrucks nach", () => {
    expect(value("result.rings", CARD)).toBe(49)
    expect(value("result.decimal", CARD)).toBeCloseTo(51.8, 9)
    expect(value("result.decimalMean", CARD)).toBeCloseTo(8.6333, 4)
    expect(value("result.ringsMean", CARD)).toBeCloseTo(49 / 6, 9)
    expect(value("result.tens", CARD)).toBe(3)
    expect(value("result.innerTens", CARD)).toBe(2)
    expect(value("result.bestTeiler", CARD)).toBeCloseTo(331.8, 9)
  })

  it("nur Probe: kein Ergebnis, aber Trefferbild und Tempo (SF-01)", () => {
    const probeOnly = MATCH.map((shot) => ({ ...shot, kind: "probe" as const }))
    for (const key of ["result.rings", "result.decimal", "result.tens", "result.bestTeiler"]) {
      expect(value(key, probeOnly)).toBeNull()
    }
    expect(value("group.enclosingDiameter", probeOnly)).not.toBeNull()
    expect(value("group.meanRadius", probeOnly)).not.toBeNull()
    expect(value("time.intervalMedian", probeOnly)).toBe(50)
  })

  it("ohne Zehntel (Ganzring-Ausdruck): ganze Ringe ja, Zehntel nein (SF-18)", () => {
    const ringsOnly = MATCH.map((shot) => ({ ...shot, decimalTenths: null, xUm: null, yUm: null }))
    expect(value("result.rings", ringsOnly)).toBe(49)
    expect(value("result.ringsMean", ringsOnly)).toBeCloseTo(49 / 6, 9)
    expect(value("result.tens", ringsOnly)).toBe(3)
    expect(value("result.decimal", ringsOnly)).toBeNull()
    expect(value("result.decimalMean", ringsOnly)).toBeNull()
  })

  it("ohne Lage (Ergebnis nur aus dem PDF): Ergebnis ja, Trefferbild nein", () => {
    const pdfOnly = MATCH.map((shot) => ({ ...shot, xUm: null, yUm: null }))
    expect(value("result.rings", pdfOnly)).toBe(49)
    expect(value("group.enclosingDiameter", pdfOnly)).toBeNull()
    expect(value("result.bestTeiler", pdfOnly)).toBeNull()
  })

  it("der beste Teiler nimmt den gemessenen Abstand vor der Lage, auch ohne Lage", () => {
    // Lage (0 | 3318) ergäbe 331,8; gemessen sind 3317 µm.
    const measured = MATCH.map((shot, i) => ({ ...shot, distanceUm: i === 0 ? 3317 : null }))
    expect(value("result.bestTeiler", measured)).toBeCloseTo(331.7, 9)
    const teilerOnly = MATCH.map((shot) => ({
      ...shot,
      xUm: null,
      yUm: null,
      distanceUm: Math.hypot(shot.xUm ?? 0, shot.yUm ?? 0),
    }))
    expect(value("result.bestTeiler", teilerOnly)).toBeCloseTo(331.8, 9)
  })
})

describe("Trefferbild-Kennzahlen", () => {
  it("zu wenige Schüsse ergeben keinen Wert, nicht 0 (SF-61)", () => {
    expect(value("group.enclosingDiameter", MATCH.slice(0, 2))).toBeNull()
    expect(value("group.enclosingDiameter", MATCH.slice(0, 3))).not.toBeNull()
    expect(value("group.r50", MATCH.slice(0, 4))).toBeNull()
    expect(value("group.r50", MATCH.slice(0, 5))).not.toBeNull()
  })

  it("R50 lässt markierte Ausreißer weg, der Streukreis zeigt sie (SF-14)", () => {
    const group = PROBE
    const outlier: MetricShot = { ...PROBE[0], xUm: 60_000, yUm: 60_000, flags: ["fehlschuss"] }
    const suspicious: MetricShot = {
      ...PROBE[1],
      xUm: -60_000,
      yUm: 60_000,
      flags: ["verdaechtig"],
    }
    expect(value("group.r50", [...group, outlier])).toBeCloseTo(
      value("group.r50", group) ?? Number.NaN,
      9
    )
    expect(value("group.r50", [...group, suspicious])).toBeCloseTo(
      value("group.r50", group) ?? Number.NaN,
      9
    )
    expect(value("group.enclosingDiameter", [...group, outlier])).toBeGreaterThan(
      (value("group.enclosingDiameter", group) ?? 0) * 10
    )
  })

  it("markiert, welche Maße mit der Schusszahl wachsen (SF-60)", () => {
    const sensitive = METRICS.filter((m) => m.nSensitive).map((m) => m.key)
    for (const key of [
      "group.enclosingDiameter",
      "result.rings",
      "result.decimal",
      "result.tens",
      "result.innerTens",
    ]) {
      expect(sensitive).toContain(key)
    }
    for (const key of ["group.meanRadius", "group.r50", "result.decimalMean"]) {
      expect(sensitive).not.toContain(key)
    }
    expect(value("group.enclosingDiameter", MATCH)).toBeGreaterThanOrEqual(
      value("group.enclosingDiameter", MATCH.slice(0, 5)) ?? Number.POSITIVE_INFINITY
    )
  })

  it("Schwerpunkt, Streuung und mittlerer Radius in mm", () => {
    expect(value("group.mpiDistance", PROBE)).toBeCloseTo(Math.hypot(1.04, -1.04), 9)
    expect(value("group.sdX", PROBE)).toBeCloseTo(0.1140175, 6)
    expect(value("group.meanRadius", PROBE)).not.toBeNull()
  })
})

describe("Tempo und Probe", () => {
  it("eine Pause ändert das Tempo nicht (SF-62)", () => {
    const withPause = MATCH.map((shot, i) => ({
      ...shot,
      firedAtMs: (shot.firedAtMs ?? 0) + (i >= 3 ? 300_000 : 0),
    }))
    expect(value("time.intervalMedian", withPause)).toBe(50)
    expect(value("time.longestPause", withPause)).toBe(350)
    expect(value("time.longestPause", MATCH)).toBe(0)
  })

  it("der Versatz Probe → Wertung zählt nur die letzten fünf Probeschüsse (SF-63)", () => {
    const beforeAdjustment: MetricShot[] = Array.from({ length: 10 }, (_, i) => ({
      ...PROBE[0],
      xUm: 5000,
      yUm: 5000,
      firedAtMs: i * 30_000,
    }))
    const afterAdjustment: MetricShot[] = Array.from({ length: 5 }, (_, i) => ({
      ...PROBE[0],
      xUm: 0,
      yUm: 0,
      firedAtMs: 300_000 + i * 30_000,
    }))
    const match: MetricShot[] = [
      [500, 0],
      [-500, 0],
      [0, 500],
      [0, -500],
    ].map(([xUm, yUm], i) => ({ ...MATCH[0], xUm, yUm, firedAtMs: 600_000 + i * 50_000 }))
    expect(
      value("sighter.offset", [...beforeAdjustment, ...afterAdjustment, ...match])
    ).toBeCloseTo(0, 9)
    // Es zählt die Abgabezeit, nicht die Reihenfolge der Liste.
    expect(
      value("sighter.offset", [...match, ...afterAdjustment, ...beforeAdjustment])
    ).toBeCloseTo(0, 9)
    // Ohne die Schüsse nach der Verstellung zählt der alte Schwerpunkt bei (5 | 5) mm.
    expect(value("sighter.offset", [...beforeAdjustment, ...match])).toBeCloseTo(
      Math.hypot(5, 5),
      9
    )
  })

  it("ohne genug Probe- oder Wertungsschüsse kein Versatz", () => {
    expect(value("sighter.offset", [...PROBE.slice(0, 2), ...MATCH])).toBeNull()
    expect(value("sighter.offset", [...PROBE, ...MATCH.slice(0, 2)])).toBeNull()
  })
})

describe("Registry", () => {
  it("Schlüssel sind eindeutig, Versionen ab 1, jede Kennzahl ist auffindbar und eingefroren", () => {
    const keys = METRICS.map((m) => m.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const metric of METRICS) {
      expect(metric.version).toBeGreaterThanOrEqual(1)
      expect(metricByKey(metric.key)).toBe(metric)
      expect(Object.isFrozen(metric)).toBe(true)
      expect(Object.isFrozen(metric.appliesTo)).toBe(true)
      expect(Object.isFrozen(metric.scopes)).toBe(true)
    }
    expect(metricByKey("gibt.es.nicht")).toBeUndefined()
  })

  it("jede Kennzahl mit Zehnteln hat ein Gegenstück in ganzen Ringen, und umgekehrt", () => {
    for (const metric of METRICS) {
      if (metric.needs === "decimal") expect(metric.scoring).toBe("decimal")
      if (metric.scoring === undefined) {
        expect(metric.counterpart).toBeUndefined()
        continue
      }
      const other = metricByKey(metric.counterpart ?? "")
      expect(other, metric.key).toBeDefined()
      if (!other) continue
      expect(other.scoring).toBe(metric.scoring === "rings" ? "decimal" : "rings")
      expect(other.counterpart).toBe(metric.key)
      for (const field of [
        "label",
        "scopes",
        "better",
        "appliesTo",
        "minShots",
        "nSensitive",
        "excludeFlagged",
      ] as const) {
        expect(other[field], `${metric.key}.${field}`).toEqual(metric[field])
      }
    }
  })

  it("inScoring wählt das Gegenstück, Kennzahlen ohne Wertung bleiben", () => {
    const rings = metricByKey("result.rings")
    const decimal = metricByKey("result.decimal")
    const r50 = metricByKey("group.r50")
    if (!rings || !decimal || !r50) throw new Error("Kennzahl fehlt")
    expect(inScoring(decimal, "rings")).toBe(rings)
    expect(inScoring(rings, "decimal")).toBe(decimal)
    expect(inScoring(rings, "rings")).toBe(rings)
    expect(inScoring(r50, "rings")).toBe(r50)
    expect(inScoring(r50, "decimal")).toBe(r50)
  })

  it("defineMetric lehnt unvollständige Definitionen ab", () => {
    const base = METRICS[0] as MetricDefinition
    expect(() => defineMetric({ ...base, version: 0 })).toThrow(RangeError)
    expect(() => defineMetric({ ...base, minShots: 0 })).toThrow(RangeError)
    expect(() => defineMetric({ ...base, appliesTo: [] })).toThrow(RangeError)
    expect(() => defineMetric({ ...base, scopes: [] })).toThrow(RangeError)
    expect(() => defineMetric({ ...base, counterpart: undefined })).toThrow(RangeError)
    expect(() => defineMetric({ ...base, scoring: undefined })).toThrow(RangeError)
    expect(() => defineMetric({ ...base, counterpart: base.key })).toThrow(RangeError)
  })
})
