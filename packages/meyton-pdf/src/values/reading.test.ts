import { describe, expect, it } from "vitest"

import {
  printoutPdf,
  type TestPicture,
  type TestPrintout,
  type TestSeries,
} from "../__fixtures__/printoutPdf"
import { readPrintoutValues } from "./read"
import { layoutOf, printoutReading, READER_VERSION, ringOf, type ReadingResult } from "./reading"
import type { PrintoutValues } from "./types"

// Erfundene Ausdrucke aus `printoutPdf`, in sich stimmig gebaut; je Widerspruch genau eine Zahl verfälscht.

const PRODUCER = { qt: "Qt 5.12.8", ghostscript: "GPL Ghostscript 9.55.0" } as const

const SERIES_A = ["10.5*", "9.8", "10.1", "9.4", "8.9", "10.6*", "10.2", "9.9", "8.2", "9.0"]
const SERIES_B = ["9.9", "9.6", "8.8", "10.2", "9.5", "10.0", "9.1", "9.3", "10.7*", "10.0"]
/** Lagen in mm zu den Werten oben, nur für die Zahl der Marken */
const holes = (n: number, from = 0): [number, number][] =>
  Array.from({ length: n }, (_, i) => [((i + from) % 7) - 3, ((i + from) % 5) - 2])

const tenths = (value: string) => Math.round(Number(value.replace("*", "").split(" ")[0]) * 10)
const sumText = (values: readonly string[]) => {
  const v = values.map(tenths)
  const rings = v.reduce((total, x) => total + ringOf(x), 0)
  const all = v.reduce((total, x) => total + x, 0)
  return `${rings} (${(all / 10).toFixed(1)})`
}

/** ein stimmiger Ausdruck aus Werten je Serie, mit Bildern je Serie */
function valued(
  layout: TestPrintout["layout"],
  mode: string,
  series: string[][],
  options: { pictures?: "all" | "whole" | "none"; cross?: boolean } = {}
): TestPrintout {
  const all = series.flat()
  const v = all.map(tenths)
  const counts = Array.from({ length: 11 }, (_, i) => v.filter((x) => ringOf(x) === 10 - i).length)
  const shape = options.pictures ?? "all"
  let from = 0
  const perSeries: TestPicture[] = series.map((values) => {
    const picture = { holes: holes(values.length, from), firstShot: from + 1, cross: options.cross }
    from += values.length
    return picture
  })
  const whole: TestPicture = { holes: holes(all.length), cross: options.cross }
  return {
    layout,
    stand: "7",
    mode,
    result: sumText(all),
    seriesLine: series.map((values) => sumText(values).split(" ")[0]).join(" "),
    counts: counts.join(" "),
    innerTens: String(all.filter((value) => value.includes("*")).length),
    widest: `1520 (${all.length}.)`,
    best: "88.1 (1.)",
    center: "1.09 mm links, 0.40 mm tief",
    series: series.map((values): TestSeries => ({
      sum: sumText(values),
      values,
      best: "88.1 (1.)",
    })),
    pictures: shape === "none" ? [] : shape === "whole" ? [whole] : [whole, ...perSeries],
  }
}

async function reading(spec: TestPrintout): Promise<ReadingResult> {
  return printoutReading(await readPrintoutValues(await printoutPdf(spec)), {
    producer: PRODUCER[spec.layout],
  })
}

const problemOf = (result: ReadingResult) => (result.kind === "rejected" ? result.problem : "ok")

describe("layoutOf", () => {
  it("nur nach dem Erzeuger", () => {
    expect(layoutOf({ producer: "GPL Ghostscript 9.55.0" })).toBe("ghostscript")
    expect(layoutOf({ producer: "Qt 5.12.8" })).toBe("qt")
    expect(layoutOf({ producer: "Microsoft: Print To PDF" })).toBe("unknown")
    expect(layoutOf({ producer: "GPL Ghostscriptx" })).toBe("unknown")
    expect(layoutOf({ producer: null })).toBe("unknown")
    expect(READER_VERSION).toBe("meyton-values@2")
  })
})

describe("printoutReading: stimmig", () => {
  it("Wertung im Qt-Layout mit Bildern je Serie", async () => {
    const result = await reading(valued("qt", "Wertung", [SERIES_A, SERIES_B]))
    if (result.kind !== "ok") throw new Error(`abgelehnt: ${result.problem}`)
    const r = result.reading
    expect(r.layout).toBe("qt")
    expect(r.probe).toBe(false)
    expect(r.discipline).toBe("LP 40")
    expect(r.stand).toBe("7")
    expect(r.shots).toHaveLength(20)
    expect(r.shots[0]).toEqual({ series: 1, decimalTenths: 105, innerTen: true })
    expect(r.shots[10].series).toBe(2)
    expect(r.series.map((s) => [s.number, s.shots, s.rings, s.decimalTenths])).toEqual([
      [1, 10, 92, 966],
      [2, 10, 93, 971],
    ])
    expect(r.total).toEqual({ rings: 185, decimalTenths: 1937 })
    expect(r.centerMm).toEqual({ x: -1.09, y: -0.4 })
    expect(r.pictures.map((p) => p.holesPt.length)).toEqual([20, 10, 10])
    expect(r.pictures[0].ringDiametersPt).toHaveLength(11)
    expect(r.series[0].bestTeiler).toEqual([{ value: 88.1, shot: 1 }])
  })

  it("Probe im Ghostscript-Layout mit Kreuzen: Probe, ohne Ergebnis", async () => {
    const result = await reading(valued("ghostscript", "Probe", [SERIES_A], { cross: true }))
    if (result.kind !== "ok") throw new Error(`abgelehnt: ${result.problem}`)
    expect(result.reading.layout).toBe("ghostscript")
    expect(result.reading.probe).toBe(true)
    expect(result.reading.total).toBeNull()
    expect(result.reading.pictures.map((p) => p.holesPt.length)).toEqual([10, 10])
  })

  it("„Vorbereitung/Probe“ gilt als Probe", async () => {
    const result = await reading(valued("qt", "Vorbereitung/Probe", [SERIES_B]))
    expect(result.kind === "ok" && result.reading.probe).toBe(true)
  })

  it("Zwischenausdruck: die letzte Serie halb", async () => {
    const result = await reading(valued("qt", "Wertung", [SERIES_A, SERIES_B.slice(0, 5)]))
    if (result.kind !== "ok") throw new Error(`abgelehnt: ${result.problem}`)
    expect(result.reading.series.map((s) => s.shots)).toEqual([10, 5])
    expect(result.reading.pictures.map((p) => p.holesPt.length)).toEqual([15, 10, 5])
  })

  it("leere Serie nach den Schüssen: nicht in der Lesung, kein Bild", async () => {
    const spec = valued("ghostscript", "Wertung", [SERIES_A])
    spec.series = [...spec.series!, { sum: "0 (0.0)", values: [] }]
    const result = await reading(spec)
    if (result.kind !== "ok") throw new Error(`abgelehnt: ${result.problem}`)
    expect(result.reading.series).toHaveLength(1)
    expect(result.reading.pictures).toHaveLength(2)
  })

  it("nur das Bild der ganzen Scheibe, oder gar keins", async () => {
    const whole = await reading(
      valued("qt", "Wertung", [SERIES_A, SERIES_B], { pictures: "whole" })
    )
    expect(whole.kind === "ok" && whole.reading.pictures.length).toBe(1)
    const none = await reading(valued("qt", "Wertung", [SERIES_A], { pictures: "none" }))
    expect(none.kind === "ok" && none.reading.pictures).toEqual([])
  })

  it("fehlende Zeilen prüft sie nicht", async () => {
    const spec = valued("qt", "Wertung", [SERIES_A])
    delete spec.result
    delete spec.counts
    delete spec.innerTens
    delete spec.seriesLine
    spec.series = spec.series!.map((series) => ({ values: series.values }))
    expect(problemOf(await reading(spec))).toBe("ok")
  })

  it("ein unbekanntes Layout liest sie, wenn alles stimmt", async () => {
    const values = await readPrintoutValues(await printoutPdf(valued("qt", "Wertung", [SERIES_A])))
    const result = printoutReading(values, { producer: "Meyton 9" })
    expect(result.kind === "ok" && result.reading.layout).toBe("unknown")
  })

  it("ohne Name, Nummer und ID", async () => {
    const result = await reading(valued("qt", "Wertung", [SERIES_A, SERIES_B]))
    const json = JSON.stringify(result)
    expect(json).not.toContain("Muster")
    expect(json).not.toContain("12345678")
    expect(json).not.toContain("ff914420")
    expect(json).not.toContain("2026")
  })
})

describe("printoutReading: ein Widerspruch, keine Werte", () => {
  const base = () => valued("qt", "Wertung", [SERIES_A, SERIES_B])

  it("keine Schüsse: empty", async () => {
    const spec = base()
    spec.series = []
    spec.pictures = []
    expect(await reading(spec)).toEqual({
      kind: "rejected",
      layout: "qt",
      problem: "empty",
      discipline: "LP 40",
    })
  })

  it.each([["Training"], ["Zehntel"]])("Modus %s: mode", async (mode) => {
    expect(problemOf(await reading({ ...base(), mode }))).toBe("mode")
  })

  it("ohne Modus: mode", async () => {
    const spec = base()
    delete spec.mode
    expect(problemOf(await reading(spec))).toBe("mode")
  })

  it("Wert über 10,9 oder Innenzehner unter 10: shotValue", async () => {
    const high = base()
    high.series![0].values = ["11.0", ...SERIES_A.slice(1)]
    expect(problemOf(await reading(high))).toBe("shotValue")
    const star = base()
    star.series![0].values = ["9.5*", ...SERIES_A.slice(1)]
    expect(problemOf(await reading(star))).toBe("shotValue")
  })

  it("Serien mit Lücke: series", () => {
    const series = (number: number) => ({
      number,
      sum: null,
      shots: [{ series: number, value: 100, innerTen: false, teiler: null }],
      bestTeiler: null,
      hitCircleMm: null,
      centerMm: null,
      spread: null,
    })
    const values: PrintoutValues = {
      discipline: "LP 40",
      mode: "Wertung",
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
      series: [series(1), series(3)],
      shots: [series(1), series(3)].flatMap((s) => s.shots),
      pictures: [],
      layout: [],
    }
    expect(problemOf(printoutReading(values, { producer: null }))).toBe("series")
    values.series = [series(1), series(2)]
    values.shots = values.series.flatMap((s) => s.shots)
    expect(problemOf(printoutReading(values, { producer: null }))).toBe("ok")
  })

  it("Summe einer Serie, Zeile „Serien“, Ergebnis: sums", async () => {
    const one = base()
    one.series![1].sum = "94 (97.1)"
    expect(problemOf(await reading(one))).toBe("sums")
    const tenthsOnly = base()
    tenthsOnly.series![1].sum = "93 (97.2)"
    expect(problemOf(await reading(tenthsOnly))).toBe("sums")
    const line = base()
    line.seriesLine = "92 94"
    expect(problemOf(await reading(line))).toBe("sums")
    const result = base()
    result.result = "185 (193.8)"
    expect(problemOf(await reading(result))).toBe("sums")
  })

  it("Innenzehner: innerTens", async () => {
    expect(problemOf(await reading({ ...base(), innerTens: "4" }))).toBe("innerTens")
  })

  it("Zähler verschoben oder mit 12 Feldern: counts", async () => {
    const shifted = base()
    const counts = shifted.counts!.split(" ").map(Number)
    counts[0] += 1
    counts[1] -= 1
    shifted.counts = counts.join(" ")
    expect(problemOf(await reading(shifted))).toBe("counts")
    expect(problemOf(await reading({ ...base(), counts: `${base().counts} 0` }))).toBe("counts")
  })

  it("Marken fehlen im Bild der Scheibe oder einer Serie: marks", async () => {
    const whole = base()
    whole.pictures![0] = { holes: holes(19) }
    expect(problemOf(await reading(whole))).toBe("marks")
    const series = base()
    series.pictures![2] = { holes: holes(9, 10), firstShot: 11 }
    expect(problemOf(await reading(series))).toBe("marks")
  })

  it("Teiler mit Schussnummer außerhalb der Schüsse: teilerRefs", async () => {
    expect(problemOf(await reading({ ...base(), widest: "1520 (21.)" }))).toBe("teilerRefs")
    const series = base()
    series.series![0].best = "88.1 (0.)"
    expect(problemOf(await reading(series))).toBe("teilerRefs")
  })
})
