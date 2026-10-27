import { describe, expect, it } from "vitest"

import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import { TARGETS } from "@vereinsheim/shot-core/targets"

import { checkDetails } from "../src/lib/entered/details"
import {
  demoCardSeeds,
  demoEnteredSeeds,
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

describe("Demo-Scheiben in jeder Detailtiefe", () => {
  const newestMs = Date.UTC(2026, 9, 20, 18, 30)
  const eveningStartMs = Date.UTC(2026, 9, 20, 16, 30)
  const seeds = demoEnteredSeeds({ newestMs, eveningStartMs })

  it("jede besteht die Prüfung der Angaben für LP 40", () => {
    for (const seed of seeds) {
      const checked = checkDetails(seed.details, { plannedShots: 40, seriesShots: 10 })
      expect(checked.ok, `${seed.origin} ${seed.level}`).toBe(true)
    }
  })

  it("alle Stufen: zweimal Serien, zweimal Gesamtergebnis (eins mit Trefferlage), Schüsse, ohne Werte", () => {
    const levels = seeds.map((seed) => seed.level).sort()
    expect(levels).toEqual(["none", "series", "series", "shots", "shots", "total", "total"])
    expect(seeds.filter((seed) => seed.level === "total" && seed.details.center)).toHaveLength(1)
    const tenthless = seeds.find((seed) => seed.origin === "manual" && seed.level === "shots")
    expect(tenthless?.details.shots).toHaveLength(40)
    expect(tenthless?.details.shots?.every((shot) => shot.decimalTenths === null)).toBe(true)
  })

  it("die wartende kurz vor dem letzten Abend, die übrigen auf einem Abend 13 Tage vor der neuesten", () => {
    const lastEvening = seeds.filter(
      (seed) => seed.startedAtMs < eveningStartMs && seed.startedAtMs > eveningStartMs - 3_600_000
    )
    expect(lastEvening.map((seed) => [seed.origin, seed.level])).toEqual([["pdf", "none"]])
    const rest = seeds.filter((seed) => !lastEvening.includes(seed))
    expect(rest).toHaveLength(6)
    for (const seed of rest) {
      expect(seed.startedAtMs - (newestMs - 13 * 86_400_000)).toBeGreaterThanOrEqual(0)
      expect(seed.startedAtMs - (newestMs - 13 * 86_400_000)).toBeLessThan(3_600_000)
    }
  })
})
