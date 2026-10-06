import { describe, expect, it } from "vitest"

import {
  computeMetric,
  defineMetric,
  eligibleShots,
  inScoring,
  inShotOrder,
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

// Sechs Schuss um (0 | 0), in x weiter gestreut als in y, gerade Zahl: Abstände 1, 1, 2, 3, 3, 4 mm
// (Median 2,5, Mittel 2,33); der Streukreis spannt sich über (4 | 0) und (−3 | 0), also 7 mm.
const SPREAD: MetricShot[] = (
  [
    [4000, 0],
    [-1000, 0],
    [-3000, 0],
    [0, 3000],
    [0, -1000],
    [0, -2000],
  ] as const
).map(([xUm, yUm], i) => ({ ...MATCH[0], xUm, yUm, firedAtMs: i * 10_000 }))

const CARD = [...PROBE, ...MATCH]
const def = (key: string) => {
  const metric = metricByKey(key)
  if (!metric) throw new Error(`Kennzahl ${key} fehlt`)
  return metric
}
const value = (key: string, shots: readonly MetricShot[]) => computeMetric(def(key), shots)
/** `toBeCloseTo` nimmt null als 0: Eine Kennzahl ohne Wert darf nicht als 0 durchgehen. */
const expectNear = (actual: number | null, expected: number) => {
  expect(actual).not.toBeNull()
  expect(actual).toBeCloseTo(expected, 9)
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

  it("fehlt einem Schuss der Wert, gibt es keine Summe, aber einen Schnitt über die übrigen", () => {
    const mixed = MATCH.map((shot, i) => (i === 3 ? { ...shot, decimalTenths: null } : shot))
    expect(value("result.decimal", mixed)).toBeNull()
    expect(value("result.rings", mixed)).toBe(49)
    expect(value("result.decimalMean", mixed)).toBeCloseTo((518 - 76) / 10 / 5, 9)
    expect(eligibleShots(def("result.decimalMean"), mixed)).toHaveLength(5)
    const noRing = MATCH.map((shot, i) => (i === 0 ? { ...shot, ring: null } : shot))
    expect(value("result.tens", noRing)).toBeNull()
    expect(value("result.innerTens", noRing)).toBeNull()
    expect(value("result.rings", noRing)).toBeNull()
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

  it("ein verdächtiger Schuss zählt nur mit seinem Wert, nie mit Lage, Abstand oder Zeit (SF-15)", () => {
    // Platzhalter: Lage (0 | 0), Teiler 0, amtlich 8,7, viel später eingetragen.
    const placeholder: MetricShot = {
      ...MATCH[0],
      xUm: 0,
      yUm: 0,
      distanceUm: 0,
      decimalTenths: 87,
      ring: 8,
      innerTen: false,
      firedAtMs: 10_000_000,
      flags: ["verdaechtig"],
    }
    const card = [...MATCH, placeholder]
    expect(value("result.bestTeiler", card)).toBeCloseTo(331.8, 9)
    for (const key of ["group.enclosingDiameter", "group.mpiDistance", "group.meanRadius"]) {
      expect(value(key, card)).toBeCloseTo(value(key, MATCH) ?? Number.NaN, 9)
    }
    expect(value("time.longestPause", card)).toBe(0)
    expect(value("result.decimal", card)).toBeCloseTo(51.8 + 8.7, 9)
    expect(value("result.rings", card)).toBe(57)
  })

  it("ungültige Angaben gelten als fehlend, nicht als Zahl", () => {
    const at0 = (patch: Partial<MetricShot>) =>
      MATCH.map((shot, i) => (i === 0 ? { ...shot, ...patch } : shot))
    expect(eligibleShots(def("group.meanRadius"), at0({ xUm: Number.NaN }))).toHaveLength(5)
    expect(value("group.meanRadius", at0({ xUm: Number.NaN }))).toBeCloseTo(
      value("group.meanRadius", MATCH.slice(1)) ?? Number.NaN,
      9
    )
    // Ein unmöglicher Abstand fällt auf die Lage zurück.
    expect(value("result.bestTeiler", at0({ distanceUm: Number.POSITIVE_INFINITY }))).toBeCloseTo(
      331.8,
      9
    )
    expect(value("result.bestTeiler", at0({ distanceUm: -500 }))).toBeCloseTo(331.8, 9)
    expect(value("result.rings", at0({ ring: Number.NaN }))).toBeNull()
    expect(value("time.intervalMedian", at0({ firedAtMs: Number.NaN }))).toBe(50)
  })
})

describe("Trefferbild-Kennzahlen", () => {
  it("jede Kennzahl mit festem Wert, in mm", () => {
    expect(value("group.enclosingDiameter", SPREAD)).toBeCloseTo(7, 9)
    expect(value("group.meanRadius", SPREAD)).toBeCloseTo(14 / 6, 9)
    expect(value("group.r50", SPREAD)).toBeCloseTo(2.5, 9)
    expect(value("group.sdX", SPREAD)).toBeCloseTo(Math.sqrt(26 / 5), 9)
    expect(value("group.sdY", SPREAD)).toBeCloseTo(Math.sqrt(14 / 5), 9)
    expectNear(value("group.mpiDistance", SPREAD), 0)
    expect(value("group.mpiDistance", PROBE)).toBeCloseTo(Math.hypot(1.04, -1.04), 9)
    expect(value("group.sdX", PROBE)).toBeCloseTo(0.1140175, 6)
  })

  it("zu wenige Schüsse ergeben keinen Wert, nicht 0 (SF-61)", () => {
    expect(value("group.enclosingDiameter", MATCH.slice(0, 2))).toBeNull()
    expect(value("group.enclosingDiameter", MATCH.slice(0, 3))).not.toBeNull()
    expect(value("group.r50", MATCH.slice(0, 4))).toBeNull()
    expect(value("group.r50", MATCH.slice(0, 5))).not.toBeNull()
  })

  it("R50 lässt Fehlschüsse weg, der Streukreis zeigt sie (SF-14)", () => {
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

  it("markiert, welche Maße von der Schusszahl abhängen (SF-60)", () => {
    const sensitive = METRICS.filter((m) => m.nSensitive).map((m) => m.key)
    for (const key of [
      "group.enclosingDiameter",
      "group.mpiDistance",
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
})

describe("Tempo, Reihenfolge und Probe", () => {
  it("Tempo ist der Median der Intervalle, nicht ihr Mittel", () => {
    const shots = [0, 10, 30, 90].map((s) => ({ ...MATCH[0], firedAtMs: s * 1000 }))
    expect(value("time.intervalMedian", shots)).toBe(20)
  })

  it("eine Pause ändert das Tempo nicht (SF-62)", () => {
    const withPause = MATCH.map((shot, i) => ({
      ...shot,
      firedAtMs: (shot.firedAtMs ?? 0) + (i >= 3 ? 300_000 : 0),
    }))
    expect(value("time.intervalMedian", withPause)).toBe(50)
    expect(value("time.longestPause", withPause)).toBe(350)
    expect(value("time.longestPause", MATCH)).toBe(0)
  })

  it("die Abgabefolge zählt, nicht die Uhr (SF-30)", () => {
    // Nach dem dritten Schuss springt die Uhr eine Stunde zurück.
    const jumped = MATCH.map((shot, i) => ({
      ...shot,
      seq: i + 1,
      firedAtMs: (shot.firedAtMs ?? 0) - (i >= 3 ? 3_600_000 : 0),
    }))
    expect(value("time.intervalMedian", jumped)).toBe(50)
    expect(value("time.longestPause", jumped)).toBe(0)
    // Die Liste darf in beliebiger Reihenfolge kommen.
    expect(value("time.longestPause", [...jumped].reverse())).toBe(0)
  })

  it("inShotOrder: erst seq, dann die Zeit, sonst die Liste", () => {
    const a = { seq: 2, firedAtMs: 100 }
    const b = { seq: 1, firedAtMs: 200 }
    expect(inShotOrder([a, b])).toEqual([b, a])
    const c = { seq: null, firedAtMs: 300 }
    const d = { firedAtMs: 100 }
    expect(inShotOrder([c, d])).toEqual([d, c])
    const e = { firedAtMs: null }
    const f = { firedAtMs: 5 }
    expect(inShotOrder([e, f])).toEqual([e, f])
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
    expectNear(value("sighter.offset", [...beforeAdjustment, ...afterAdjustment, ...match]), 0)
    // Es zählt die Abgabefolge, nicht die Reihenfolge der Liste.
    expectNear(value("sighter.offset", [...match, ...afterAdjustment, ...beforeAdjustment]), 0)
    // Ohne die Schüsse nach der Verstellung zählt der alte Schwerpunkt bei (5 | 5) mm.
    expect(value("sighter.offset", [...beforeAdjustment, ...match])).toBeCloseTo(
      Math.hypot(5, 5),
      9
    )
  })

  it("Probe nach Beginn der Wertung zählt nicht zum Versatz", () => {
    const at = (kind: MetricShot["kind"], xUm: number, i: number): MetricShot => ({
      ...MATCH[0],
      kind,
      xUm,
      yUm: 0,
      firedAtMs: i * 30_000,
    })
    const shots = [
      ...[0, 1, 2, 3, 4].map((i) => at("probe", 0, i)),
      ...[5, 6, 7, 8].map((i) => at("match", 0, i)),
      ...[9, 10, 11].map((i) => at("probe", 9000, i)),
    ]
    expectNear(value("sighter.offset", shots), 0)
  })

  it("ohne genug Probe- oder Wertungsschüsse kein Versatz", () => {
    expect(value("sighter.offset", [...PROBE.slice(0, 2), ...MATCH])).toBeNull()
    expect(value("sighter.offset", [...PROBE, ...MATCH.slice(0, 2)])).toBeNull()
  })
})

// Kennzahlen, die in beiden Wertungen gleich sind: Ein Zehner bleibt ein Zehner.
const SCORING_FREE = ["result.tens", "result.innerTens"]

describe("Registry", () => {
  it("Schlüssel sind eindeutig, Versionen ab 1, alles auffindbar und eingefroren", () => {
    const keys = METRICS.map((m) => m.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(Object.isFrozen(METRICS)).toBe(true)
    for (const metric of METRICS) {
      expect(metric.version).toBeGreaterThanOrEqual(1)
      expect(metricByKey(metric.key)).toBe(metric)
      expect(Object.isFrozen(metric)).toBe(true)
      expect(Object.isFrozen(metric.appliesTo)).toBe(true)
      expect(Object.isFrozen(metric.scopes)).toBe(true)
    }
    expect(metricByKey("gibt.es.nicht")).toBeUndefined()
  })

  it("jede Kennzahl aus Ringen oder Zehnteln hat ihr Gegenstück, mit gleichen Regeln", () => {
    for (const metric of METRICS) {
      const valueBased = metric.needs === "ring" || metric.needs === "decimal"
      if (!valueBased || SCORING_FREE.includes(metric.key)) {
        expect(metric.scoring, metric.key).toBeUndefined()
        expect(metric.counterpart, metric.key).toBeUndefined()
        continue
      }
      expect(metric.scoring, metric.key).toBe(metric.needs === "ring" ? "rings" : "decimal")
      const other = def(metric.counterpart ?? "")
      expect(other.scoring, metric.key).toBe(metric.scoring === "rings" ? "decimal" : "rings")
      expect(other.needs, metric.key).toBe(other.scoring === "rings" ? "ring" : "decimal")
      expect(other.counterpart, metric.key).toBe(metric.key)
      for (const field of [
        "label",
        "unit",
        "scopes",
        "better",
        "appliesTo",
        "minShots",
        "nSensitive",
        "excludeMisses",
        "onMissing",
      ] as const) {
        expect(other[field], `${metric.key}.${field}`).toEqual(metric[field])
      }
    }
  })

  it("inScoring wählt das Gegenstück, Kennzahlen ohne Wertung bleiben", () => {
    const rings = def("result.rings")
    const decimal = def("result.decimal")
    const r50 = def("group.r50")
    expect(inScoring(decimal, "rings")).toBe(rings)
    expect(inScoring(rings, "decimal")).toBe(decimal)
    expect(inScoring(rings, "rings")).toBe(rings)
    expect(inScoring(r50, "rings")).toBe(r50)
    expect(inScoring(r50, "decimal")).toBe(r50)
    const orphan = defineMetric({ ...rings, key: "result.orphan", counterpart: "result.missing" })
    expect(() => inScoring(orphan, "decimal")).toThrow()
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
    expect(() => defineMetric({ ...base, key: "" })).toThrow(RangeError)
    expect(() => defineMetric({ ...base, key: "ringe" })).toThrow(RangeError)
    expect(() => defineMetric({ ...base, decimals: 1.5 })).toThrow(RangeError)
    expect(() => defineMetric({ ...base, decimals: -1 })).toThrow(RangeError)
  })
})
