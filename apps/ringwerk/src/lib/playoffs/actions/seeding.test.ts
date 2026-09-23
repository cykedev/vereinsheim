import { beforeEach, describe, expect, it, vi } from "vitest"

// Playoff-Setzung (Start + nächste Runde) mit ECHTER Tabellenrechnung: gemockt sind nur DB,
// Auth und Framework. So hält jeder Test fest, welche Tabelle die Setzung tatsächlich liest.

const m = vi.hoisted(() => ({
  getAuthSession: vi.fn(),
  competitionFindUnique: vi.fn(),
  competitionParticipantFindMany: vi.fn(),
  matchupFindMany: vi.fn(),
  matchupCount: vi.fn(),
  playoffMatchCount: vi.fn(),
  playoffMatchFindMany: vi.fn(),
  playoffMatchCreate: vi.fn(),
  playoffMatchCreateMany: vi.fn(),
  auditLogCreate: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: m.getAuthSession,
  canManage: (role: string) => role === "ADMIN" || role === "MANAGER",
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock("@/lib/competitions/publicPdfCache", () => ({ revalidatePublicPdf: vi.fn() }))
vi.mock("@/lib/db", () => ({
  db: {
    competition: { findUnique: m.competitionFindUnique },
    competitionParticipant: { findMany: m.competitionParticipantFindMany },
    matchup: { findMany: m.matchupFindMany, count: m.matchupCount },
    playoffMatch: {
      count: m.playoffMatchCount,
      findMany: m.playoffMatchFindMany,
      create: m.playoffMatchCreate,
      createMany: m.playoffMatchCreateMany,
    },
    auditLog: { create: m.auditLogCreate },
  },
}))

import { startPlayoffs } from "./start"
import { advanceRound } from "./match"
import { getSeedingStandings } from "../queries"
import type { BestOfStandingRow, StandingRow } from "@/lib/standings/queries"

// ─── Fixture ─────────────────────────────────────────────────────────────────

type Format = "BEST_OF_SINGLE" | "DOUBLE_ROUND_ROBIN"

/**
 * Best-of-Muster je Begegnung (der Stärkere gewinnt immer 2:1):
 * - "normal": er gewinnt auch Duell 1 — die heutige Rundenturnier-Rechnung liegt zufällig richtig
 * - "strongLosesDuelOne": er verliert Duell 1 — genau hier scheitert die Rundenturnier-Rechnung,
 *   weil sie pro Paarung nur die erste Serie je Schütze wertet
 */
type Pattern = "normal" | "strongLosesDuelOne"

/** Prisma liefert Decimal — die Tabellenrechner rufen `.toNumber()`. */
const dec = (n: number) => ({ toNumber: () => n })

function series(
  participantId: string,
  duelNumber: number | null,
  ringteiler: number,
  opts: { isTiebreak?: boolean; rings?: number } = {}
) {
  return {
    participantId,
    duelNumber,
    isTiebreak: opts.isTiebreak ?? false,
    rings: dec(opts.rings ?? 100 - ringteiler),
    teiler: dec(0),
    ringteiler: dec(ringteiler),
    discipline: { teilerFaktor: dec(1) },
  }
}

type SeriesRow = ReturnType<typeof series>

function bestOfSeries(strong: string, weak: string, pattern: Pattern): SeriesRow[] {
  // Niedriger Ringteiler gewinnt (RINGTEILER). Reihenfolge wie beim Speichern: Duell für Duell.
  return pattern === "normal"
    ? [
        series(strong, 1, 5),
        series(weak, 1, 9),
        series(strong, 2, 5),
        series(weak, 2, 9),
        series(weak, 3, 5),
        series(strong, 3, 9),
      ]
    : [
        series(weak, 1, 5),
        series(strong, 1, 9),
        series(strong, 2, 5),
        series(weak, 2, 9),
        series(strong, 3, 5),
        series(weak, 3, 9),
      ]
}

interface LeagueOptions {
  format: Format
  pattern?: Pattern
  withdrawn?: string[]
  status?: string
  playoffHasViertelfinale?: boolean
  playoffHasAchtelfinale?: boolean
  /** Serien einzelner Begegnungen ersetzen; Schlüssel "Stärker-Schwächer". */
  override?: Record<string, SeriesRow[]>
}

/**
 * Liga, in der `ids` die wahre Stärke-Reihenfolge ist; alle Begegnungen abgeschlossen.
 * Best-of: jeder gegen jeden einmal. Doppelrunde: Hin- und Rückrunde, eine Serie je Schütze,
 * der Stärkere gewinnt. Ungerade Teilnehmerzahl: jeder hat ein Freilos.
 */
function league(ids: string[], opts: LeagueOptions) {
  const pattern = opts.pattern ?? "normal"
  const matchups: unknown[] = []
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const [strong, weak] = [ids[i], ids[j]]
      const key = `${strong}-${weak}`
      if (opts.format === "BEST_OF_SINGLE") {
        matchups.push({
          id: `m-${key}`,
          status: "COMPLETED",
          homeParticipantId: strong,
          awayParticipantId: weak,
          series: opts.override?.[key] ?? bestOfSeries(strong, weak, pattern),
        })
      } else {
        for (const [home, away, leg] of [
          [strong, weak, "h"],
          [weak, strong, "r"],
        ]) {
          matchups.push({
            id: `m-${key}-${leg}`,
            status: "COMPLETED",
            homeParticipantId: home,
            awayParticipantId: away,
            series: opts.override?.[key] ?? [series(strong, null, 5), series(weak, null, 9)],
          })
        }
      }
    }
  }
  if (ids.length % 2 === 1) {
    for (const id of ids) {
      matchups.push({
        id: `bye-${id}`,
        status: "BYE",
        homeParticipantId: id,
        awayParticipantId: null,
        series: [],
      })
    }
  }

  m.competitionFindUnique.mockResolvedValue({
    id: "c1",
    status: opts.status ?? "ACTIVE",
    playoffBestOf: 5,
    playoffHasViertelfinale: opts.playoffHasViertelfinale ?? false,
    playoffHasAchtelfinale: opts.playoffHasAchtelfinale ?? false,
    leagueFormat: opts.format,
    scoringMode: "RINGTEILER",
    disciplineId: "d1",
    groupBestOf: 3,
    groupPlayAllDuels: true,
    groupTiebreaker1: null,
    groupTiebreaker2: null,
  })
  m.competitionParticipantFindMany.mockResolvedValue(
    ids.map((id, i) => ({
      status: opts.withdrawn?.includes(id) ? "WITHDRAWN" : "ACTIVE",
      // Nachnamen GEGEN die Stärke sortiert: eine Tabelle, die nichts wertet und nur alphabetisch
      // ordnet, ergäbe die umgekehrte Setzung — jeder Test erkennt so eine falsche Quelle.
      participant: {
        id,
        firstName: id,
        lastName: `Name${String(ids.length - i).padStart(2, "0")}`,
      },
    }))
  )
  m.matchupFindMany.mockResolvedValue(matchups)
}

/** P01, P02, … in Stärke-Reihenfolge. */
const players = (n: number) =>
  Array.from({ length: n }, (_, i) => `P${String(i + 1).padStart(2, "0")}`)

type PlayoffRow = {
  id: string
  round: string
  status: string
  winsA: number
  winsB: number
  participantAId: string
  participantBId: string
}

/** Bestehende Playoff-Matches; die zweite Abfrage (je Runde) filtert wie Prisma nach `round`. */
function existingPlayoffs(rows: PlayoffRow[]) {
  m.playoffMatchFindMany.mockImplementation(async (args?: { where?: { round?: string } }) =>
    args?.where?.round ? rows.filter((r) => r.round === args.where!.round) : rows
  )
}

/** Eine Runde, in der jeweils der Gesetzte (participantA) gewinnt. */
function wonBySeed(round: string, pairs: [string, string][]): PlayoffRow[] {
  return pairs.map(([a, b], i) => ({
    id: `${round}-${i}`,
    round,
    status: "COMPLETED",
    winsA: 3,
    winsB: 1,
    participantAId: a,
    participantBId: b,
  }))
}

/** Die per createMany angelegten Paarungen als "A–B" in Setzreihenfolge. */
function createdPairs(): string[] {
  expect(m.playoffMatchCreateMany).toHaveBeenCalledTimes(1)
  const { data } = m.playoffMatchCreateMany.mock.calls[0][0] as {
    data: { participantAId: string; participantBId: string }[]
  }
  return data.map((d) => `${d.participantAId}–${d.participantBId}`)
}

/** Paarungen "1–N, 2–(N-1), …" aus einer Setzliste. */
const seededPairs = (seeds: string[]) =>
  seeds.slice(0, seeds.length / 2).map((s, i) => `${s}–${seeds[seeds.length - 1 - i]}`)

beforeEach(() => {
  vi.clearAllMocks()
  m.getAuthSession.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } })
  m.matchupCount.mockResolvedValue(0)
  m.playoffMatchCount.mockResolvedValue(0)
  m.playoffMatchCreate.mockResolvedValue({})
  m.playoffMatchCreateMany.mockResolvedValue({ count: 0 })
  m.auditLogCreate.mockResolvedValue({})
})

// ─── Charakterisierung: heutiges Verhalten, das erhalten bleiben muss ────────

describe.each(["DOUBLE_ROUND_ROBIN", "BEST_OF_SINGLE"] as const)(
  "startPlayoffs — %s, Normalfall",
  (format) => {
    it("Halbfinale mit 4: 1–4, 2–3", async () => {
      league(["A", "B", "C", "D"], { format })
      expect(await startPlayoffs("c1")).toEqual({ success: true })
      expect(createdPairs()).toEqual(["A–D", "B–C"])
    })

    it("Halbfinale mit 6: nur die besten 4 qualifizieren sich", async () => {
      league(players(6), { format })
      expect(await startPlayoffs("c1")).toEqual({ success: true })
      expect(createdPairs()).toEqual(["P01–P04", "P02–P03"])
    })

    it("Viertelfinale mit 8: 1–8, 2–7, 3–6, 4–5", async () => {
      league(players(8), { format, playoffHasViertelfinale: true })
      expect(await startPlayoffs("c1")).toEqual({ success: true })
      expect(createdPairs()).toEqual(seededPairs(players(8)))
    })

    it("Achtelfinale mit 16: 1–16 … 8–9", async () => {
      league(players(16), { format, playoffHasAchtelfinale: true })
      expect(await startPlayoffs("c1")).toEqual({ success: true })
      expect(createdPairs()).toEqual(seededPairs(players(16)))
    })

    it("ungerade Teilnehmerzahl mit Freilosen: die besten 4 von 5", async () => {
      league(["A", "B", "C", "D", "E"], { format })
      expect(await startPlayoffs("c1")).toEqual({ success: true })
      expect(createdPairs()).toEqual(["A–D", "B–C"])
    })

    it("Zurückgezogene werden übersprungen, ihre Begegnungen zählen nicht", async () => {
      league(["A", "B", "C", "D", "E"], { format, withdrawn: ["C"] })
      expect(await startPlayoffs("c1")).toEqual({ success: true })
      expect(createdPairs()).toEqual(["A–E", "B–D"])
    })

    it("protokolliert die Zahl der aktiven Teilnehmer", async () => {
      league(["A", "B", "C", "D", "E"], { format, withdrawn: ["E"] })
      await startPlayoffs("c1")
      expect(m.auditLogCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: "PLAYOFFS_STARTED",
            details: { participantCount: 4 },
          }),
        })
      )
    })
  }
)

describe("startPlayoffs — Best-of, geteilter Platz", () => {
  it("Ringtausch A>B>C>A: alle drei teilen Platz 1, gesetzt wird nach Tabellenposition", async () => {
    // A schlägt B, B schlägt C, C schlägt A (je 2:1), alle schlagen D → A, B, C sind in jedem
    // Kriterium gleich, nur der Name ordnet sie: C (Name02), B (Name03), A (Name04), dann D.
    league(["A", "B", "C", "D"], {
      format: "BEST_OF_SINGLE",
      override: { "A-C": bestOfSeries("C", "A", "normal") },
    })
    expect(await startPlayoffs("c1")).toEqual({ success: true })
    expect(createdPairs()).toEqual(["C–D", "B–A"])
  })
})

// ─── Problemfälle Best-of: vor dem Fix las die Setzung die Rundenturnier-Tabelle ─

describe("startPlayoffs — Best-of, Problemfälle", () => {
  const format = "BEST_OF_SINGLE" as const
  const pattern = "strongLosesDuelOne" as const

  it("Halbfinale mit 4: gesetzt nach Match-Siegen, nicht nach Duell 1", async () => {
    league(["A", "B", "C", "D"], { format, pattern })
    expect(await startPlayoffs("c1")).toEqual({ success: true })
    expect(createdPairs()).toEqual(["A–D", "B–C"])
  })

  it("Halbfinale mit 6: die wirklich besten 4 qualifizieren sich", async () => {
    league(players(6), { format, pattern })
    expect(await startPlayoffs("c1")).toEqual({ success: true })
    expect(createdPairs()).toEqual(["P01–P04", "P02–P03"])
  })

  it("Viertelfinale mit 8", async () => {
    league(players(8), { format, pattern, playoffHasViertelfinale: true })
    expect(await startPlayoffs("c1")).toEqual({ success: true })
    expect(createdPairs()).toEqual(seededPairs(players(8)))
  })

  it("Achtelfinale mit 16", async () => {
    league(players(16), { format, pattern, playoffHasAchtelfinale: true })
    expect(await startPlayoffs("c1")).toEqual({ success: true })
    expect(createdPairs()).toEqual(seededPairs(players(16)))
  })

  it("mit Freilosen und Rückzug", async () => {
    league(["A", "B", "C", "D", "E", "F", "G"], { format, pattern, withdrawn: ["B"] })
    expect(await startPlayoffs("c1")).toEqual({ success: true })
    expect(createdPairs()).toEqual(["A–E", "C–D"])
  })

  it("Stechschuss entscheidet die Begegnung — er zählt, Duell 1 nicht", async () => {
    // Sonst Normalfall; nur A gegen B: B gewinnt Duell 1, A Duell 2, Duell 3 gleich (1:1),
    // A gewinnt den Stechschuss (10,5 gegen 9,8) → A gewinnt die Begegnung 2:1 n. St.
    league(["A", "B", "C", "D"], {
      format,
      override: {
        "A-B": [
          series("B", 1, 5),
          series("A", 1, 9),
          series("A", 2, 5),
          series("B", 2, 9),
          series("A", 3, 7),
          series("B", 3, 7),
          series("A", 4, 0, { isTiebreak: true, rings: 10.5 }),
          series("B", 4, 0, { isTiebreak: true, rings: 9.8 }),
        ],
      },
    })
    expect(await startPlayoffs("c1")).toEqual({ success: true })
    expect(createdPairs()).toEqual(["A–D", "B–C"])
  })
})

describe("getSeedingStandings — eine Quelle für die Setzliste", () => {
  it("Best-of-Liga: Best-of-Tabelle (Match-Siege), nicht die Rundenturnier-Rechnung", async () => {
    league(["A", "B", "C", "D"], { format: "BEST_OF_SINGLE", pattern: "strongLosesDuelOne" })
    const rows = (await getSeedingStandings("c1")) as BestOfStandingRow[]
    expect(rows.map((r) => r.participantId)).toEqual(["A", "B", "C", "D"])
    expect(rows.map((r) => r.wins)).toEqual([3, 2, 1, 0])
    expect(m.competitionFindUnique).toHaveBeenCalledWith({
      where: { id: "c1" },
      select: { leagueFormat: true },
    })
  })

  it("Doppelrunden-Liga: Punkte-Tabelle wie bisher", async () => {
    league(["A", "B", "C", "D"], { format: "DOUBLE_ROUND_ROBIN" })
    const rows = (await getSeedingStandings("c1")) as StandingRow[]
    expect(rows.map((r) => r.participantId)).toEqual(["A", "B", "C", "D"])
    expect(rows.map((r) => r.points)).toEqual([12, 8, 4, 0])
  })

  it("geteilter Platz: Reihenfolge eindeutig, Platz geteilt — gesetzt wird nach Position", async () => {
    league(["A", "B", "C", "D"], {
      format: "BEST_OF_SINGLE",
      override: { "A-C": bestOfSeries("C", "A", "normal") },
    })
    const rows = (await getSeedingStandings("c1")) as BestOfStandingRow[]
    expect(rows.map((r) => r.participantId)).toEqual(["C", "B", "A", "D"])
    expect(rows.map((r) => r.rank)).toEqual([1, 1, 1, 4])
  })
})

describe.each(["DOUBLE_ROUND_ROBIN", "BEST_OF_SINGLE"] as const)(
  "startPlayoffs — %s, Schutzprüfungen",
  (format) => {
    it("ohne Anmeldung", async () => {
      league(["A", "B", "C", "D"], { format })
      m.getAuthSession.mockResolvedValue(null)
      expect(await startPlayoffs("c1")).toEqual({ error: "Nicht angemeldet." })
      expect(m.playoffMatchCreateMany).not.toHaveBeenCalled()
    })

    it("ohne Verwaltungsrecht", async () => {
      league(["A", "B", "C", "D"], { format })
      m.getAuthSession.mockResolvedValue({ user: { id: "u2", role: "USER" } })
      expect(await startPlayoffs("c1")).toEqual({ error: "Keine Berechtigung." })
      expect(m.playoffMatchCreateMany).not.toHaveBeenCalled()
    })

    it("Wettbewerb nicht gefunden", async () => {
      league(["A", "B", "C", "D"], { format })
      m.competitionFindUnique.mockResolvedValue(null)
      expect(await startPlayoffs("c1")).toEqual({ error: "Meisterschaft nicht gefunden." })
      expect(m.playoffMatchCreateMany).not.toHaveBeenCalled()
    })

    it("Wettbewerb nicht aktiv", async () => {
      league(["A", "B", "C", "D"], { format, status: "COMPLETED" })
      expect(await startPlayoffs("c1")).toEqual({
        error: "Playoffs können nur für aktive Meisterschaften gestartet werden.",
      })
      expect(m.playoffMatchCreateMany).not.toHaveBeenCalled()
    })

    it("Playoffs schon gestartet", async () => {
      league(["A", "B", "C", "D"], { format })
      m.playoffMatchCount.mockResolvedValue(2)
      expect(await startPlayoffs("c1")).toEqual({ error: "Playoffs wurden bereits gestartet." })
      expect(m.playoffMatchCreateMany).not.toHaveBeenCalled()
    })

    it("offene Paarungen in der Gruppenphase", async () => {
      league(["A", "B", "C", "D"], { format })
      m.matchupCount.mockResolvedValue(1)
      expect(await startPlayoffs("c1")).toEqual({
        error: "Es gibt noch ausstehende Paarungen in der Gruppenphase.",
      })
      expect(m.playoffMatchCreateMany).not.toHaveBeenCalled()
    })

    it("zu wenige aktive Teilnehmer fürs Halbfinale (Rückzüge zählen nicht)", async () => {
      league(["A", "B", "C", "D", "E"], { format, withdrawn: ["D", "E"] })
      expect(await startPlayoffs("c1")).toEqual({
        error: "Mindestens 4 aktive Teilnehmer für Playoffs erforderlich.",
      })
      expect(m.playoffMatchCreateMany).not.toHaveBeenCalled()
    })

    it("zu wenige aktive Teilnehmer fürs Viertelfinale", async () => {
      league(players(6), { format, playoffHasViertelfinale: true })
      expect(await startPlayoffs("c1")).toEqual({
        error: "Mindestens 8 aktive Teilnehmer für Playoffs erforderlich.",
      })
      expect(m.playoffMatchCreateMany).not.toHaveBeenCalled()
    })
  }
)

describe.each(["DOUBLE_ROUND_ROBIN", "BEST_OF_SINGLE"] as const)(
  "advanceRound — %s, Normalfall",
  (format) => {
    it("Viertelfinale → Halbfinale: Sieger nach Gruppenplatz neu gesetzt (1–4, 2–3)", async () => {
      const ids = players(8)
      league(ids, { format, playoffHasViertelfinale: true })
      existingPlayoffs(
        wonBySeed("QUARTER_FINAL", [
          [ids[0], ids[7]],
          [ids[1], ids[6]],
          [ids[2], ids[5]],
          [ids[3], ids[4]],
        ])
      )
      expect(await advanceRound("c1")).toEqual({ success: true })
      expect(createdPairs()).toEqual(["P01–P04", "P02–P03"])
    })

    it("Viertelfinale mit Überraschungssiegern: neu gesetzt nach Gruppenplatz der Sieger", async () => {
      // P07 schlägt P02, P05 schlägt P04 → Sieger P01, P03, P05, P07 → 1–7, 3–5
      const ids = players(8)
      league(ids, { format, playoffHasViertelfinale: true })
      const qf = wonBySeed("QUARTER_FINAL", [
        [ids[0], ids[7]],
        [ids[1], ids[6]],
        [ids[2], ids[5]],
        [ids[3], ids[4]],
      ])
      qf[1].winsA = 1
      qf[1].winsB = 3
      qf[3].winsA = 1
      qf[3].winsB = 3
      existingPlayoffs(qf)
      expect(await advanceRound("c1")).toEqual({ success: true })
      expect(createdPairs()).toEqual(["P01–P07", "P03–P05"])
    })

    it("Achtelfinale → Viertelfinale: 1–8, 2–7, 3–6, 4–5", async () => {
      const ids = players(16)
      league(ids, { format, playoffHasAchtelfinale: true })
      existingPlayoffs(
        wonBySeed(
          "EIGHTH_FINAL",
          ids.slice(0, 8).map((s, i) => [s, ids[15 - i]] as [string, string])
        )
      )
      expect(await advanceRound("c1")).toEqual({ success: true })
      expect(createdPairs()).toEqual(seededPairs(ids.slice(0, 8)))
    })

    it("Halbfinale → Finale: die beiden Halbfinal-Sieger, ohne Neu-Setzung", async () => {
      league(["A", "B", "C", "D"], { format })
      existingPlayoffs(
        wonBySeed("SEMI_FINAL", [
          ["A", "D"],
          ["B", "C"],
        ])
      )
      expect(await advanceRound("c1")).toEqual({ success: true })
      expect(m.playoffMatchCreate).toHaveBeenCalledWith({
        data: { competitionId: "c1", round: "FINAL", participantAId: "A", participantBId: "B" },
      })
    })

    it("keine Playoffs vorhanden", async () => {
      league(["A", "B", "C", "D"], { format })
      existingPlayoffs([])
      expect(await advanceRound("c1")).toEqual({ error: "Keine Playoffs gefunden." })
    })

    it("aktuelle Runde noch nicht abgeschlossen", async () => {
      league(["A", "B", "C", "D"], { format })
      const semis = wonBySeed("SEMI_FINAL", [
        ["A", "D"],
        ["B", "C"],
      ])
      semis[1].status = "PENDING"
      existingPlayoffs(semis)
      expect(await advanceRound("c1")).toEqual({
        error: "Noch nicht alle Matches der aktuellen Runde abgeschlossen.",
      })
      expect(m.playoffMatchCreate).not.toHaveBeenCalled()
    })
  }
)

describe("advanceRound — Best-of, Problemfälle", () => {
  const format = "BEST_OF_SINGLE" as const
  const pattern = "strongLosesDuelOne" as const

  it("Viertelfinale → Halbfinale: 1–4, 2–3 nach der Best-of-Tabelle", async () => {
    const ids = players(8)
    league(ids, { format, pattern, playoffHasViertelfinale: true })
    existingPlayoffs(
      wonBySeed("QUARTER_FINAL", [
        [ids[0], ids[7]],
        [ids[1], ids[6]],
        [ids[2], ids[5]],
        [ids[3], ids[4]],
      ])
    )
    expect(await advanceRound("c1")).toEqual({ success: true })
    expect(createdPairs()).toEqual(["P01–P04", "P02–P03"])
  })

  it("Viertelfinale mit Überraschungssiegern", async () => {
    const ids = players(8)
    league(ids, { format, pattern, playoffHasViertelfinale: true })
    const qf = wonBySeed("QUARTER_FINAL", [
      [ids[0], ids[7]],
      [ids[1], ids[6]],
      [ids[2], ids[5]],
      [ids[3], ids[4]],
    ])
    qf[1].winsA = 1
    qf[1].winsB = 3
    qf[3].winsA = 1
    qf[3].winsB = 3
    existingPlayoffs(qf)
    expect(await advanceRound("c1")).toEqual({ success: true })
    expect(createdPairs()).toEqual(["P01–P07", "P03–P05"])
  })

  it("Achtelfinale → Viertelfinale", async () => {
    const ids = players(16)
    league(ids, { format, pattern, playoffHasAchtelfinale: true })
    existingPlayoffs(
      wonBySeed(
        "EIGHTH_FINAL",
        ids.slice(0, 8).map((s, i) => [s, ids[15 - i]] as [string, string])
      )
    )
    expect(await advanceRound("c1")).toEqual({ success: true })
    expect(createdPairs()).toEqual(seededPairs(ids.slice(0, 8)))
  })
})
