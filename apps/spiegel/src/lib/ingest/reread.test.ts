import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import { frozenExpected, frozenReadings } from "@vereinsheim/ssmdb2-cases/frozen"

import { createPrismaClient } from "@/lib/db"
import { storeSnapshot } from "../db/raw"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { ingestBatch } from "./ingest"
import { ADAPTER_VERSION } from "./meyton-ssmdb2"
import { REREAD_QUIET_MS, rereadOutdatedKeys } from "./reread"

const db = createPrismaClient()
let site: TestSite
let bridgeId: number
/** eine eigene ScheibenID je Test */
let nextId = 700_000

beforeAll(async () => {
  site = await createTestSite(db, "reread")
  bridgeId = (
    await db.bridge.create({
      data: { siteId: site.siteId, name: "Test", tokenHash: `reread-${site.siteId}` },
    })
  ).id
  await db.sportpassConsent.create({
    data: {
      userId: site.ownerId,
      siteId: site.siteId,
      sportpassId: BigInt(12345678),
      confirmedAt: new Date(),
      firstCardConfirmedAt: new Date(),
    },
  })
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

/** die gesendeten Stände einer Scheibe eines Falls unter einer eigenen ScheibenID */
function sent(caseId: string, scheibenId = nextId++): SnapshotV1[] {
  const expected = frozenExpected(caseId).cards[0]
  const readings = frozenReadings(caseId)
  return expected.sentReadings.map((n) => {
    const s = readings
      .find((r) => r.reading === n)!
      .snapshots.find((x) => x.scheibenId === expected.scheibenId)!
    const data = {
      ...s.data,
      scheiben: {
        ...s.data.scheiben,
        rows: s.data.scheiben.rows.map((row) => ({ ...row, ScheibenID: String(scheibenId) })),
      },
    }
    return { ...s, scheibenId, data, checksum: computeChecksum(data) }
  })
}

/**
 * Der Stand vor dem neuen Adapter: Alle Stände sind abgelegt, die Scheibe kennt nur den letzten (die früheren Blöcke
 * hatte sie ersetzt). Die früheren Stände liegen ungedeutet in den Rohdaten.
 */
async function asBefore(snapshots: readonly SnapshotV1[]) {
  for (const snapshot of snapshots.slice(0, -1))
    await storeSnapshot(db, { sourceId: site.sourceId, bridgeId }, snapshot, {
      nowMs: Date.parse(snapshot.observedAt),
    })
  const last = snapshots.at(-1)!
  await ingestBatch(db, { bridgeId, siteId: site.siteId, timeZone: "Europe/Berlin" }, [last], {
    nowMs: Date.parse(last.observedAt),
  })
  const [card] = await cardsOf(last.scheibenId)
  return card
}

const cardsOf = (scheibenId: number) =>
  db.card.findMany({
    where: { sourceId: site.sourceId, scheibenId },
    orderBy: { block: "asc" },
    include: { currentRevision: { include: { shots: { orderBy: { seq: "asc" } } } } },
  })

const rawOf = (scheibenId: number) =>
  db.rawSnapshot.findMany({
    where: { sourceId: site.sourceId, scheibenId },
    orderBy: { sequence: "asc" },
    select: { adapterVersion: true, block: true },
  })

const reread = (nowMs = Date.now()) => rereadOutdatedKeys(db, { nowMs, sourceId: site.sourceId })

const numbersOf = (shots: readonly { treffer: number }[]) => shots.map((s) => s.treffer)

describe("rereadOutdatedKeys", () => {
  it("SF-72: der ersetzte Block kommt als eigene Scheibe zurück, die vorhandene wird Block 1; ein zweiter Lauf ändert nichts", async () => {
    const snapshots = sent("SF-72")
    const scheibenId = snapshots[0].scheibenId
    const before = await asBefore(snapshots)
    expect(await cardsOf(scheibenId)).toHaveLength(1)

    expect(await reread()).toEqual({ keys: 1, created: 1 })

    const cards = await cardsOf(scheibenId)
    expect(cards.map((c) => c.block)).toEqual([0, 1])
    expect(cards[1].id).toBe(before.id)
    expect(numbersOf(cards[0].currentRevision!.shots)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(numbersOf(cards[1].currentRevision!.shots)).toEqual([1, 2, 3, 4, 5])
    expect(cards[0].ownerId).toBe(site.ownerId)
    expect(await rawOf(scheibenId)).toEqual([
      { adapterVersion: ADAPTER_VERSION, block: 0 },
      { adapterVersion: ADAPTER_VERSION, block: 1 },
    ])

    expect(await reread()).toEqual({ keys: 0, created: 0 })
    expect(await cardsOf(scheibenId)).toHaveLength(2)
  })

  it("SF-03: die Probe vor der Wertung wird Block 0, die Wertung Block 1", async () => {
    const snapshots = sent("SF-03")
    await asBefore(snapshots)
    await reread()
    const cards = await cardsOf(snapshots[0].scheibenId)
    expect(
      cards.map((c) => [c.block, c.currentRevision!.shots.every((s) => s.stellung === 0)])
    ).toEqual([
      [0, true],
      [1, false],
    ])
  })

  it("liegt die Scheibe im Papierkorb oder wartet sie auf die erste Bestätigung, gilt das auch für den neuen Block", async () => {
    const snapshots = sent("SF-72")
    const before = await asBefore(snapshots)
    const deletedAt = new Date("2026-10-10T12:00:00.000Z")
    await db.card.update({ where: { id: before.id }, data: { deletedAt, ownerPending: true } })
    await reread()
    const [added] = await cardsOf(snapshots[0].scheibenId)
    expect(added.id).not.toBe(before.id)
    expect(added.deletedAt).toEqual(deletedAt)
    expect(added.ownerPending).toBe(true)
  })

  it("eine ScheibenID, deren jüngster Stand vor weniger als 30 Minuten kam, wartet", async () => {
    const snapshots = sent("SF-72")
    await asBefore(snapshots)
    const lastSeen = Date.parse(snapshots.at(-1)!.observedAt)
    expect(await reread(lastSeen + REREAD_QUIET_MS - 60_000)).toEqual({ keys: 0, created: 0 })
    expect(await cardsOf(snapshots[0].scheibenId)).toHaveLength(1)
    expect((await reread(lastSeen + REREAD_QUIET_MS + 60_000)).created).toBe(1)
  })

  it("Rohdaten ohne Scheibe (etwa entfernt) bringen keine zurück und bleiben ungelesen", async () => {
    const [first] = sent("SF-72")
    await storeSnapshot(db, { sourceId: site.sourceId, bridgeId }, first, {
      nowMs: Date.parse(first.observedAt),
    })
    expect(await reread()).toEqual({ keys: 0, created: 0 })
    expect(await cardsOf(first.scheibenId)).toHaveLength(0)
    expect(await rawOf(first.scheibenId)).toEqual([{ adapterVersion: null, block: null }])
  })
})
