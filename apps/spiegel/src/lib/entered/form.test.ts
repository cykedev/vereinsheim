import { describe, expect, it } from "vitest"

import { checkDetails, type DetailsInput, type DetailsProblem } from "./details"
import {
  detailsToForm,
  emptyForm,
  formToDetails,
  parseValue,
  problemText,
  seriesSumText,
  seriesTotalText,
  startedAtOf,
  TEXTS,
  type EnteredFormState,
  type FormDiscipline,
  type StoredDetails,
} from "./form"

const LG40: FormDiscipline = { plannedShots: 40, seriesShots: 10, officialScoring: "decimal" }
const LP_RINGS: FormDiscipline = { plannedShots: 40, seriesShots: 10, officialScoring: "rings" }
const OPEN: FormDiscipline = { plannedShots: null, seriesShots: null, officialScoring: null }
const TODAY = "2026-10-28"
const form = (over: Partial<EnteredFormState> = {}, discipline = LG40): EnteredFormState => ({
  ...emptyForm(discipline, TODAY),
  ...over,
})
const rows = (...sums: string[]) => sums.map((sum) => ({ sum, open: false, shots: [] }))
const details = (state: EnteredFormState, discipline = LG40) => {
  const result = formToDetails(state, discipline)
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.details
}
const errorsOf = (state: EnteredFormState, discipline = LG40) => {
  const result = formToDetails(state, discipline)
  if (result.ok) throw new Error("keine Fehler")
  return result.errors
}

describe("parseValue", () => {
  it("Zehntel mit Komma oder Punkt, „97“ ist 97,0, nie gerundet", () => {
    expect(parseValue("10,4", "decimal", 1)).toEqual({
      ok: true,
      value: { rings: null, decimalTenths: 104 },
    })
    expect(parseValue(" 97.3 ", "decimal", 10)).toEqual({
      ok: true,
      value: { rings: null, decimalTenths: 973 },
    })
    expect(parseValue("97", "decimal", 10)).toEqual({
      ok: true,
      value: { rings: null, decimalTenths: 970 },
    })
    expect(parseValue("9,75", "decimal", 1)).toEqual({ ok: false, error: TEXTS.decimal })
    expect(parseValue("", "decimal", 1)).toEqual({ ok: true, value: null })
  })

  it("ganze Ringe nur ganz", () => {
    expect(parseValue("97", "rings", 10)).toEqual({
      ok: true,
      value: { rings: 97, decimalTenths: null },
    })
    expect(parseValue("9,7", "rings", 1)).toEqual({ ok: false, error: TEXTS.rings })
  })

  it("Grenzen: ein Schuss 10,9 bzw. 10, eine Summe je Schuss", () => {
    expect(parseValue("10,9", "decimal", 1).ok).toBe(true)
    expect(parseValue("11", "decimal", 1)).toEqual({ ok: false, error: TEXTS.shotMax })
    expect(parseValue("11", "rings", 1)).toEqual({ ok: false, error: TEXTS.shotMax })
    expect(parseValue("109,1", "decimal", 10)).toEqual({ ok: false, error: TEXTS.sumMax(10) })
    expect(parseValue("101", "rings", 10)).toEqual({ ok: false, error: TEXTS.sumMax(10) })
  })
})

describe("seriesTotalText", () => {
  it("Summen zählen als volle Serien, Schüsse einzeln je Schuss", () => {
    const state = form({
      series: [...rows("102,4"), { sum: "", open: true, shots: ["10,0", "9,9", "", ""] }],
    })
    expect(seriesTotalText(state, LG40)).toBe("Gesamt 122,3 · 12 Schuss")
    expect(seriesTotalText(form(), LG40)).toBeNull()
    expect(seriesTotalText(form({ series: rows("abc") }), LG40)).toBeNull()
  })
})

describe("formToDetails", () => {
  it("Serien-Summen in Zehnteln; leere am Ende zählen nicht", () => {
    expect(details(form({ series: rows("102,4", "101,9", "", "") }))).toEqual({
      series: [
        { series: 1, rings: null, decimalTenths: 1024 },
        { series: 2, rings: null, decimalTenths: 1019 },
      ],
    })
  })

  it("eine Lücke zwischen gefüllten Serien ist ein Fehler an ihr", () => {
    expect(errorsOf(form({ series: rows("98", "", "97", "") }))).toEqual({
      "series.1.sum": TEXTS.gap(2),
    })
  })

  it("keine Serie: der Fehler am Ergebnis", () => {
    expect(errorsOf(form({ series: rows("", "", "", "") }))).toEqual({ result: TEXTS.noResult })
  })

  it("Schüsse einzeln: Summe aus den Schüssen, Schusszahl die der Schüsse", () => {
    const state = form({
      values: "rings",
      series: [{ sum: "", open: true, shots: ["10", "9", "", "10"] }, ...rows("", "", "")],
    })
    expect(details(state)).toEqual({
      shots: [
        { series: 1, ring: 10, decimalTenths: null },
        { series: 1, ring: 9, decimalTenths: null },
        { series: 1, ring: 10, decimalTenths: null },
      ],
      series: [{ series: 1, shots: 3, rings: 29, decimalTenths: null }],
    })
    expect(seriesSumText(state.series[0]!, "rings")).toBe("29")
  })

  it("Schüsse nur in einigen Serien: Fehler an der Summe ohne Schüsse", () => {
    const state = form({
      series: [{ sum: "", open: true, shots: ["10,4"] }, ...rows("99,0", "", "")],
    })
    expect(errorsOf(state)).toEqual({ "series.1.sum": TEXTS.mixed })
  })

  it("ein falscher Schuss: Fehler am Schuss", () => {
    const state = form({ series: [{ sum: "", open: true, shots: ["10,4", "12"] }] })
    expect(errorsOf(state)).toEqual({ "series.0.shot.1": TEXTS.shotMax })
  })

  it("nur Gesamtergebnis: ohne Schusszahl die der Disziplin, mit eigener gespeichert", () => {
    expect(details(form({ result: "total", total: "380" }, LP_RINGS), LP_RINGS)).toEqual({
      total: { rings: 380, decimalTenths: null },
    })
    expect(details(form({ result: "total", total: "190,3", totalShots: "20" }))).toEqual({
      total: { rings: null, decimalTenths: 1903, shots: 20 },
    })
    expect(errorsOf(form({ result: "total", total: "500" }, LP_RINGS), LP_RINGS)).toEqual({
      total: TEXTS.sumMax(40),
    })
    expect(errorsOf(form({ result: "total", total: "380" }, OPEN), OPEN)).toEqual({
      totalShots: TEXTS.shotsUnknown,
    })
    expect(errorsOf(form({ result: "total", total: "" }))).toEqual({ total: TEXTS.noResult })
  })

  it("Trefferlage: links negativ, hoch positiv, eine Achse allein, höchstens 100 mm", () => {
    const center = { x: "1,2", xDir: "left" as const, y: "0,85", yDir: "up" as const }
    expect(details(form({ series: rows("98"), center })).center).toEqual({ xUm: -1200, yUm: 850 })
    expect(
      details(form({ series: rows("98"), center: { ...center, y: "", yDir: "down" } })).center
    ).toEqual({ xUm: -1200, yUm: 0 })
    expect(errorsOf(form({ series: rows("98"), center: { ...center, x: "101" } }))).toEqual({
      "center.x": TEXTS.centerMax,
    })
    expect(errorsOf(form({ series: rows("98"), center: { ...center, y: "a" } }))).toEqual({
      "center.y": TEXTS.centerFormat,
    })
  })

  it("was das Formular liefert, nimmt `checkDetails` an", () => {
    const state = form({
      series: [
        { sum: "", open: true, shots: Array.from({ length: 10 }, () => "10,1") },
        { sum: "", open: true, shots: ["9,8", "10,0"] },
      ],
      center: { x: "2", xDir: "right", y: "1", yDir: "down" },
    })
    expect(checkDetails(details(state), LG40).ok).toBe(true)
  })
})

/** gespeichert, wie `checkDetails` es schreibt, und wieder gelesen */
function stored(input: DetailsInput, discipline = LG40): StoredDetails {
  const checked = checkDetails(input, discipline)
  if (!checked.ok) throw new Error(checked.problem)
  const { shots, sums } = checked.details
  return {
    shots: shots.map((shot) => ({
      series: shot.series,
      ring: shot.ring,
      decimalTenths: shot.decimalTenths,
      probe: shot.stellung === 0,
      more: shot.xUm !== null || shot.firedAtMs !== null || shot.innerTen === true,
    })),
    series: (sums?.series ?? []).map((s) => ({
      series: s.series,
      shots: s.shots,
      rings: s.rings,
      decimalTenths: s.decimalTenths,
    })),
    total: sums?.total ?? null,
    center: sums?.center ? { xUm: sums.center.xUm, yUm: sums.center.yUm } : null,
  }
}
const when = { day: "2026-10-20", time: "19:30", place: "Schützenhaus" }

describe("detailsToForm", () => {
  const shapes: [string, DetailsInput, FormDiscipline][] = [
    ["Serien in Zehnteln", { series: [{ series: 1, decimalTenths: 1024 }] }, LG40],
    [
      "Serien in Ringen, unvollständig",
      { series: [1, 2, 3].map((series) => ({ series, rings: 95 })) },
      LP_RINGS,
    ],
    [
      "Schüsse einzeln mit Zehnteln",
      {
        shots: [
          { series: 1, ring: null, decimalTenths: 104 },
          { series: 1, ring: null, decimalTenths: 99 },
        ],
        series: [{ series: 1, shots: 2, decimalTenths: 203 }],
      },
      LG40,
    ],
    ["Gesamtergebnis", { total: { rings: 371 } }, LP_RINGS],
    ["Gesamtergebnis mit eigener Schusszahl", { total: { decimalTenths: 1903, shots: 20 } }, LG40],
    [
      "mit Trefferlage",
      { series: [{ series: 1, rings: 95 }], center: { xUm: -1200, yUm: 850 } },
      LP_RINGS,
    ],
  ]

  it.each(shapes)("%s: unverändert gespeichert dieselben Angaben", (_name, input, discipline) => {
    const before = stored(input, discipline)
    const state = detailsToForm(before, discipline, when)
    expect(state).not.toBeNull()
    expect(stored(details(state!, discipline), discipline)).toEqual(before)
    expect(state).toMatchObject(when)
  })

  it("leere Serien bis zur Zahl der Disziplin, die Werte wie gespeichert", () => {
    const state = detailsToForm(
      stored({ series: [{ series: 1, rings: 95 }] }, LP_RINGS),
      LP_RINGS,
      when
    )
    expect(state?.values).toBe("rings")
    expect(state?.series.map((row) => row.sum)).toEqual(["95", "", "", ""])
  })

  it("was das Formular nicht zeigen kann: null", () => {
    const placed = stored({
      shots: [{ series: 1, ring: 10, decimalTenths: null, xUm: 100, yUm: 100 }],
      series: [{ series: 1, shots: 1, rings: 10 }],
    })
    expect(detailsToForm(placed, LG40, when)).toBeNull()
    const probe = stored({ shots: [{ series: null, ring: 9, decimalTenths: null, probe: true }] })
    expect(detailsToForm(probe, LG40, when)).toBeNull()
  })
})

describe("startedAtOf", () => {
  it("Uhrzeit in der Zone; ohne Uhrzeit 12 Uhr und unbekannt", () => {
    expect(startedAtOf("2026-10-20", "19:30", "Europe/Berlin", TODAY)).toEqual({
      ok: true,
      startedAtMs: Date.UTC(2026, 9, 20, 17, 30),
      timeUnknown: false,
    })
    expect(startedAtOf("2026-10-20", "", "Europe/Berlin", TODAY)).toEqual({
      ok: true,
      startedAtMs: Date.UTC(2026, 9, 20, 10),
      timeUnknown: true,
    })
  })

  it("kein Tag, ein Tag in der Zukunft, eine falsche Uhrzeit", () => {
    expect(startedAtOf("", "", "Europe/Berlin", TODAY)).toEqual({
      ok: false,
      errors: { day: TEXTS.dayMissing },
    })
    expect(startedAtOf("2026-10-29", "", "Europe/Berlin", TODAY)).toEqual({
      ok: false,
      errors: { day: TEXTS.dayFuture },
    })
    expect(startedAtOf("2026-10-20", "25:00", "Europe/Berlin", TODAY)).toEqual({
      ok: false,
      errors: { time: TEXTS.time },
    })
  })
})

describe("problemText", () => {
  const problems: DetailsProblem[] = [
    "shotValue",
    "shotRingTenths",
    "shotSeries",
    "shotInnerTen",
    "shotPosition",
    "shotTime",
    "seriesNumber",
    "seriesShotsUnknown",
    "seriesValue",
    "seriesShots",
    "seriesSum",
    "totalShotsUnknown",
    "totalValue",
    "totalMismatch",
    "centerWithoutResult",
    "centerValue",
    "place",
    "importKey",
    "startedAt",
    "stand",
  ]

  it.each(problems)("%s hat einen Text ohne Semikolon", (problem) => {
    const { text } = problemText(problem)
    expect(text.length).toBeGreaterThan(10)
    expect(text).not.toContain(";")
  })

  it("Texte ohne Semikolon und ohne drei Punkte", () => {
    for (const text of Object.values(TEXTS))
      expect(typeof text === "string" ? text : text(3)).not.toMatch(/;|\.\.\./)
  })
})
