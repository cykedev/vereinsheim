import type { Picture, PrintoutValues, ShotValue } from "@vereinsheim/meyton-pdf/values"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { describe, expect, it } from "vitest"

import {
  checkLabels,
  drawnMm,
  labelDeviations,
  matchDiscipline,
  selfCheck,
  teilerFromMm,
  compareCenter,
  compareShots,
  compareSums,
  compareTeiler,
  fitDrawn,
  hitCircleCandidates,
  nearestCandidate,
  ringDiametersMm,
  scaleFromRings,
  spreadCandidates,
  summarize,
  teilerOf,
  type RawShot,
} from "./compare"

// Erfundene Schüsse (keine echten Scheiben, ADR-029): Lage in µm, Wert und Abstand passend zueinander gesetzt.
function shot(xUm: number, yUm: number, decimalTenths: number, series = 1): RawShot {
  const distance = Math.hypot(xUm, yUm)
  return {
    xUm,
    yUm,
    series,
    ring: Math.floor(decimalTenths / 10),
    decimalTenths,
    innerTen: decimalTenths >= 100 && distance <= 4750,
    distanceTenthsUm: Math.round(distance * 10),
  }
}

const RAW: RawShot[] = [
  shot(1000, 2000, 104),
  shot(-12000, 3000, 92),
  shot(5000, -8000, 95),
  shot(3000, 1000, 105),
]

const printed = (shots: readonly RawShot[]): ShotValue[] =>
  shots.map((s) => ({
    series: s.series ?? 1,
    value: s.decimalTenths,
    innerTen: s.innerTen,
    teiler: null,
  }))

function values(overrides: Partial<PrintoutValues>): PrintoutValues {
  return {
    discipline: null,
    mode: null,
    shooter: null,
    stand: null,
    initialized: null,
    result: null,
    seriesRings: null,
    counts: null,
    innerTens: null,
    bestTeiler: null,
    widestTeiler: null,
    hitCircleMm: null,
    centerMm: null,
    spread: null,
    series: [],
    shots: [],
    pictures: [],
    layout: [],
    ...overrides,
  }
}

describe("compareShots", () => {
  it("zählt gleiche Werte und Innenzehner in der Folge des Ausdrucks", () => {
    const result = compareShots(printed(RAW), RAW)
    expect(result).toMatchObject({ compared: 4, valueEqual: 4, innerTenEqual: 4, mismatches: [] })
  })

  it("findet einen abweichenden Wert und einen fehlenden Stern", () => {
    const shots = printed(RAW)
    shots[1] = { ...shots[1], value: 93 }
    shots[3] = { ...shots[3], innerTen: false }
    expect(compareShots(shots, RAW)).toMatchObject({
      valueEqual: 3,
      innerTenEqual: 3,
      mismatches: [1, 3],
    })
  })

  it("vergleicht einen Zwischenausdruck nur mit den ersten Schüssen", () => {
    expect(compareShots(printed(RAW.slice(0, 2)), RAW)).toMatchObject({
      printed: 2,
      raw: 4,
      compared: 2,
    })
  })

  it("unterscheidet beim Teiler je Schuss abgeschnitten und gerundet, in der gedruckten Genauigkeit", () => {
    // roh 223,607 · 1236,93 · 943,398 · 316,228; abgeschnitten und gerundet unterscheiden sich bei den ersten beiden
    const shots = printed(RAW).map((s, i) => ({
      ...s,
      teiler: Math.trunc(teilerOf(RAW[i].distanceTenthsUm)),
    }))
    expect(compareShots(shots, RAW)).toMatchObject({
      teilerCompared: 4,
      teilerTruncated: 4,
      teilerRounded: 2,
    })
    shots[0] = { ...shots[0], teiler: 223.6 }
    expect(compareShots(shots, RAW)).toMatchObject({ teilerTruncated: 4, teilerRounded: 3 })
  })
})

describe("compareSums", () => {
  it("schneidet die Serien in ihrer Folge aus den Rohdaten", () => {
    const series = (number: number, shots: ShotValue[], rings: number, tenths: number) => ({
      number,
      sum: { rings, tenths },
      shots,
      bestTeiler: null,
      hitCircleMm: null,
      centerMm: null,
      spread: null,
    })
    // Serie 1: 10 + 9 Ringe, 196 Zehntel; Serie 2: 9 + 10 Ringe, 200 Zehntel
    const checks = compareSums(
      values({
        seriesRings: [19, 18],
        series: [
          series(1, printed(RAW.slice(0, 2)), 19, 196),
          series(2, printed(RAW.slice(2)), 19, 201),
        ],
        shots: printed(RAW),
      }),
      RAW
    )
    expect(checks.filter((c) => c.printed !== c.raw)).toEqual([
      { what: "Serie 2 Zehntel", printed: 201, raw: 200 },
      { what: "Serien 2", printed: 18, raw: 19 },
    ])
    expect(checks).toHaveLength(6)
  })

  it("prüft Ergebnis, Serien, Innenzehner und Zähler gegen die Rohdaten", () => {
    const checks = compareSums(
      values({
        result: { rings: 38, tenths: 396 },
        seriesRings: [38],
        innerTens: 2,
        counts: [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        series: [
          {
            number: 1,
            sum: { rings: 38, tenths: 397 },
            shots: printed(RAW),
            bestTeiler: null,
            hitCircleMm: null,
            centerMm: null,
            spread: null,
          },
        ],
        shots: printed(RAW),
      }),
      RAW
    )
    const wrong = checks.filter((c) => c.printed !== c.raw)
    expect(wrong).toEqual([{ what: "Serie 1 Zehntel", printed: 397, raw: 396 }])
    expect(checks.map((c) => c.what)).toContain("Zähler 10")
    expect(checks.find((c) => c.what === "Innenzehner")?.raw).toBe(2)
  })
})

describe("compareTeiler", () => {
  it("nimmt den Teiler am genannten Schuss und prüft die Rangfolge", () => {
    const best = [...RAW]
      .map((s, i) => ({ shot: i + 1, value: teilerOf(s.distanceTenthsUm) }))
      .sort((a, b) => a.value - b.value)
    const checks = compareTeiler(best.slice(0, 3), RAW, "best")
    expect(checks.every((c) => c.diff === 0 && c.rankOk)).toBe(true)
  })

  it("merkt eine falsche Schussnummer und einen falschen Rang", () => {
    const [check] = compareTeiler([{ value: 223.6, shot: 2 }], RAW, "best")
    expect(check.raw).toBeCloseTo(teilerOf(RAW[1].distanceTenthsUm), 6)
    expect(check.diff).not.toBe(0)
    expect(check.rankOk).toBe(false)
  })

  it("erkennt abgeschnitten und gerundet in der Genauigkeit der Art", () => {
    // roh 223,607: bester Teiler mit einer Nachkommastelle, weitester ganz
    const [cut] = compareTeiler([{ value: 223.6, shot: 1 }], RAW, "best")
    expect(cut).toMatchObject({ truncated: true, rounded: true })
    const raw = [{ ...RAW[0], distanceTenthsUm: 8817 }]
    expect(compareTeiler([{ value: 88.1, shot: 1 }], raw, "best")[0]).toMatchObject({
      truncated: true,
      rounded: false,
    })
    expect(compareTeiler([{ value: 88.2, shot: 1 }], raw, "best")[0]).toMatchObject({
      truncated: false,
      rounded: true,
    })
    expect(compareTeiler([{ value: 88, shot: 1 }], raw, "widest")[0]).toMatchObject({
      truncated: true,
      rounded: true,
    })
  })

  it("nimmt bei gleichem Teiler jeden der Schüsse als richtigen Rang", () => {
    const twins = [RAW[0], { ...RAW[0], xUm: -RAW[0].xUm }, RAW[1]]
    const checks = compareTeiler(
      [
        { value: 223.6, shot: 2 },
        { value: 223.6, shot: 1 },
      ],
      twins,
      "best"
    )
    expect(checks.map((c) => c.rankOk)).toEqual([true, true])
  })

  it("rangiert weiteste absteigend und mit den Nummern einer Serie", () => {
    const checks = compareTeiler(
      [{ value: Math.trunc(teilerOf(RAW[1].distanceTenthsUm)), shot: 12 }],
      RAW,
      "widest",
      [11, 12, 13, 14]
    )
    expect(checks[0].rankOk).toBe(true)
    expect(checks[0].diff).toBeLessThan(0)
    expect(checks[0].diff).toBeGreaterThan(-1)
  })
})

describe("compareCenter", () => {
  it("erkennt abgeschnitten und gerundet", () => {
    // Schwerpunkt (1,756; 0,003) mm
    const shots = [
      { xUm: 1756, yUm: 3 },
      { xUm: 1756, yUm: 3 },
    ]
    const truncated = compareCenter({ x: 1.75, y: 0 }, shots)
    expect(truncated).toMatchObject({ truncated: true, rounded: false })
    expect(truncated?.distanceMm).toBeCloseTo(Math.hypot(0.006, 0.003), 9)
    expect(compareCenter({ x: 1.76, y: 0 }, shots)).toMatchObject({
      truncated: false,
      rounded: true,
    })
    expect(compareCenter({ x: -1.75, y: 0 }, shots)).toMatchObject({
      truncated: false,
      rounded: false,
    })
  })

  it("schneidet negative Werte zur Null hin ab", () => {
    expect(compareCenter({ x: -1.75, y: -0.4 }, [{ xUm: -1759, yUm: -409 }])).toMatchObject({
      truncated: true,
    })
  })

  it("liefert ohne Schüsse nichts", () => {
    expect(compareCenter({ x: 0, y: 0 }, [])).toBeNull()
  })
})

describe("Trefferkreis und Streuwert", () => {
  // drei Punkte bestimmen den Kreis: ein gleichseitiges Dreieck mit Umkreisradius 10 mm
  const triangle = [0, 120, 240].map((deg) => ({
    xUm: 10000 * Math.cos((deg * Math.PI) / 180),
    yUm: 10000 * Math.sin((deg * Math.PI) / 180),
  }))

  it("rechnet die vier Kandidaten, die sich bei drei bestimmenden Punkten unterscheiden", () => {
    const c = hitCircleCandidates(triangle, 4.5)!
    expect(c.enclosing).toBeCloseTo(20, 6)
    expect(c.enclosingPlusCaliber).toBeCloseTo(24.5, 6)
    expect(c.extremeSpread).toBeCloseTo(10 * Math.sqrt(3), 6)
    expect(c.twiceMaxRadius).toBeCloseTo(20, 6)
  })

  it("wählt den nächsten Kandidaten, nicht den ersten", () => {
    const c = hitCircleCandidates(triangle, 4.5)!
    expect(nearestCandidate(24.5, c)).toEqual({
      candidate: "enclosingPlusCaliber",
      diff: expect.closeTo(0, 6),
    })
    expect(nearestCandidate(17.4, c).candidate).toBe("extremeSpread")
    expect(nearestCandidate(19.9, c).candidate).toBe("enclosing")
  })

  it("rechnet den Streuwert mit n und mit n − 1", () => {
    const s = spreadCandidates([
      { xUm: -2000, yUm: 0 },
      { xUm: 2000, yUm: 0 },
    ])!
    expect(s.population.horizontal).toBeCloseTo(2, 9)
    expect(s.sample.horizontal).toBeCloseTo(2 * Math.SQRT2, 9)
    expect(s.population.vertical).toBe(0)
    expect(s.population.overall).toBeCloseTo(Math.SQRT2, 9)
  })
})

describe("Trefferbild", () => {
  it("liest den Maßstab aus den Ringen der Luftpistole", () => {
    const mm = ringDiametersMm(LP_10M)
    expect(mm[0]).toBe(155.5)
    expect(mm.at(-1)).toBe(5)
    expect(
      scaleFromRings(
        mm.map((d) => d * 1.8),
        mm
      )
    ).toBeCloseTo(1.8, 9)
    expect(scaleFromRings([1, 2], mm)).toBeNull()
  })

  const raw = [
    { xUm: 0, yUm: 0 },
    { xUm: 10000, yUm: 0 },
    { xUm: 0, yUm: -20000 },
    { xUm: -5000, yUm: 5000 },
  ]
  const center = { x: 480, y: 650 }
  const at = (p: { xUm: number; yUm: number }, scale = 1.5) => ({
    x: center.x + (p.xUm / 1000) * scale,
    y: center.y + (p.yUm / 1000) * scale,
  })

  it("findet keine Abweichung, wo das Bild genau ist", () => {
    const fit = fitDrawn(
      raw.map((p) => at(p)),
      raw,
      { center, ptPerMm: 1.5 }
    )!
    expect(Math.max(...fit.fitted)).toBeLessThan(1e-9)
    expect(Math.max(...fit.fromRings!)).toBeLessThan(1e-9)
    expect(fit.fittedScale).toBeCloseTo(1.5, 9)
  })

  it("misst einen verschobenen Treffer in mm, nicht in Punkt", () => {
    const drawn = raw.map((p) => at(p))
    drawn[1] = { x: drawn[1].x + 0.75, y: drawn[1].y }
    const fit = fitDrawn(drawn, raw, { center, ptPerMm: 1.5 })!
    expect(fit.fromRings![1]).toBeCloseTo(0.5, 9)
    expect(fit.fromRings![0]).toBe(0)
    // die beste Ausrichtung verteilt den Fehler, der verschobene Treffer bleibt der größte
    expect(fit.fitted.indexOf(Math.max(...fit.fitted))).toBe(1)
    expect(Math.max(...fit.fitted)).toBeLessThan(0.5)
    expect(Math.max(...fit.fitted)).toBeGreaterThan(0.25)
  })

  it("misst auch bei gespiegeltem Bild positive Abweichungen", () => {
    const drawn = raw.map((p) => ({ x: at(p).x, y: 2 * center.y - at(p).y }))
    drawn[1] = { x: drawn[1].x + 0.75, y: drawn[1].y }
    const fit = fitDrawn(drawn, raw, null)!
    expect(fit.fittedScale).toBeLessThan(0)
    expect(Math.min(...fit.fitted)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...fit.fitted)).toBeGreaterThan(0.25)
  })

  it("gleicht in der besten Ausrichtung einen falschen Maßstab und eine falsche Mitte aus", () => {
    const drawn = raw.map((p) => ({ x: at(p, 1.6).x + 3, y: at(p, 1.6).y - 2 }))
    const fit = fitDrawn(drawn, raw, { center, ptPerMm: 1.5 })!
    expect(Math.max(...fit.fitted)).toBeLessThan(1e-9)
    expect(fit.fittedScale).toBeCloseTo(1.6, 9)
    expect(Math.min(...fit.fromRings!)).toBeGreaterThan(1)
  })

  it("zählt fehlende Nummern und überdeckte Marken", () => {
    const holes = raw.map((p, index) => ({ index, ...at(p) }))
    holes.push({ index: 4, x: holes[0].x + 3, y: holes[0].y })
    const picture: Picture = {
      frame: null,
      center,
      ringDiametersPt: [],
      holeDiameterPt: 6.75,
      holeShape: "circle",
      holes,
      labels: [
        { shot: 11, x: holes[0].x, y: holes[0].y },
        { shot: 12, x: holes[1].x + 0.15, y: holes[1].y },
        { shot: 13, x: holes[2].x, y: holes[2].y },
      ],
    }
    const check = checkLabels(picture, 11, 1.5)
    expect(check.missing).toBe(2)
    expect(check.covered).toBe(2)
    expect(check.offsetsMm).toEqual([0, expect.closeTo(0.1, 9), 0])
  })
})

describe("Teiler und Nummern aus dem Bild", () => {
  const rings = { center: { x: 480, y: 650 }, ptPerMm: 1.5 }

  it("rechnet Lage und Teiler einer Marke aus Mitte und Maßstab", () => {
    const mm = drawnMm({ x: 480 + 4.5, y: 650 - 6 }, rings)
    expect(mm).toEqual({ x: 3, y: -4 })
    expect(teilerFromMm(mm)).toBeCloseTo(500, 9)
  })

  it("misst die Nummer gegen ihren Schuss und nimmt bei doppelten Zahlen die nächste", () => {
    const picture: Picture = {
      frame: null,
      center: rings.center,
      ringDiametersPt: [],
      holeDiameterPt: 6.75,
      holeShape: "circle",
      holes: [],
      labels: [
        { shot: 3, x: 480 + 30, y: 650 },
        { shot: 3, x: 480 + 1.5 * 2.2, y: 650 },
        { shot: 4, x: 480, y: 650 + 1.5 * 1.5 },
      ],
    }
    const raw = [
      { xUm: 2000, yUm: 0 },
      { xUm: 0, yUm: 1000 },
      { xUm: 9000, yUm: 9000 },
    ]
    const out = labelDeviations(picture, 3, raw, rings)
    expect(out).toEqual([expect.closeTo(0.2, 9), expect.closeTo(0.5, 9)])
  })
})

describe("selfCheck", () => {
  const series = (number: number, shots: ShotValue[], rings: number, tenths: number) => ({
    number,
    sum: { rings, tenths },
    shots,
    bestTeiler: null,
    hitCircleMm: null,
    centerMm: null,
    spread: null,
  })
  const one = printed(RAW.slice(0, 2))
  const two = printed(RAW.slice(2))

  it("findet keinen Widerspruch, wo die Summen zu den Werten passen", () => {
    const checks = selfCheck(
      values({
        result: { rings: 38, tenths: 396 },
        seriesRings: [19, 19],
        innerTens: 2,
        counts: [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        series: [series(1, one, 19, 196), series(2, two, 19, 200)],
        shots: [...one, ...two],
      })
    )
    expect(checks.filter((c) => c.printed !== c.fromShots)).toEqual([])
    expect(checks).toHaveLength(2 + 4 + 2 + 1 + 11)
  })

  it("meldet einen falsch gelesenen Wert über die Summen", () => {
    const misread = [{ ...one[0], value: 94 }, one[1]]
    const checks = selfCheck(
      values({
        result: { rings: 38, tenths: 396 },
        counts: [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        series: [series(1, misread, 19, 196), series(2, two, 19, 200)],
        shots: [...misread, ...two],
      })
    )
    expect(checks.filter((c) => c.printed !== c.fromShots).map((c) => c.what)).toEqual([
      "Ergebnis Ringe",
      "Ergebnis Zehntel",
      "Serie Ringe",
      "Serie Zehntel",
      "Zähler",
      "Zähler",
    ])
  })

  it("prüft ohne Werte je Schuss nichts", () => {
    expect(selfCheck(values({ result: { rings: 38, tenths: 396 } }))).toEqual([])
  })
})

describe("matchDiscipline", () => {
  const names = ["LP 40", "LP 40 alt", "LP-Trainingsscheibe", "LG 40", "lg 40"]

  it("ordnet wörtlich, sonst nach Normalisieren genau einer Disziplin zu", () => {
    expect(matchDiscipline("LP 40 alt", names)).toEqual({ kind: "exact", index: 1 })
    expect(matchDiscipline("LP\u2212Trainingsscheibe", names)).toEqual({
      kind: "normalized",
      index: 2,
    })
    expect(matchDiscipline("lp  40", names)).toEqual({ kind: "normalized", index: 0 })
  })

  it("rät nicht bei mehreren oder keinem Treffer", () => {
    expect(matchDiscipline("Lg 40", names)).toEqual({ kind: "ambiguous" })
    expect(matchDiscipline("LP 60", names)).toEqual({ kind: "none" })
  })
})

describe("summarize", () => {
  it("nimmt Beträge, Median, 95 % nach nächstem Rang und den Anteil gleich", () => {
    const values = Array.from({ length: 20 }, (_, i) => (i < 10 ? 0 : -(i - 9)))
    expect(summarize(values)).toEqual({ n: 20, median: 0.5, p95: 9, max: 10, shareEqual: 0.5 })
    expect(summarize([])).toEqual({ n: 0, median: null, p95: null, max: null, shareEqual: null })
  })
})
