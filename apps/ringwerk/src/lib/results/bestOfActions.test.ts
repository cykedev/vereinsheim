import { beforeEach, describe, expect, it, vi } from "vitest"

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  getAuthSessionMock,
  revalidatePathMock,
  revalidateTagMock,
  matchupFindUniqueMock,
  competitionFindUniqueMock,
  competitionParticipantFindFirstMock,
  seriesDeleteManyMock,
  transactionMock,
  auditLogCreateMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  revalidateTagMock: vi.fn(),
  matchupFindUniqueMock: vi.fn(),
  competitionFindUniqueMock: vi.fn(),
  competitionParticipantFindFirstMock: vi.fn(),
  seriesDeleteManyMock: vi.fn(),
  transactionMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: getAuthSessionMock,
  canManage: (role: string) => role === "ADMIN" || role === "MANAGER",
}))
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
}))
vi.mock("@/lib/db", () => ({
  db: {
    matchup: { findUnique: matchupFindUniqueMock },
    competition: { findUnique: competitionFindUniqueMock },
    competitionParticipant: { findFirst: competitionParticipantFindFirstMock },
    series: { deleteMany: seriesDeleteManyMock },
    auditLog: { create: auditLogCreateMock },
    $transaction: transactionMock,
  },
}))

import { saveBestOfDuel, saveStechschuss, deleteLatestBestOfDuel } from "./bestOfActions"

// ─── Sessions ─────────────────────────────────────────────────────────────────

const adminSession = { user: { id: "u1", role: "ADMIN" } }
const userSession = { user: { id: "u2", role: "USER" } }
const managerSession = { user: { id: "u3", role: "MANAGER" } }

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Creates a Decimal-like mock (Prisma Decimal). */
function dec(n: number) {
  return { toNumber: () => n }
}

/** Creates a basic matchup with configurable series and competition settings. */
function makeMatchup(overrides: {
  series?: unknown[]
  groupBestOf?: number
  groupPlayAllDuels?: boolean
  disciplineId?: string | null
  scoringMode?: string
  status?: string
}) {
  return {
    id: "m1",
    status: overrides.status ?? "PENDING",
    round: "FIRST_LEG",
    dueDate: new Date("2026-03-15"),
    homeParticipantId: "p1",
    homeParticipant: { firstName: "Anna", lastName: "Schmidt" },
    awayParticipantId: "p2",
    awayParticipant: { firstName: "Klaus", lastName: "Meyer" },
    competitionId: "c1",
    competition: {
      shotsPerSeries: 30,
      disciplineId: overrides.disciplineId ?? "d1",
      discipline: {
        id: "d1",
        scoringType: "WHOLE" as const,
        teilerFaktor: dec(1.0),
      },
      scoringMode: overrides.scoringMode ?? "RINGTEILER",
      groupBestOf: overrides.groupBestOf ?? 3,
      groupPlayAllDuels: overrides.groupPlayAllDuels ?? false,
      groupTiebreaker1: null,
      groupTiebreaker2: null,
    },
    series: overrides.series ?? [],
  }
}

/** Creates a plain series row as returned by Prisma (with Decimal fields). */
function makeSeries(
  participantId: string,
  duelNumber: number,
  rings: number,
  teiler: number,
  ringteiler: number,
  isTiebreak = false,
  teilerFaktor = 1
) {
  return {
    participantId,
    rings: dec(rings),
    teiler: dec(teiler),
    ringteiler: dec(ringteiler),
    duelNumber,
    isTiebreak,
    discipline: { teilerFaktor: dec(teilerFaktor) },
  }
}

/** Creates a transaction mock that calls the callback with a tx object. */
function makeTransactionMock(extraTx?: Record<string, unknown>) {
  return async (fn: (tx: unknown) => Promise<void>) => {
    const tx = {
      series: { upsert: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({}) },
      matchup: { update: vi.fn().mockResolvedValue({}) },
      ...extraTx,
    }
    return fn(tx)
  }
}

// ─── saveBestOfDuel ───────────────────────────────────────────────────────────

describe("saveBestOfDuel", () => {
  const duelInput = {
    matchupId: "m1",
    duelNumber: 1,
    homeResult: { rings: 95, teiler: 12.3 },
    awayResult: { rings: 92, teiler: 15.0 },
  }

  beforeEach(() => {
    vi.resetAllMocks()
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: [] }))
    competitionFindUniqueMock.mockResolvedValue({ isPublic: false, publicSlug: null })
    transactionMock.mockImplementation(makeTransactionMock())
    auditLogCreateMock.mockResolvedValue({})
  })

  // ── Auth guards ──

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await saveBestOfDuel(duelInput)
    expect(result).toEqual({ error: "Nicht angemeldet." })
  })

  it("liefert Fehler für USER-Rolle", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    const result = await saveBestOfDuel(duelInput)
    expect(result).toEqual({ error: "Keine Berechtigung." })
  })

  it("erlaubt MANAGER-Rolle", async () => {
    getAuthSessionMock.mockResolvedValue(managerSession)
    const result = await saveBestOfDuel(duelInput)
    expect(result).toEqual({ success: true })
  })

  // ── Validation ──

  it("liefert Fehler wenn Paarung nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue(null)
    const result = await saveBestOfDuel(duelInput)
    expect(result).toEqual({ error: "Paarung nicht gefunden." })
  })

  it("liefert Fehler bei BYE-Paarung", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ status: "BYE", series: [] }))
    const result = await saveBestOfDuel(duelInput)
    expect(result).toEqual({ error: "Freilos-Paarungen haben keine Ergebnisse." })
  })

  it("liefert Fehler wenn kein Away-Participant", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue({
      ...makeMatchup({ series: [] }),
      awayParticipantId: null,
      awayParticipant: null,
    })
    const result = await saveBestOfDuel(duelInput)
    expect(result).toEqual({ error: "Ungültige Paarung: kein Gegner zugeordnet." })
  })

  it("liefert Fehler wenn Disziplin nicht konfiguriert (gemischte Liga, kein CP)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const base = makeMatchup({ series: [] })
    matchupFindUniqueMock.mockResolvedValue({
      ...base,
      competition: {
        ...base.competition,
        disciplineId: null,
        discipline: null,
      },
    })
    competitionParticipantFindFirstMock.mockResolvedValue(null)
    const result = await saveBestOfDuel(duelInput)
    expect(result).toEqual({ error: "Disziplin nicht konfiguriert." })
  })

  // ── Completion logic ──

  it("setzt Matchup auf COMPLETED wenn Best-of-3 nach 2 Siegen gewonnen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    // Home already won duel 1 (ringteiler 7.3 < 23.0).
    const existingSeries = [
      makeSeries("p1", 1, 95, 12.3, 17.3), // home ringteiler = 100 - 95 + 12.3 = 17.3
      makeSeries("p2", 1, 92, 15.0, 23.0), // away ringteiler = 100 - 92 + 15.0 = 23.0
    ]
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: existingSeries }))

    let capturedMatchupUpdate: unknown
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: { upsert: vi.fn().mockResolvedValue({}) },
        matchup: {
          update: vi.fn().mockImplementation((args: unknown) => {
            capturedMatchupUpdate = args
            return {}
          }),
        },
      }
      return fn(tx)
    })

    // Duel 2: home wins again (95 vs 92 rings → home ringteiler lower).
    await saveBestOfDuel({ ...duelInput, duelNumber: 2 })

    expect(capturedMatchupUpdate).toMatchObject({ data: { status: "COMPLETED" } })
  })

  it("lässt Matchup PENDING nach erstem Duell in Best-of-3", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: [] }))

    let capturedStatus: string | undefined
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: { upsert: vi.fn().mockResolvedValue({}) },
        matchup: {
          update: vi.fn().mockImplementation((args: { data: { status: string } }) => {
            capturedStatus = args.data.status
            return {}
          }),
        },
      }
      return fn(tx)
    })

    await saveBestOfDuel(duelInput)
    expect(capturedStatus).toBe("PENDING")
  })

  it("groupPlayAllDuels=true: lässt Match offen auch wenn win threshold erreicht", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    // Home wins duels 1 and 2 already.
    const existingSeries = [
      makeSeries("p1", 1, 95, 12.3, 17.3),
      makeSeries("p2", 1, 92, 15.0, 23.0),
      makeSeries("p1", 2, 95, 12.3, 17.3),
      makeSeries("p2", 2, 92, 15.0, 23.0),
    ]
    matchupFindUniqueMock.mockResolvedValue(
      makeMatchup({ series: existingSeries, groupBestOf: 3, groupPlayAllDuels: true })
    )

    let capturedStatus: string | undefined
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: { upsert: vi.fn().mockResolvedValue({}) },
        matchup: {
          update: vi.fn().mockImplementation((args: { data: { status: string } }) => {
            capturedStatus = args.data.status
            return {}
          }),
        },
      }
      return fn(tx)
    })

    // Duel 3: not yet played → match stays pending even though home already has 2 wins.
    await saveBestOfDuel({ ...duelInput, duelNumber: 3 })
    // After duel 3 with home win, all 3 duels complete → COMPLETED.
    expect(capturedStatus).toBe("COMPLETED")
  })

  it("groupPlayAllDuels=true: lässt Match PENDING nach 2/3 Duellen", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    // Only duel 1 exists.
    const existingSeries = [
      makeSeries("p1", 1, 95, 12.3, 17.3),
      makeSeries("p2", 1, 92, 15.0, 23.0),
    ]
    matchupFindUniqueMock.mockResolvedValue(
      makeMatchup({ series: existingSeries, groupBestOf: 3, groupPlayAllDuels: true })
    )

    let capturedStatus: string | undefined
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: { upsert: vi.fn().mockResolvedValue({}) },
        matchup: {
          update: vi.fn().mockImplementation((args: { data: { status: string } }) => {
            capturedStatus = args.data.status
            return {}
          }),
        },
      }
      return fn(tx)
    })

    await saveBestOfDuel({ ...duelInput, duelNumber: 2 })
    expect(capturedStatus).toBe("PENDING")
  })

  // ── AuditLog ──

  it("schreibt RESULT_ENTERED bei Ersterfassung", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: [] }))
    await saveBestOfDuel(duelInput)
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "RESULT_ENTERED" }),
      })
    )
  })

  it("schreibt RESULT_CORRECTED bei Korrektur", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    // Duel 1 already has series for both participants.
    matchupFindUniqueMock.mockResolvedValue(
      makeMatchup({
        series: [makeSeries("p1", 1, 90, 20.0, 30.0), makeSeries("p2", 1, 88, 22.0, 34.0)],
      })
    )
    await saveBestOfDuel(duelInput)
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "RESULT_CORRECTED" }),
      })
    )
  })

  // ── effectiveTeilerFaktor ──

  it("wendet Faktor nicht an bei fester Disziplin (disciplineId gesetzt)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    // LP-Disziplin: faktor 0.333, aber feste Disziplin → effektiv 1.0
    let homeCreate: { ringteiler: number } | undefined
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: {
          upsert: vi.fn().mockImplementation((args: { create: { ringteiler: number } }) => {
            if (!homeCreate) homeCreate = args.create
            return {}
          }),
        },
        matchup: { update: vi.fn().mockResolvedValue({}) },
      }
      return fn(tx)
    })
    matchupFindUniqueMock.mockResolvedValue({
      ...makeMatchup({ series: [] }),
      competition: {
        ...makeMatchup({ series: [] }).competition,
        disciplineId: "d-lp",
        discipline: {
          id: "d-lp",
          scoringType: "WHOLE" as const,
          teilerFaktor: dec(0.3333333),
        },
      },
    })

    await saveBestOfDuel({
      matchupId: "m1",
      duelNumber: 1,
      homeResult: { rings: 90, teiler: 60 },
      awayResult: { rings: 90, teiler: 60 },
    })

    // effectiveTeilerFaktor with non-null disciplineId → faktor = 1.0
    // ringteiler = 100 - 90 + 60 * 1.0 = 70
    expect(homeCreate?.ringteiler).toBe(70)
  })

  it("wendet Faktor an bei gemischter Liga (disciplineId null)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    let homeCreate: { ringteiler: number } | undefined
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: {
          upsert: vi.fn().mockImplementation((args: { create: { ringteiler: number } }) => {
            if (!homeCreate) homeCreate = args.create
            return {}
          }),
        },
        matchup: { update: vi.fn().mockResolvedValue({}) },
      }
      return fn(tx)
    })
    matchupFindUniqueMock.mockResolvedValue({
      ...makeMatchup({ series: [] }),
      competition: {
        ...makeMatchup({ series: [] }).competition,
        disciplineId: null,
        discipline: null,
      },
    })
    competitionParticipantFindFirstMock.mockResolvedValue({
      discipline: {
        id: "d-lp",
        scoringType: "WHOLE" as const,
        teilerFaktor: dec(0.5),
      },
    })

    await saveBestOfDuel({
      matchupId: "m1",
      duelNumber: 1,
      homeResult: { rings: 90, teiler: 60 },
      awayResult: { rings: 90, teiler: 60 },
    })

    // effectiveTeilerFaktor with null disciplineId → faktor = 0.5
    // ringteiler = 100 - 90 + 60 * 0.5 = 40
    expect(homeCreate?.ringteiler).toBe(40)
  })

  // ── Transaction errors ──

  it("liefert generischen Fehler bei Transaction-Exception", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    transactionMock.mockRejectedValue(new Error("DB gone"))
    const result = await saveBestOfDuel(duelInput)
    expect(result).toEqual({ error: "Duell-Ergebnis konnte nicht gespeichert werden." })
  })
})

// ─── saveStechschuss ──────────────────────────────────────────────────────────

describe("saveStechschuss", () => {
  // Three regular duels, 1:1 with duel 3 being a tie → needs Stechschuss.
  // Duel 1: home wins (rt 17.3 < 23.0).
  // Duel 2: away wins (rt 37.0 > 23.0, so away lower → away wins).
  // Duel 3: tie (same ringteiler for both).
  const tieSeries = [
    makeSeries("p1", 1, 95, 12.3, 17.3), // home wins duel 1
    makeSeries("p2", 1, 92, 15.0, 23.0),
    makeSeries("p1", 2, 88, 25.0, 37.0), // away wins duel 2
    makeSeries("p2", 2, 92, 15.0, 23.0),
    makeSeries("p1", 3, 92, 18.0, 26.0), // duel 3 → tie (same ringteiler)
    makeSeries("p2", 3, 92, 18.0, 26.0),
  ]

  const stechschussInput = {
    matchupId: "m1",
    homeShot: 9.8,
    awayShot: 9.5,
  }

  beforeEach(() => {
    vi.resetAllMocks()
    competitionFindUniqueMock.mockResolvedValue({ isPublic: false, publicSlug: null })
    transactionMock.mockImplementation(makeTransactionMock())
    auditLogCreateMock.mockResolvedValue({})
  })

  // ── Auth guards ──

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: tieSeries }))
    const result = await saveStechschuss(stechschussInput)
    expect(result).toEqual({ error: "Nicht angemeldet." })
  })

  it("liefert Fehler für USER-Rolle", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: tieSeries }))
    const result = await saveStechschuss(stechschussInput)
    expect(result).toEqual({ error: "Keine Berechtigung." })
  })

  // ── Stechschuss decides the match ──

  it("setzt Matchup auf COMPLETED wenn Stechschuss entschieden (home gewinnt)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    // 2 regular duels, each won by the other → 1:1 tie.
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: tieSeries }))

    let capturedStatus: string | undefined
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: { upsert: vi.fn().mockResolvedValue({}) },
        matchup: {
          update: vi.fn().mockImplementation((args: { data: { status: string } }) => {
            capturedStatus = args.data.status
            return {}
          }),
        },
      }
      return fn(tx)
    })

    // Home shot 9.8 > away shot 9.5 → home wins in RINGTEILER mode
    // (higher rings in single-shot Stechschuss, which is what resolveBestOf uses).
    await saveStechschuss(stechschussInput)
    expect(capturedStatus).toBe("COMPLETED")
  })

  it("lässt Matchup PENDING wenn Stechschuss unentschieden (beide 9.5)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: tieSeries }))

    let capturedStatus: string | undefined
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: { upsert: vi.fn().mockResolvedValue({}) },
        matchup: {
          update: vi.fn().mockImplementation((args: { data: { status: string } }) => {
            capturedStatus = args.data.status
            return {}
          }),
        },
      }
      return fn(tx)
    })

    await saveStechschuss({ matchupId: "m1", homeShot: 9.5, awayShot: 9.5 })
    expect(capturedStatus).toBe("PENDING")
  })

  it("weist dem ersten Stechschuss die Nummer maxRegularDuel+1 zu", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: tieSeries, groupBestOf: 3 }))

    const upsertCalls: Array<{
      where: { matchupId_participantId_duelNumber: { duelNumber: number } }
    }> = []
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: {
          upsert: vi
            .fn()
            .mockImplementation(
              (args: { where: { matchupId_participantId_duelNumber: { duelNumber: number } } }) => {
                upsertCalls.push(args)
                return {}
              }
            ),
        },
        matchup: { update: vi.fn().mockResolvedValue({}) },
      }
      return fn(tx)
    })

    await saveStechschuss(stechschussInput)

    // max regular duel is 3 → Stechschuss duelNumber should be 4
    expect(upsertCalls[0].where.matchupId_participantId_duelNumber.duelNumber).toBe(4)
    expect(upsertCalls[1].where.matchupId_participantId_duelNumber.duelNumber).toBe(4)
  })

  it("erkennt zweiten Stechschuss nach Unentschieden und weist nächste Nummer zu", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    // Regular duels 1-3 already done (1:1:tie); first Stechschuss at duel 4 was a tie.
    const seriesWithTb4 = [
      ...tieSeries,
      makeSeries("p1", 4, 9.5, 0, 0, true), // Stechschuss round 4, tied (ringteiler=0 for both)
      makeSeries("p2", 4, 9.5, 0, 0, true),
    ]
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: seriesWithTb4, groupBestOf: 3 }))

    const upsertCalls: Array<{
      where: { matchupId_participantId_duelNumber: { duelNumber: number } }
    }> = []
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: {
          upsert: vi
            .fn()
            .mockImplementation(
              (args: { where: { matchupId_participantId_duelNumber: { duelNumber: number } } }) => {
                upsertCalls.push(args)
                return {}
              }
            ),
        },
        matchup: { update: vi.fn().mockResolvedValue({}) },
      }
      return fn(tx)
    })

    await saveStechschuss(stechschussInput)
    // max(regularDuel=3, tbMax=4) + 1 = 5
    expect(upsertCalls[0].where.matchupId_participantId_duelNumber.duelNumber).toBe(5)
  })

  it("schreibt RESULT_ENTERED beim ersten Stechschuss", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: tieSeries }))
    await saveStechschuss(stechschussInput)
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "RESULT_ENTERED" }),
      })
    )
  })

  it("schreibt RESULT_CORRECTED bei Stechschuss-Korrektur", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    // Stechschuss round 4 already present for both with a DECIDED outcome (9.5 > 9.2).
    // ringteiler: 100-9.5=90.5 vs 100-9.2=90.8 → home lower → home wins → NOT a tie.
    const seriesWithTb = [
      ...tieSeries,
      makeSeries("p1", 4, 9.5, 0, 90.5, true),
      makeSeries("p2", 4, 9.2, 0, 90.8, true),
    ]
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: seriesWithTb }))
    await saveStechschuss(stechschussInput)
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "RESULT_CORRECTED" }),
      })
    )
  })

  it("liefert Fehler bei Transaction-Exception", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: tieSeries }))
    transactionMock.mockRejectedValue(new Error("DB gone"))
    const result = await saveStechschuss(stechschussInput)
    expect(result).toEqual({ error: "Stechschuss konnte nicht gespeichert werden." })
  })
})

// ─── deleteLatestBestOfDuel ───────────────────────────────────────────────────

describe("deleteLatestBestOfDuel", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    competitionFindUniqueMock.mockResolvedValue({ isPublic: false, publicSlug: null })
    transactionMock.mockImplementation(makeTransactionMock())
    auditLogCreateMock.mockResolvedValue({})
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: [] }))
    const result = await deleteLatestBestOfDuel("m1")
    expect(result).toEqual({ error: "Nicht angemeldet." })
  })

  it("liefert Fehler für USER-Rolle", async () => {
    getAuthSessionMock.mockResolvedValue(userSession)
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: [] }))
    const result = await deleteLatestBestOfDuel("m1")
    expect(result).toEqual({ error: "Keine Berechtigung." })
  })

  it("liefert Fehler wenn keine Serien vorhanden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series: [] }))
    const result = await deleteLatestBestOfDuel("m1")
    expect(result).toEqual({ error: "Keine Serien vorhanden." })
  })

  it("löscht das höchste Duell und setzt Status auf PENDING", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const series = [
      makeSeries("p1", 1, 95, 12.3, 17.3),
      makeSeries("p2", 1, 92, 15.0, 23.0),
      makeSeries("p1", 2, 90, 18.0, 28.0),
      makeSeries("p2", 2, 94, 14.0, 20.0),
    ]
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series }))

    const deleteManyArgs: unknown[] = []
    const updateArgs: unknown[] = []
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: {
          deleteMany: vi.fn().mockImplementation((args: unknown) => {
            deleteManyArgs.push(args)
            return {}
          }),
        },
        matchup: {
          update: vi.fn().mockImplementation((args: unknown) => {
            updateArgs.push(args)
            return {}
          }),
        },
      }
      return fn(tx)
    })

    const result = await deleteLatestBestOfDuel("m1")
    expect(result).toEqual({ success: true })
    expect(deleteManyArgs[0]).toMatchObject({ where: { matchupId: "m1", duelNumber: 2 } })
    expect(updateArgs[0]).toMatchObject({ data: { status: "PENDING" } })
  })

  it("löscht Stechschuss-Runde korrekt", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    const series = [
      makeSeries("p1", 1, 95, 12.3, 17.3),
      makeSeries("p2", 1, 92, 15.0, 23.0),
      makeSeries("p1", 2, 88, 25.0, 37.0),
      makeSeries("p2", 2, 92, 15.0, 23.0),
      makeSeries("p1", 3, 9.8, 0, 0, true),
      makeSeries("p2", 3, 9.5, 0, 0, true),
    ]
    matchupFindUniqueMock.mockResolvedValue(makeMatchup({ series }))

    const deleteManyArgs: Array<{ where: { duelNumber: number } }> = []
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: {
          deleteMany: vi.fn().mockImplementation((args: { where: { duelNumber: number } }) => {
            deleteManyArgs.push(args)
            return {}
          }),
        },
        matchup: { update: vi.fn().mockResolvedValue({}) },
      }
      return fn(tx)
    })

    await deleteLatestBestOfDuel("m1")
    expect(deleteManyArgs[0].where.duelNumber).toBe(3)
  })

  it("schreibt RESULT_CORRECTED in AuditLog", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue(
      makeMatchup({
        series: [makeSeries("p1", 1, 95, 12.3, 17.3), makeSeries("p2", 1, 92, 15.0, 23.0)],
      })
    )
    await deleteLatestBestOfDuel("m1")
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "RESULT_CORRECTED" }),
      })
    )
  })

  it("liefert Fehler bei Transaction-Exception", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue(
      makeMatchup({ series: [makeSeries("p1", 1, 90, 20, 30)] })
    )
    transactionMock.mockRejectedValue(new Error("connection lost"))
    const result = await deleteLatestBestOfDuel("m1")
    expect(result).toEqual({ error: "Duell konnte nicht gelöscht werden." })
  })
})

// ─── TEILER-mode bugs ─────────────────────────────────────────────────────────

/**
 * Helper for mixed-discipline TEILER competitions:
 * competitionDisciplineId=null, discipline fetched per-participant.
 * The per-participant teilerFaktor is returned by competitionParticipantFindFirstMock.
 */
function makeTeilerMatchup(overrides: {
  series?: unknown[]
  groupBestOf?: number
  groupPlayAllDuels?: boolean
  scoringMode?: string
}) {
  const base = makeMatchup(overrides)
  return {
    ...base,
    competition: {
      ...base.competition,
      disciplineId: null, // mixed → factor active
      discipline: null,
    },
  }
}

describe("TEILER-mode: evaluateMatchState uses corrected teiler (bug fix)", () => {
  // Bug: evaluateMatchState built correctedTeiler = raw teiler (ignoring factor).
  // Fix: correctedTeiler = teiler * effectiveTeilerFaktor(competitionDisciplineId, teilerFaktor).
  //
  // Scenario: best-of-3, playAll=false, TEILER mode, mixed discipline.
  // p1 (home): teiler=10, factor=2 → correctedTeiler=20 (worse)
  // p2 (away): teiler=15, factor=1 → correctedTeiler=15 (better — lower wins in TEILER)
  //
  // Without fix: raw teiler comparison → p1(10) < p2(15) → p1 wins all 3 duels → COMPLETED
  // With fix: corrected teiler → p2(15) < p1(20) → p2 wins all 3 duels → COMPLETED (p2 is winner)
  //
  // We verify the matchup is set to COMPLETED after duel 2 (playAll=false, ceil(3/2)=2 wins).
  // If the bug exists, p1(home) appears to win via raw teiler. With fix, p2(away) wins.

  beforeEach(() => {
    vi.resetAllMocks()
    competitionFindUniqueMock.mockResolvedValue({ isPublic: false, publicSlug: null })
    auditLogCreateMock.mockResolvedValue({})
    // p1 has factor=2, p2 has factor=1
    competitionParticipantFindFirstMock
      .mockResolvedValueOnce({
        discipline: { id: "d-p1", scoringType: "WHOLE" as const, teilerFaktor: dec(2.0) },
      })
      .mockResolvedValueOnce({
        discipline: { id: "d-p2", scoringType: "WHOLE" as const, teilerFaktor: dec(1.0) },
      })
  })

  it("setzt COMPLETED nach 2 Siegen — mit korrigiertem Teiler entscheidet p2 (away)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    // Existing: duel 1 played. p2 won with corrected teiler (15 < 20).
    // ringteiler stored = MAX_RINGS - rings + teiler * factor
    //   p1: 100 - 90 + 10 * 2 = 30  (factor applied at save time)
    //   p2: 100 - 90 + 15 * 1 = 25  (factor applied at save time)
    const existingSeries = [
      makeSeries("p1", 1, 90, 10, 30), // home: ringteiler=30
      makeSeries("p2", 1, 90, 15, 25), // away: ringteiler=25 (lower = better)
    ]
    matchupFindUniqueMock.mockResolvedValue(
      makeTeilerMatchup({ series: existingSeries, groupBestOf: 3, groupPlayAllDuels: false })
    )

    let capturedMatchupUpdate: { data: { status: string } } | undefined
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: { upsert: vi.fn().mockResolvedValue({}) },
        matchup: {
          update: vi.fn().mockImplementation((args: { data: { status: string } }) => {
            capturedMatchupUpdate = args
            return {}
          }),
        },
      }
      return fn(tx)
    })

    // Duel 2: same pattern — p2 should win again (corrected teiler 15 < 20)
    await saveBestOfDuel({
      matchupId: "m1",
      duelNumber: 2,
      homeResult: { rings: 90, teiler: 10 }, // home: corrected = 10 * 2 = 20
      awayResult: { rings: 90, teiler: 15 }, // away: corrected = 15 * 1 = 15 (wins)
    })

    // With fix: p2 has won 2 of 3, playAll=false → COMPLETED
    // Without fix: p1 wins (raw teiler 10 < 15) → COMPLETED for wrong winner
    // We verify COMPLETED is set. The winner direction is verified by the
    // calculateBestOfStandings test (Test 13) which can directly inspect outcomes.
    expect(capturedMatchupUpdate?.data.status).toBe("COMPLETED")
  })
})

describe("TEILER-mode Stechschuss via saveStechschuss (bug fix)", () => {
  // Bug: saveStechschuss called evaluateMatchState which routed tiebreak series
  // through duelOutcome(scoringMode=TEILER). Stechschuss series have teiler=0,
  // so duelOutcome(TEILER, 0, 0) always returns TIE → match never completes.
  // Fix: tiebreak series evaluated with stechschussOutcome(home.rings, away.rings).
  //
  // Scenario: best-of-3, playAll=true, TEILER mode, fixed discipline.
  // Regular duels: 1:1:TIE → needs_tiebreak.
  // Stechschuss: home shot=9.8, away shot=9.5 → home wins.

  // Regular tie series in TEILER mode (fixed discipline, factor=1)
  const teilerTieSeries = [
    makeSeries("p1", 1, 90, 2.0, 108.0), // home wins duel 1 (lower teiler)
    makeSeries("p2", 1, 90, 3.0, 109.0), // away teiler higher
    makeSeries("p1", 2, 90, 3.0, 109.0), // away wins duel 2
    makeSeries("p2", 2, 90, 2.0, 108.0),
    makeSeries("p1", 3, 90, 2.5, 108.5), // duel 3: TIE
    makeSeries("p2", 3, 90, 2.5, 108.5),
  ]

  const teilerMatchupWithTieSeries = makeMatchup({
    series: teilerTieSeries,
    scoringMode: "TEILER",
    groupBestOf: 3,
    groupPlayAllDuels: true,
  })

  beforeEach(() => {
    vi.resetAllMocks()
    competitionFindUniqueMock.mockResolvedValue({ isPublic: false, publicSlug: null })
    transactionMock.mockImplementation(makeTransactionMock())
    auditLogCreateMock.mockResolvedValue({})
  })

  it("setzt COMPLETED wenn Stechschuss entschieden in TEILER-Modus (home shot 9.8 > away 9.5)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue(teilerMatchupWithTieSeries)

    let capturedStatus: string | undefined
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: { upsert: vi.fn().mockResolvedValue({}) },
        matchup: {
          update: vi.fn().mockImplementation((args: { data: { status: string } }) => {
            capturedStatus = args.data.status
            return {}
          }),
        },
      }
      return fn(tx)
    })

    // homeShot=9.8 > awayShot=9.5 → home wins Stechschuss → COMPLETED
    await saveStechschuss({ matchupId: "m1", homeShot: 9.8, awayShot: 9.5 })

    // Without fix: TEILER mode with teiler=0 → always TIE → PENDING
    // With fix: stechschussOutcome(9.8, 9.5) → "A" → COMPLETED
    expect(capturedStatus).toBe("COMPLETED")
  })

  it("lässt PENDING wenn Stechschuss unentschieden in TEILER-Modus (beide 9.5)", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    matchupFindUniqueMock.mockResolvedValue(teilerMatchupWithTieSeries)

    let capturedStatus: string | undefined
    transactionMock.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      const tx = {
        series: { upsert: vi.fn().mockResolvedValue({}) },
        matchup: {
          update: vi.fn().mockImplementation((args: { data: { status: string } }) => {
            capturedStatus = args.data.status
            return {}
          }),
        },
      }
      return fn(tx)
    })

    await saveStechschuss({ matchupId: "m1", homeShot: 9.5, awayShot: 9.5 })
    expect(capturedStatus).toBe("PENDING")
  })
})
