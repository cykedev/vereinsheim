import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAuthSessionMock,
  revalidatePathMock,
  competitionFindUniqueMock,
  competitionParticipantFindManyMock,
  matchupCountMock,
  matchupDeleteManyMock,
  matchupCreateManyMock,
  transactionMock,
  seriesCountMock,
  playoffMatchCountMock,
  revalidatePublicPdfMock,
} = vi.hoisted(() => ({
  getAuthSessionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  competitionFindUniqueMock: vi.fn(),
  competitionParticipantFindManyMock: vi.fn(),
  matchupCountMock: vi.fn(),
  matchupDeleteManyMock: vi.fn(),
  matchupCreateManyMock: vi.fn(),
  transactionMock: vi.fn(),
  seriesCountMock: vi.fn(),
  playoffMatchCountMock: vi.fn(),
  revalidatePublicPdfMock: vi.fn(),
}))

vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: getAuthSessionMock,
  canManage: (role: string) => role === "ADMIN" || role === "MANAGER",
}))
vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}))
vi.mock("@/lib/competitions/publicPdfCache", () => ({
  revalidatePublicPdf: revalidatePublicPdfMock,
}))
vi.mock("@/lib/db", () => ({
  db: {
    competition: { findUnique: competitionFindUniqueMock },
    competitionParticipant: { findMany: competitionParticipantFindManyMock },
    matchup: {
      count: matchupCountMock,
      deleteMany: matchupDeleteManyMock,
      createMany: matchupCreateManyMock,
    },
    series: { count: seriesCountMock },
    playoffMatch: { count: playoffMatchCountMock },
    $transaction: transactionMock,
  },
}))

import { generateCompetitionSchedule } from "./actions"

const adminSession = { user: { id: "u1", role: "ADMIN" } }

const FOUR_PARTICIPANTS = [
  { participantId: "p1" },
  { participantId: "p2" },
  { participantId: "p3" },
  { participantId: "p4" },
]

// Capture what createMany was called with from within the transaction callback
function captureCreateManyData(): { data: unknown[] } | undefined {
  const calls = matchupCreateManyMock.mock.calls
  if (calls.length === 0) return undefined
  return calls[0][0] as { data: unknown[] }
}

/** No results recorded anywhere — the precondition for (re)generating. */
function noResults() {
  matchupCountMock.mockResolvedValue(0)
  seriesCountMock.mockResolvedValue(0)
  playoffMatchCountMock.mockResolvedValue(0)
}

// The action runs check + delete + create in one interactive transaction; the tx client exposes
// the same mocked delegates as db.
const txClient = {
  matchup: {
    count: matchupCountMock,
    deleteMany: matchupDeleteManyMock,
    createMany: matchupCreateManyMock,
  },
  series: { count: seriesCountMock },
  playoffMatch: { count: playoffMatchCountMock },
}

function setupTransaction() {
  transactionMock.mockImplementation(async (fn: (tx: typeof txClient) => Promise<unknown>) =>
    fn(txClient)
  )
  matchupDeleteManyMock.mockResolvedValue({ count: 0 })
  matchupCreateManyMock.mockResolvedValue({ count: 0 })
}

// ─── Auth guards ──────────────────────────────────────────────────────────────

describe("generateCompetitionSchedule — auth guards", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("liefert Fehler ohne Session", async () => {
    getAuthSessionMock.mockResolvedValue(null)
    const result = await generateCompetitionSchedule("c1")
    expect(result).toEqual({ error: "Nicht angemeldet." })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn kein Manager", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "u2", role: "USER" } })
    const result = await generateCompetitionSchedule("c1")
    expect(result).toEqual({ error: "Keine Berechtigung." })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn Wettbewerb nicht gefunden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue(null)
    const result = await generateCompetitionSchedule("c99")
    expect(result).toEqual({ error: "Liga nicht gefunden." })
  })

  it("liefert Fehler wenn Wettbewerb nicht ACTIVE ist", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      status: "DRAFT",
      leagueFormat: "DOUBLE_ROUND_ROBIN",
      hinrundeDeadline: null,
      rueckrundeDeadline: null,
    })
    const result = await generateCompetitionSchedule("c1")
    expect(result).toMatchObject({ error: expect.stringContaining("aktive") })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn weniger als 4 Teilnehmer", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      status: "ACTIVE",
      leagueFormat: "DOUBLE_ROUND_ROBIN",
      hinrundeDeadline: null,
      rueckrundeDeadline: null,
    })
    competitionParticipantFindManyMock.mockResolvedValue([
      { participantId: "p1" },
      { participantId: "p2" },
      { participantId: "p3" },
    ])
    noResults()
    const result = await generateCompetitionSchedule("c1")
    expect(result).toMatchObject({ error: expect.stringContaining("4") })
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it("liefert Fehler wenn bereits abgeschlossene Paarungen vorhanden", async () => {
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      status: "ACTIVE",
      leagueFormat: "DOUBLE_ROUND_ROBIN",
      hinrundeDeadline: null,
      rueckrundeDeadline: null,
    })
    competitionParticipantFindManyMock.mockResolvedValue(FOUR_PARTICIPANTS)
    noResults()
    setupTransaction()
    matchupCountMock.mockImplementation(async ({ where }: { where: { status?: string } }) =>
      where.status === "COMPLETED" ? 2 : 0
    )
    const result = await generateCompetitionSchedule("c1")
    expect(result).toMatchObject({
      error: expect.stringContaining("2 Paarung(en) bereits entschieden"),
    })
    expect(matchupDeleteManyMock).not.toHaveBeenCalled()
    expect(matchupCreateManyMock).not.toHaveBeenCalled()
  })
})

// ─── BEST_OF_SINGLE ───────────────────────────────────────────────────────────

describe("generateCompetitionSchedule — BEST_OF_SINGLE", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      status: "ACTIVE",
      leagueFormat: "BEST_OF_SINGLE",
      hinrundeDeadline: null,
      rueckrundeDeadline: null,
    })
    competitionParticipantFindManyMock.mockResolvedValue(FOUR_PARTICIPANTS)
    noResults()
    setupTransaction()
  })

  it("erzeugt genau 6 Paarungen für 4 Teilnehmer (Single Round-Robin)", async () => {
    const result = await generateCompetitionSchedule("c1")
    expect(result).toEqual({ success: true })

    const call = captureCreateManyData()
    expect(call).toBeDefined()
    expect((call!.data as unknown[]).length).toBe(6)
  })

  it("alle Paarungen liegen in der Hinrunde (FIRST_LEG)", async () => {
    await generateCompetitionSchedule("c1")

    const call = captureCreateManyData()
    const rows = call!.data as Array<{ round: string }>
    expect(rows.every((r) => r.round === "FIRST_LEG")).toBe(true)
  })

  it("kein SECOND_LEG wird erzeugt", async () => {
    await generateCompetitionSchedule("c1")

    const call = captureCreateManyData()
    const rows = call!.data as Array<{ round: string }>
    expect(rows.some((r) => r.round === "SECOND_LEG")).toBe(false)
  })

  it("Paarungen haben Status PENDING (keine Freilose bei 4 Teilnehmern)", async () => {
    await generateCompetitionSchedule("c1")

    const call = captureCreateManyData()
    const rows = call!.data as Array<{ status: string }>
    expect(rows.every((r) => r.status === "PENDING")).toBe(true)
  })

  it("jeder Teilnehmer spielt gegen jeden anderen genau 1x", async () => {
    await generateCompetitionSchedule("c1")

    const call = captureCreateManyData()
    const rows = call!.data as Array<{ homeParticipantId: string; awayParticipantId: string }>
    const pairs = rows.map((r) => [r.homeParticipantId, r.awayParticipantId].sort().join("-"))
    const unique = new Set(pairs)
    // 4 Teilnehmer → 6 eindeutige Paare
    expect(unique.size).toBe(6)
  })

  it("dueDate ist hinrundeDeadline (null wenn nicht gesetzt)", async () => {
    await generateCompetitionSchedule("c1")

    const call = captureCreateManyData()
    const rows = call!.data as Array<{ dueDate: unknown }>
    expect(rows.every((r) => r.dueDate === null)).toBe(true)
  })

  it("Freilos-Paarung erhält status BYE und awayParticipantId null (5 Teilnehmer)", async () => {
    competitionParticipantFindManyMock.mockResolvedValue([
      { participantId: "p1" },
      { participantId: "p2" },
      { participantId: "p3" },
      { participantId: "p4" },
      { participantId: "p5" },
    ])

    await generateCompetitionSchedule("c1")

    const call = captureCreateManyData()
    const rows = call!.data as Array<{
      status: string
      awayParticipantId: string | null
      round: string
    }>
    const byes = rows.filter((r) => r.status === "BYE")
    expect(byes.length).toBe(5) // 5 Freilose (je einer pro Spieltag)
    expect(byes.every((r) => r.awayParticipantId === null)).toBe(true)
    expect(byes.every((r) => r.round === "FIRST_LEG")).toBe(true)
  })

  it("löscht beim Neu-Generieren auch alte Freilose, nicht nur offene Paarungen", async () => {
    // Sonst bleiben BYE-Zeilen stehen und jeder Teilnehmer hat danach zwei Freilose je Runde.
    await generateCompetitionSchedule("c1")
    expect(matchupDeleteManyMock).toHaveBeenCalledWith({
      // series: none — even if a duel slips in between check and delete, it is never deleted
      where: { competitionId: "c1", status: { in: ["PENDING", "BYE"] }, series: { none: {} } },
    })
  })

  it("bricht ab, wenn an einer offenen Paarung schon Duelle eingetragen sind", async () => {
    // Best-of-Paarungen bleiben PENDING, bis alle Duelle entschieden sind. Series.matchupId steht
    // auf ON DELETE SET NULL — ein Löschen ließe die erfassten Serien still verwaisen.
    seriesCountMock.mockResolvedValue(2)
    const result = await generateCompetitionSchedule("c1")
    expect(result).toMatchObject({ error: expect.stringContaining("Ergebnisse erfasst") })
    expect(matchupDeleteManyMock).not.toHaveBeenCalled()
    expect(matchupCreateManyMock).not.toHaveBeenCalled()
  })

  it("bricht bei einem Kampflos-Sieg ab", async () => {
    matchupCountMock.mockImplementation(async ({ where }: { where: { status?: string } }) =>
      where.status === "WALKOVER" ? 1 : 0
    )
    const result = await generateCompetitionSchedule("c1")
    expect(result).toMatchObject({ error: expect.stringContaining("bereits entschieden") })
    expect(matchupDeleteManyMock).not.toHaveBeenCalled()
    expect(matchupCreateManyMock).not.toHaveBeenCalled()
  })

  it("bricht ab, wenn die Playoffs laufen", async () => {
    playoffMatchCountMock.mockResolvedValue(2)
    const result = await generateCompetitionSchedule("c1")
    expect(result).toMatchObject({ error: expect.stringContaining("Playoffs") })
    expect(matchupDeleteManyMock).not.toHaveBeenCalled()
    expect(matchupCreateManyMock).not.toHaveBeenCalled()
  })

  it("zählt Serien über die Paarungen der Liga, nicht über Series.competitionId", async () => {
    // In einer Liga ist Series.competitionId null — ein Filter darauf fände nie eine Serie.
    await generateCompetitionSchedule("c1")
    expect(seriesCountMock).toHaveBeenCalledWith({ where: { matchup: { competitionId: "c1" } } })
    expect(playoffMatchCountMock).toHaveBeenCalledWith({ where: { competitionId: "c1" } })
  })

  it("prüft die Sperre in derselben serialisierbaren Transaktion wie Löschen und Anlegen", async () => {
    await generateCompetitionSchedule("c1")
    expect(transactionMock).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    })
  })

  it("meldet einen Datenbankfehler als Fehlertext statt zu werfen", async () => {
    // z.B. Serialisierungskonflikt, weil parallel ein Duell gespeichert wurde
    transactionMock.mockRejectedValue(new Error("could not serialize access"))
    const result = await generateCompetitionSchedule("c1")
    expect(result).toEqual({
      error: "Spielplan konnte nicht generiert werden. Bitte erneut versuchen.",
    })
  })

  it("invalidiert das öffentliche PDF", async () => {
    await generateCompetitionSchedule("c1")
    expect(revalidatePublicPdfMock).toHaveBeenCalledWith("c1")
  })

  it("revalidatePath wird für schedule und participants aufgerufen", async () => {
    await generateCompetitionSchedule("c1")
    expect(revalidatePathMock).toHaveBeenCalledWith("/competitions/c1/schedule")
    expect(revalidatePathMock).toHaveBeenCalledWith("/competitions/c1/participants")
  })
})

// ─── DOUBLE_ROUND_ROBIN (Regression) ─────────────────────────────────────────

describe("generateCompetitionSchedule — DOUBLE_ROUND_ROBIN regression", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getAuthSessionMock.mockResolvedValue(adminSession)
    competitionFindUniqueMock.mockResolvedValue({
      id: "c1",
      status: "ACTIVE",
      leagueFormat: "DOUBLE_ROUND_ROBIN",
      hinrundeDeadline: null,
      rueckrundeDeadline: null,
    })
    competitionParticipantFindManyMock.mockResolvedValue(FOUR_PARTICIPANTS)
    noResults()
    setupTransaction()
  })

  it("erzeugt 12 Paarungen für 4 Teilnehmer (Hin- + Rückrunde)", async () => {
    const result = await generateCompetitionSchedule("c1")
    expect(result).toEqual({ success: true })

    const call = captureCreateManyData()
    expect((call!.data as unknown[]).length).toBe(12)
  })

  it("erzeugt sowohl FIRST_LEG als auch SECOND_LEG Paarungen", async () => {
    await generateCompetitionSchedule("c1")

    const call = captureCreateManyData()
    const rows = call!.data as Array<{ round: string }>
    const firstLeg = rows.filter((r) => r.round === "FIRST_LEG")
    const secondLeg = rows.filter((r) => r.round === "SECOND_LEG")
    expect(firstLeg.length).toBe(6)
    expect(secondLeg.length).toBe(6)
  })
})
