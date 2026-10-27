import { describe, expect, it } from "vitest"

import { circle, printoutPdf, type TestPrintout } from "../__fixtures__/printoutPdf"
import { MeytonPdfError } from "../errors"
import {
  parseCenter,
  parseMm,
  parseSpread,
  parseSum,
  parseTeiler,
  readPrintoutValues,
} from "./read"

// Erfundene Ausdrucke nach den zwei gemessenen Layouts aus `printoutPdf` (ohne echte Namen, ADR-029).

/** Kopf und Zeilen wie im Layout mit „Trefferkreis“ (Qt): Werte als eigene Stücke */
const qtSpec: TestPrintout = {
  layout: "qt",
  stand: "4",
  mode: "Probe",
  result: "97 (101.3)",
  seriesLine: "97",
  counts: "4 4 1 1 0 0 0 0 0 0 0",
  innerTens: "2",
  widest: "1520 (9.), 990 (4.), 610 (2.)",
  best: "88.1 (1.), 201.7 (6.), 255.0 (3.)",
  circle: "21.36 mm",
  center: "1.09 mm links, 0.40 mm tief",
  series: [
    {
      sum: "97 (101.3)",
      values: ["10.5*", "9.8", "10.1", "9.4", "8.9", "10.6*", "10.2", "9.9", "8.2", "9.0"],
      best: "88.1 (1.), 201.7 (6.), 255.0 (3.)",
      circle: "21.36 mm",
      center: "1.09 mm links, 0.40 mm tief",
    },
  ],
  initialized: "02.10.2026 19:21",
}

/** Kopf im Layout mit „Streuwert“ (Ghostscript): Kopf der Serie samt Summe in einem Stück */
const gsSpec: TestPrintout = {
  layout: "ghostscript",
  stand: "3",
  mode: "Wertung",
  result: "18 (19.4)",
  center: "0.50 mm rechts, 1.30 mm hoch",
  spread: "10.88, horizontal: 11.90, vertikal: 9.77",
  series: [
    {
      sum: "18 (19.4)",
      values: ["9.2", "10.2"],
      center: "0.98 mm rechts, 3.66 mm tief",
      spread: "10.16, horizontal: 12.00, vertikal: 7.89",
    },
    { sum: "0 (0.0)", values: [] },
  ],
}

const readSpec = async (spec: TestPrintout) => readPrintoutValues(await printoutPdf(spec))

describe("einzelne Zeilen", () => {
  it("liest Summen in Ringen und Zehnteln", () => {
    expect(parseSum("88 (92.7)")).toEqual({ rings: 88, tenths: 927 })
    expect(parseSum("343")).toEqual({ rings: 343, tenths: null })
    expect(parseSum("(361.9)")).toEqual({ rings: null, tenths: 3619 })
    expect(parseSum("(361,9)")).toEqual({ rings: null, tenths: 3619 })
    expect(parseSum("")).toBeNull()
    expect(parseSum("88 (92.75)")).toEqual({ rings: 88, tenths: null })
  })

  it("liest Teiler mit Schussnummer", () => {
    expect(parseTeiler("171.4 (10.), 347.5 (32.)")).toEqual([
      { value: 171.4, shot: 10 },
      { value: 347.5, shot: 32 },
    ])
    expect(parseTeiler("4920 (26.)")).toEqual([{ value: 4920, shot: 26 }])
    expect(parseTeiler("–")).toBeNull()
  })

  it("liest die Trefferlage mit rechts und hoch positiv", () => {
    expect(parseCenter("1.09 mm links, 5.26 mm hoch")).toEqual({ x: -1.09, y: 5.26 })
    expect(parseCenter("6.49 mm rechts, 2.74 mm tief")).toEqual({ x: 6.49, y: -2.74 })
    expect(parseCenter("6.49 mm rechts")).toBeNull()
  })

  it("liest Trefferkreis und Streuwert", () => {
    expect(parseMm("75.59 mm")).toBe(75.59)
    expect(parseMm("75.59")).toBeNull()
    expect(parseSpread("10.88, horizontal: 11.90, vertikal: 9.77")).toEqual({
      overall: 10.88,
      horizontal: 11.9,
      vertical: 9.77,
    })
    expect(parseSpread("10.88")).toEqual({ overall: 10.88, horizontal: null, vertical: null })
  })
})

describe("readPrintoutValues", () => {
  it("liest Kopf, Zeilen und Serie im Layout mit Trefferkreis", async () => {
    const values = await readSpec(qtSpec)
    expect(values.discipline).toBe("LP 40")
    expect(values.mode).toBe("Probe")
    expect(values.shooter).toBe("Muster, Max")
    expect(values.stand).toBe("4")
    expect(values.initialized).toBe("2026-10-02T19:21")
    expect(values.result).toEqual({ rings: 97, tenths: 1013 })
    expect(values.seriesRings).toEqual([97])
    expect(values.counts).toEqual([4, 4, 1, 1, 0, 0, 0, 0, 0, 0, 0])
    expect(values.innerTens).toBe(2)
    expect(values.widestTeiler).toEqual([
      { value: 1520, shot: 9 },
      { value: 990, shot: 4 },
      { value: 610, shot: 2 },
    ])
    expect(values.bestTeiler?.[0]).toEqual({ value: 88.1, shot: 1 })
    expect(values.hitCircleMm).toBe(21.36)
    expect(values.centerMm).toEqual({ x: -1.09, y: -0.4 })
    expect(values.spread).toBeNull()
    expect(values.layout).toEqual([
      "Ergebnis:",
      "Serien:",
      "Zähler:",
      "Innenzehner:",
      "Weiteste:",
      "beste Teiler:",
      "Trefferkreis:",
      "Trefferlage:",
      "Serie 1:",
    ])
    const [series] = values.series
    expect(series.sum).toEqual({ rings: 97, tenths: 1013 })
    expect(series.hitCircleMm).toBe(21.36)
    expect(series.centerMm).toEqual({ x: -1.09, y: -0.4 })
    expect(values.shots.map((s) => s.value)).toEqual([105, 98, 101, 94, 89, 106, 102, 99, 82, 90])
    expect(values.shots.filter((s) => s.innerTen).map((s) => s.value)).toEqual([105, 106])
    expect(values.shots.every((s) => s.series === 1)).toBe(true)
  })

  it("trennt die Serien: Werte und Zeilen jeder Serie bleiben bei ihr", async () => {
    const values = await readSpec({
      ...qtSpec,
      // Serie 2 steht im Strom vor Serie 1: die Zuordnung hängt an der Lage, nicht an der Folge
      reversedStream: true,
      series: [
        ...qtSpec.series!,
        {
          sum: "93 (97.1)",
          values: ["9.9", "9.6", "8.8", "10.2", "9.5", "10.0", "9.1", "9.3", "10.7*", "10.0"],
          best: "41.0 (19.), 177.3 (14.), 201.7 (20.)",
          circle: "30.02 mm",
          center: "2.20 mm rechts, 0.15 mm hoch",
        },
      ],
    })
    expect(values.series.map((s) => s.shots.length)).toEqual([10, 10])
    const [one, two] = values.series
    expect(one.shots.at(-1)?.value).toBe(90)
    expect(one.centerMm).toEqual({ x: -1.09, y: -0.4 })
    expect(two.sum).toEqual({ rings: 93, tenths: 971 })
    expect(two.shots.map((s) => s.value)).toEqual([99, 96, 88, 102, 95, 100, 91, 93, 107, 100])
    expect(two.shots.every((s) => s.series === 2)).toBe(true)
    expect(two.bestTeiler?.[0]).toEqual({ value: 41, shot: 19 })
    expect(two.hitCircleMm).toBe(30.02)
    expect(two.centerMm).toEqual({ x: 2.2, y: 0.15 })
    expect(values.shots).toHaveLength(20)
  })

  it("liest das Layout mit Streuwert und die Summe im Kopf der Serie", async () => {
    const values = await readSpec(gsSpec)
    expect(values.mode).toBe("Wertung")
    expect(values.result).toEqual({ rings: 18, tenths: 194 })
    expect(values.hitCircleMm).toBeNull()
    expect(values.spread).toEqual({ overall: 10.88, horizontal: 11.9, vertical: 9.77 })
    expect(values.series.map((s) => s.sum)).toEqual([
      { rings: 18, tenths: 194 },
      { rings: 0, tenths: 0 },
    ])
    expect(values.series[0].centerMm).toEqual({ x: 0.98, y: -3.66 })
    expect(values.series[0].spread?.vertical).toBe(7.89)
    expect(values.series[1].shots).toEqual([])
    expect(values.shots.map((s) => s.value)).toEqual([92, 102])
  })

  it("lässt fehlende Felder null und findet ohne Zeichnung kein Trefferbild", async () => {
    const values = await readSpec({ layout: "ghostscript", shooter: null, result: "" })
    expect(values.result).toBeNull()
    expect(values.mode).toBeNull()
    expect(values.shooter).toBeNull()
    expect(values.stand).toBeNull()
    expect(values.initialized).toBeNull()
    expect(values.counts).toBeNull()
    expect(values.bestTeiler).toBeNull()
    expect(values.centerMm).toBeNull()
    expect(values.series).toEqual([])
    expect(values.shots).toEqual([])
    expect(values.pictures).toEqual([])
    expect(values.layout).toEqual(["Ergebnis:"])
  })

  it("findet Ringe, Treffer in Schussfolge und Nummern je Bild", async () => {
    const whole: [number, number][] = [
      [0, 0],
      [3, -2],
      [-10, 4],
    ]
    const values = await readSpec({
      ...qtSpec,
      pictures: [
        { center: [480, 656], scale: 1.5, frame: 114, holes: whole },
        { center: [98, 540], scale: 1.2, frame: 82, holes: whole.slice(0, 2) },
        {
          center: [98, 452],
          scale: 1.0,
          frame: 82,
          holes: whole.slice(2),
          firstShot: 3,
          twice: true,
        },
      ],
    })
    expect(values.pictures).toHaveLength(3)
    const [big, first, second] = values.pictures
    expect(big.center.x).toBeCloseTo(480, 3)
    expect(big.center.y).toBeCloseTo(656, 3)
    expect(big.ringDiametersPt).toHaveLength(11)
    expect(big.ringDiametersPt[0]).toBeCloseTo(155.5 * 1.5, 1)
    expect(big.holeDiameterPt).toBeCloseTo(4.5 * 1.5, 1)
    expect(big.frame?.left).toBeCloseTo(480 - 57, 1)
    // der erste Treffer liegt genau in der Mitte und zählt trotzdem als Treffer
    expect(big.holes.map((h) => [h.index, h.x - 480, h.y - 656])).toEqual([
      [0, 0, 0],
      [1, expect.closeTo(4.5, 3), expect.closeTo(-3, 3)],
      [2, expect.closeTo(-15, 3), expect.closeTo(6, 3)],
    ])
    expect(big.labels.map((l) => l.shot)).toEqual([1, 2, 3])
    expect(first.holes).toHaveLength(2)
    expect(first.holes[1].x - 98).toBeCloseTo(3.6, 3)
    // Füllung und Rand desselben Kreises zählen einmal
    expect(second.holes).toHaveLength(1)
    expect(second.ringDiametersPt).toHaveLength(11)
    expect(second.labels.map((l) => l.shot)).toEqual([3])
    // Nummern im Bild stören die Zeilen daneben nicht
    expect(values.result).toEqual({ rings: 97, tenths: 1013 })
  })

  it("nimmt Kreuze als Treffer, hält die Innenzehn für einen Ring und lässt ferne Kreise weg", async () => {
    const [only] = (
      await readSpec({
        layout: "ghostscript",
        pictures: [
          {
            center: [480, 656],
            scale: 1.25,
            frame: 128,
            holes: [
              [2, 1],
              [-6, 3],
              [0, 0],
            ],
            cross: true,
          },
        ],
        // gleich groß wie die Kreuze, aber weit außerhalb der Scheibe
        extra: [circle(150, 300, 5.1 * 1.25, "B")],
      })
    ).pictures
    expect(only.holeShape).toBe("cross")
    expect(only.holeDiameterPt).toBeCloseTo(5.1 * 1.25, 1)
    expect(only.ringDiametersPt).toHaveLength(11)
    expect(only.holes.map((h) => [h.x - 480, h.y - 656])).toEqual([
      [expect.closeTo(2.5, 3), expect.closeTo(1.25, 3)],
      [expect.closeTo(-7.5, 3), expect.closeTo(3.75, 3)],
      [expect.closeTo(0, 3), expect.closeTo(0, 3)],
    ])
    expect(only.labels).toEqual([])
  })

  it("liest den Teiler je Schuss, wo das Layout ihn druckt", async () => {
    const values = await readSpec({
      layout: "ghostscript",
      series: [{ sum: "18 (18.7)", values: ["10.3* 312.5T", "8.4 1650T"] }],
    })
    expect(values.shots).toEqual([
      { series: 1, value: 103, innerTen: true, teiler: 312.5 },
      { series: 1, value: 84, innerTen: false, teiler: 1650 },
    ])
  })

  it("weist Dateien ab, die keine PDFs oder zu groß sind", async () => {
    await expect(readPrintoutValues(new TextEncoder().encode("hallo"))).rejects.toMatchObject({
      code: "notPdf",
    })
    const pdf = await printoutPdf(qtSpec)
    const error = await readPrintoutValues(pdf, { limits: { maxBytes: 10 } }).catch(
      (e: unknown) => e
    )
    expect(error).toBeInstanceOf(MeytonPdfError)
    expect(error).toMatchObject({ code: "tooLarge" })
  })

  it("bricht nach der Zeitgrenze ab", async () => {
    let clock = 0
    const pdf = await printoutPdf(qtSpec)
    await expect(
      readPrintoutValues(pdf, { limits: { maxParseMs: 5 }, now: () => (clock += 10) })
    ).rejects.toMatchObject({ code: "timeout" })
  })
})
