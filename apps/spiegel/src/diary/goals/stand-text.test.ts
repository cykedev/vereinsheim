import { describe, expect, it } from "vitest"

import type { GoalRule, GoalStand } from "./measure"
import {
  basisLine,
  bigNumber,
  nothingCounted,
  previewLine,
  standLine,
  standTiles,
  startState,
  thresholdText,
} from "./stand-text"

const rule = (extra: Partial<GoalRule> = {}): GoalRule => ({
  measure: "card",
  threshold: 355,
  scoring: "rings",
  shots: 40,
  cards: "all",
  from: "2026-09-01",
  to: "2027-08-31",
  ...extra,
})

const point = (day: string, value: number, hit: boolean) => ({
  cardId: day,
  day,
  startedAtMs: 0,
  series: null,
  value,
  hit,
})

const stand = (extra: Partial<GoalStand> = {}): GoalStand => ({
  counted: 3,
  hits: 2,
  recent: { counted: 3, hits: 2 },
  best: point("2026-10-20", 362, true),
  mean: null,
  points: [
    point("2026-10-01", 350, false),
    point("2026-10-20", 362, true),
    point("2026-10-21", 356, true),
  ],
  cards: 3,
  left: { noValue: 0, otherShots: 0, noSeries: 0 },
  ...extra,
})

describe("Sätze zum Stand", () => {
  it("Schwelle in der Wertung des Ziels", () => {
    expect(thresholdText(355, "rings")).toBe("355")
    expect(thresholdText(365.5, "decimal")).toBe("365,5")
  })

  it("Zeile, große Zahl und Start bei Scheiben und Serien", () => {
    expect(standLine(rule(), stand())).toBe("2 von 3 Scheiben ab 355")
    expect(
      standLine(rule({ measure: "series", threshold: 92 }), stand({ counted: 1, hits: 1 }))
    ).toBe("1 von 1 Serie ab 92")
    expect(bigNumber(rule(), stand())).toEqual({
      value: "2",
      caption: "von 3 Scheiben ab 355 Ringen",
    })
    expect(startState(rule(), stand())).toBe("2 von 3 Scheiben")
    expect(previewLine(rule(), stand())).toBe("Bisher in diesem Zeitraum: 2 von 3 Scheiben ab 355.")
  })

  it("Schnitt mit einer Stelle", () => {
    const average = rule({ measure: "average", threshold: 350 })
    const s = stand({ mean: 352.94 })
    expect(standLine(average, s)).toBe("Schnitt 352,9 über 3 Scheiben")
    expect(bigNumber(average, s)).toEqual({
      value: "352,9",
      caption: "Schnitt über 3 Scheiben · Ziel 350",
    })
    expect(startState(average, s)).toBe("Schnitt 352,9")
  })

  it("ohne gezählte Scheibe kein Wert, ein Satz statt einer Zahl", () => {
    const none = stand({
      counted: 0,
      hits: 0,
      best: null,
      points: [],
      recent: { counted: 0, hits: 0 },
    })
    expect(bigNumber(rule(), none)).toBeNull()
    expect(standTiles(rule(), none, (d) => d)).toBeNull()
    expect(previewLine(rule(), { ...none, cards: 0 })).toBe(
      "Bisher keine Scheibe in diesem Zeitraum."
    )
    expect(
      previewLine(rule(), { ...none, cards: 6, left: { noValue: 1, otherShots: 5, noSeries: 0 } })
    ).toBe("Bisher zählt keine der 6 Scheiben: 5 mit anderer Schusszahl, 1 ohne Ergebnis.")
    expect(nothingCounted(rule(), { ...none, cards: 6 })).toBe(
      "Noch zählt keine Scheibe in diesem Zeitraum."
    )
    expect(nothingCounted(rule({ measure: "series" }), { ...none, cards: 6 })).toBe(
      "Noch zählt keine Serie in diesem Zeitraum."
    )
    expect(standLine(rule({ measure: "average" }), { ...none, cards: 0 })).toBe(
      "Noch keine Scheibe in diesem Zeitraum."
    )
  })

  it("Kacheln: zuletzt, das Beste mit Tag, der Schnitt der gezählten", () => {
    expect(standTiles(rule(), stand(), (d) => `Tag ${d}`)).toEqual({
      recent: "2 von 3",
      best: { value: "362", day: "Tag 2026-10-20" },
      mean: "356,0",
    })
  })

  it("Grundlage nur, wenn etwas nicht zählt", () => {
    expect(basisLine(stand())).toBeNull()
    expect(basisLine(stand({ cards: 14, left: { noValue: 2, otherShots: 1, noSeries: 0 } }))).toBe(
      "über 14 Scheiben · 2 ohne Ergebnis zählen nicht · 1 mit anderer Schusszahl zählt nicht"
    )
  })
})
