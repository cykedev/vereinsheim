import { describe, expect, it } from "vitest"

import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import { TARGETS } from "@vereinsheim/shot-core/targets"

import { ownCardSeeds } from "./own-cards"

describe("ownCardSeeds", () => {
  const { seeds, omitted } = ownCardSeeds()

  it("32 Scheiben (30 Luftpistole, 2 Luftgewehr); drei weggelassen wie im Labor", () => {
    expect(seeds).toHaveLength(32)
    expect(seeds.filter((s) => s.discipline.family === "lp-freihand")).toHaveLength(30)
    expect(seeds.filter((s) => s.discipline.family === "lg-freihand")).toHaveLength(2)
    expect(omitted).toEqual([
      { n: 2, reason: "ohne Scheibenbild" },
      { n: 12, reason: "ohne Scheibenbild" },
      { n: 21, reason: "verdeckt" },
    ])
  })

  it("jeder Wert gleich der Wertung aus der Lage (Meyton), Abgabefolge eindeutig", () => {
    for (const seed of seeds) {
      const target = TARGETS[seed.discipline.targetId]
      for (const shot of seed.shots) {
        const score = scoreFromCoordinates(target, shot.xUm!, shot.yUm!)
        expect(shot.decimalTenths, `Scheibe ${seed.n}`).toBe(score.decimalTenths)
        expect(shot.innerTen, `Scheibe ${seed.n}`).toBe(score.innerTen)
      }
      expect(new Set(seed.shots.map((s) => s.seq)).size).toBe(seed.shots.length)
      expect(new Set(seed.shots.map((s) => `${s.stellung}:${s.treffer}`)).size).toBe(
        seed.shots.length
      )
    }
  })

  // 10 unvollständige zählt auch das Labor (`season()`, Scheiben mit `own`)
  it("Merkmale wie im Labor: Training, endgültig, unvollständig mit Merkmal; Luftpistole amtlich in Ringen", () => {
    expect(seeds.every((s) => s.card.kind === "training" && s.card.state === "final")).toBe(true)
    expect(seeds.filter((s) => !s.card.complete)).toHaveLength(10)
    expect(seeds.filter((s) => s.card.flags.includes("unvollstaendig"))).toHaveLength(10)
    expect(
      new Set(seeds.map((s) => `${s.discipline.family}:${s.discipline.officialScoring}`))
    ).toEqual(new Set(["lp-freihand:rings", "lg-freihand:null"]))
  })

  it("keine echte ScheibenID: die Nummer des Labors (2 bis 36)", () => {
    expect(seeds.every((s) => s.card.scheibenId === s.n && s.n >= 2 && s.n <= 36)).toBe(true)
  })
})
