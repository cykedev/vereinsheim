// Korrekturen in den Playoffs und die nächste Runde: Ringwerk setzt die nächste Runde aus allen Siegern neu nach Rang.
// Ändert eine Korrektur den Ausgang eines Matches (anderer Sieger oder wieder offen), fällt deshalb die ganze nächste
// Runde weg; korrigierbar ist eine Runde nur, solange in der ganzen nächsten Runde kein Duell angelegt ist.
//
// Die Matches liegen in einem Bestand im Speicher; das Mock filtert wie Prisma nach Wettbewerb, Runde, Teilnehmern und
// „hat Duelle“, damit eine Abfrage je Teilnehmer ein anderes Ergebnis liefert als eine je Runde. Sperre und Entfernen
// laufen nur über den Client der Transaktion; `db.playoffMatch` direkt zu nutzen ist ein Fehler.

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

const { store, computeDuelOutcome, storedDuelOutcome, getAuthSession, db, tx } = vi.hoisted(() => {
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
  const outside = () => {
    throw new Error("Folge-Runde außerhalb der Transaktion gelesen oder geschrieben")
  }
  const tx = {
    playoffMatch: {
      findFirst: vi.fn(async ({ where }: { where: Where }) => matches(where)[0] ?? null),
      deleteMany: vi.fn(async ({ where }: { where: Where }) => {
        const gone = new Set(matches(where).map((m) => m.id))
        store.matches = store.matches.filter((m) => !gone.has(m.id))
        return { count: gone.size }
      }),
      update: vi.fn(async () => ({})),
    },
    playoffDuel: { update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    playoffDuelResult: { upsert: vi.fn(), deleteMany: vi.fn() },
  }
  const db = {
    playoffMatch: {
      findFirst: vi.fn(outside),
      findMany: vi.fn(outside),
      deleteMany: vi.fn(outside),
    },
    playoffDuel: { findUnique: vi.fn(), aggregate: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  }
  return {
    store,
    db,
    tx,
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

/**
 * Viertelfinale q1 (p1 gegen p2, Best-of-5) und zwei Halbfinals; s2 mit den Teilnehmern der anderen Viertelfinals.
 * Mit `final` steht auch das Finale (aus s1 und s2).
 */
function bracket({ s2Duels = 0, final = false, finalDuels = 0 } = {}) {
  const done = { competitionId: "c1", status: "COMPLETED", winsA: 3, winsB: 2, duels: 5 }
  const open = { competitionId: "c1", status: "PENDING", winsA: 0, winsB: 0, duels: 0 }
  store.matches = [
    { ...done, id: "q1", round: "QUARTER_FINAL", participantAId: "p1", participantBId: "p2" },
    { ...done, id: "q2", round: "QUARTER_FINAL", participantAId: "p3", participantBId: "p4" },
    { ...done, id: "q3", round: "QUARTER_FINAL", participantAId: "p5", participantBId: "p6" },
    { ...done, id: "q4", round: "QUARTER_FINAL", participantAId: "p7", participantBId: "p8" },
    { ...open, id: "s1", round: "SEMI_FINAL", participantAId: "p1", participantBId: "p5" },
    {
      ...open,
      id: "s2",
      round: "SEMI_FINAL",
      participantAId: "p3",
      participantBId: "p7",
      duels: s2Duels,
    },
    ...(final
      ? [
          {
            ...open,
            id: "f",
            round: "FINAL",
            participantAId: "p1",
            participantBId: "p3",
            duels: finalDuels,
          },
        ]
      : []),
  ]
}

const roundIds = (round: string) => store.matches.filter((m) => m.round === round).map((m) => m.id)

/** das letzte Duell eines Matches mit Stand `winsA:winsB`; gewonnen von `winner` (Ringteiler kleiner) */
function lastDuel({
  matchId = "q1",
  round = "QUARTER_FINAL",
  a = "p1",
  b = "p2",
  winsA = 3,
  winsB = 2,
  winner = "A",
}: Partial<{
  matchId: string
  round: string
  a: string
  b: string
  winsA: number
  winsB: number
  winner: "A" | "B"
}> = {}) {
  const result = (participantId: string, ringteiler: number) => ({
    participantId,
    totalRings: decimal(95),
    teiler: decimal(10),
    ringteiler: decimal(ringteiler),
  })
  return {
    id: "d5",
    duelNumber: 5,
    isCompleted: true,
    playoffMatchId: matchId,
    results: [result(a, winner === "A" ? 10 : 20), result(b, winner === "A" ? 20 : 10)],
    playoffMatch: {
      id: matchId,
      round,
      winsA,
      winsB,
      status: "COMPLETED",
      competitionId: "c1",
      participantAId: a,
      participantA: { firstName: "A", lastName: "Eins" },
      participantBId: b,
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

/** Korrektur des letzten Duells: vorher gewann `before`, jetzt ergibt sie `outcome` */
const correct = (outcome: "A" | "B" | "DRAW", before: "A" | "B" = "A") => {
  storedDuelOutcome.mockReturnValue(before)
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
  db.playoffDuel.findUnique.mockResolvedValue(lastDuel())
  db.playoffDuel.aggregate.mockResolvedValue({ _max: { duelNumber: 5 } })
})

describe("Korrektur im Viertelfinale", () => {
  it("dreht den Sieger, das Match bleibt fertig: die ganze nächste Runde fällt weg", async () => {
    bracket()
    expect(await correct("B")).toEqual({ success: true })
    expect(roundIds("SEMI_FINAL")).toEqual([])
  })

  it("öffnet das Match wieder: die ganze nächste Runde fällt weg, nicht nur das Halbfinale mit diesen Teilnehmern", async () => {
    bracket()
    expect(await correct("DRAW")).toEqual({ success: true })
    expect(roundIds("SEMI_FINAL")).toEqual([])
    expect(tx.playoffMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { winsA: 2, winsB: 2, status: "PENDING" } })
    )
  })

  it("bestätigt den Sieger: die nächste Runde bleibt", async () => {
    bracket()
    expect(await correct("A")).toEqual({ success: true })
    expect(roundIds("SEMI_FINAL")).toEqual(["s1", "s2"])
  })

  it("macht aus einem Sieg der unterlegenen Seite ein Unentschieden: das Match bleibt entschieden (3:1), die nächste Runde bleibt", async () => {
    bracket()
    expect(await correct("DRAW", "B")).toEqual({ success: true })
    expect(tx.playoffMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { winsA: 3, winsB: 1, status: "COMPLETED" } })
    )
    expect(roundIds("SEMI_FINAL")).toEqual(["s1", "s2"])
  })

  it("ist gesperrt, sobald irgendwo in der nächsten Runde ein Duell angelegt ist", async () => {
    bracket({ s2Duels: 1 })
    const result = await correct("B")
    expect(result).toMatchObject({ error: expect.stringContaining("nächsten Runde") })
    expect(tx.playoffDuelResult.upsert).not.toHaveBeenCalled()
    expect(roundIds("SEMI_FINAL")).toEqual(["s1", "s2"])
  })

  it("lehnt eine Korrektur ab, nach der beide Seiten genug Siege hätten", async () => {
    bracket()
    db.playoffDuel.findUnique.mockResolvedValue(lastDuel({ winsA: 3, winsB: 2 }))
    // 3:2, das Duell war ein Unentschieden und wird ein Sieg für B: 3:3
    storedDuelOutcome.mockReturnValue("DRAW")
    computeDuelOutcome.mockResolvedValue({ ringteilerA: 20, ringteilerB: 10, outcome: "B" })
    const result = await savePlayoffDuelResult({
      duelId: "d5",
      totalRingsA: 90,
      teilerA: 20,
      totalRingsB: 98,
      teilerB: 5,
    })
    expect(result).toMatchObject({ error: expect.stringContaining("beide Seiten") })
    expect(db.$transaction).not.toHaveBeenCalled()
  })
})

describe("Korrektur im Halbfinale und im Finale", () => {
  const semi = { matchId: "s1", round: "SEMI_FINAL", a: "p1", b: "p5", winsA: 3, winsB: 0 }

  it("Halbfinale ist gesperrt, sobald das Finale ein Duell hat", async () => {
    bracket({ final: true, finalDuels: 1 })
    db.playoffDuel.findUnique.mockResolvedValue(lastDuel(semi))
    expect(await correct("B")).toMatchObject({ error: expect.stringContaining("nächsten Runde") })
    expect(roundIds("FINAL")).toEqual(["f"])
  })

  it("Halbfinale mit anderem Sieger entfernt das noch leere Finale", async () => {
    bracket({ final: true })
    db.playoffDuel.findUnique.mockResolvedValue(lastDuel({ ...semi, winsA: 3, winsB: 2 }))
    expect(await correct("B")).toEqual({ success: true })
    expect(roundIds("FINAL")).toEqual([])
  })

  it("Finale: eine Korrektur entfernt nichts", async () => {
    bracket({ final: true, finalDuels: 1 })
    db.playoffDuel.findUnique.mockResolvedValue(
      lastDuel({ matchId: "f", round: "FINAL", a: "p1", b: "p3", winsA: 1, winsB: 0 })
    )
    expect(await correct("B")).toEqual({ success: true })
    expect(tx.playoffMatch.deleteMany).not.toHaveBeenCalled()
    expect(roundIds("FINAL")).toEqual(["f"])
  })
})

describe("letztes Duell im Viertelfinale löschen", () => {
  it("öffnet das Match wieder (3:2 → 2:2): die ganze nächste Runde fällt weg", async () => {
    bracket()
    storedDuelOutcome.mockReturnValue("A")
    expect(await deleteLastPlayoffDuel("d5")).toEqual({ success: true })
    expect(roundIds("SEMI_FINAL")).toEqual([])
    expect(tx.playoffMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { winsA: 2, winsB: 2, status: "PENDING" } })
    )
  })

  it("die übrigen Siege entscheiden noch (3:2 → 3:1): Match bleibt fertig, die nächste Runde bleibt", async () => {
    bracket()
    db.playoffDuel.findUnique.mockResolvedValue(lastDuel({ winner: "B" }))
    storedDuelOutcome.mockReturnValue("B")
    expect(await deleteLastPlayoffDuel("d5")).toEqual({ success: true })
    expect(tx.playoffMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { winsA: 3, winsB: 1, status: "COMPLETED" } })
    )
    expect(roundIds("SEMI_FINAL")).toEqual(["s1", "s2"])
  })

  it("ist gesperrt, sobald irgendwo in der nächsten Runde ein Duell angelegt ist", async () => {
    bracket({ s2Duels: 1 })
    const result = await deleteLastPlayoffDuel("d5")
    expect(result).toMatchObject({ error: expect.stringContaining("nächsten Runde") })
    expect(tx.playoffDuel.delete).not.toHaveBeenCalled()
    expect(roundIds("SEMI_FINAL")).toEqual(["s1", "s2"])
  })
})

describe("Finale löschen und neue Eingaben", () => {
  it("Löschen im Finale zählt das Duell mit der Wertung des Finales zurück (Stichkriterien)", async () => {
    bracket({ final: true, finalDuels: 1 })
    const duel = lastDuel({ matchId: "f", round: "FINAL", a: "p1", b: "p3", winsA: 1, winsB: 0 })
    duel.playoffMatch.competition.finaleTiebreaker1 = "TEILER" as never
    db.playoffDuel.findUnique.mockResolvedValue(duel)
    storedDuelOutcome.mockReturnValue("A")
    expect(await deleteLastPlayoffDuel("d5")).toEqual({ success: true })
    expect(storedDuelOutcome).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      true,
      "RINGS",
      "TEILER",
      null
    )
    expect(tx.playoffMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { winsA: 0, winsB: 0, status: "PENDING" } })
    )
  })

  it("lehnt ein weiteres Duell in einem entschiedenen Match ab", async () => {
    bracket()
    const duel = lastDuel()
    db.playoffDuel.findUnique.mockResolvedValue({ ...duel, isCompleted: false, results: [] })
    computeDuelOutcome.mockResolvedValue({ ringteilerA: 15, ringteilerB: 20, outcome: "B" })
    const result = await savePlayoffDuelResult({
      duelId: "d5",
      totalRingsA: 95,
      teilerA: 10,
      totalRingsB: 95,
      teilerB: 10,
    })
    expect(result).toMatchObject({ error: expect.stringContaining("schon entschieden") })
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it("entscheidet ein Match: offene Duelle dieses Matches fallen weg", async () => {
    bracket()
    const duel = lastDuel({ winsA: 2, winsB: 2 })
    duel.playoffMatch.status = "PENDING"
    db.playoffDuel.findUnique.mockResolvedValue({ ...duel, isCompleted: false, results: [] })
    computeDuelOutcome.mockResolvedValue({ ringteilerA: 10, ringteilerB: 20, outcome: "A" })
    expect(
      await savePlayoffDuelResult({
        duelId: "d5",
        totalRingsA: 98,
        teilerA: 5,
        totalRingsB: 90,
        teilerB: 30,
      })
    ).toEqual({
      success: true,
    })
    expect(tx.playoffDuel.deleteMany).toHaveBeenCalledWith({
      where: { playoffMatchId: "q1", isCompleted: false },
    })
  })

  it("ein neues Unentschieden lässt das Match offen und legt das nächste Duell an", async () => {
    bracket()
    const duel = lastDuel({ winsA: 2, winsB: 2 })
    duel.playoffMatch.status = "PENDING"
    db.playoffDuel.findUnique.mockResolvedValue({ ...duel, isCompleted: false, results: [] })
    db.playoffDuel.findFirst.mockResolvedValue({ duelNumber: 5 })
    computeDuelOutcome.mockResolvedValue({ ringteilerA: 15, ringteilerB: 15, outcome: "DRAW" })
    expect(
      await savePlayoffDuelResult({
        duelId: "d5",
        totalRingsA: 95,
        teilerA: 10,
        totalRingsB: 95,
        teilerB: 10,
      })
    ).toEqual({
      success: true,
    })
    expect(tx.playoffMatch.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { winsA: 2, winsB: 2, status: "PENDING" } })
    )
    expect(db.playoffDuel.create).toHaveBeenCalledWith({
      data: { playoffMatchId: "q1", duelNumber: 6, isSuddenDeath: false },
    })
  })

  it("schreibt in einer serialisierbaren Transaktion", async () => {
    bracket()
    await correct("B")
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    })
  })
})
