import { describe, expect, it } from "vitest"

import { influenceRows, type InfluenceInput, type WellbeingAspect } from "./influences"

const DAY = 86_400_000

/** ein Eintrag am Abend i mit Abstand zur Form und Befinden */
function input(
  i: number,
  distance: number,
  wellbeing: Partial<Record<WellbeingAspect, number>>
): InfluenceInput {
  return {
    entryId: `e${i}`,
    day: new Date(Date.UTC(2026, 0, 5) + i * DAY).toISOString().slice(0, 10),
    competition: false,
    distance: { id: `e${i}`, atMs: i * DAY, value: distance, n: 40, sd: 0.8 },
    wellbeing,
  }
}

const row = (inputs: InfluenceInput[], aspect: WellbeingAspect) =>
  influenceRows(inputs).find((r) => r.aspect === aspect)!

describe("influenceRows", () => {
  // die ersten sechs Abende nach gutem Schlaf, die sechs späteren nach schlechtem; der Ø je Schuss steigt über die Zeit
  // um 0,2 je Abend, der Abstand zur Form nicht
  const distances = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, -0.3, -0.3, -0.3, -0.3, -0.3, -0.3]
  const sleep = (i: number) => (i < 6 ? 80 + i : 20 + i)
  const inputs = distances.map((d, i) => input(i, d, { sleep: sleep(i) }))

  it("nach gutem Schlaf über der Form: sechs gegen sechs mit klarem Abstand", () => {
    const sleepRow = row(inputs, "sleep")
    expect(sleepRow.entered).toBe(12)
    expect(sleepRow.high.n).toBe(6)
    expect(sleepRow.low.n).toBe(6)
    expect(sleepRow.high.mean).toBeCloseTo(0.3, 9)
    expect(sleepRow.low.mean).toBeCloseTo(-0.3, 9)
    expect(sleepRow.comparison?.test).not.toBeNull()
    expect(sleepRow.comparison?.verdict).toBe("higher")
    expect(sleepRow.points.filter((p) => p.side === "high").map((p) => p.entryId)).toEqual([
      "e0",
      "e1",
      "e2",
      "e3",
      "e4",
      "e5",
    ])
  })

  it("ohne Form urteilte der Ø je Schuss umgekehrt: der Fortschritt machte das Urteil", () => {
    const raw = inputs.map((x, i) => ({
      ...x,
      distance: { ...x.distance, value: 8.5 + 0.2 * i + distances[i] },
    }))
    expect(row(raw, "sleep").comparison?.verdict).toBe("lower")
  })

  it("viel Stress unter der Form: schwächer", () => {
    // viel Stress an den Abenden unter der Form
    const stress = distances.map((d, i) => input(i, d, { stress: i < 6 ? 20 + i : 80 + i }))
    expect(row(stress, "stress").comparison?.verdict).toBe("lower")
    expect(
      row(
        stress.map((x, i) => ({ ...x, distance: { ...x.distance, value: -distances[i] } })),
        "stress"
      ).comparison?.verdict
    ).toBe("higher")
  })

  it("vier auf einer Seite: kein Test", () => {
    const few = [0.3, 0.3, 0.3, 0.3, -0.3, -0.3, -0.3, -0.3].map((d, i) =>
      input(i, d, { energy: d > 0 ? 80 + i : 20 + i })
    )
    const energy = row(few, "energy")
    expect(energy.high.n).toBe(4)
    expect(energy.comparison).not.toBeNull()
    expect(energy.comparison?.test).toBeNull()
  })

  it("alle gleich: beide Gruppen leer, kein Vergleich, die Punkte ohne Seite", () => {
    const same = distances.map((d, i) => input(i, d, { motivation: 50 }))
    const motivation = row(same, "motivation")
    expect(motivation.entered).toBe(12)
    expect(motivation.high).toEqual({ n: 0, mean: null })
    expect(motivation.low).toEqual({ n: 0, mean: null })
    expect(motivation.comparison).toBeNull()
    expect(motivation.points.every((p) => p.side === "none")).toBe(true)
  })

  it("ohne Wert im Merkmal zählt ein Eintrag dort nicht", () => {
    const energy = row(inputs, "energy")
    expect(energy).toMatchObject({ entered: 0, comparison: null, points: [] })
  })
})
