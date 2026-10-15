import { describe, expect, it } from "vitest"

import { pauseRecovery } from "@vereinsheim/shot-core/analysis"
import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import { TARGETS } from "@vereinsheim/shot-core/targets"

import { toMetricShot } from "../src/lib/db/cards"
import { ownCardSeeds } from "./own-cards"
import { OWN_CARDS, type OwnCard } from "./own-cards-data"

describe("ownCardSeeds", () => {
  const { seeds, omitted } = ownCardSeeds()
  const seedOf = (n: number) => seeds.find((s) => s.n === n)!

  it("32 Scheiben (30 Luftpistole, 2 Luftgewehr); drei weggelassen", () => {
    expect(seeds).toHaveLength(32)
    expect(seeds.filter((s) => s.discipline.family === "lp-freihand")).toHaveLength(30)
    expect(seeds.filter((s) => s.discipline.family === "lg-freihand")).toHaveLength(2)
    expect(omitted).toEqual([
      { n: 2, reason: "ohne Scheibenbild" },
      { n: 12, reason: "ohne Scheibenbild" },
      { n: 21, reason: "verdeckt" },
    ])
  })

  it("weggelassen: Zimmerstutzen und Schach ohne Scheibenbild, König verdeckt (SF-19)", () => {
    const name = (n: number) => OWN_CARDS.find((o) => o.n === n)!.discipline
    expect(omitted.map((o) => name(o.n))).toEqual(["Zimmerstutzen", "LP Schach 6x6", "König LP"])
    // verdeckt ist auch die Anzeigeart 10 (Lage sichtbar), ab dem ersten Wertungsschuss (SF-19, SF-74)
    const lp40 = OWN_CARDS.find((o) => o.n === 36)!
    const hidden = (display: number): OwnCard => ({
      ...lp40,
      shots: lp40.shots.map((s, i) => (i === 5 ? { ...s, display } : s)),
    })
    for (const display of [5, 10])
      expect(ownCardSeeds([hidden(display)]).omitted, `Anzeigeart ${display}`).toEqual([
        { n: 36, reason: "verdeckt" },
      ])
    expect(ownCardSeeds([hidden(2)]).seeds).toHaveLength(1)
  })

  it("jeder Wert gleich der Wertung aus der Lage (Meyton), auch die Probe; Abgabefolge eindeutig", () => {
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

  it("ein Ausdruck als unabhängiger Anker (vault/meyton/meyton-printout.md)", () => {
    const match = seedOf(35).shots.filter((s) => s.stellung !== 0)
    const sum = (shots: typeof match, key: "ring" | "decimalTenths") =>
      shots.reduce((total, s) => total + (s[key] ?? 0), 0)
    // 352 (371,4), Serien …, Innenzehner 2
    expect(sum(match, "ring")).toBe(352)
    expect(sum(match, "decimalTenths")).toBe(3714)
    expect(
      [1, 2, 3, 4].map((k) =>
        sum(
          match.filter((s) => s.series === k),
          "ring"
        )
      )
    ).toEqual([88, 88, 88, 88])
    expect(match.filter((s) => s.innerTen)).toHaveLength(2)
    // „Wertung …“ im Kopf ist der letzte Schuss
    expect(new Date(match.at(-1)!.firedAtMs!).toISOString().slice(0, 16)).toBe("2026-01-01T17:00")
  })

  it("Pausen relativ zum Takt an der LP 60: nach jeder Zehnerserie", () => {
    const recovery = pauseRecovery(seedOf(28).shots.map(toMetricShot), "rings")!
    // Median der 38 Abstände bis 3 Minuten (42,505 + 42,706) / 2 = 42,6055 s, doppelt 85,211 s, auf ganze Sekunden
    // 85 s; eine feste Grenze von 3 Minuten fände nur eine der drei Pausen
    expect(recovery.rule).toEqual({ thresholdMs: 85_000, typicalMs: 42_605.5, basis: "takt" })
    expect(recovery.effects.map((e) => e.afterShot)).toEqual([11, 21, 31])
  })

  it("Merkmale: Training, endgültig, unvollständig mit Merkmal; Luftpistole amtlich in Ringen", () => {
    expect(seeds.every((s) => s.card.kind === "training" && s.card.state === "final")).toBe(true)
    expect(seeds.filter((s) => !s.card.complete)).toHaveLength(10)
    expect(seeds.filter((s) => s.card.flags.includes("unvollstaendig"))).toHaveLength(10)
    // 25 von 40 und 40 von 60
    for (const n of [29, 28])
      expect(seedOf(n).card.flags, `Scheibe ${n}`).toEqual(["unvollstaendig"])
    expect(seedOf(36).card).toMatchObject({ complete: true, flags: [] })
    // ein Training nur aus Probe ist fertig
    expect(seedOf(33).card.complete).toBe(true)
    expect(
      new Set(seeds.map((s) => `${s.discipline.family}:${s.discipline.officialScoring}`))
    ).toEqual(new Set(["lp-freihand:rings", "lg-freihand:null"]))
  })

  it("keine echte ScheibenID: die laufende Nummer (2 bis 36)", () => {
    expect(seeds.every((s) => s.card.scheibenId === s.n && s.n >= 2 && s.n <= 36)).toBe(true)
  })
})
