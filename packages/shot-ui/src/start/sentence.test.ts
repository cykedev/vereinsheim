import { describe, expect, it } from "vitest"

import type { EveningBlock } from "./model"
import { eveningDeltaText, eveningSentence } from "./sentence"

const block = (patch: Partial<EveningBlock>): EveningBlock => ({
  family: "lp-freihand",
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

  it("Abstand unter der großen Zahl, mit dem Band, wo es eins gibt", () => {
    expect(eveningDeltaText(block({}))).toBe("+0,09 zum Schnitt der 5 Scheiben davor · im Formband")
    expect(eveningDeltaText(block({ mean: 9.31, verdict: "above" }))).toBe(
      "+0,36 zum Schnitt der 5 Scheiben davor · über dem Formband"
    )
    expect(eveningDeltaText(block({ mean: 8.6, verdict: "below" }))).toBe(
      "−0,35 zum Schnitt der 5 Scheiben davor · unter dem Formband"
    )
    expect(
      eveningDeltaText(block({ band: null, verdict: null, average: { value: 9, n: 1 } }))
    ).toBe("+0,04 zum Schnitt der Scheibe davor")
    expect(eveningDeltaText(block({ average: null }))).toBeNull()
  })
})
