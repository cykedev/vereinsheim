import { afterEach, describe, expect, it } from "vitest"

import { SLUG_REGEX } from "@/lib/competitions/publicSlug"
import { calculateRingteiler, determineOutcome, MAX_RINGS } from "@/lib/results/calculateResult"
import { duelOutcome } from "@/lib/scoring/bestOf"
import { calculateStandings, type StandingsMatchup } from "@/lib/standings/calculateStandings"

import { advance, installClock, setClock, uninstallClock } from "./clock"
import { inventNames, LONG_NAMES } from "./names"
import { createRandom } from "./random"
import { fixedSeries, forcedPair, seriesValue, type FixedCase } from "./results"
import { SCENARIOS } from "./scenarios"

describe("Zufall mit festem Startwert", () => {
  it("ergibt mit demselben Startwert dieselbe Folge", () => {
    const a = createRandom("L-DRR-L2")
    const b = createRandom("L-DRR-L2")
    expect(Array.from({ length: 20 }, () => a.next())).toEqual(
      Array.from({ length: 20 }, () => b.next())
    )
  })

  it("ergibt mit anderem Startwert eine andere Folge", () => {
    expect(createRandom("a").next()).not.toBe(createRandom("b").next())
  })
})

describe("erfundene Namen", () => {
  it("wiederholt kein Paar und nimmt keinen der langen Namen", () => {
    const names = inventNames(createRandom("pool"), 43)
    const keys = names.map((n) => `${n.firstName} ${n.lastName}`)
    expect(new Set(keys).size).toBe(43)
    const long = new Set(LONG_NAMES.map((n) => `${n.firstName} ${n.lastName}`))
    expect(keys.some((k) => long.has(k))).toBe(false)
  })

  it("hat sechzehn lange Namen mit Umlauten", () => {
    expect(LONG_NAMES).toHaveLength(16)
    expect(LONG_NAMES.some((n) => /[äöüÄÖÜß]/.test(n.firstName + n.lastName))).toBe(true)
  })
})

describe("Serienwerte", () => {
  it("bleiben im Rahmen der Wertungsart", () => {
    const random = createRandom("werte")
    for (let i = 0; i < 200; i++) {
      const whole = seriesValue(random, "WHOLE", random.next())
      expect(Number.isInteger(whole.rings)).toBe(true)
      expect(whole.rings).toBeLessThanOrEqual(100)
      const decimal = seriesValue(random, "DECIMAL", random.next())
      expect(decimal.rings).toBeLessThanOrEqual(109)
      expect(Math.round(decimal.rings * 10) / 10).toBe(decimal.rings)
      expect(whole.teiler).toBeGreaterThan(0)
    }
  })

  it("gehen bei einem erzwungenen Paar nach Ringwerks Vergleich so aus wie verlangt", () => {
    const random = createRandom("paare")
    for (const mode of ["RINGTEILER", "RINGS", "TEILER"] as const) {
      for (const winner of ["A", "B", "TIE"] as const) {
        for (let i = 0; i < 30; i++) {
          const [a, b] = forcedPair(random, "WHOLE", mode, winner)
          const side = (x: typeof a) => ({
            rings: x.rings,
            correctedTeiler: x.teiler,
            ringteiler: calculateRingteiler(x.rings, x.teiler, 1, MAX_RINGS.WHOLE),
          })
          expect(duelOutcome(side(a), side(b), mode, null, null)).toBe(winner)
        }
      }
    }
  })
})

describe("Uhr", () => {
  afterEach(() => uninstallClock())

  it("liefert feste Zeit, bis sie weitergestellt wird, und parst Argumente wie Date", () => {
    installClock(new Date("2026-01-05T08:00:00.000Z"))
    expect(new Date().toISOString()).toBe("2026-01-05T08:00:00.000Z")
    expect(Date.now()).toBe(new Date("2026-01-05T08:00:00.000Z").getTime())
    advance()
    expect(new Date().toISOString()).toBe("2026-01-05T08:01:00.000Z")
    expect(new Date("2026-03-31").toISOString()).toBe("2026-03-31T00:00:00.000Z")
    expect(new Date(Date.UTC(2026, 1, 2)).toISOString()).toBe("2026-02-02T00:00:00.000Z")
  })

  it("geht nie zurück", () => {
    installClock(new Date("2026-05-01T00:00:00.000Z"))
    setClock(new Date("2026-04-01T00:00:00.000Z"))
    expect(new Date().toISOString()).toBe("2026-05-01T00:00:01.000Z")
  })
})

describe("Phasen-Matrix", () => {
  it("hat eindeutige Kürzel und Namen, die in das Namensfeld passen", () => {
    expect(new Set(SCENARIOS.map((s) => s.code)).size).toBe(SCENARIOS.length)
    expect(new Set(SCENARIOS.map((s) => s.name)).size).toBe(SCENARIOS.length)
    for (const s of SCENARIOS) expect(s.name.length).toBeLessThanOrEqual(100)
  })

  it("gibt jedem öffentlichen Wettbewerb einen gültigen Slug", () => {
    for (const s of SCENARIOS.filter((x) => x.public)) {
      expect(s.code.toLowerCase()).toMatch(SLUG_REGEX)
    }
  })

  it("deckt jede Liga-Phase in jedem Format ab", () => {
    for (const format of ["DRR", "BO3", "BO5"] as const) {
      const phases = new Set(
        SCENARIOS.filter((s) => s.kind === "LEAGUE" && s.format === format).map((s) =>
          s.kind === "LEAGUE" ? s.phase : ""
        )
      )
      for (const phase of [
        "L0-leer",
        "L0-teilnehmer",
        "L1",
        "L2",
        "L4",
        "L5-mitten",
        "L5-fertig",
        "L6-offen",
        "L6-hauptwertung",
        "L6-stichkriterium",
        "L6-verlaengerung",
        "L7-mit-playoffs",
        "L7-ohne-playoffs",
        "L7-archiviert",
      ]) {
        expect(phases.has(phase as never), `${format} ${phase}`).toBe(true)
      }
    }
  })

  it("deckt jede Wertungsart und jeden Zielwert-Modus mit jedem Bezug im Event ab", () => {
    const events = SCENARIOS.filter((s) => s.kind === "EVENT")
    for (const mode of ["RINGTEILER", "RINGS", "RINGS_DECIMAL", "TEILER", "DECIMAL_REST"]) {
      expect(events.some((e) => e.kind === "EVENT" && e.scoringMode === mode)).toBe(true)
    }
    for (const mode of ["TARGET_ABSOLUTE", "TARGET_UNDER", "TARGET_OVER"]) {
      for (const type of ["TEILER", "RINGS", "RINGS_DECIMAL"]) {
        expect(
          events.some(
            (e) => e.kind === "EVENT" && e.scoringMode === mode && e.target?.type === type
          ),
          `${mode} ${type}`
        ).toBe(true)
      }
    }
  })
})

describe("feste Fälle der Wertung", () => {
  const LUFTPISTOLE = 0.3333333
  const factorOf = (place: number) => (place % 2 === 1 ? LUFTPISTOLE : 1)

  /** alle Paarungen einer vollen Hin- und Rückrunde mit sechs Teilnehmern */
  function doubleRoundRobin(fixedCase: FixedCase, mixed: boolean): StandingsMatchup[] {
    const matchups: StandingsMatchup[] = []
    for (const firstLeg of [true, false]) {
      for (let home = 0; home < 6; home++) {
        for (let away = home + 1; away < 6; away++) {
          const [h, a] = firstLeg ? [home, away] : [away, home]
          const result = (self: number, other: number) => {
            const v = fixedSeries(fixedCase, self, other, firstLeg)
            const factor = mixed ? factorOf(self) : 1
            return {
              participantId: `p${self}`,
              rings: v.rings,
              teiler: v.teiler,
              ringteiler: calculateRingteiler(v.rings, v.teiler, factor, MAX_RINGS.WHOLE),
            }
          }
          matchups.push({
            id: `${firstLeg ? "h" : "r"}-${h}-${a}`,
            status: "COMPLETED",
            homeParticipantId: `p${h}`,
            awayParticipantId: `p${a}`,
            results: [result(h, a), result(a, h)],
          })
        }
      }
    }
    return matchups
  }

  const participants = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`,
    firstName: "Vorname",
    lastName: `Name ${i}`,
    withdrawn: false,
  }))

  it("„teiler-roh-anders“: Teiler vom Ausdruck und korrigierter Teiler entscheiden Paarungen anders", () => {
    const differing = doubleRoundRobin("teiler-roh-anders", true).filter((m) => {
      const [home, away] = m.results
      const side = (r: typeof home, corrected: boolean) => ({
        ...r,
        teiler: r.teiler * (corrected ? factorOf(Number(r.participantId.slice(1))) : 1),
      })
      return (
        determineOutcome(side(home, false), side(away, false), "TEILER") !==
        determineOutcome(side(home, true), side(away, true), "TEILER")
      )
    })
    // Platz 1 gegen 0, 2 und 4, Platz 3 gegen 4, je in Hin- und Rückrunde
    expect(differing).toHaveLength(8)
  })

  it("„ringe-gegen-ringteiler“: zwei Punktgleiche, die meisten Ringe und der beste Ringteiler trennen verschieden", () => {
    const rows = calculateStandings(
      participants,
      doubleRoundRobin("ringe-gegen-ringteiler", false),
      "RINGS"
    )
    const two = rows.find((r) => r.participantId === "p2")!
    const three = rows.find((r) => r.participantId === "p3")!
    expect(two.points).toBe(three.points)
    expect(rows.filter((r) => r.points === two.points)).toHaveLength(2)
    expect(two.bestRings).toBeGreaterThan(three.bestRings!)
    expect(two.bestRingteiler).toBeGreaterThan(three.bestRingteiler!)
  })
})
