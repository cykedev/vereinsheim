// Korrekturen in den Playoffs und die nächste Runde: Ringwerk setzt die nächste Runde aus allen Siegern neu nach Rang.
// Ändert eine Korrektur den Ausgang eines Matches (anderer Sieger oder wieder offen), fällt deshalb die ganze nächste
// Runde weg; korrigierbar ist eine Runde nur, solange in der ganzen nächsten Runde kein Duell geschossen ist.
//
// Die Matches liegen in einem Bestand im Speicher; das Mock filtert wie Prisma nach Wettbewerb, Runde, Teilnehmern und
// „hat Duelle“, damit eine Abfrage je Teilnehmer ein anderes Ergebnis liefert als eine je Runde.

import { beforeEach, describe, expect, it, vi } from "vitest"

interface Row {
  id: string
  competitionId: string
  round: string
  participantAId: string
  participantBId: string
  winsA: number
  winsB: number
  status: string
  duels: number
}

const { store, computeDuelOutcome, storedDuelOutcome, getAuthSession, db } = vi.hoisted(() => {
  const store = { matches: [] as Row[] }
  type Where = {
    competitionId?: string
    round?: string
    OR?: Record<string, string>[]
    duels?: { some?: object; none?: object }
  }
  const matches = (where: Where) =>
    store.matches.filter(
      (m) =>
        (!where.competitionId || m.competitionId === where.competitionId) &&
        (!where.round || m.round === where.round) &&
        (!where.OR ||
          where.OR.some((c) => Object.entries(c).every(([k, v]) => m[k as keyof Row] === v))) &&
        (!where.duels?.some || m.duels > 0) &&
        (!where.duels?.none || m.duels === 0)
    )
  const playoffMatch = {
    findFirst: vi.fn(async ({ where }: { where: Where }) => matches(where)[0] ?? null),
    findMany: vi.fn(async ({ where }: { where: Where }) => matches(where)),
    delete: vi.fn(async ({ where }: { where: { id: string } }) => {
      store.matches = store.matches.filter((m) => m.id !== where.id)
    }),
    deleteMany: vi.fn(async ({ where }: { where: Where }) => {
      const gone = new Set(matches(where).map((m) => m.id))
      store.matches = store.matches.filter((m) => !gone.has(m.id))
      return { count: gone.size }
    }),
    update: vi.fn(async () => ({})),
  }
  const tx = {
    playoffMatch,
    playoffDuel: { update: vi.fn(), delete: vi.fn() },
    playoffDuelResult: { upsert: vi.fn(), deleteMany: vi.fn() },
  }
  const db = {
    playoffMatch,
    playoffDuel: { findUnique: vi.fn(), aggregate: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  }
  return {
    store,
    db,
    computeDuelOutcome: vi.fn(),
    storedDuelOutcome: vi.fn(),
    getAuthSession: vi.fn(),
  }
})

vi.mock("@/lib/db", () => ({ db }))
vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession,
  canManage: (role: string) => role === "ADMIN" || role === "MANAGER",
}))
vi.mock("@/lib/competitions/publicPdfCache", () => ({ revalidatePublicPdf: vi.fn() }))
vi.mock("./duelOutcome", () => ({ computeDuelOutcome, storedDuelOutcome }))

import { deleteLastPlayoffDuel } from "./deleteDuel"
import { savePlayoffDuelResult } from "./saveDuel"

const decimal = (n: number) => ({ toNumber: () => n })

/** Viertelfinale q1 (p1 gegen p2, 3:2 für p1) und zwei Halbfinals; s2 mit den Teilnehmern der anderen Viertelfinals */
function bracket({ s2Duels = 0 } = {}) {
  const base = { competitionId: "c1", status: "COMPLETED", winsA: 3, winsB: 2, duels: 5 }
  store.matches = [
    { ...base, id: "q1", round: "QUARTER_FINAL", participantAId: "p1", participantBId: "p2" },
    { ...base, id: "q2", round: "QUARTER_FINAL", participantAId: "p3", participantBId: "p4" },
    { ...base, id: "q3", round: "QUARTER_FINAL", participantAId: "p5", participantBId: "p6" },
    { ...base, id: "q4", round: "QUARTER_FINAL", participantAId: "p7", participantBId: "p8" },
    {
      ...base,
      id: "s1",
      round: "SEMI_FINAL",
      participantAId: "p1",
      participantBId: "p5",
      status: "PENDING",
      winsA: 0,
      winsB: 0,
      duels: 0,
    },
    {
      ...base,
      id: "s2",
      round: "SEMI_FINAL",
      participantAId: "p3",
      participantBId: "p7",
      status: "PENDING",
      winsA: 0,
      winsB: 0,
      duels: s2Duels,
    },
  ]
}

const semis = () => store.matches.filter((m) => m.round === "SEMI_FINAL").map((m) => m.id)

/** das letzte Duell von q1, gewonnen von p1 */
function lastDuelOfQ1() {
  const result = (participantId: string) => ({
    participantId,
    totalRings: decimal(95),
    teiler: decimal(10),
    ringteiler: decimal(15),
  })
  return {
    id: "d5",
    duelNumber: 5,
    isCompleted: true,
    playoffMatchId: "q1",
    results: [result("p1"), result("p2")],
    playoffMatch: {
      id: "q1",
      round: "QUARTER_FINAL",
      winsA: 3,
      winsB: 2,
      status: "COMPLETED",
      competitionId: "c1",
      participantAId: "p1",
      participantA: { firstName: "A", lastName: "Eins" },
      participantBId: "p2",
      participantB: { firstName: "B", lastName: "Zwei" },
      competition: {
        disciplineId: null,
        discipline: null,
        playoffBestOf: 5,
        finalePrimary: "RINGS",
        finaleTiebreaker1: null,
        finaleTiebreaker2: null,
        finaleHasSuddenDeath: true,
      },
    },
  }
}

const correct = (outcome: "A" | "B" | "DRAW") => {
  computeDuelOutcome.mockResolvedValue({ ringteilerA: 15, ringteilerB: 15, outcome })
  return savePlayoffDuelResult({
    duelId: "d5",
    totalRingsA: 95,
    teilerA: 10,
    totalRingsB: 95,
    teilerB: 10,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getAuthSession.mockResolvedValue({ user: { id: "u1", role: "MANAGER" } })
  db.playoffDuel.findUnique.mockResolvedValue(lastDuelOfQ1())
  db.playoffDuel.aggregate.mockResolvedValue({ _max: { duelNumber: 5 } })
  storedDuelOutcome.mockReturnValue("A")
})

describe("Korrektur im Viertelfinale", () => {
  it("dreht den Sieger, das Match bleibt fertig: die ganze nächste Runde fällt weg", async () => {
    bracket()
    expect(await correct("B")).toEqual({ success: true })
    expect(semis()).toEqual([])
  })

  it("öffnet das Match wieder: die ganze nächste Runde fällt weg, nicht nur das Halbfinale mit diesen Teilnehmern", async () => {
    bracket()
    expect(await correct("DRAW")).toEqual({ success: true })
    expect(semis()).toEqual([])
  })

  it("bestätigt den Sieger: die nächste Runde bleibt", async () => {
    bracket()
    expect(await correct("A")).toEqual({ success: true })
    expect(semis()).toEqual(["s1", "s2"])
  })

  it("ist gesperrt, sobald irgendwo in der nächsten Runde ein Duell geschossen ist", async () => {
    bracket({ s2Duels: 1 })
    const result = await correct("B")
    expect(result).toMatchObject({ error: expect.stringContaining("nächsten Runde") })
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(semis()).toEqual(["s1", "s2"])
  })
})

describe("letztes Duell im Viertelfinale löschen", () => {
  beforeEach(() => {
    const duel = lastDuelOfQ1()
    db.playoffDuel.findUnique.mockResolvedValue({ ...duel, playoffMatch: { ...duel.playoffMatch } })
  })

  it("öffnet das Match wieder: die ganze nächste Runde fällt weg", async () => {
    bracket()
    expect(await deleteLastPlayoffDuel("d5")).toEqual({ success: true })
    expect(semis()).toEqual([])
  })

  it("ist gesperrt, sobald irgendwo in der nächsten Runde ein Duell geschossen ist", async () => {
    bracket({ s2Duels: 1 })
    const result = await deleteLastPlayoffDuel("d5")
    expect(result).toMatchObject({ error: expect.stringContaining("nächsten Runde") })
    expect(semis()).toEqual(["s1", "s2"])
  })
})
