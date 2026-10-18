// Eintragen, Korrigieren und Löschen von Playoff-Duellen auf einem Nachbau von Prisma (`playoffFake.ts`). Der Siegstand
// ist eine Folge der fertigen Duelle: Ringwerk zählt ihn in der Transaktion neu, statt einen vorab gelesenen Stand zu
// verschieben. Die nächste Runde entsteht aus allen Siegern neu nach Rang; ändert eine Korrektur den Ausgang eines
// Matches, fällt sie deshalb ganz weg, und korrigierbar ist eine Runde nur, solange die nächste kein Duell hat.

import { beforeEach, describe, expect, it, vi } from "vitest"

import type { FakeDuel } from "./playoffFake"

const { fake, computeDuelOutcome, getAuthSession } = vi.hoisted(() => ({
  fake: {
    current: undefined as unknown as ReturnType<typeof import("./playoffFake").createPlayoffFake>,
  },
  computeDuelOutcome: vi.fn(),
  getAuthSession: vi.fn(),
}))

vi.mock("@/lib/db", () => ({
  get db() {
    return fake.current.db
  },
}))
vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession,
  canManage: (role: string) => role === "ADMIN" || role === "MANAGER",
}))
vi.mock("@/lib/competitions/publicPdfCache", () => ({ revalidatePublicPdf: vi.fn() }))
vi.mock("./duelOutcome", async (original) => ({
  ...(await original<typeof import("./duelOutcome")>()),
  computeDuelOutcome,
}))

import { deleteLastPlayoffDuel } from "./deleteDuel"
import { addPlayoffDuel } from "./manualDuel"
import { createPlayoffFake } from "./playoffFake"
import { savePlayoffDuelResult } from "./saveDuel"

type Outcome = "A" | "B" | "DRAW"
const RINGTEILER: Record<Outcome, [number, number]> = { A: [10, 20], B: [20, 10], DRAW: [15, 15] }

let rules = {
  playoffBestOf: 5,
  finalePrimary: "RINGS",
  finaleTiebreaker1: null as string | null,
  finaleTiebreaker2: null as string | null,
  finaleHasSuddenDeath: true,
}

/** was `savePlayoffDuelResult` und `deleteLastPlayoffDuel` vorab lesen: das Duell mit Match und Regeln */
function loaded(duelId: string) {
  const { store } = fake.current
  const duel = store.duels.find((d) => d.id === duelId)!
  const match = store.matches.find((m) => m.id === duel.playoffMatchId)!
  const decimal = (n: number | null) => (n === null ? null : { toNumber: () => n })
  return {
    ...duel,
    results: duel.results.map((r) => ({
      ...r,
      totalRings: decimal(r.totalRings),
      teiler: decimal(r.teiler),
      ringteiler: decimal(r.ringteiler),
    })),
    playoffMatch: {
      ...match,
      participantA: { firstName: "A", lastName: match.participantAId },
      participantB: { firstName: "B", lastName: match.participantBId },
      competition: { disciplineId: null, discipline: null, ...rules },
    },
  }
}

const duelOf = (matchId: string, n: number) => `${matchId}-d${n}`

/** ein Duell eintragen oder korrigieren; `snapshot` statt frisch gelesen, um gleichzeitiges Speichern nachzustellen */
function save(duelId: string, outcome: Outcome, snapshot = loaded(duelId)) {
  fake.current.db.playoffDuel.findUnique.mockResolvedValue(snapshot)
  const [rtA, rtB] = RINGTEILER[outcome]
  computeDuelOutcome.mockResolvedValue({ ringteilerA: rtA, ringteilerB: rtB, outcome })
  return savePlayoffDuelResult({
    duelId,
    totalRingsA: 120 - rtA,
    teilerA: 5,
    totalRingsB: 120 - rtB,
    teilerB: 5,
  })
}

function remove(duelId: string) {
  fake.current.db.playoffDuel.findUnique.mockResolvedValue(loaded(duelId))
  return deleteLastPlayoffDuel(duelId)
}

const match = (id: string) => fake.current.store.matches.find((m) => m.id === id)!
const stand = (id: string) => `${match(id).winsA}:${match(id).winsB} ${match(id).status}`
const round = (r: string) =>
  fake.current.store.matches.filter((m) => m.round === r).map((m) => m.id)
const duels = (matchId: string): FakeDuel[] =>
  fake.current.store.duels.filter((d) => d.playoffMatchId === matchId)

/** Viertelfinale q1 3:2 (A B A B A) und drei weitere, dazu zwei leere Halbfinals; wahlweise mit Finale */
function bracket({ s2Duels = 0, final = false, finalDuels = [] as Outcome[] } = {}) {
  const { addMatch } = fake.current
  const done = { status: "COMPLETED" }
  const qf = (id: string, a: string, b: string, outcomes: Outcome[]) =>
    addMatch({ id, round: "QUARTER_FINAL", participantAId: a, participantBId: b }, outcomes, done)
  qf("q1", "p1", "p2", ["A", "B", "A", "B", "A"])
  qf("q2", "p3", "p4", ["A", "A", "A"])
  qf("q3", "p5", "p6", ["A", "A", "A"])
  qf("q4", "p7", "p8", ["A", "A", "A"])
  const semi = { round: "SEMI_FINAL" }
  if (final) {
    addMatch(
      { id: "s1", ...semi, participantAId: "p1", participantBId: "p5" },
      ["A", "A", "A"],
      done
    )
    addMatch(
      { id: "s2", ...semi, participantAId: "p3", participantBId: "p7" },
      ["A", "A", "A"],
      done
    )
    const decided = finalDuels.includes("A") || finalDuels.includes("B")
    addMatch({ id: "f", round: "FINAL", participantAId: "p1", participantBId: "p3" }, finalDuels, {
      status: decided ? "COMPLETED" : "PENDING",
    })
  } else {
    addMatch({ id: "s1", ...semi, participantAId: "p1", participantBId: "p5" })
    addMatch(
      { id: "s2", ...semi, participantAId: "p3", participantBId: "p7" },
      Array(s2Duels).fill("offen")
    )
  }
}

/** Finale p1 gegen p3 mit den gegebenen Duellen; `sd` markiert die Duelle ab dieser Nummer als Verlängerung */
const final = (outcomes: ("A" | "B" | "DRAW" | "offen")[], status = "PENDING", sd = 2) => {
  fake.current.addMatch(
    { id: "f", round: "FINAL", participantAId: "p1", participantBId: "p3" },
    outcomes,
    { status }
  )
  for (const d of duels("f")) d.isSuddenDeath = d.duelNumber >= sd
}
const finalDuels = () => duels("f").map((d) => [d.duelNumber, d.isSuddenDeath, d.isCompleted])

const qf1 = (outcomes: ("A" | "B" | "DRAW" | "offen")[], status = "PENDING") =>
  fake.current.addMatch(
    { id: "q1", round: "QUARTER_FINAL", participantAId: "p1", participantBId: "p2" },
    outcomes,
    { status }
  )

beforeEach(() => {
  vi.clearAllMocks()
  fake.current = createPlayoffFake()
  rules = { ...rules, finaleTiebreaker1: null, finaleHasSuddenDeath: true }
  getAuthSession.mockResolvedValue({ user: { id: "u1", role: "MANAGER" } })
})

describe("Korrektur im Viertelfinale", () => {
  it("dreht den Sieger, das Match bleibt fertig: die ganze nächste Runde fällt weg", async () => {
    bracket()
    expect(await save(duelOf("q1", 5), "B")).toEqual({ success: true })
    expect(stand("q1")).toBe("2:3 COMPLETED")
    expect(round("SEMI_FINAL")).toEqual([])
  })

  it("öffnet das Match wieder: die ganze nächste Runde fällt weg, nicht nur das Halbfinale mit diesen Teilnehmern", async () => {
    bracket()
    expect(await save(duelOf("q1", 5), "DRAW")).toEqual({ success: true })
    expect(stand("q1")).toBe("2:2 PENDING")
    expect(round("SEMI_FINAL")).toEqual([])
  })

  it("bestätigt den Sieger: die nächste Runde bleibt", async () => {
    bracket()
    expect(await save(duelOf("q1", 5), "A")).toEqual({ success: true })
    expect(round("SEMI_FINAL")).toEqual(["s1", "s2"])
  })

  it("macht aus einem Sieg der unterlegenen Seite ein Unentschieden: bleibt entschieden (3:1), die nächste Runde bleibt", async () => {
    bracket()
    expect(await save(duelOf("q1", 2), "DRAW")).toEqual({ success: true })
    expect(stand("q1")).toBe("3:1 COMPLETED")
    expect(round("SEMI_FINAL")).toEqual(["s1", "s2"])
  })

  it("ist gesperrt, sobald irgendwo in der nächsten Runde ein Duell angelegt ist", async () => {
    bracket({ s2Duels: 1 })
    expect(await save(duelOf("q1", 5), "B")).toMatchObject({
      error: expect.stringContaining("nächsten Runde"),
    })
    expect(stand("q1")).toBe("3:2 COMPLETED")
    expect(duels("q1")[4].results[0].ringteiler).toBe(10)
    expect(round("SEMI_FINAL")).toEqual(["s1", "s2"])
  })

  it("lehnt eine Korrektur ab, nach der beide Seiten genug Siege hätten", async () => {
    qf1(["A", "B", "A", "B", "DRAW", "A"], "COMPLETED")
    expect(await save(duelOf("q1", 5), "B")).toMatchObject({
      error: expect.stringContaining("beide Seiten"),
    })
    expect(stand("q1")).toBe("3:2 COMPLETED")
  })
})

describe("Halbfinale und Finale", () => {
  it("Halbfinale ist gesperrt, sobald das Finale ein Duell hat", async () => {
    bracket({ final: true, finalDuels: ["A"] })
    expect(await save(duelOf("s1", 3), "B")).toMatchObject({
      error: expect.stringContaining("nächsten Runde"),
    })
    expect(round("FINAL")).toEqual(["f"])
  })

  it("Halbfinale wieder offen: das noch leere Finale fällt weg", async () => {
    bracket({ final: true })
    expect(await save(duelOf("s1", 3), "B")).toEqual({ success: true })
    expect(stand("s1")).toBe("2:1 PENDING")
    expect(round("FINAL")).toEqual([])
  })

  it("Finale: eine Korrektur entfernt nichts", async () => {
    bracket({ final: true, finalDuels: ["A"] })
    expect(await save(duelOf("f", 1), "B")).toEqual({ success: true })
    expect(stand("f")).toBe("0:1 COMPLETED")
    expect(round("FINAL")).toEqual(["f"])
  })

  it("Finale zum Unentschieden korrigiert: es bekommt die Verlängerung", async () => {
    bracket({ final: true, finalDuels: ["A"] })
    expect(await save(duelOf("f", 1), "DRAW")).toEqual({ success: true })
    expect(stand("f")).toBe("0:0 PENDING")
    expect(duels("f").map((d) => [d.duelNumber, d.isSuddenDeath, d.isCompleted])).toEqual([
      [1, false, true],
      [2, true, false],
    ])
  })

  it("Finale ohne Verlängerung im Regelwerk: kein weiteres Duell", async () => {
    rules.finaleHasSuddenDeath = false
    bracket({ final: true, finalDuels: ["A"] })
    expect(await save(duelOf("f", 1), "DRAW")).toEqual({ success: true })
    expect(duels("f")).toHaveLength(1)
  })
})

describe("neue Eingaben", () => {
  it("ein weiteres Duell in einem entschiedenen Match zählt nicht", async () => {
    qf1(["A", "A", "A", "offen"], "COMPLETED")
    expect(await save(duelOf("q1", 4), "B")).toMatchObject({
      error: expect.stringContaining("schon entschieden"),
    })
    expect(stand("q1")).toBe("3:0 COMPLETED")
  })

  it("entscheidet ein Match: seine offenen Duelle fallen weg", async () => {
    qf1(["A", "A", "offen", "offen"])
    expect(await save(duelOf("q1", 3), "A")).toEqual({ success: true })
    expect(stand("q1")).toBe("3:0 COMPLETED")
    expect(duels("q1").map((d) => d.duelNumber)).toEqual([1, 2, 3])
  })

  it("ein Unentschieden lässt das Match offen und legt das nächste Duell an", async () => {
    qf1(["A", "B", "offen"])
    expect(await save(duelOf("q1", 3), "DRAW")).toEqual({ success: true })
    expect(stand("q1")).toBe("1:1 PENDING")
    expect(duels("q1").map((d) => [d.duelNumber, d.isCompleted])).toEqual([
      [1, true],
      [2, true],
      [3, true],
      [4, false],
    ])
  })

  it("Finale: ein Unentschieden im ersten Duell bringt die Verlängerung", async () => {
    final(["offen"])
    expect(await save(duelOf("f", 1), "DRAW")).toEqual({ success: true })
    expect(stand("f")).toBe("0:0 PENDING")
    expect(finalDuels()).toEqual([
      [1, false, true],
      [2, true, false],
    ])
  })

  it("Finale: ein Unentschieden in der Verlängerung bringt die nächste", async () => {
    final(["DRAW", "offen"])
    expect(await save(duelOf("f", 2), "DRAW")).toEqual({ success: true })
    expect(stand("f")).toBe("0:0 PENDING")
    expect(finalDuels()).toEqual([
      [1, false, true],
      [2, true, true],
      [3, true, false],
    ])
  })

  it("Finale: ein Sieg entscheidet, kein weiteres Duell", async () => {
    final(["DRAW", "offen"])
    expect(await save(duelOf("f", 2), "B")).toEqual({ success: true })
    expect(stand("f")).toBe("0:1 COMPLETED")
    expect(duels("f")).toHaveLength(2)
  })

  it("Finale ohne Verlängerung im Regelwerk: ein neues Unentschieden bringt kein Duell", async () => {
    rules.finaleHasSuddenDeath = false
    final(["offen"])
    expect(await save(duelOf("f", 1), "DRAW")).toEqual({ success: true })
    expect(finalDuels()).toEqual([[1, false, true]])
  })

  it("schreibt das Protokoll in der Transaktion", async () => {
    qf1(["A", "offen"])
    await save(duelOf("q1", 2), "A")
    expect(fake.current.store.audit).toEqual([{ eventType: "PLAYOFF_RESULT_ENTERED" }])
  })
})

describe("gleichzeitig speichern", () => {
  it("zählt den Siegstand aus den Duellen, auch wenn der vorab gelesene Stand veraltet ist", async () => {
    // 1:1, Duell 3 offen; während Duell 3 eingetragen wird, hat jemand Duell 1 von A zu B korrigiert
    qf1(["A", "B", "offen"])
    const stale = loaded(duelOf("q1", 3))
    duels("q1")[0].results = [
      { participantId: "p1", totalRings: 100, teiler: 5, ringteiler: 20 },
      { participantId: "p2", totalRings: 110, teiler: 5, ringteiler: 10 },
    ]
    Object.assign(match("q1"), { winsA: 0, winsB: 2 })
    expect(await save(duelOf("q1", 3), "A", stale)).toEqual({ success: true })
    expect(stand("q1")).toBe("1:2 PENDING")
  })

  const conflict = () => Object.assign(new Error("Transaction failed"), { code: "P2034" })

  it("wiederholt die Transaktion, wenn Postgres sie wegen einer gleichzeitigen Änderung abbricht", async () => {
    bracket()
    fake.current.db.$transaction.mockRejectedValueOnce(conflict())
    expect(await save(duelOf("q1", 5), "B")).toEqual({ success: true })
    expect(stand("q1")).toBe("2:3 COMPLETED")
    expect(fake.current.db.$transaction).toHaveBeenCalledTimes(2)
  })

  it("meldet eine gleichzeitige Änderung verständlich, wenn sie nach drei Versuchen bleibt", async () => {
    bracket()
    fake.current.db.$transaction.mockRejectedValue(conflict())
    expect(await save(duelOf("q1", 5), "B")).toMatchObject({
      error: expect.stringContaining("gleichzeitig"),
    })
    expect(fake.current.db.$transaction).toHaveBeenCalledTimes(3)
  })

  it("eine schon vergebene Duell-Nummer gilt als gleichzeitige Änderung", async () => {
    qf1(["A", "B"])
    fake.current.db.$transaction.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
    )
    expect(await addPlayoffDuel("q1")).toMatchObject({
      error: expect.stringContaining("gleichzeitig"),
    })
    expect(fake.current.db.$transaction).toHaveBeenCalledTimes(1)
  })

  it("wiederholt andere Fehler nicht", async () => {
    bracket()
    vi.spyOn(console, "error").mockImplementation(() => {})
    fake.current.db.$transaction.mockRejectedValueOnce(new Error("kaputt"))
    expect(await save(duelOf("q1", 5), "B")).toEqual({
      error: "Ergebnis konnte nicht gespeichert werden.",
    })
    expect(fake.current.db.$transaction).toHaveBeenCalledTimes(1)
  })

  it("schreibt in einer serialisierbaren Transaktion", async () => {
    bracket()
    await save(duelOf("q1", 5), "B")
    expect(fake.current.db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    })
  })
})

describe("letztes Duell löschen", () => {
  it("öffnet das Match wieder (3:2 → 2:2): die ganze nächste Runde fällt weg", async () => {
    bracket()
    expect(await remove(duelOf("q1", 5))).toEqual({ success: true })
    expect(stand("q1")).toBe("2:2 PENDING")
    expect(round("SEMI_FINAL")).toEqual([])
  })

  it("die übrigen Siege entscheiden noch: Match bleibt fertig, die nächste Runde bleibt", async () => {
    qf1(["A", "A", "B", "A", "B"], "COMPLETED")
    fake.current.addMatch({
      id: "s1",
      round: "SEMI_FINAL",
      participantAId: "p1",
      participantBId: "p5",
    })
    expect(await remove(duelOf("q1", 5))).toEqual({ success: true })
    expect(stand("q1")).toBe("3:1 COMPLETED")
    expect(round("SEMI_FINAL")).toEqual(["s1"])
  })

  it("Finale: das einzige Duell löschen öffnet es wieder, auch mit Stichkriterium", async () => {
    rules.finaleTiebreaker1 = "TEILER"
    bracket({ final: true, finalDuels: ["A"] })
    expect(await remove(duelOf("f", 1))).toEqual({ success: true })
    expect(stand("f")).toBe("0:0 PENDING")
    expect(duels("f")).toHaveLength(0)
  })

  it("Finale: die entscheidende Verlängerung löschen legt sie offen neu an", async () => {
    final(["DRAW", "A"], "COMPLETED")
    expect(await remove(duelOf("f", 2))).toEqual({ success: true })
    expect(stand("f")).toBe("0:0 PENDING")
    expect(finalDuels()).toEqual([
      [1, false, true],
      [2, true, false],
    ])
  })

  it("ist gesperrt, sobald irgendwo in der nächsten Runde ein Duell angelegt ist", async () => {
    bracket({ s2Duels: 1 })
    expect(await remove(duelOf("q1", 5))).toMatchObject({
      error: expect.stringContaining("nächsten Runde"),
    })
    expect(duels("q1")).toHaveLength(5)
    expect(round("SEMI_FINAL")).toEqual(["s1", "s2"])
  })
})

describe("Duell anlegen", () => {
  it("legt in einem offenen Match das nächste Duell an", async () => {
    qf1(["A", "B"])
    expect(await addPlayoffDuel("q1")).toMatchObject({ success: true })
    expect(duels("q1").map((d) => [d.duelNumber, d.isCompleted])).toEqual([
      [1, true],
      [2, true],
      [3, false],
    ])
  })

  it("nicht in einem entschiedenen Match", async () => {
    qf1(["A", "A", "A"], "COMPLETED")
    expect(await addPlayoffDuel("q1")).toMatchObject({
      error: expect.stringContaining("abgeschlossen"),
    })
    expect(duels("q1")).toHaveLength(3)
  })
})
