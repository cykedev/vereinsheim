import { cardValues, comparePeriods } from "@vereinsheim/shot-core/analysis"
import { metricByKey } from "@vereinsheim/shot-core/metrics"
import { describe, expect, it } from "vitest"

import { isCardId, isNamedPeriodId } from "@vereinsheim/shot-ui/nav/routes"

import { NAMED_PERIODS, PRINTOUT_ONLY_ID, season, SEASON_NOW_MS } from "./season"

const sigma = metricByKey("group.sigma")!
const DAY = 86_400_000
const lg = season().filter((c) => c.family === "lg-freihand")
const lp = season().filter((c) => c.family === "lp-freihand")
const between = (from: string, to: string) =>
  lg.filter(
    (c) =>
      c.card.startedAtMs >= Date.parse(`${from}T00:00:00+02:00`) &&
      c.card.startedAtMs < Date.parse(`${to}T00:00:00+02:00`)
  )
const meanSigma = (cards: typeof lg) => {
  const values = cardValues(
    cards.map((c) => c.card),
    sigma,
    "decimal"
  )
  return values.reduce((sum, v) => sum + v.value, 0) / values.length
}

describe("Saison im Labor (Plan L3, D17)", () => {
  it("etwa 80 Scheiben Luftgewehr und 40 Luftpistole, keine nach jetzt, immer gleich", () => {
    expect(lg.length).toBeGreaterThanOrEqual(75)
    expect(lg.length).toBeLessThanOrEqual(85)
    expect(lp.length).toBeGreaterThanOrEqual(35)
    expect(lp.length).toBeLessThanOrEqual(50)
    expect(season().every((c) => c.card.startedAtMs < SEASON_NOW_MS)).toBe(true)
    expect(season()).toEqual(season())
  })

  it("Wettkämpfe, Training nur aus Probe, eine Scheibe nur aus dem Ausdruck", () => {
    expect(lg.filter((c) => c.card.kind === "competition")).toHaveLength(11)
    expect(lp.filter((c) => c.card.kind === "competition")).toHaveLength(6)
    const probeOnly = lg.filter((c) => c.card.shots.every((s) => s.kind === "probe"))
    expect(probeOnly.length).toBeGreaterThanOrEqual(5)
    expect(season().filter((c) => c.card.flags?.includes("nur-pdf"))).toHaveLength(1)
    // Wertungsscheiben beginnen mit Probe, wie am Stand
    const competition = lg.find((c) => c.card.kind === "competition")!
    expect(competition.card.shots.filter((s) => s.kind === "match")).toHaveLength(40)
    expect(competition.card.shots[0].kind).toBe("probe")
  })

  it("Formknick im Juni, neue Munition ab August: σ je Scheibe im Mittel", () => {
    expect(meanSigma(between("2026-06-01", "2026-07-01"))).toBeGreaterThan(
      meanSigma(between("2026-05-01", "2026-06-01"))
    )
    expect(meanSigma(between("2026-08-01", "2026-10-01"))).toBeLessThan(
      meanSigma(between("2026-04-01", "2026-06-01"))
    )
  })

  it("„Neue Munition“ gegen den gleich langen Zeitraum davor: σ nachweisbar tiefer", () => {
    expect(NAMED_PERIODS.map((p) => p.name)).toEqual([
      "Vorbereitung Landesmeisterschaft",
      "Neue Munition",
    ])
    const from = Date.parse("2026-08-01T00:00:00+02:00")
    const length = SEASON_NOW_MS + 1 - from
    const pick = (a: number, b: number) =>
      cardValues(
        lg.filter((c) => c.card.startedAtMs >= a && c.card.startedAtMs < b).map((c) => c.card),
        sigma,
        "decimal"
      )
    const result = comparePeriods(pick(from - length, from), pick(from, SEASON_NOW_MS + 1))
    expect(result?.verdict).toBe("lower")
    expect(length).toBeGreaterThan(50 * DAY)
  })

  it("Ids wie aus der Datenbank: eindeutig, gültig in der Adresse, ohne Datum oder Scheibe (User, 9. Oktober 2026)", () => {
    const ids = season().map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(isCardId(id), id).toBe(true)
      expect(id).not.toMatch(/2026|10m/)
    }
    for (const period of NAMED_PERIODS) expect(isNamedPeriodId(period.id), period.id).toBe(true)
    expect(
      season()
        .filter((c) => c.card.flags?.includes("nur-pdf"))
        .map((c) => c.id)
    ).toEqual([PRINTOUT_ONLY_ID])
  })

  it("Abende mit zwei Scheiben und Mischabende; das Luftgewehr bleibt gleich (Plan N2, D9)", () => {
    // Fingerabdruck des Luftgewehrs vor N2: 81 Scheiben, Ids, Beginn, Schusszahl, erste Lage
    const key = lg
      .map((c) => `${c.id}:${c.card.startedAtMs}:${c.card.shots.length}:${c.card.shots[0]?.xUm}`)
      .join("|")
    let hash = 0x811c9dc5
    for (const char of key) {
      hash ^= char.charCodeAt(0)
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
    expect(lg).toHaveLength(81)
    expect(hash.toString(16)).toBe("7552ea3c")
    expect(lp).toHaveLength(46)
    // Abende in MESZ (die Saison liegt ganz in der Sommerzeit)
    const day = (c: (typeof lg)[number]) =>
      new Date(c.card.startedAtMs + 2 * 3_600_000).toISOString().slice(0, 10)
    const count = (cards: typeof lg) =>
      cards.reduce((m, c) => m.set(day(c), (m.get(day(c)) ?? 0) + 1), new Map<string, number>())
    const lpDays = count(lp)
    // zwei Abende mit zwei Scheiben (N2) und der letzte Abend (Review N5)
    expect([...lpDays.values()].filter((n) => n === 2)).toHaveLength(3)
    // Mischabende: dazu schon die gemeinsamen Wettkampftage; neu sind drei Trainings der Luftpistole an Samstagen
    // mit Luftgewehr
    const lgDays = count(lg)
    const mixedTraining = lp.filter((c) => c.card.kind === "training" && lgDays.has(day(c)))
    // drei Samstage (N2) und zwei Scheiben am letzten Abend, einem Samstag mit Wettkampf (Review N5)
    expect(mixedTraining).toHaveLength(5)
    for (const c of mixedTraining)
      expect(new Date(`${day(c)}T12:00:00Z`).getUTCDay(), day(c)).toBe(6)
  })

  it("amtliche Wertung: Luftpistole und Wettkampf in ganzen Ringen, Training Luftgewehr in Zehnteln, nur Probe ohne", () => {
    const probeOnly = (c: (typeof lg)[number]) => c.card.shots.every((s) => s.kind === "probe")
    for (const c of season()) {
      const expected = probeOnly(c)
        ? undefined
        : c.family === "lp-freihand" || c.card.kind === "competition"
          ? "rings"
          : "decimal"
      expect(c.card.official, c.id).toBe(expected)
    }
    expect(lg.filter((c) => c.card.official === "decimal").length).toBeGreaterThan(40)
    expect(lg.filter((c) => c.card.official === "rings")).toHaveLength(11)
    expect(lg.filter((c) => c.card.official === undefined).length).toBeGreaterThan(3)
  })
})
