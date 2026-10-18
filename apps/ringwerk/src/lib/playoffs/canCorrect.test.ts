// Korrigierbar ist eine Runde nur, solange in der ganzen nächsten Runde kein Duell geschossen ist: Die nächste Runde
// entsteht aus allen Siegern neu nach Rang, eine Korrektur kann jede ihrer Paarungen ändern.

import { describe, expect, it, vi } from "vitest"

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }))
vi.mock("@/lib/db", () => ({ db: { playoffMatch: { findMany } } }))

import { getPlayoffBracket } from "./queries"

const person = (id: string) => ({ id, firstName: id, lastName: id })
const match = (id: string, round: string, a: string, b: string, duels: number) => ({
  id,
  round,
  status: duels > 0 ? "COMPLETED" : "PENDING",
  winsA: 0,
  winsB: 0,
  participantA: person(a),
  participantB: person(b),
  duels: Array.from({ length: duels }, (_, i) => ({
    id: `${id}-d${i}`,
    duelNumber: i + 1,
    isSuddenDeath: false,
    isCompleted: true,
    results: [],
  })),
})

describe("korrigierbar", () => {
  it("ein Viertelfinale nicht mehr, sobald irgendein Halbfinale ein Duell hat", async () => {
    findMany.mockResolvedValue([
      match("q1", "QUARTER_FINAL", "p1", "p2", 3),
      match("q2", "QUARTER_FINAL", "p3", "p4", 3),
      match("s1", "SEMI_FINAL", "p1", "p3", 0),
      match("s2", "SEMI_FINAL", "p5", "p7", 1),
    ])
    const bracket = await getPlayoffBracket("c1")
    expect(bracket.quarterFinals.map((m) => m.canCorrect)).toEqual([false, false])
  })

  it("ein Viertelfinale schon, solange im ganzen Halbfinale kein Duell geschossen ist", async () => {
    findMany.mockResolvedValue([
      match("q1", "QUARTER_FINAL", "p1", "p2", 3),
      match("s1", "SEMI_FINAL", "p1", "p3", 0),
      match("s2", "SEMI_FINAL", "p5", "p7", 0),
    ])
    const bracket = await getPlayoffBracket("c1")
    expect(bracket.quarterFinals.map((m) => m.canCorrect)).toEqual([true])
  })
})
