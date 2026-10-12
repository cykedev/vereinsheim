import { describe, expect, it } from "vitest"

import type { EveningBlock } from "./model"
import { eveningReferenceText, eveningSentence, formLegend } from "./sentence"

const block = (patch: Partial<EveningBlock>): EveningBlock => ({
  family: "lp-freihand",
  scoring: "decimal",
  day: "2026-09-25",
  rows: [],
  shots: 60,
  mean: 9.04,
  cardsBefore: 12,
  average: { value: 8.95, n: 5 },
  band: { low: 8.7, high: 9.2 },
  verdict: "within",
  strip: [],
  records: [],
  ...patch,
})

describe("Satz über dem Abend (Plan N5, D4)", () => {
  it("im Band, darüber, darunter: ordnet ein wie der Fortschritt, ohne Wertung; die Zahl folgt dem Schnitt", () => {
    expect(eveningSentence(block({}), "Luftpistole")).toBe("Im Formband: 0,09 über deinem Schnitt.")
    expect(eveningSentence(block({ mean: 9.31, verdict: "above" }), "Luftpistole")).toBe(
      "Über dem Formband: 0,36 über deinem Schnitt."
    )
    expect(eveningSentence(block({ mean: 8.6, verdict: "below" }), "Luftpistole")).toBe(
      "Unter dem Formband: 0,35 unter deinem Schnitt."
    )
    expect(eveningSentence(block({ mean: 8.951 }), "Luftpistole")).toBe(
      "Im Formband: genau dein Schnitt."
    )
  })

  it("ohne Band nur der Abstand zum Schnitt davor, ohne Scheiben davor der erste Abend", () => {
    expect(eveningSentence(block({ band: null, verdict: null }), "Luftpistole")).toBe(
      "0,09 über dem Schnitt der 5 Scheiben davor."
    )
    expect(
      eveningSentence(
        block({ band: null, verdict: null, average: { value: 9.1, n: 1 } }),
        "Luftpistole"
      )
    ).toBe("0,06 unter dem Schnitt der Scheibe davor.")
    expect(
      eveningSentence(
        block({ average: null, band: null, verdict: null, cardsBefore: 0 }),
        "Luftpistole"
      )
    ).toBe("Dein erster Abend mit Luftpistole.")
    expect(eveningSentence(block({ band: null, verdict: null, mean: 8.951 }), "Luftpistole")).toBe(
      "Genau auf dem Schnitt der 5 Scheiben davor."
    )
    expect(eveningSentence(block({ mean: null }), "Luftpistole")).toBeNull()
    // Scheiben davor, aber keine mit Wert: kein Satz statt „erster Abend“
    expect(
      eveningSentence(
        block({ average: null, band: null, verdict: null, cardsBefore: 2 }),
        "Luftpistole"
      )
    ).toBeNull()
  })

  it("unter der großen Zahl der Bezug, nicht noch einmal der Abstand aus dem Satz (U5, D2)", () => {
    expect(eveningReferenceText(block({}))).toBe("Schnitt der 5 Scheiben davor: 8,95")
    expect(
      eveningReferenceText(block({ band: null, verdict: null, average: { value: 9, n: 1 } }))
    ).toBe("Schnitt der Scheibe davor: 9,00")
    expect(eveningReferenceText(block({ average: null }))).toBeNull()
    expect(eveningReferenceText(block({ mean: null }))).toBeNull()
  })

  it("Legende: nur was der Verlauf zeigt (Review U5)", () => {
    const point = (id: string, tonight: boolean, partial: boolean) => ({
      id,
      value: 9,
      tonight,
      mean: 9,
      partial,
      band: null,
    })
    const LINE = "Grau: deine letzten Scheiben. Die Linie ist der Schnitt der jeweils letzten fünf"
    expect(formLegend(block({ strip: [point("a", true, true)], band: null }))).toBeNull()
    // nur der Abend, aber schon mit Band: nur der Satz zum Band
    expect(formLegend(block({ strip: [point("a", true, false), point("b", true, false)] }))).toBe(
      "Das Band zeigt deine übliche Schwankung."
    )
    expect(
      formLegend(block({ strip: [point("a", false, false), point("b", true, false)], band: null }))
    ).toBe(`${LINE}.`)
    expect(
      formLegend(block({ strip: [point("a", false, true), point("b", true, false)], band: null }))
    ).toBe(`${LINE} (gestrichelt, solange es weniger sind).`)
  })
})
