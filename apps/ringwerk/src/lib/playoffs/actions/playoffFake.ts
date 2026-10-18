// Nachbau von Prisma für die Tests der Playoff-Actions: Matches, Duelle und Ergebnisse im Speicher, mit den Abfragen,
// die die Actions stellen. Gefiltert wird wie Prisma (Wettbewerb, Runde, „hat Duelle“), damit eine Abfrage je Teilnehmer
// ein anderes Ergebnis liefert als eine je Runde (conventions §9). `db.playoffMatch` und `db.playoffDuel` außerhalb der
// Transaktion zu lesen oder zu schreiben, ist ein Fehler: Siegstand und Folge-Runde gehören in die Transaktion.
// Nur für Tests.

import { vi } from "vitest"

export interface FakeMatch {
  id: string
  competitionId: string
  round: string
  participantAId: string
  participantBId: string
  winsA: number
  winsB: number
  status: string
}

export interface FakeResult {
  participantId: string
  totalRings: number
  teiler: number | null
  ringteiler: number | null
}

export interface FakeDuel {
  id: string
  playoffMatchId: string
  duelNumber: number
  isSuddenDeath: boolean
  isCompleted: boolean
  results: FakeResult[]
}

export interface FakeStore {
  matches: FakeMatch[]
  duels: FakeDuel[]
  audit: { eventType: string }[]
}

const decimal = (n: number | null) => (n === null ? null : { toNumber: () => n })
const withDecimals = (r: FakeResult) => ({
  ...r,
  totalRings: decimal(r.totalRings)!,
  teiler: decimal(r.teiler),
  ringteiler: decimal(r.ringteiler),
})

type Where = {
  id?: string
  competitionId?: string
  round?: string
  playoffMatchId?: string
  isCompleted?: boolean
  duels?: { some?: object; none?: object }
}

export function createPlayoffFake() {
  const store: FakeStore = { matches: [], duels: [], audit: [] }
  let nextId = 1

  const hasDuels = (m: FakeMatch) => store.duels.some((d) => d.playoffMatchId === m.id)
  const matches = (where: Where) =>
    store.matches.filter(
      (m) =>
        (!where.id || m.id === where.id) &&
        (!where.competitionId || m.competitionId === where.competitionId) &&
        (!where.round || m.round === where.round) &&
        (!where.duels?.some || hasDuels(m)) &&
        (!where.duels?.none || !hasDuels(m))
    )
  const duels = (where: Where) =>
    store.duels
      .filter(
        (d) =>
          (!where.id || d.id === where.id) &&
          (!where.playoffMatchId || d.playoffMatchId === where.playoffMatchId) &&
          (where.isCompleted === undefined || d.isCompleted === where.isCompleted)
      )
      .sort((a, b) => a.duelNumber - b.duelNumber)
  const duelOut = (d: FakeDuel) => ({ ...d, results: d.results.map(withDecimals) })

  const tx = {
    playoffMatch: {
      findFirst: vi.fn(async ({ where }: { where: Where }) => matches(where)[0] ?? null),
      findMany: vi.fn(async ({ where }: { where: Where }) => matches(where)),
      findUniqueOrThrow: vi.fn(async ({ where }: { where: Where }) => {
        const m = matches(where)[0]
        if (!m) throw new Error(`Match ${where.id} fehlt`)
        return { ...m }
      }),
      count: vi.fn(async ({ where }: { where: Where }) => matches(where).length),
      update: vi.fn(async ({ where, data }: { where: Where; data: Partial<FakeMatch> }) => {
        const m = matches(where)[0]
        Object.assign(m, data)
        return { ...m }
      }),
      create: vi.fn(
        async ({ data }: { data: Omit<FakeMatch, "id" | "winsA" | "winsB" | "status"> }) => {
          const m = { id: `m${nextId++}`, winsA: 0, winsB: 0, status: "PENDING", ...data }
          store.matches.push(m)
          return m
        }
      ),
      createMany: vi.fn(
        async ({ data }: { data: Omit<FakeMatch, "id" | "winsA" | "winsB" | "status">[] }) => {
          for (const row of data)
            store.matches.push({
              id: `m${nextId++}`,
              winsA: 0,
              winsB: 0,
              status: "PENDING",
              ...row,
            })
          return { count: data.length }
        }
      ),
      deleteMany: vi.fn(async ({ where }: { where: Where }) => {
        const gone = new Set(matches(where).map((m) => m.id))
        store.matches = store.matches.filter((m) => !gone.has(m.id))
        return { count: gone.size }
      }),
    },
    playoffDuel: {
      findUniqueOrThrow: vi.fn(async ({ where }: { where: Where }) => {
        const d = duels(where)[0]
        if (!d) throw new Error(`Duell ${where.id} fehlt`)
        return duelOut(d)
      }),
      findMany: vi.fn(async ({ where }: { where: Where }) => duels(where).map(duelOut)),
      aggregate: vi.fn(async ({ where }: { where: Where }) => ({
        _max: { duelNumber: duels(where).at(-1)?.duelNumber ?? null },
      })),
      create: vi.fn(
        async ({ data }: { data: Omit<FakeDuel, "id" | "isCompleted" | "results"> }) => {
          const d = { id: `d${nextId++}`, isCompleted: false, results: [], ...data }
          store.duels.push(d)
          return d
        }
      ),
      update: vi.fn(async ({ where, data }: { where: Where; data: Partial<FakeDuel> }) => {
        Object.assign(duels(where)[0], data)
      }),
      delete: vi.fn(async ({ where }: { where: Where }) => {
        store.duels = store.duels.filter((d) => d.id !== where.id)
      }),
      deleteMany: vi.fn(async ({ where }: { where: Where }) => {
        const gone = new Set(duels(where).map((d) => d.id))
        store.duels = store.duels.filter((d) => !gone.has(d.id))
        return { count: gone.size }
      }),
    },
    playoffDuelResult: {
      upsert: vi.fn(
        async ({
          where,
          create,
          update,
        }: {
          where: { duelId_participantId: { duelId: string; participantId: string } }
          create: FakeResult & { duelId: string }
          update: Partial<FakeResult>
        }) => {
          const { duelId, participantId } = where.duelId_participantId
          const duel = store.duels.find((d) => d.id === duelId)!
          const existing = duel.results.find((r) => r.participantId === participantId)
          if (existing) Object.assign(existing, pick({ ...update, participantId }))
          else duel.results.push(pick(create))
        }
      ),
      deleteMany: vi.fn(async ({ where }: { where: { duelId: string } }) => {
        const duel = store.duels.find((d) => d.id === where.duelId)
        if (duel) duel.results = []
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: { eventType: string } }) => {
        store.audit.push({ eventType: data.eventType })
      }),
    },
  }

  const outside = () => {
    throw new Error("Playoff-Daten außerhalb der Transaktion gelesen oder geschrieben")
  }
  const db = {
    playoffMatch: new Proxy({}, { get: () => outside }),
    playoffDuel: { findUnique: vi.fn() },
    auditLog: { create: vi.fn(outside) },
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  }

  /** ein Match mit Duellen; `outcomes` je Duell: "A", "B", "DRAW" oder "offen" */
  function addMatch(
    match: Omit<FakeMatch, "winsA" | "winsB" | "status" | "competitionId"> & {
      competitionId?: string
    },
    outcomes: ("A" | "B" | "DRAW" | "offen")[] = [],
    { status, winsA, winsB }: Partial<Pick<FakeMatch, "status" | "winsA" | "winsB">> = {}
  ) {
    const a = outcomes.filter((o) => o === "A").length
    const b = outcomes.filter((o) => o === "B").length
    store.matches.push({
      competitionId: "c1",
      winsA: winsA ?? a,
      winsB: winsB ?? b,
      status: status ?? "PENDING",
      ...match,
    })
    outcomes.forEach((o, i) =>
      store.duels.push({
        id: `${match.id}-d${i + 1}`,
        playoffMatchId: match.id,
        duelNumber: i + 1,
        isSuddenDeath: false,
        isCompleted: o !== "offen",
        results:
          o === "offen"
            ? []
            : [
                result(match.participantAId, o === "A" ? 10 : o === "B" ? 20 : 15),
                result(match.participantBId, o === "A" ? 20 : o === "B" ? 10 : 15),
              ],
      })
    )
  }

  return { store, tx, db, addMatch }
}

/** Ergebnis mit gegebenem Ringteiler (kleiner gewinnt außerhalb des Finales; im Finale mehr Ringe) */
export function result(participantId: string, ringteiler: number): FakeResult {
  return { participantId, totalRings: 120 - ringteiler, teiler: 5, ringteiler }
}

function pick(r: Partial<FakeResult> & { participantId?: string }): FakeResult {
  return {
    participantId: r.participantId!,
    totalRings: Number(r.totalRings),
    teiler: r.teiler === undefined || r.teiler === null ? null : Number(r.teiler),
    ringteiler: r.ringteiler === undefined || r.ringteiler === null ? null : Number(r.ringteiler),
  }
}
