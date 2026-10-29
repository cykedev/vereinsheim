import { describe, expect, it } from "vitest"

import { goalFromTreffsicher, routineFromTreffsicher } from "./treffsicher-goal"

const ZONE = "Europe/Berlin"
const SESSIONS: Record<string, { familyId: number | null; day: string }> = {
  a: { familyId: 1, day: "2026-09-02" },
  b: { familyId: 1, day: "2026-09-20" },
  c: { familyId: 2, day: "2026-09-21" },
  d: { familyId: null, day: "2026-09-22" },
  early: { familyId: 1, day: "2026-08-31" },
}
const context = {
  importKey: "treffsicher:g1",
  sessionOf: (id: string) => SESSIONS[id],
  timeZone: ZONE,
}

const goal = (over: Partial<Parameters<typeof goalFromTreffsicher>[0]> = {}) => ({
  title: " 380 Ringe ",
  description: "  Ruhig bleiben ",
  type: "RESULT" as const,
  // Treffsicher speichert Mitternacht in Berlin als UTC: 31. August 22:30 UTC ist in Berlin der 1. September
  dateFrom: "2026-08-31T22:30:00.000Z",
  dateTo: "2026-09-30T21:59:00.000Z",
  sessionIds: ["a", "b"],
  ...over,
})

describe("goalFromTreffsicher", () => {
  it("Satz, Notiz, Art und Zeitraum als Tage in der Anzeige-Zone, ohne Messung", () => {
    const { goal: imported } = goalFromTreffsicher(goal(), context)
    expect(imported).toEqual({
      importKey: "treffsicher:g1",
      familyId: 1,
      title: "380 Ringe",
      note: "Ruhig bleiben",
      kind: "result",
      from: "2026-09-01",
      to: "2026-09-30",
    })
  })

  it("ein Zeitraum ist ein Kalendertag, kein Abend: 1:00 in Berlin bleibt der Tag", () => {
    const { goal: imported } = goalFromTreffsicher(
      goal({ dateFrom: "2026-09-01T23:00:00.000Z" }),
      context
    )
    expect(imported.from).toBe("2026-09-02")
  })

  it("Prozessziel, leere Beschreibung", () => {
    const { goal: imported } = goalFromTreffsicher(
      goal({ type: "PROCESS", description: "  " }),
      context
    )
    expect(imported).toMatchObject({ kind: "process", note: null })
  })

  it("Familie nur, wenn alle Einheiten mit Familie dieselbe haben; ohne Familie zählen nicht", () => {
    expect(goalFromTreffsicher(goal({ sessionIds: ["a", "d"] }), context).goal.familyId).toBe(1)
    expect(goalFromTreffsicher(goal({ sessionIds: ["a", "c"] }), context).goal.familyId).toBe(null)
    expect(goalFromTreffsicher(goal({ sessionIds: ["d"] }), context).goal.familyId).toBe(null)
    expect(goalFromTreffsicher(goal({ sessionIds: [] }), context).goal.familyId).toBe(null)
  })

  it("zählt Verknüpfungen außerhalb des Zeitraums und unbekannte Einheiten", () => {
    const result = goalFromTreffsicher(goal({ sessionIds: ["a", "early", "fremd"] }), context)
    expect(result).toMatchObject({ outside: 1, unknown: 1 })
    expect(goalFromTreffsicher(goal(), context)).toMatchObject({ outside: 0, unknown: 0 })
  })
})

describe("routineFromTreffsicher", () => {
  const familyOf = (name: string) => (name === "Luftpistole" ? 1 : null)
  const ctx = { importKey: "treffsicher:r1", familyOf }

  it("Schritte in falscher Reihenfolge kommen nach `order`, leere Beschreibung fällt weg", () => {
    const { routine, flattened } = routineFromTreffsicher(
      {
        name: " Vor dem Schuss ",
        discipline: { name: "Luftpistole" },
        steps: [
          { order: 3, title: "Abziehen", description: "" },
          { order: 1, title: "Atmen", description: "tief" },
          { order: 2, title: "Zielen" },
        ],
      },
      ctx
    )
    expect(flattened).toBe(false)
    expect(routine).toEqual({
      importKey: "treffsicher:r1",
      familyId: 1,
      name: "Vor dem Schuss",
      steps: [{ title: "Atmen", description: "tief" }, { title: "Zielen" }, { title: "Abziehen" }],
    })
  })

  it("ohne Disziplin oder mit unbekannter keine Familie", () => {
    const steps = [{ order: 1, title: "Atmen" }]
    expect(
      routineFromTreffsicher({ name: "A", discipline: null, steps }, ctx).routine.familyId
    ).toBe(null)
    expect(
      routineFromTreffsicher({ name: "A", discipline: { name: "Kegeln" }, steps }, ctx).routine
        .familyId
    ).toBe(null)
  })

  it("Schritte, die nicht zu lesen sind, als ein Schritt mit allen Texten", () => {
    const { routine, flattened } = routineFromTreffsicher(
      {
        name: "Alt",
        discipline: null,
        steps: [
          { order: 1, title: 5 },
          { order: 2, title: "Zielen", description: "ruhig" },
        ],
      },
      ctx
    )
    expect(flattened).toBe(true)
    expect(routine.steps).toEqual([{ title: "Zielen\nruhig" }])
    expect(
      routineFromTreffsicher({ name: "Kein Array", discipline: null, steps: "Atmen" }, ctx)
    ).toMatchObject({
      flattened: true,
      routine: { steps: [{ title: "Atmen" }] },
    })
    expect(
      routineFromTreffsicher({ name: "Leer", discipline: null, steps: null }, ctx)
    ).toMatchObject({
      flattened: true,
      routine: { steps: [] },
    })
  })
})
