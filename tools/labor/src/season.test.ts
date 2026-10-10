import { cardValues, comparePeriods } from "@vereinsheim/shot-core/analysis"
import { metricByKey } from "@vereinsheim/shot-core/metrics"
import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import { TARGETS } from "@vereinsheim/shot-core/targets"
import { describe, expect, it } from "vitest"

import { eveningDay } from "@vereinsheim/shot-ui/list/evenings"
import { isCardId, isNamedPeriodId } from "@vereinsheim/shot-ui/nav/routes"

import { OWN_CARDS } from "./ownCards"
import {
  NAMED_PERIODS,
  ownCardOmitted,
  PRINTOUT_ONLY_ID,
  season,
  SEASON_NOW_MS,
  SEASON_TIME_ZONE,
} from "./season"

const sigma = metricByKey("group.sigma")!
const DAY = 86_400_000
const lg = season().filter((c) => c.family === "lg-freihand")
const lp = season().filter((c) => c.family === "lp-freihand")
/** das erfundene Luftgewehr bis zum 27. September, wie vor den echten Scheiben */
const invented = lg.filter(
  (c) => !c.own && c.card.startedAtMs < Date.parse("2026-09-28T00:00:00+02:00")
)
/** der Abend einer Scheibe in Berlin */
const evening = (c: (typeof lg)[number]) => eveningDay(c.card.startedAtMs, SEASON_TIME_ZONE)
const utc = (c: (typeof lg)[number]) => new Date(c.card.startedAtMs).toISOString()
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
  it("Luftgewehr erfunden und zwei echte, Luftpistole nur echt; keine nach jetzt, immer gleich", () => {
    expect(lg).toHaveLength(85)
    expect(lg.filter((c) => c.own).map((c) => c.own)).toEqual([18, 25])
    expect(lp).toHaveLength(30)
    expect(lp.every((c) => c.own !== undefined && c.card.kind === "training")).toBe(true)
    expect(season().every((c) => c.card.startedAtMs < SEASON_NOW_MS)).toBe(true)
    expect(season()).toEqual(season())
  })

  it("die echten Scheiben wie in der Anlage: jeder Wert aus der Lage gleich Meytons, auch die Probe", () => {
    const shown = season().filter((c) => c.own !== undefined)
    expect(shown).toHaveLength(32)
    for (const c of shown) {
      const own = OWN_CARDS.find((o) => o.n === c.own)!
      expect(
        c.card.shots.map((s) => s.decimalTenths),
        `Scheibe ${own.n}`
      ).toEqual(
        own.shots.map((s) => scoreFromCoordinates(TARGETS[c.target], s.xUm, s.yUm).decimalTenths)
      )
      expect(
        c.card.shots.map((s) => s.decimalTenths),
        `Scheibe ${own.n}`
      ).toEqual(own.shots.map((s) => s.decimalTenths))
      expect(c.card.shots.map((s) => s.kind)).toEqual(
        own.shots.map((s) => (s.stellung === 1 ? "match" : "probe"))
      )
    }
  })

  it("weggelassen: ohne Scheibenbild (Zimmerstutzen, Schach) und verdeckt (König, SF-19)", () => {
    expect(
      OWN_CARDS.filter((o) => ownCardOmitted(o)).map((o) => [o.n, o.discipline, ownCardOmitted(o)])
    ).toEqual([
      [2, "Zimmerstutzen", "ohne Scheibenbild"],
      [12, "LP Schach 6x6", "ohne Scheibenbild"],
      [21, "König LP", "verdeckt"],
    ])
  })

  it("amtliche Wertung aus der Anzeigeart, unvollständig mit Merkmal und nicht für Rekorde", () => {
    const byOwn = (n: number) => season().find((c) => c.own === n)!.card
    expect(byOwn(36).official).toBe("rings")
    // LP 20 mit Anzeigeart 7 (Zehntel und bester Teiler)
    expect(byOwn(27).official).toBe("decimal")
    // nur Probe hat keine
    expect(byOwn(30).official).toBeUndefined()
    expect(byOwn(36)).toMatchObject({ complete: true })
    expect(byOwn(36).flags).toBeUndefined()
    // 25 von 40 und 40 von 60
    for (const n of [29, 28]) {
      expect(byOwn(n).complete, `Scheibe ${n}`).toBe(false)
      expect(byOwn(n).flags).toEqual(["unvollstaendig"])
    }
    // ein Training nur aus Probe ist fertig, seine Zahl ist die der Probe
    expect(byOwn(33).complete).toBe(true)
  })

  it("Zeiten in Berlin, Sommer- und Winterzeit; der letzte Abend ist ein Mischabend", () => {
    const byOwn = (n: number) => season().find((c) => c.own === n)!
    // Ortszeit des Stands nach UTC: 19:13 MESZ (UTC+2), 19:54 MEZ (UTC+1), 19:17 MESZ
    expect(utc(byOwn(3))).toBe("2024-10-18T17:13:33.990Z")
    expect(utc(byOwn(6))).toBe("2024-11-12T18:54:06.674Z")
    expect(utc(byOwn(36))).toBe("2026-10-09T17:17:07.742Z")
    expect([3, 6, 36].map((n) => evening(byOwn(n)))).toEqual([
      "2024-10-18",
      "2024-11-12",
      "2026-10-09",
    ])
    // Schusszeiten mit Millisekunden: der letzte Schuss des 9. Oktober um 19:41:00
    const lastShot = byOwn(36).card.shots.at(-1)!.firedAtMs!
    expect(new Date(lastShot).toISOString()).toBe("2026-10-09T17:41:00.012Z")
    // 20:00 und 20:45 MESZ
    const last = season().filter((c) => evening(c) === "2026-10-09")
    expect(last.map((c) => [c.family, utc(c).slice(11, 16), c.own ?? null])).toEqual([
      ["lp-freihand", "17:17", 36],
      ["lg-freihand", "18:00", null],
      ["lg-freihand", "18:45", null],
    ])
  })

  it("Wettkämpfe, Training nur aus Probe, eine Scheibe nur aus dem Ausdruck", () => {
    expect(lg.filter((c) => c.card.kind === "competition")).toHaveLength(11)
    expect(lp.filter((c) => c.card.kind === "competition")).toHaveLength(0)
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

  it("das erfundene Luftgewehr bleibt gleich (Fingerabdruck vor N2); Abende mit mehreren echten Scheiben", () => {
    // Fingerabdruck des Luftgewehrs vor N2: 81 Scheiben, Ids, Beginn, Schusszahl, erste Lage
    const key = invented
      .map((c) => `${c.id}:${c.card.startedAtMs}:${c.card.shots.length}:${c.card.shots[0]?.xUm}`)
      .join("|")
    let hash = 0x811c9dc5
    for (const char of key) {
      hash ^= char.charCodeAt(0)
      hash = Math.imul(hash, 0x01000193) >>> 0
    }
    expect(invented).toHaveLength(81)
    expect(hash.toString(16)).toBe("7552ea3c")
    // echt: drei Scheiben am 12. November 2024 und am 25. September 2026
    const days = lp.reduce(
      (m, c) => m.set(evening(c), (m.get(evening(c)) ?? 0) + 1),
      new Map<string, number>()
    )
    expect([...days].filter(([, n]) => n > 1)).toEqual([
      ["2024-11-12", 3],
      ["2026-09-25", 3],
    ])
  })

  it("amtliche Wertung des erfundenen Luftgewehrs: Wettkampf in ganzen Ringen, Training in Zehnteln, nur Probe ohne", () => {
    const probeOnly = (c: (typeof lg)[number]) => c.card.shots.every((s) => s.kind === "probe")
    for (const c of lg.filter((c) => !c.own)) {
      const expected = probeOnly(c)
        ? undefined
        : c.card.kind === "competition"
          ? "rings"
          : "decimal"
      expect(c.card.official, c.id).toBe(expected)
    }
    expect(invented.filter((c) => c.card.official === "decimal").length).toBeGreaterThan(40)
    expect(invented.filter((c) => c.card.official === "rings")).toHaveLength(11)
    expect(invented.filter((c) => c.card.official === undefined).length).toBeGreaterThan(3)
  })
})
