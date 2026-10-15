import { describe, expect, it } from "vitest"

import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import { TARGETS } from "@vereinsheim/shot-core/targets"

import {
  demoCardSeeds,
  loadOwnCards,
  ownCardSeeds,
  type OwnCard,
  type OwnSeedShot,
} from "./own-cards"

/** jeder Wert gleich der Wertung aus der Lage (Meyton), auch die Probe; Abgabefolge eindeutig */
function expectConsistent(seeds: ReturnType<typeof demoCardSeeds>) {
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
    expect(seed.card.scheibenId).toBe(seed.n)
  }
}

/** eine erfundene LP 40 mit fünf Probe- und 40 Wertungsschüssen in Zehnteln */
function lp40(display = 1): OwnCard {
  const shots: OwnSeedShot[] = Array.from({ length: 45 }, (_, i) => {
    const probe = i < 5
    const xUm = ((i * 37) % 11) * 900 - 4_500
    const yUm = ((i * 53) % 13) * 800 - 4_800
    const score = scoreFromCoordinates(TARGETS["lp-10m"], xUm, yUm)
    return {
      stellung: probe ? 0 : 1,
      nr: probe ? i + 1 : i - 4,
      serie: probe ? 0 : Math.ceil((i - 4) / 10),
      xUm,
      yUm,
      offsetMs: i * 40_000,
      decimalTenths: score.decimalTenths,
      innerTen: score.innerTen,
      display: i === 10 ? display : 1,
    }
  })
  return {
    n: 7,
    disciplineId: 19210040,
    discipline: "LP 40",
    startedAt: "2026-01-09T17:30:00.000Z",
    shots,
  }
}

describe("ownCardSeeds", () => {
  it("weggelassen: ohne Scheibenbild und verdeckt ab dem ersten Wertungsschuss (SF-19, SF-74)", () => {
    const zimmerstutzen = { ...lp40(), n: 8, disciplineId: 18151010, discipline: "Zimmerstutzen" }
    expect(ownCardSeeds([zimmerstutzen]).omitted).toEqual([{ n: 8, reason: "ohne Scheibenbild" }])
    for (const display of [5, 10])
      expect(ownCardSeeds([lp40(display)]).omitted, `Anzeigeart ${display}`).toEqual([
        { n: 7, reason: "verdeckt" },
      ])
    expect(ownCardSeeds([lp40(2)]).seeds).toHaveLength(1)
  })

  it("eine Scheibe: Werte wie aus der Lage, Wertung in Serien, Luftpistole amtlich in Ringen", () => {
    const { seeds } = ownCardSeeds([lp40()])
    expectConsistent(seeds)
    expect(seeds[0].shots.filter((s) => s.stellung === 1).map((s) => s.series)).toContain(4)
    expect(seeds[0].discipline).toMatchObject({ family: "lp-freihand", officialScoring: "rings" })
    expect(seeds[0].card).toMatchObject({ kind: "training", state: "final", complete: true })
  })
})

describe("demoCardSeeds", () => {
  const seeds = demoCardSeeds()

  it("erfundene Scheiben, wenn keine eigenen da sind: Luftpistole, Werte aus der Lage", () => {
    expect(seeds).toHaveLength(72)
    expect(new Set(seeds.map((s) => s.discipline.family))).toEqual(new Set(["lp-freihand"]))
    expectConsistent(seeds)
  })

  it("Training, nur Probe und Wettkampf kommen vor", () => {
    expect(new Set(seeds.map((s) => s.card.kind))).toEqual(new Set(["training", "competition"]))
    expect(seeds.some((s) => s.shots.every((shot) => shot.stellung === 0))).toBe(true)
  })
})

describe.skipIf(!loadOwnCards())("eigene Scheiben aus tools/private/own-cards.json", () => {
  it("jeder Wert gleich der Wertung aus der Lage, keine echte ScheibenID", () => {
    expectConsistent(ownCardSeeds(loadOwnCards() ?? []).seeds)
  })
})
