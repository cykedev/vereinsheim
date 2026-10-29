import { describe, expect, it } from "vitest"

import {
  entryFromSession,
  executionsOnCard,
  type TreffsicherSessionForEntry,
} from "./treffsicher-entry"

const ZONE = "Europe/Berlin"
const KEY = "treffsicher:ts1"
const SEVEN = {
  fitness: 60,
  nutrition: 50,
  technique: 70,
  tactics: 40,
  mentalStrength: 80,
  environment: 30,
  equipment: 90,
}

function session(over: Partial<TreffsicherSessionForEntry> = {}): TreffsicherSessionForEntry {
  return {
    id: "ts1",
    dateMs: Date.UTC(2026, 2, 13, 18),
    type: "TRAINING",
    trainingGoal: null,
    isFavourite: false,
    location: null,
    wellbeing: null,
    prognosis: null,
    feedback: null,
    reflection: null,
    series: [],
    ...over,
  }
}

const FEEDBACK = {
  ...SEVEN,
  explanation: null,
  goalAchieved: null,
  goalAchievedNote: null,
  progress: null,
  fiveBestShots: null,
  wentWell: null,
  insights: null,
}
const PROGNOSIS = { ...SEVEN, expectedScore: null, expectedCleanShots: null, performanceGoal: null }

describe("entryFromSession", () => {
  it("nimmt Abend, Art, Disziplin, Schlüssel und die Werte genau wie gespeichert", () => {
    const entry = entryFromSession(
      session({
        wellbeing: { sleep: 73, energy: 41, stress: 12, motivation: 100 },
        prognosis: { ...PROGNOSIS, expectedScore: 365.5 },
        feedback: FEEDBACK,
      }),
      { importKey: "treffsicher:ts1", familyId: 4, withCard: true, timeZone: ZONE }
    )
    expect(entry).toMatchObject({
      importKey: "treffsicher:ts1",
      day: "2026-03-13",
      kind: "shooting",
      familyId: 4,
      expectedScore: 365.5,
    })
    expect(entry.scales.filter((s) => s.part === "wellbeing")).toEqual([
      { part: "wellbeing", aspect: "sleep", value: 73 },
      { part: "wellbeing", aspect: "energy", value: 41 },
      { part: "wellbeing", aspect: "stress", value: 12 },
      { part: "wellbeing", aspect: "motivation", value: 100 },
    ])
    expect(entry.scales.filter((s) => s.part === "prognosis")).toHaveLength(7)
    expect(entry.scales.find((s) => s.part === "feedback" && s.aspect === "equipment")?.value).toBe(
      90
    )
  })

  it("Abend vor 4 Uhr ist der Vortag; Trocken- und Mentaltraining", () => {
    const night = entryFromSession(session({ dateMs: Date.UTC(2026, 2, 14, 1, 30) }), {
      importKey: KEY,
      familyId: null,
      withCard: false,
      timeZone: ZONE,
    })
    expect(night.day).toBe("2026-03-13")
    const ctx = { importKey: KEY, familyId: null, withCard: false, timeZone: ZONE }
    expect(entryFromSession(session({ type: "TROCKENTRAINING" }), ctx).kind).toBe("dry")
    expect(entryFromSession(session({ type: "MENTAL" }), ctx).kind).toBe("mental")
    expect(entryFromSession(session({ type: "WETTKAMPF" }), ctx).kind).toBe("shooting")
  })

  it("Vorhaben aus dem Trainingsziel, sonst dem Leistungsziel; „Hat es geklappt?“ nur mit Vorhaben", () => {
    const ctx = { importKey: KEY, familyId: 1, withCard: true, timeZone: ZONE }
    const goal = entryFromSession(
      session({
        trainingGoal: " Abzug sauber ",
        prognosis: { ...PROGNOSIS, performanceGoal: "360 Ringe" },
        feedback: { ...FEEDBACK, goalAchieved: true },
      }),
      ctx
    )
    expect(goal.intention).toBe("Abzug sauber")
    expect(goal.outcome).toBe("yes")
    const performance = entryFromSession(
      session({
        prognosis: { ...PROGNOSIS, performanceGoal: "360 Ringe" },
        feedback: { ...FEEDBACK, goalAchieved: false },
      }),
      ctx
    )
    expect(performance).toMatchObject({ intention: "360 Ringe", outcome: "no" })
    const none = entryFromSession(session({ feedback: { ...FEEDBACK, goalAchieved: true } }), ctx)
    expect(none).toMatchObject({ intention: null, outcome: null })
  })

  it("Erkenntnis und Lernfrage in ihre Felder, die übrigen Texte mit Überschrift in fester Folge in die Notiz", () => {
    const full = session({
      isFavourite: true,
      location: "Schützenhaus",
      prognosis: { ...PROGNOSIS, expectedCleanShots: 30 },
      feedback: {
        ...FEEDBACK,
        explanation: "zu müde",
        goalAchievedNote: "fast",
        progress: "besser",
        fiveBestShots: "1, 7, 12, 30, 38",
        wentWell: "Atmung",
        insights: "Pause hilft",
      },
      reflection: {
        observations: "Licht wechselte",
        insight: "Pause hilft",
        learningQuestion: "länger halten?",
        routineDeviation: "kein Trockenschuss",
      },
    })
    const withoutCard = entryFromSession(full, {
      importKey: KEY,
      familyId: 1,
      withCard: false,
      timeZone: ZONE,
    })
    expect(withoutCard.learned).toBe("Pause hilft")
    expect(withoutCard.question).toBe("länger halten?")
    expect(withoutCard.note).toBe(
      [
        "Licht wechselte",
        "Abweichung vom Ablauf:\nkein Trockenschuss",
        "Abweichung von der Prognose:\nzu müde",
        "Zum Ziel:\nfast",
        "Fortschritt:\nbesser",
        "Fünf beste Schüsse:\n1, 7, 12, 30, 38",
        "Was gut lief:\nAtmung",
        "Erkenntnisse:\nPause hilft",
        "Erwartete saubere Schüsse:\n30",
        "Ort:\nSchützenhaus",
        "Favorit",
      ].join("\n\n")
    )
    const withCard = entryFromSession(full, {
      importKey: KEY,
      familyId: 1,
      withCard: true,
      timeZone: ZONE,
    })
    expect(withCard.note).not.toContain("Ort:")
    expect(
      entryFromSession(session(), { importKey: KEY, familyId: 1, withCard: false, timeZone: ZONE })
        .note
    ).toBeNull()
  })
})

describe("executionsOnCard", () => {
  const series = (qualities: (number | null)[], practice = false) => [
    ...(practice ? [{ position: 0, isPractice: true, executionQuality: 5 }] : []),
    ...qualities.map((q, i) => ({ position: i + 1, isPractice: false, executionQuality: q })),
  ]
  const four = [1, 2, 3, 4].map((n) => ({ series: n }))

  it("legt die Wertungsserien der Reihe nach auf die Serien der Scheibe, die Mitte der Stufe", () => {
    expect(executionsOnCard({ series: series([1, 3, 5, 4], true) }, four)).toEqual([
      { series: 1, value: 10 },
      { series: 2, value: 50 },
      { series: 3, value: 90 },
      { series: 4, value: 70 },
    ])
  })

  it("lässt Serien ohne Bewertung weg, bei anderer Serienzahl nichts", () => {
    expect(executionsOnCard({ series: series([2, null, 4, 4]) }, four)).toEqual([
      { series: 1, value: 30 },
      { series: 3, value: 70 },
      { series: 4, value: 70 },
    ])
    expect(
      executionsOnCard(
        { series: series([2, 3, 4, 4]) },
        [1, 2, 3, 4, 5, 6].map((n) => ({ series: n }))
      )
    ).toBeNull()
  })
})
