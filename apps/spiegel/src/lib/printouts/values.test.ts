import { printoutPdf } from "@vereinsheim/meyton-pdf/test-printout"
import { printoutReading, type PrintoutReading } from "@vereinsheim/meyton-pdf/reading"
import { readPrintoutValues } from "@vereinsheim/meyton-pdf/values"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { describe, expect, it } from "vitest"

import {
  shotsAround,
  valuedHits,
  valuedSpec,
  type ValuedPrintoutSpec,
} from "../../../test/printout"
import { detailsFromReading, readingOrder, ringDiametersMm, scaleFromRings } from "./values"

// Erfundene, stimmige Ausdrucke aus `valuedPrintout`, gelesen wie im Kindprozess (hier im Testprozess).

const PRODUCER = { qt: "Qt 5.12.8", ghostscript: "GPL Ghostscript 9.55.0" } as const

async function readingOf(spec: ValuedPrintoutSpec): Promise<PrintoutReading> {
  const printout = valuedSpec(spec)
  const values = await readPrintoutValues(await printoutPdf(printout))
  const result = printoutReading(values, { producer: PRODUCER[printout.layout] })
  if (result.kind !== "ok") throw new Error(`Lesung abgelehnt: ${result.problem}`)
  return result.reading
}

const problemOf = (result: ReturnType<typeof detailsFromReading>) =>
  result.ok ? "ok" : result.problem

describe("Ringe und Maßstab", () => {
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
})

describe("detailsFromReading: stimmig", () => {
  it.each([
    ["qt", "Wertung", false],
    ["ghostscript", "Wertung", false],
    ["qt", "Probe", false],
    ["ghostscript", "Wertung", true],
  ] as const)(
    "%s, %s, Kreuze %s: Lagen höchstens 10 µm neben den erzeugten",
    async (layout, mode, cross) => {
      const spec: ValuedPrintoutSpec = { layout, mode, cross }
      const result = detailsFromReading(await readingOf(spec), "lp-10m")
      if (!result.ok) throw new Error(result.problem)
      const hits = valuedHits(spec)
      const shots = result.details.shots!
      expect(shots).toHaveLength(40)
      shots.forEach((shot, i) => {
        expect(shot.xUm).not.toBeNull()
        expect(Math.abs(shot.xUm! - hits[i].xMm * 1000)).toBeLessThanOrEqual(10)
        expect(Math.abs(shot.yUm! - hits[i].yMm * 1000)).toBeLessThanOrEqual(10)
        expect(shot.decimalTenths).toBe(hits[i].decimalTenths)
        expect(shot.ring).toBe(hits[i].ring)
        expect(shot.innerTen).toBe(hits[i].innerTen)
        expect(shot.distanceTenthsUm).toBeNull()
        expect(shot.probe).toBe(mode === "Probe")
      })
      expect(result.stand).toBe("7")
    }
  )

  it("Wertung: Serien und Ergebnis wie gedruckt", async () => {
    const result = detailsFromReading(await readingOf({}), "lp-10m")
    if (!result.ok) throw new Error(result.problem)
    const hits = valuedHits()
    const rings = hits.reduce((s, h) => s + h.ring, 0)
    const tenths = hits.reduce((s, h) => s + h.decimalTenths, 0)
    expect(result.details.total).toEqual({ shots: 40, rings, decimalTenths: tenths })
    expect(result.details.series?.map((s) => [s.series, s.shots])).toEqual([
      [1, 10],
      [2, 10],
      [3, 10],
      [4, 10],
    ])
    expect(result.details.shots?.[10].series).toBe(2)
  })

  it("Probe: ohne Serien und Ergebnis", async () => {
    const result = detailsFromReading(await readingOf({ mode: "Probe" }), "lp-10m")
    if (!result.ok) throw new Error(result.problem)
    expect(result.details.series).toBeUndefined()
    expect(result.details.total).toBeUndefined()
    expect(result.details.shots?.every((s) => s.series === null && s.probe)).toBe(true)
  })

  it("Zwischenausdruck: die letzte Serie halb", async () => {
    const result = detailsFromReading(await readingOf({ shotsMm: shotsAround(35) }), "lp-10m")
    if (!result.ok) throw new Error(result.problem)
    expect(result.details.series?.map((s) => s.shots)).toEqual([10, 10, 10, 5])
    expect(result.details.total?.shots).toBe(35)
  })

  it("nur das Bild der ganzen Scheibe: Lagen aus ihm", async () => {
    const result = detailsFromReading(await readingOf({ wholeOnly: true }), "lp-10m")
    if (!result.ok) throw new Error(result.problem)
    const hits = valuedHits()
    expect(Math.abs(result.details.shots![5].xUm! - hits[5].xMm * 1000)).toBeLessThanOrEqual(10)
  })

  it("ohne Trefferbild: Werte ohne Lage, auch ohne Scheibenbild", async () => {
    const reading = await readingOf({ omit: ["pictures"] })
    for (const targetId of ["lp-10m", null] as const) {
      const result = detailsFromReading(reading, targetId)
      if (!result.ok) throw new Error(result.problem)
      expect(result.details.shots?.every((s) => s.xUm === null && s.yUm === null)).toBe(true)
    }
  })
})

describe("detailsFromReading: Widerspruch, keine Werte", () => {
  it("Luftpistole gegen das Scheibenbild des Luftgewehrs, oder ohne Scheibenbild: rings", async () => {
    const reading = await readingOf({})
    expect(problemOf(detailsFromReading(reading, "lg-10m"))).toBe("rings")
    expect(problemOf(detailsFromReading(reading, null))).toBe("rings")
  })

  it("verzerrte Ringe in einem Bild: rings", async () => {
    const reading = await readingOf({})
    const rings = reading.pictures[2].ringDiametersPt
    rings[3] *= 1.01
    expect(problemOf(detailsFromReading(reading, "lp-10m"))).toBe("rings")
  })

  it("verschobenes Bild einer Serie gegen das Bild der Scheibe: marks", async () => {
    const reading = await readingOf({
      tamper: (spec) => {
        const picture = spec.pictures![2]
        picture.holes = picture.holes.map(([x, y]) => [x + 0.1, y])
      },
    })
    expect(problemOf(detailsFromReading(reading, "lp-10m"))).toBe("marks")
  })

  it("nur das Bild der Scheibe, Marken zweier Schüsse vertauscht: marks", async () => {
    const hits = valuedHits()
    // zwei Schüsse mit verschiedenem Wert, deren Marken die Zeichnung vertauscht
    const a = hits.findIndex((h) => h.decimalTenths >= 100)
    const b = hits.findIndex((h) => h.decimalTenths < 90)
    const reading = await readingOf({
      wholeOnly: true,
      omit: ["center", "circle", "best", "widest"],
      tamper: (printout) => {
        const holes = printout.pictures![0].holes
        ;[holes[a], holes[b]] = [holes[b], holes[a]]
        for (const series of printout.series!) {
          delete series.center
          delete series.circle
          delete series.best
        }
      },
    })
    expect(problemOf(detailsFromReading(reading, "lp-10m"))).toBe("marks")
  })

  it.each([
    ["Trefferlage gesamt", "center", (s: ValuedPrintoutSpec) => tamperLine(s, "center")],
    ["Trefferlage einer Serie", "center", (s: ValuedPrintoutSpec) => tamperSeries(s, "center")],
    ["Trefferkreis", "circle", (s: ValuedPrintoutSpec) => tamperLine(s, "circle")],
    [
      "Streuwert",
      "spread",
      (s: ValuedPrintoutSpec) => tamperLine({ ...s, layout: "ghostscript" }, "spread"),
    ],
    ["bester Teiler", "teiler", (s: ValuedPrintoutSpec) => tamperLine(s, "best")],
    ["weitester Teiler", "teiler", (s: ValuedPrintoutSpec) => tamperLine(s, "widest")],
  ] as const)("%s: %s", async (_, problem, tampered) => {
    const reading = await readingOf(tampered({}))
    expect(problemOf(detailsFromReading(reading, "lp-10m"))).toBe(problem)
  })
})

/** die erste Zahl einer Zeile um 0,05 mm bzw. 3/100 mm verschoben */
function bump(line: string, by: number): string {
  return line.replace(/\d+\.\d+|\d+/, (number) => {
    const decimals = number.split(".")[1]?.length ?? 0
    return (Number(number) + by).toFixed(decimals)
  })
}

function tamperLine(
  spec: ValuedPrintoutSpec,
  key: "center" | "circle" | "spread" | "best" | "widest"
): ValuedPrintoutSpec {
  const by = key === "best" || key === "widest" ? 3 : 0.05
  return { ...spec, tamper: (printout) => (printout[key] = bump(printout[key]!, by)) }
}

function tamperSeries(spec: ValuedPrintoutSpec, key: "center"): ValuedPrintoutSpec {
  return {
    ...spec,
    tamper: (printout) => {
      const series = printout.series![1]
      series[key] = bump(series[key]!, 0.05)
    },
  }
}

describe("readingOrder", () => {
  it("nur ok, der zuletzt gedruckte zuerst, bei gleicher Zeit der zuletzt gespeicherte", () => {
    const at = (iso: string) => new Date(iso)
    const rows = [
      {
        id: "a",
        valuesStatus: "ok",
        printedAt: at("2026-10-02T17:00:00Z"),
        storedAt: at("2026-10-02T18:00:00Z"),
      },
      {
        id: "b",
        valuesStatus: "ok",
        printedAt: at("2026-10-02T17:30:00Z"),
        storedAt: at("2026-10-02T18:00:00Z"),
      },
      {
        id: "c",
        valuesStatus: "inconsistent",
        printedAt: at("2026-10-02T17:40:00Z"),
        storedAt: at("2026-10-02T18:00:00Z"),
      },
      {
        id: "d",
        valuesStatus: "ok",
        printedAt: at("2026-10-02T17:30:00Z"),
        storedAt: at("2026-10-02T19:00:00Z"),
      },
      { id: "e", valuesStatus: null, printedAt: null, storedAt: at("2026-10-02T19:00:00Z") },
      { id: "f", valuesStatus: "ok", printedAt: null, storedAt: at("2026-10-02T20:00:00Z") },
    ]
    expect(readingOrder(rows).map((r) => r.id)).toEqual(["d", "b", "a", "f"])
  })
})
