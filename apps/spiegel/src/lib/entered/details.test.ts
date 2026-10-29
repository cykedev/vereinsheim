import { describe, expect, it } from "vitest"

import type { CardOrigin } from "@/generated/prisma/client"

import {
  checkDetails,
  checkImportKey,
  checkStand,
  detailsWriter,
  enteredScoring,
  normalizePlace,
  type DetailsInput,
  type DetailsProblem,
  type EnteredOrigin,
  type EnteredShot,
} from "./details"

const LG40 = { plannedShots: 40, seriesShots: 10 }

/** zehn Wertungsschüsse in Serie 1, Ringe 10, 9, 10, 8, 9, 10, 10, 9, 9, 10 (94) */
const tenShots = (extra: Partial<EnteredShot> = {}): EnteredShot[] =>
  [10, 9, 10, 8, 9, 10, 10, 9, 9, 10].map((ring) => ({
    series: 1,
    ring,
    decimalTenths: null,
    ...extra,
  }))

const details = (input: DetailsInput, discipline = LG40) => {
  const result = checkDetails(input, discipline)
  if (!result.ok) throw new Error(`Problem ${result.problem}`)
  return result.details
}

describe("checkDetails: je Problem ein Fall", () => {
  const cases: [
    DetailsProblem,
    DetailsInput,
    { plannedShots: number | null; seriesShots: number | null }?,
  ][] = [
    ["shotValue", { shots: [{ series: 1, ring: null, decimalTenths: null }] }],
    ["shotValue", { shots: [{ series: 1, ring: 11, decimalTenths: null }] }],
    ["shotValue", { shots: [{ series: 1, ring: null, decimalTenths: 110 }] }],
    ["shotRingTenths", { shots: [{ series: 1, ring: 9, decimalTenths: 101 }] }],
    ["shotSeries", { shots: [{ series: 0, ring: 9, decimalTenths: null }] }],
    ["shotSeries", { shots: tenShots({ series: 2 }), series: [{ series: 1, rings: 94 }] }],
    [
      "seriesNumber",
      {
        series: [
          { series: 1, rings: 90 },
          { series: 1, rings: 91 },
        ],
      },
    ],
    ["seriesNumber", { series: [{ series: 0, rings: 90 }] }],
    ["seriesNumber", { series: [{ series: 3_000_000_000, rings: 90 }] }],
    ["seriesValue", { series: [{ series: 1, shots: 1001, rings: 9000 }] }],
    ["shotInnerTen", { shots: [{ series: 1, ring: 9, decimalTenths: null, innerTen: true }] }],
    ["shotPosition", { shots: [{ series: 1, ring: 9, decimalTenths: null, xUm: 1.5, yUm: 0 }] }],
    ["shotPosition", { shots: [{ series: 1, ring: 9, decimalTenths: null, xUm: 100 }] }],
    [
      "shotPosition",
      { shots: [{ series: 1, ring: 9, decimalTenths: null, distanceTenthsUm: -1 }] },
    ],
    ["shotTime", { shots: [{ series: 1, ring: 9, decimalTenths: null, firedAtMs: Number.NaN }] }],
    ["shotTime", { shots: [{ series: 1, ring: 9, decimalTenths: null, firedAtMs: 1.5 }] }],
    [
      "seriesShotsUnknown",
      { series: [{ series: 1, rings: 90 }] },
      { plannedShots: 15, seriesShots: null },
    ],
    ["seriesValue", { series: [{ series: 1, rings: 101 }] }],
    ["seriesValue", { series: [{ series: 1 }] }],
    // 98,4 heißt mindestens 90 Ringe in ganzen Ringen, nie 99
    ["seriesValue", { series: [{ series: 1, rings: 99, decimalTenths: 984 }] }],
    ["seriesShots", { shots: tenShots(), series: [{ series: 1, shots: 11, rings: 94 }] }],
    ["seriesSum", { shots: tenShots(), series: [{ series: 1, rings: 93 }] }],
    ["totalShotsUnknown", { total: { rings: 371 } }, { plannedShots: null, seriesShots: null }],
    ["totalValue", { total: { rings: 401 } }],
    ["totalValue", { total: { shots: 0, rings: 0 } }],
    [
      "totalMismatch",
      {
        total: { rings: 371 },
        series: [90, 92, 94, 94].map((rings, i) => ({ series: i + 1, rings })),
      },
    ],
    ["totalMismatch", { shots: tenShots(), total: { rings: 95 } }],
    ["centerWithoutResult", { center: { xUm: 100, yUm: 200 } }],
    ["centerValue", { total: { rings: 371 }, center: { xUm: 100_001, yUm: 0 } }],
    ["centerValue", { total: { rings: 371 }, center: { xUm: 1.5, yUm: 0 } }],
  ]
  it.each(cases)("%s", (problem, input, discipline = LG40) => {
    expect(checkDetails(input, discipline)).toEqual({ ok: false, problem })
  })

  it("Ort und Schlüssel der Übernahme", () => {
    expect(normalizePlace("x".repeat(81))).toEqual({ ok: false, problem: "place" })
    expect(checkImportKey("manual", "treffsicher:abc")).toBe("importKey")
    expect(checkImportKey("treffsicher", "treffsicher:a/b")).toBe("importKey")
    expect(checkImportKey("treffsicher", "treffsicher:abc_1-2")).toBeNull()
    expect(checkImportKey("manual", undefined)).toBeNull()
  })

  it("Standnummer nur vom Ausdruck, höchstens acht Ziffern und Buchstaben", () => {
    expect(checkStand("pdf", "12")).toBeNull()
    expect(checkStand("pdf", "A7")).toBeNull()
    expect(checkStand("pdf", undefined)).toBeNull()
    expect(checkStand("pdf", null)).toBeNull()
    expect(checkStand("pdf", "123456789")).toBe("stand")
    expect(checkStand("pdf", "1 2")).toBe("stand")
    expect(checkStand("manual", "12")).toBe("stand")
  })
})

describe("checkDetails: Vorgaben und Normalform", () => {
  it("vier Serien ohne Schusszahl: je eine volle Serie der Disziplin", () => {
    const { sums, shots } = details({
      series: [93, 95, 94, 96].map((rings, i) => ({ series: i + 1, rings })),
    })
    expect(shots).toEqual([])
    expect(sums?.series.map((s) => s.shots)).toEqual([10, 10, 10, 10])
    expect(sums?.total).toBeNull()
  })

  it("ein Gesamtergebnis ohne Serien hat die Schusszahl der Disziplin, ohne sie ist sie unbekannt", () => {
    expect(details({ total: { rings: 371 } }).sums?.total).toEqual({
      shots: 40,
      rings: 371,
      decimalTenths: null,
    })
    expect(
      checkDetails({ total: { rings: 371 } }, { plannedShots: null, seriesShots: null })
    ).toEqual({ ok: false, problem: "totalShotsUnknown" })
  })

  it("eine Trefferlage ohne Schusszahl hat die der Scheibe", () => {
    expect(
      details({ total: { rings: 371 }, center: { xUm: 1200, yUm: -500 } }).sums?.center
    ).toEqual({
      xUm: 1200,
      yUm: -500,
      shots: 40,
    })
    expect(details({ shots: tenShots(), center: { xUm: 0, yUm: 0 } }).sums?.center?.shots).toBe(10)
  })

  it("Schüsse: Folge, Stellung und Treffer je Stellung, Ring aus den Zehnteln, Innenzehner unbekannt", () => {
    const { shots, sums } = details({
      shots: [
        { series: null, ring: null, decimalTenths: 95, probe: true },
        { series: 1, ring: null, decimalTenths: 104 },
        { series: 1, ring: 9, decimalTenths: null, innerTen: false },
      ],
    })
    expect(sums).toBeUndefined()
    expect(shots.map((s) => [s.seq, s.stellung, s.treffer, s.ring, s.innerTen])).toEqual([
      [1, 0, 1, 9, null],
      [2, 1, 1, 10, null],
      [3, 1, 2, 9, false],
    ])
    expect(shots[0]).toMatchObject({ xUm: null, displayMode: null, firedAtMs: null, flags: [] })
  })

  it("Schüsse, Serien und Gesamtergebnis, die zusammenpassen; Zehntel neben ganzen Ringen", () => {
    const { sums } = details({
      shots: tenShots(),
      series: [{ series: 1, rings: 94, decimalTenths: 978 }],
      total: { decimalTenths: 978 },
    })
    expect(sums?.total).toEqual({ shots: 10, rings: null, decimalTenths: 978 })
  })
})

describe("enteredScoring: die Wertung wie eingetragen", () => {
  const scoring = (input: DetailsInput) => enteredScoring(details(input))
  it("Schüsse mit, ohne und mit gemischten Zehnteln", () => {
    expect(scoring({ shots: tenShots({ decimalTenths: null }) })).toBe("rings")
    expect(scoring({ shots: [{ series: 1, ring: null, decimalTenths: 95 }] })).toBe("decimal")
    // gemischt: der Ring folgt aus den Zehnteln, also tragen alle ganze Ringe
    expect(
      scoring({
        shots: [
          { series: 1, ring: null, decimalTenths: 95 },
          { series: 1, ring: 9, decimalTenths: null },
        ],
      })
    ).toBe("rings")
  })
  it("Serien und Gesamtergebnis; ohne Werte keine", () => {
    expect(scoring({ series: [{ series: 1, decimalTenths: 984 }] })).toBe("decimal")
    expect(
      scoring({
        series: [
          { series: 1, rings: 94 },
          { series: 2, decimalTenths: 984 },
        ],
      })
    ).toBeNull()
    expect(scoring({ total: { rings: 371 } })).toBe("rings")
    expect(scoring({})).toBeNull()
  })
})

describe("detailsWriter: wer was ändern darf", () => {
  const table: [CardOrigin, EnteredOrigin, CardOrigin | null][] = [
    ["raw", "pdf", null],
    ["raw", "manual", null],
    ["raw", "treffsicher", null],
    ["pdf", "pdf", "pdf"],
    ["pdf", "manual", null],
    ["pdf", "treffsicher", null],
    ["manual", "pdf", null],
    ["manual", "manual", "manual"],
    ["manual", "treffsicher", null],
    ["treffsicher", "pdf", "pdf"],
    ["treffsicher", "manual", "manual"],
    ["treffsicher", "treffsicher", "treffsicher"],
  ]
  it.each(table)("%s von %s: %s", (existing, writer, expected) => {
    expect(detailsWriter(existing, writer)).toBe(expected)
  })
})

describe("normalizePlace", () => {
  it("trimmt, fasst Leerraum zusammen, leer heißt keiner, fehlt heißt nicht anfassen", () => {
    expect(normalizePlace("  Schützenhaus   Nord ")).toEqual({
      ok: true,
      place: "Schützenhaus Nord",
    })
    expect(normalizePlace("")).toEqual({ ok: true, place: null })
    expect(normalizePlace(null)).toEqual({ ok: true, place: null })
    expect(normalizePlace(undefined)).toEqual({ ok: true, place: undefined })
    expect(normalizePlace("x".repeat(80))).toMatchObject({ ok: true })
  })
})
