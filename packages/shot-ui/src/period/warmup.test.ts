import { describe, expect, it } from "vitest"

import type { ProjectedCard } from "@vereinsheim/shot-core/projection"

import { markWarmup } from "./warmup"

const ZONE = "Europe/Berlin"

type Card = ProjectedCard & { family: string | null }

/** eine Scheibe zu `iso` (UTC) in der Familie lp, ohne Werte; nur die Felder, die die Regel liest, zählen */
const card = (id: string, iso: string, probeOnly: boolean, family: string | null = "lp"): Card => ({
  id,
  startedAtMs: Date.parse(iso),
  kind: "training",
  complete: true,
  flags: [],
  family,
  projection: {
    version: "test",
    probeOnly,
    suspicious: false,
    printedShots: 10,
    values: {},
    records: { decimal: null, rings: null },
  },
})

const marked = (cards: readonly Card[]) =>
  markWarmup(cards, { timeZone: ZONE, familyOf: (c) => c.family })
    .filter((c) => c.warmup)
    .map((c) => c.id)

describe("markWarmup: Abend in der Anzeige-Zone, vor 4 Uhr der Vortag", () => {
  it("eine Probe vor Mitternacht und die Wertung danach sind ein Abend, um 4 Uhr beginnt ein neuer", () => {
    // Probe 10.03.2026 23:30 MEZ, Wertung 11.03.2026 00:30 MEZ: derselbe Abend
    expect(
      marked([card("p", "2026-03-10T22:30:00Z", true), card("w", "2026-03-10T23:30:00Z", false)])
    ).toEqual(["p"])
    // Probe 11.03.2026 03:30 MEZ gehört zum Abend davor, die Wertung 04:30 MEZ zum nächsten
    expect(
      marked([card("p", "2026-03-11T02:30:00Z", true), card("w", "2026-03-11T03:30:00Z", false)])
    ).toEqual([])
  })

  it("an der Umstellung auf Winterzeit zählt die Uhr der Zone, nicht vier Stunden absolut", () => {
    // Probe 24.10.2026 23:30 MESZ, Wertung 25.10.2026 03:45 MEZ: derselbe Abend
    expect(
      marked([card("p", "2026-10-24T21:30:00Z", true), card("w", "2026-10-25T02:45:00Z", false)])
    ).toEqual(["p"])
    // Probe 25.10. 03:30 MEZ (viereinhalb Stunden nach Mitternacht) gehört noch zum 24.10., die Wertung 04:30 MEZ nicht
    expect(
      marked([card("p", "2026-10-25T02:30:00Z", true), card("w", "2026-10-25T03:30:00Z", false)])
    ).toEqual([])
  })

  it("eine Scheibe ohne Familie ist weder Einschießen noch Wertung für andere", () => {
    const probe = card("p", "2026-03-10T17:00:00Z", true)
    expect(marked([probe, card("w", "2026-03-10T18:00:00Z", false, null)])).toEqual([])
    expect(
      marked([
        card("x", "2026-03-10T17:00:00Z", true, null),
        card("w", "2026-03-10T18:00:00Z", false),
      ])
    ).toEqual([])
  })

  it("ein `warmup` am Eingang, das nach der Regel nicht gilt, fällt weg; die Folge bleibt", () => {
    const stale = { ...card("a", "2026-03-10T17:00:00Z", true), warmup: true as const }
    const cards = [
      card("w", "2026-03-10T18:00:00Z", false),
      stale,
      card("p", "2026-03-10T17:30:00Z", true),
    ]
    const result = markWarmup(cards, { timeZone: ZONE, familyOf: (c) => c.family })
    expect(result.map((c) => c.id)).toEqual(["w", "a", "p"])
    expect(result.map((c) => c.warmup ?? false)).toEqual([false, true, true])
    expect(marked([stale])).toEqual([])
    expect("warmup" in markWarmup([stale], { timeZone: ZONE, familyOf: (c) => c.family })[0]).toBe(
      false
    )
  })
})
