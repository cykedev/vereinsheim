import { describe, expect, it } from "vitest"

import {
  computeMetric,
  contextOf,
  defineMetric,
  selectShots,
  stepsInOrder,
  eligibleShots,
  inScoring,
  inShotOrder,
  METRICS,
  metricByKey,
  asOnPrintout,
  probeOnlyAsMatch,
  shotNumbers,
  pauseThresholdOf,
  timesInOrder,
  FLAG_OVER_TARGET,
  FLAG_SUSPICIOUS,
  type MetricDefinition,
  type MetricShot,
  CARD_FLAGS,
} from "./metrics"
import { CARD, MATCH, PROBE, SPREAD } from "./__fixtures__/cards"
import { tempo } from "./time"

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
    expect(value("group.sigma", probeOnly)).not.toBeNull()
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
    for (const key of ["group.enclosingDiameter", "group.mpiDistance", "group.sigma"]) {
      expect(value(key, card)).toBeCloseTo(value(key, MATCH) ?? Number.NaN, 9)
    }
    expect(value("time.intervalMedian", card)).toBe(value("time.intervalMedian", MATCH))
    // zählte seine Zeit, dauerte die Karte bis zum Platzhalter
    expect(value("time.duration", card)).toBe(250)
    expect(value("result.decimal", card)).toBeCloseTo(51.8 + 8.7, 9)
    expect(value("result.rings", card)).toBe(57)
  })

  it("ein Schuss über der Soll-Zahl zählt mit Wert 0 und Zeit, nie mit Lage oder Abstand (SF-08)", () => {
    // Meyton: echte Lage nahe der Mitte, Wert 0, Platzhalter-Teiler (der Adapter gibt keinen Abstand), 60 s später
    const over: MetricShot = {
      ...MATCH[5],
      xUm: 0,
      yUm: 500,
      distanceUm: null,
      decimalTenths: 0,
      ring: 0,
      innerTen: false,
      firedAtMs: 610_000,
      flags: [FLAG_OVER_TARGET],
    }
    const card = [...MATCH, over]
    // mit Lage wäre er der beste Teiler (50,0) und zöge den Schwerpunkt zur Mitte
    expect(value("result.bestTeiler", card)).toBeCloseTo(331.8, 9)
    for (const key of [
      "group.enclosingDiameter",
      "group.mpiDistance",
      "group.r50",
      "group.sigma",
      "group.sdX",
      "group.sdY",
    ]) {
      expect(value(key, card), key).toBeCloseTo(value(key, MATCH) ?? Number.NaN, 9)
    }
    expect(eligibleShots(def("group.sigma"), card)).toHaveLength(6)
    // Wert 0 und Zeit zählen: 46 Schuss am Stand sind 46 Schuss im Ergebnis
    expect(value("result.decimal", card)).toBeCloseTo(51.8, 9)
    expect(value("result.rings", card)).toBe(49)
    expect(value("result.decimalMean", card)).toBeCloseTo(51.8 / 7, 9)
    expect(value("time.duration", card)).toBe(310)
    // Gegenprobe: ohne das Merkmal zählt die Lage
    const unflagged = [...MATCH, { ...over, flags: [] }]
    expect(value("result.bestTeiler", unflagged)).toBeCloseTo(50, 9)
  })

  it("ungültige Angaben gelten als fehlend, nicht als Zahl", () => {
    const at0 = (patch: Partial<MetricShot>) =>
      MATCH.map((shot, i) => (i === 0 ? { ...shot, ...patch } : shot))
    expect(eligibleShots(def("group.sigma"), at0({ xUm: Number.NaN }))).toHaveLength(5)
    expect(value("group.sigma", at0({ xUm: Number.NaN }))).toBeCloseTo(
      value("group.sigma", MATCH.slice(1)) ?? Number.NaN,
      9
    )
    // Ein unmöglicher Abstand fällt auf die Lage zurück.
    expect(value("result.bestTeiler", at0({ distanceUm: Number.POSITIVE_INFINITY }))).toBeCloseTo(
      331.8,
      9
    )
    expect(value("result.bestTeiler", at0({ distanceUm: -500 }))).toBeCloseTo(331.8, 9)
    expect(value("result.rings", at0({ ring: Number.NaN }))).toBeNull()
    expect(value("result.decimal", at0({ decimalTenths: Number.NaN }))).toBeNull()
    expect(eligibleShots(def("time.intervalMedian"), at0({ firedAtMs: Number.NaN }))).toHaveLength(
      5
    )
    // Teiler 0 ohne Lage ist ein Treffer genau in der Mitte, kein fehlender Wert.
    const center: MetricShot = { ...MATCH[0], xUm: null, yUm: null, distanceUm: 0 }
    expectNear(value("result.bestTeiler", [center]), 0)
  })
})

describe("Trefferbild-Kennzahlen", () => {
  it("jede Kennzahl mit festem Wert, in mm", () => {
    expect(value("group.enclosingDiameter", SPREAD)).toBeCloseTo(7, 9)
    expect(value("group.r50", SPREAD)).toBeCloseTo(2.5, 9)
    expect(value("group.sdX", SPREAD)).toBeCloseTo(Math.sqrt(26 / 5), 9)
    expect(value("group.sdY", SPREAD)).toBeCloseTo(Math.sqrt(14 / 5), 9)
    expectNear(value("group.mpiDistance", SPREAD), 0)
    expect(value("group.mpiDistance", PROBE)).toBeCloseTo(Math.hypot(1.04, -1.04), 9)
    expect(value("group.sdX", PROBE)).toBeCloseTo(0.1140175, 6)
    // Hier unterscheiden sich Streukreis und größter Abstand (0,3606 mm).
    expect(value("group.enclosingDiameter", PROBE)).toBeCloseTo(0.3676955, 6)
  })

  it("weitere Kennzahlen mit festen Werten", () => {
    // SPREAD: √(Σr² / (2(n − 1))) = 2,0 mm, σ̂ = 2,0 mm / c4(11)
    expect(value("group.sigma", SPREAD)).toBeCloseTo(2.0505458, 6)
    expect(value("result.tensRate", CARD)).toBe(50)
    expect(value("time.duration", MATCH)).toBe(250)
    // nach einem Sprung der Uhr keine Dauer (SF-30)
    const jumped = MATCH.map((shot, i) => ({
      ...shot,
      seq: i + 1,
      firedAtMs: (shot.firedAtMs as number) - (i >= 3 ? 3_600_000 : 0),
    }))
    expect(value("time.duration", jumped)).toBeNull()
    const paced = [0, 40, 85, 125, 170, 210].map((s, i) => ({
      ...MATCH[0],
      seq: i + 1,
      firedAtMs: s * 1000,
    }))
    expect(value("time.tempoSpread", paced)).toBe(5)
    expectNear(value("time.tempoSpread", MATCH), 0)
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
    // R50 fällt bei kleinem n etwas zu klein aus, der Streukreis wächst mit n; σ̂ gleicht das aus.
    for (const key of [
      "group.enclosingDiameter",
      "group.mpiDistance",
      "group.r50",
      "result.rings",
      "result.decimal",
      "result.tens",
      "result.innerTens",
      "time.duration",
    ]) {
      expect(sensitive).toContain(key)
    }
    for (const key of [
      "group.sigma",
      "result.decimalMean",
      "result.tensRate",
      "time.tempoSpread",
    ]) {
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
  })

  it("die Abgabefolge zählt, nicht die Uhr (SF-30)", () => {
    // Nach dem dritten Schuss springt die Uhr eine Stunde zurück.
    const jumped = MATCH.map((shot, i) => ({
      ...shot,
      seq: i + 1,
      firedAtMs: (shot.firedAtMs ?? 0) - (i >= 3 ? 3_600_000 : 0),
    }))
    expect(value("time.intervalMedian", jumped)).toBe(50)
    // Die Liste darf in beliebiger Reihenfolge kommen.
    expect(value("time.intervalMedian", [...jumped].reverse())).toBe(50)
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
    // Nur ein Teil hat seq: dann die Zeit.
    const g = { seq: 1, firedAtMs: 300 }
    const h = { seq: null, firedAtMs: 100 }
    expect(inShotOrder([g, h])).toEqual([h, g])
  })

  it("fehlt ein Schuss mitten in der Folge, entsteht daraus keine Pause", () => {
    // Sechs Schuss im Abstand von 100 s; der vierte ist ein Platzhalter oder ohne Zeit.
    const steady = MATCH.map((shot, i) => ({ ...shot, seq: i + 1, firedAtMs: i * 100_000 }))
    const flagged = steady.map((shot, i) => (i === 3 ? { ...shot, flags: ["verdaechtig"] } : shot))
    const untimed = steady.map((shot, i) => (i === 3 ? { ...shot, firedAtMs: null } : shot))
    for (const shots of [flagged, untimed]) {
      expect(value("time.intervalMedian", shots)).toBe(100)
      // ohne die Lücke wären die 200 s über den fehlenden Schuss hinweg eine Pause
      const times = timesInOrder(selectShots(inShotOrder(shots), { need: "time" }))
      expect(tempo(times).pausesMs).toEqual([])
    }
  })
})

describe("Lücken in der Abgabefolge (SF-04, SF-30)", () => {
  const at = (seq: number, kind: MetricShot["kind"], s: number | null): MetricShot => ({
    ...MATCH[0],
    seq,
    kind,
    series: kind === "match" ? 1 : null,
    firedAtMs: s === null ? null : s * 1000,
  })
  // Wertung 0, 40 s, eine Probe bei 70 s, Wertung 100 und 160 s
  const CARD5 = [
    at(1, "match", 0),
    at(2, "match", 40),
    at(3, "probe", 70),
    at(4, "match", 100),
    at(5, "match", 160),
  ]
  const MATCH4 = CARD5.filter((shot) => shot.kind === "match")
  const gaps = (steps: readonly { gapBefore: boolean }[]) => steps.map((step) => step.gapBefore)

  it("ohne Karte ist jeder Sprung eine Lücke", () => {
    expect(gaps(stepsInOrder(MATCH4))).toEqual([false, false, true, false])
  })

  it("füllt nur eine Probe den Sprung, ist er in der Wertung keine Lücke", () => {
    expect(gaps(stepsInOrder(MATCH4, contextOf(MATCH4, CARD5)))).toEqual([
      false,
      false,
      false,
      false,
    ])
  })

  it("fehlt der Karte die Nummer, bleibt es eine Lücke", () => {
    expect(gaps(stepsInOrder(MATCH4, contextOf(MATCH4, MATCH4)))).toEqual([
      false,
      false,
      true,
      false,
    ])
  })

  it("fehlt einem Wertungsschuss dazwischen nur die Zeit, bleibt es eine Lücke", () => {
    const card = CARD5.map((shot) => (shot.seq === 3 ? at(3, "match", null) : shot))
    const match = card.filter((shot) => shot.kind === "match")
    const timed = selectShots(inShotOrder(card), { kinds: ["match"], need: "time" })
    expect(gaps(stepsInOrder(timed, contextOf(match, card)))).toEqual([false, false, true, false])
  })

  it("in einer Auswahl beider Arten gehört die Probe dazu: ohne Zeit eine Lücke", () => {
    const card = CARD5.map((shot) => (shot.seq === 3 ? at(3, "probe", null) : shot))
    const timed = selectShots(inShotOrder(card), { need: "time" })
    expect(gaps(stepsInOrder(timed, contextOf(card, card)))).toEqual([false, false, true, false])
  })

  it("nur die Probe ist durchlässig: in der Probe bleiben Wertungsschüsse eine Lücke", () => {
    // Probe 0 und 40 s, Wertung 80 und 120 s, späte Probe 160 s (wie SF-03: Probe → Wertung → Probe)
    const card = [
      at(1, "probe", 0),
      at(2, "probe", 40),
      at(3, "match", 80),
      at(4, "match", 120),
      at(5, "probe", 160),
    ]
    const probe = card.filter((shot) => shot.kind === "probe")
    expect(gaps(stepsInOrder(probe, contextOf(probe, card)))).toEqual([false, false, true])
  })

  it("Probe vorn füllt keine fremde Lücke: fehlt der Karte eine Nummer, bleibt es eine", () => {
    // Probe seq 1 und 2, Wertung 3 und 4, späte Probe 5, Wertung 7; seq 6 fehlt der Karte. Die Probe vorn
    // zählt so viele Nummern, wie der Sprung braucht, liegt aber nicht in ihm.
    const card = [
      at(1, "probe", 0),
      at(2, "probe", 40),
      at(3, "match", 80),
      at(4, "match", 120),
      at(5, "probe", 160),
      at(7, "match", 240),
    ]
    const match = card.filter((shot) => shot.kind === "match")
    expect(gaps(stepsInOrder(match, contextOf(match, card)))).toEqual([false, false, true])
  })

  it("ein riesiger Sprung bleibt eine Lücke, auch mit einer Probe darin", () => {
    const card = [at(1, "match", 0), at(2, "probe", 30), at(1_000_000, "match", 60)]
    const match = card.filter((shot) => shot.kind === "match")
    expect(gaps(stepsInOrder(match, contextOf(match, card)))).toEqual([false, true])
  })

  it("Tempo über die Wertung mit der Karte, ohne sie und über beide Arten (Handwerte)", () => {
    // ohne Karte: 40 und 60 s, Median 50; mit Karte: 40, 60, 60, Median 60; beide Arten: 40, 30, 30, 60
    const tempoOf = (shots: readonly MetricShot[], card?: readonly MetricShot[]) =>
      computeMetric(def("time.intervalMedian"), shots, card)
    for (const [actual, expected] of [
      [tempoOf(MATCH4), 50],
      [tempoOf(MATCH4, CARD5), 60],
      [tempoOf(CARD5), 35],
    ] as const) {
      expect(actual).not.toBeNull()
      expect(actual).toBe(expected)
    }
  })

  it("die Zeit-Kennzahlen rechnen seit der Regel in Version 2, Tempo und Streuung seit der Pause über dem Doppelten in 4", () => {
    expect(def("time.intervalMedian").version).toBe(4)
    expect(def("time.tempoSpread").version).toBe(4)
    expect(def("time.duration").version).toBe(2)
  })
})

describe("Pausen mit der Schwelle der Karte (Z1, Z2)", () => {
  /** Schüsse mit den Abständen `gaps` (in s), Serie 1 bis Schuss 10 */
  const timed = (gaps: readonly number[], kind: MetricShot["kind"] = "match") =>
    gaps
      .reduce<number[]>((times, gap) => [...times, times.at(-1)! + gap], [0])
      .map(
        (s, i): MetricShot => ({
          ...MATCH[0],
          seq: i + 1,
          kind,
          series: kind === "match" ? (i < 10 ? 1 : 2) : null,
          firedAtMs: s * 1000,
        })
      )
  // Serie 1 im Takt von 30 s, dann 30 s; Serie 2: 30, fünfmal 90, dreimal 30. Die Karte: 14 × 30 und 5 × 90, Median
  // 30 s, Schwelle 60 s, die 90 s sind Pausen. Serie 2 allein: Median 90 s, Schwelle 180 s, keine Pause.
  const CARD20 = timed([...Array(10).fill(30), 30, 90, 90, 90, 90, 90, 30, 30, 30])
  const SERIES2 = CARD20.slice(10)

  it("Tempo und Tempo-Streuung einer Serie mit der Schwelle der ganzen Karte", () => {
    const tempoOf = (card?: readonly MetricShot[]) =>
      computeMetric(def("time.intervalMedian"), SERIES2, card)
    const spreadOf = (card?: readonly MetricShot[]) =>
      computeMetric(def("time.tempoSpread"), SERIES2, card)
    expect(tempoOf(CARD20)).toBe(30)
    expect(spreadOf(CARD20)).not.toBeNull()
    expect(spreadOf(CARD20)).toBe(0)
    // Gegenprobe: ohne Karte gilt der Takt der Serie
    expect(tempoOf()).toBe(90)
    expect(spreadOf()).toBe(60)
  })

  it("eine Karte nur aus Probe, als Wertung gezeigt: die Schwelle aus der Auswahl, nie still drei Minuten", () => {
    const raw = timed([40, 40, 40, 40, 120, 40, 40, 40], "probe")
    const printed = probeOnlyAsMatch(raw)
    expect(pauseThresholdOf(printed, contextOf(printed, raw))).toBe(80_000)
    expect(pauseThresholdOf(printed, contextOf(printed, printed))).toBe(80_000)
  })

  it("nur Schüsse mit gültiger Zeit zählen in den Takt, wie in jeder Zeit-Auswertung (SF-15)", () => {
    // Schuss 3 ist verdächtig: ohne ihn gibt es nur drei Abstände, also die feste Grenze; mit ihm wären es fünf
    const card = timed([30, 15, 15, 30, 30]).map((shot, i) =>
      i === 2 ? { ...shot, flags: [FLAG_SUSPICIOUS] } : shot
    )
    const match = selectShots(card, { need: "time" })
    expect(match).toHaveLength(5)
    expect(pauseThresholdOf(match, contextOf(match, card))).toBe(180_000)
  })
})

// Kennzahlen, die in beiden Wertungen gleich sind: Ein Zehner bleibt ein Zehner.
const SCORING_FREE = ["result.tens", "result.innerTens", "result.tensRate"]

describe("selectShots", () => {
  it("wählt nach denselben Regeln wie die Registry", () => {
    const miss: MetricShot = { ...PROBE[0], xUm: 60_000, yUm: 60_000, flags: ["fehlschuss"] }
    const placeholder: MetricShot = {
      ...MATCH[0],
      xUm: 0,
      yUm: 0,
      distanceUm: 0,
      firedAtMs: 10_000_000,
      flags: ["verdaechtig"],
    }
    const over: MetricShot = { ...MATCH[1], decimalTenths: 0, ring: 0, flags: ["ueber-soll"] }
    const card = [...CARD, miss, placeholder, over]
    for (const metric of METRICS) {
      expect(
        selectShots(card, {
          kinds: metric.appliesTo,
          need: metric.needs,
          excludeMisses: metric.excludeMisses,
        }),
        metric.key
      ).toEqual(eligibleShots(metric, card))
    }
  })

  it("ohne Angabe der Art zählen Probe und Wertung", () => {
    expect(selectShots(CARD, { need: "position" })).toHaveLength(CARD.length)
    expect(selectShots(CARD, { need: "position", kinds: ["match"] })).toHaveLength(MATCH.length)
  })
})

describe("shotNumbers", () => {
  it("nummeriert je Art in Abgabefolge, unabhängig von fehlenden Angaben", () => {
    // Liste absichtlich gemischt; Schuss 3 der Wertung ist ein Platzhalter ohne Lage und Wert
    const third: MetricShot = {
      ...MATCH[2],
      xUm: null,
      yUm: null,
      decimalTenths: null,
      flags: ["verdaechtig"],
    }
    const card = [MATCH[5], PROBE[1], MATCH[0], third, PROBE[0], MATCH[1], MATCH[3], MATCH[4]]
    const numbers = shotNumbers(card)
    expect(MATCH.map((shot) => numbers.get(shot === MATCH[2] ? third : shot))).toEqual([
      1, 2, 3, 4, 5, 6,
    ])
    expect(numbers.get(PROBE[0])).toBe(1)
    expect(numbers.get(PROBE[1])).toBe(2)
  })
})

describe("probeOnlyAsMatch", () => {
  it("eine Karte nur mit Probe wird Wertung, Serien zu zehn in Abgabefolge, Liste in ihrer Reihenfolge", () => {
    const probes: MetricShot[] = Array.from({ length: 12 }, (_, i) => ({
      ...PROBE[0],
      seq: i + 1,
      xUm: 100 * i,
    }))
    // die beiden letzten zuerst: Reihenfolge der Liste bleibt, die Serie folgt der Abgabefolge
    const shuffled = [probes[11], probes[10], ...probes.slice(0, 10)]
    const card = probeOnlyAsMatch(shuffled)
    expect(card.map((s) => s.kind)).toEqual(Array(12).fill("match"))
    expect(card.map((s) => s.seq)).toEqual(shuffled.map((s) => s.seq))
    expect(card.map((s) => s.series)).toEqual([2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
  })

  it("mit Wertung oder ohne Schüsse bleibt die Karte, wie sie ist", () => {
    const card = [PROBE[0], MATCH[0]]
    expect(probeOnlyAsMatch(card)).toBe(card)
    const empty: MetricShot[] = []
    expect(probeOnlyAsMatch(empty)).toBe(empty)
  })
})

describe("asOnPrintout (eine Scheibe wie am Ausdruck)", () => {
  it("mit Wertung bleiben nur die Wertungsschüsse, in der Reihenfolge der Liste, unverändert", () => {
    const card = asOnPrintout(CARD)
    expect(card).toEqual(MATCH)
    card.forEach((shot, i) => expect(shot).toBe(MATCH[i]))
  })

  it("Probe zwischen Wertung (SF-04) fällt ebenso weg", () => {
    const mixed = [
      PROBE[0],
      PROBE[1],
      PROBE[2],
      MATCH[0],
      MATCH[1],
      PROBE[3],
      PROBE[4],
      MATCH[2],
      MATCH[3],
    ]
    expect(asOnPrintout(mixed)).toEqual([MATCH[0], MATCH[1], MATCH[2], MATCH[3]])
  })

  it("nur Probe ist Training: wie `probeOnlyAsMatch`, Serien zu zehn", () => {
    const probes: MetricShot[] = Array.from({ length: 60 }, (_, i) => ({ ...PROBE[0], seq: i + 1 }))
    const card = asOnPrintout(probes)
    expect(card).toEqual(probeOnlyAsMatch(probes))
    expect(card.map((s) => s.series)).toEqual(
      Array.from({ length: 60 }, (_, i) => Math.floor(i / 10) + 1)
    )
  })

  it("nur Wertung oder ohne Schüsse: dieselbe Liste", () => {
    expect(asOnPrintout(MATCH)).toBe(MATCH)
    const empty: MetricShot[] = []
    expect(asOnPrintout(empty)).toBe(empty)
  })
})

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
    expect(() => defineMetric({ ...base, decimals: 4 })).toThrow(RangeError)
    expect(() => defineMetric({ ...base, catalogId: "" })).toThrow(RangeError)
    expect(() => defineMetric({ ...base, catalogId: "e1" })).toThrow(RangeError)
    expect(() => defineMetric({ ...base, catalogId: "X1" })).toThrow(RangeError)
  })

  it("jede Kennzahl trägt ihre Katalog-ID (vault/spiegel/spiegel-statistics.md)", () => {
    expect(Object.fromEntries(METRICS.map((metric) => [metric.key, metric.catalogId]))).toEqual({
      "result.rings": "E1",
      "result.decimal": "E1",
      "result.decimalMean": "E2",
      "result.ringsMean": "E2",
      "result.tens": "E4",
      "result.innerTens": "E5",
      "result.tensRate": "E4",
      "result.bestTeiler": "E8",
      "group.mpiDistance": "L2",
      "group.enclosingDiameter": "P1",
      "group.r50": "P4",
      "group.sigma": "P5",
      "group.sdX": "P6",
      "group.sdY": "P6",
      "time.intervalMedian": "Z1",
      "time.tempoSpread": "Z2",
      "time.duration": "Z3",
    })
  })
})

describe("Merkmale einer Scheibe an einer Stelle", () => {
  it("jede Kennung, die an einer Scheibe stehen kann", () => {
    expect([...CARD_FLAGS].sort()).toEqual([
      "als-wertung-gezaehlt",
      "ausgenommen",
      "disziplin-unbekannt",
      "korrigiert",
      "leer",
      "neu-gewertet",
      "nur-pdf",
      "nur-probe",
      "scheibe-passt-nicht",
      "ueber-soll",
      "uhr-abweichung",
      "unvollstaendig",
    ])
    expect(new Set(CARD_FLAGS).size).toBe(CARD_FLAGS.length)
  })
})
