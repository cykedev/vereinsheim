import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import { frozenExpected, frozenReadings } from "@vereinsheim/ssmdb2-cases/frozen"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { eveningOfStart } from "../card-requests/id"
import { startHintMs } from "../db/blocks"

import { bridgeState, recordHeartbeat } from "./bridges"
import { ingestBatch } from "./ingest"

// Aufträge per ID beim Einlesen: Ein offener Auftrag gilt wie eine Zustimmung für genau diese Scheibe, wenn ihr Beginn auf
// den genannten Abend fällt; sonst wird nichts gespeichert.

const db = createPrismaClient()
let site: TestSite
let bridgeId: number
let other: string
/** der erfundene Sportpass mit Zustimmung in den Fällen; hier gehört er dem zweiten Konto */
const MUSTER = BigInt(12345678)

beforeAll(async () => {
  site = await createTestSite(db, "requests")
  bridgeId = (
    await db.bridge.create({
      data: { siteId: site.siteId, name: "Test", tokenHash: `test-${site.siteId}` },
    })
  ).id
  other = (
    await db.user.create({
      data: { email: `requests-other-${site.siteId}@example.com`, name: "B", passwordHash: "-" },
    })
  ).id
  await db.sportpassConsent.create({
    data: {
      userId: other,
      siteId: site.siteId,
      sportpassId: MUSTER,
      confirmedAt: new Date(),
      firstCardConfirmedAt: new Date(),
    },
  })
})
afterAll(async () => {
  await site.remove()
  await db.user.delete({ where: { id: other } })
  await db.$disconnect()
})

const target = () => ({ bridgeId, siteId: site.siteId, timeZone: "Europe/Berlin" })
const ingest = (snapshots: readonly SnapshotV1[]) =>
  ingestBatch(db, target(), snapshots, { nowMs: Date.parse(snapshots.at(-1)!.observedAt) })

/** die gesendeten Lesungen einer Scheibe eines Falls */
function sent(caseId: string, index = 0): SnapshotV1[] {
  const card = frozenExpected(caseId).cards[index]
  const readings = frozenReadings(caseId)
  return card.sentReadings.map((n) =>
    readings.find((r) => r.reading === n)!.snapshots.find((s) => s.scheibenId === card.scheibenId)!
  )
}

/** dieselben Stände als eine andere Scheibe mit anderer SportpassID */
function as(snapshots: readonly SnapshotV1[], sportpass: string, scheibenId: number) {
  return snapshots.map((snapshot) => {
    const data = {
      ...snapshot.data,
      scheiben: {
        ...snapshot.data.scheiben,
        rows: snapshot.data.scheiben.rows.map((row) => ({
          ...row,
          SportpassID: sportpass,
          ScheibenID: String(scheibenId),
        })),
      },
    }
    return { ...snapshot, scheibenId, data, checksum: computeChecksum(data) }
  })
}

const eveningOf = (snapshot: SnapshotV1) =>
  eveningOfStart(
    startHintMs(
      snapshot.data.treffer.rows.map((row) => row.Zeitstempel),
      Date.parse(snapshot.observedAt)
    )
  )

const request = (userId: string, scheibenId: number, day: string) =>
  db.cardRequest.create({ data: { userId, siteId: site.siteId, scheibenId, day } })
const statusOf = async (id: number) =>
  db.cardRequest.findUniqueOrThrow({ where: { id }, select: { status: true, cardId: true } })
const stored = (scheibenId: number) =>
  db.rawSnapshot.count({ where: { sourceId: site.sourceId, scheibenId } })

describe("Einlesen mit Auftrag per ID", () => {
  it("ohne Zustimmung, mit Auftrag und passendem Abend: beim Auftraggeber, nicht wartend; Auftrag erledigt", async () => {
    const snapshots = as(sent("SF-03"), "87654321", 70_001)
    const r = await request(site.ownerId, 70_001, eveningOf(snapshots[0]))
    const results = await ingest(snapshots)
    expect(results.every((x) => x.outcome !== "discarded")).toBe(true)
    const card = await db.card.findFirstOrThrow({
      where: { sourceId: site.sourceId, scheibenId: 70_001 },
      orderBy: { block: "desc" },
    })
    expect(card.ownerId).toBe(site.ownerId)
    expect(card.ownerPending).toBe(false)
    expect(await statusOf(r.id)).toEqual({ status: "done", cardId: card.id })
  })

  it("ein anderer Abend: nichts gespeichert, Auftrag „an diesem Tag nicht gefunden“", async () => {
    const snapshots = as(sent("SF-03"), "87654321", 70_002)
    const r = await request(site.ownerId, 70_002, "2020-01-01")
    const results = await ingest(snapshots)
    expect(results.every((x) => x.outcome === "discarded" && x.reason === "no-consent")).toBe(true)
    expect(await stored(70_002)).toBe(0)
    expect((await statusOf(r.id)).status).toBe("mismatch")
  })

  it("ohne Auftrag und ohne Zustimmung bleibt es beim Verwerfen", async () => {
    const snapshots = as(sent("SF-03"), "87654321", 70_003)
    const results = await ingest(snapshots)
    expect(results.every((x) => x.reason === "no-consent")).toBe(true)
    expect(await stored(70_003)).toBe(0)
  })

  it("eine Zustimmung per Sportpass geht vor: der Auftrag eines anderen ist vergeben", async () => {
    const snapshots = as(sent("SF-03"), String(MUSTER), 70_004)
    const r = await request(site.ownerId, 70_004, eveningOf(snapshots[0]))
    await ingest(snapshots)
    const card = await db.card.findFirstOrThrow({
      where: { sourceId: site.sourceId, scheibenId: 70_004 },
      orderBy: { block: "desc" },
    })
    expect(card.ownerId).toBe(other)
    expect((await statusOf(r.id)).status).toBe("taken")
  })

  it("zwei Aufträge derselben Scheibe: der ältere bekommt sie, der andere ist vergeben", async () => {
    const snapshots = as(sent("SF-03"), "87654321", 70_005)
    const first = await request(other, 70_005, eveningOf(snapshots[0]))
    const second = await request(site.ownerId, 70_005, eveningOf(snapshots[0]))
    await ingest(snapshots)
    expect((await statusOf(first.id)).status).toBe("done")
    expect((await statusOf(second.id)).status).toBe("taken")
  })

  it("verdeckt: nichts gespeichert, Auftrag gehalten", async () => {
    // eine Scheibe, die die Brücke zurückhält (verdeckte Wertung, SF-19)
    const card = frozenExpected("SF-19").cards.find((c) => c.bridge === "zurueckhalten")!
    const readings = frozenReadings("SF-19")
    const snapshots = as(
      readings.flatMap((x) => x.snapshots.filter((s) => s.scheibenId === card.scheibenId)),
      "87654321",
      70_006
    )
    const r = await request(site.ownerId, 70_006, eveningOf(snapshots.at(-1)!))
    const results = await ingest([snapshots.at(-1)!])
    expect(results[0]).toMatchObject({ outcome: "discarded", reason: "hidden" })
    expect(await stored(70_006)).toBe(0)
    expect((await statusOf(r.id)).status).toBe("held")
  })
})

describe("Zustand und Heartbeat mit Aufträgen", () => {
  it("der Zustand nennt offene Aufträge aktiver Konten, mit offenem Auftrag alle Sperren", async () => {
    const r = await request(site.ownerId, 70_101, "2026-10-21")
    const state = await bridgeState(db, site.siteId)
    expect(state.requests).toContainEqual({ id: r.id, scheibenId: 70_101 })
    await db.user.update({ where: { id: site.ownerId }, data: { isActive: false } })
    try {
      expect((await bridgeState(db, site.siteId)).requests).not.toContainEqual({
        id: r.id,
        scheibenId: 70_101,
      })
    } finally {
      await db.user.update({ where: { id: site.ownerId }, data: { isActive: true } })
    }
  })

  it("der Heartbeat schließt „nicht in der Ablage“ und „gehalten“, „gesendet“ nicht; nur offene der Anlage", async () => {
    const missing = await request(site.ownerId, 70_201, "2026-10-21")
    const held = await request(site.ownerId, 70_202, "2026-10-21")
    const sentOne = await request(site.ownerId, 70_203, "2026-10-21")
    const closed = await db.cardRequest.create({
      data: {
        userId: site.ownerId,
        siteId: site.siteId,
        scheibenId: 70_204,
        day: "2026-10-21",
        status: "withdrawn",
      },
    })
    const now = Date.now()
    await recordHeartbeat(
      db,
      { bridgeId, siteId: site.siteId, timeZone: "Europe/Berlin", runStartedAt: null },
      {
        contractVersion: 1,
        bridgeVersion: "test",
        runStartedAt: new Date(now - 60_000).toISOString(),
        sentAt: new Date(now).toISOString(),
        status: "ok",
        backlog: 0,
        lastDbContactAt: null,
        queryMs: null,
        sourceClockOffsetMs: null,
        heldBack: [],
        sourceFingerprint: null,
        requestsDone: [
          { id: missing.id, outcome: "missing" },
          { id: held.id, outcome: "held" },
          { id: sentOne.id, outcome: "sent" },
          { id: closed.id, outcome: "missing" },
        ],
      },
      now
    )
    expect((await statusOf(missing.id)).status).toBe("missing")
    expect((await statusOf(held.id)).status).toBe("held")
    expect((await statusOf(sentOne.id)).status).toBe("open")
    expect((await statusOf(closed.id)).status).toBe("withdrawn")
  })
})
