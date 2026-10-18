// Listen außerhalb eines Wettbewerbs (Teilnehmer, Wettbewerbe, Disziplinen, Protokoll) enden auf der `id`: Gleiche Namen
// (zwei Gäste gleichen Namens, zwei Wettbewerbe gleichen Namens) und Einträge derselben Zeit stehen so immer gleich.

import { beforeEach, describe, expect, it, vi } from "vitest"

const { findMany } = vi.hoisted(() => ({
  findMany: {
    participant: vi.fn(),
    competition: vi.fn(),
    discipline: vi.fn(),
    auditLog: vi.fn(),
  },
}))

vi.mock("@/lib/db", () => ({
  db: {
    participant: { findMany: findMany.participant },
    competition: { findMany: findMany.competition },
    discipline: { findMany: findMany.discipline },
    auditLog: { findMany: findMany.auditLog },
  },
}))

import { getAuditLogs, getAuditLogsByCompetition } from "./auditLog/queries"
import { getCompetitions, getCompetitionsForManagement } from "./competitions/listQueries"
import { getDisciplines, getDisciplinesForManagement } from "./disciplines/queries"
import {
  getAllActiveParticipants,
  getParticipants,
  getParticipantsForManagement,
  getParticipantsNotInCompetition,
} from "./participants/queries"

beforeEach(() => {
  vi.resetAllMocks()
  for (const mock of Object.values(findMany)) mock.mockResolvedValue([])
})

const lastOrder = (mock: ReturnType<typeof vi.fn>) => {
  const orderBy = (mock.mock.calls.at(-1)?.[0] as { orderBy?: unknown }).orderBy
  return Array.isArray(orderBy) ? orderBy.at(-1) : orderBy
}

describe("Listen enden auf einem eindeutigen Schlüssel", () => {
  it.each([
    ["Teilnehmer", () => getParticipants(), findMany.participant, { id: "asc" }],
    [
      "Teilnehmer (Verwaltung)",
      () => getParticipantsForManagement(),
      findMany.participant,
      { id: "asc" },
    ],
    ["aktive Teilnehmer", () => getAllActiveParticipants(), findMany.participant, { id: "asc" }],
    [
      "noch nicht eingeschrieben",
      () => getParticipantsNotInCompetition("c1"),
      findMany.participant,
      { id: "asc" },
    ],
    ["Wettbewerbe", () => getCompetitions(), findMany.competition, { id: "asc" }],
    [
      "Wettbewerbe (Verwaltung)",
      () => getCompetitionsForManagement(),
      findMany.competition,
      { id: "asc" },
    ],
    ["Disziplinen", () => getDisciplines(), findMany.discipline, { id: "asc" }],
    [
      "Disziplinen (Verwaltung)",
      () => getDisciplinesForManagement(),
      findMany.discipline,
      { id: "asc" },
    ],
    ["Protokoll", () => getAuditLogs(), findMany.auditLog, { id: "desc" }],
    [
      "Protokoll eines Wettbewerbs",
      () => getAuditLogsByCompetition("c1"),
      findMany.auditLog,
      { id: "desc" },
    ],
  ])("%s", async (_name, load, mock, last) => {
    await load()
    expect(lastOrder(mock)).toEqual(last)
  })
})
