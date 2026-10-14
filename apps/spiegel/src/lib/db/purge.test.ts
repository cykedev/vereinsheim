import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import { frozenExpected, frozenReadings } from "@vereinsheim/ssmdb2-cases/frozen"

import { createPrismaClient } from "@/lib/db"
import { ingestBatch } from "@/lib/ingest/ingest"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { purgeCards } from "./purge"
import { storeSnapshot } from "./raw"

const db = createPrismaClient()
let site: TestSite
let bridgeId: number
const DAY_MS = 86_400_000

beforeAll(async () => {
  site = await createTestSite(db, "purge")
  bridgeId = (
    await db.bridge.create({
      data: { siteId: site.siteId, name: "Test", tokenHash: `purge-${site.siteId}` },
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

const target = () => ({ bridgeId, siteId: site.siteId, timeZone: "Europe/Berlin" })
const ingest = (snapshots: readonly SnapshotV1[]) =>
  ingestBatch(db, target(), snapshots, { nowMs: Date.parse(snapshots.at(-1)!.observedAt) })

/** die gesendeten Stände der ersten Scheibe von SF-02 */
function sent(): SnapshotV1[] {
  const card = frozenExpected("SF-02").cards[0]
  const readings = frozenReadings("SF-02")
  return card.sentReadings.map(
    (n) =>
      readings
        .find((r) => r.reading === n)!
        .snapshots.find((s) => s.scheibenId === card.scheibenId)!
  )
}

describe("purgeCards", () => {
  it("entfernt Scheibe und Rohdaten ihres Zyklus, setzt einen Grabstein; ein späterer Zyklus bleibt", async () => {
    const snapshots = sent()
    await ingest(snapshots)
    const card = await db.card.findFirstOrThrow({
      where: { sourceId: site.sourceId, scheibenId: snapshots[0].scheibenId },
      include: { revisions: true },
    })
    const key = { sourceId: site.sourceId, scheibenId: card.scheibenId! }

    // derselbe Zähler 60 Tage später (SF-77): ein Stand mit einer geänderten Trefferzeile, die übrigen Zeilen geteilt
    const last = snapshots.at(-1)!
    const data = {
      ...last.data,
      treffer: {
        ...last.data.treffer,
        rows: last.data.treffer.rows.map((row, i) => (i === 0 ? { ...row, Ring: "0" } : row)),
      },
    }
    const laterMs = Date.parse(last.observedAt) + 60 * DAY_MS
    const later: SnapshotV1 = {
      ...last,
      sequence: laterMs,
      observedAt: new Date(laterMs).toISOString(),
      data,
      checksum: computeChecksum(data),
    }
    const stored = await storeSnapshot(db, { sourceId: site.sourceId, bridgeId }, later, {
      nowMs: laterMs,
    })
    expect(stored.outcome).toBe("stored")
    const kept = await db.rawSnapshot.findFirstOrThrow({
      where: { ...key, sequence: BigInt(laterMs) },
    })
    const keptRows = [...kept.scheibenRowIds, ...kept.serienRowIds, ...kept.trefferRowIds]
    const rowsBefore = await db.rawRow.count({ where: key })
    expect(await db.rawSnapshot.count({ where: key })).toBeGreaterThan(1)

    await db.$transaction((tx) => purgeCards(tx, [card.id], "nicht-meine"))

    expect(await db.card.count({ where: { id: card.id } })).toBe(0)
    expect(await db.cardRevision.count({ where: { cardId: card.id } })).toBe(0)
    expect(await db.shot.count({ where: { cardId: card.id } })).toBe(0)
    expect(await db.cardProjection.count({ where: { cardId: card.id } })).toBe(0)
    // vom Zyklus der Scheibe bleibt kein Stand, der spätere bleibt mit allen seinen Zeilen
    expect((await db.rawSnapshot.findMany({ where: key })).map((s) => s.id)).toEqual([kept.id])
    expect(await db.rawRow.count({ where: { id: { in: keptRows } } })).toBe(keptRows.length)
    // was nur der entfernte Zyklus brauchte, ist weg
    const rowsAfter = await db.rawRow.count({ where: key })
    expect(rowsAfter).toBe(new Set(keptRows).size)
    expect(rowsAfter).toBeLessThan(rowsBefore)
    const tombstone = await db.tombstone.findFirstOrThrow({ where: key })
    expect(tombstone).toMatchObject({ cycle: card.cycle, reason: "nicht-meine" })
    expect(tombstone.startedAt.getTime()).toBe(card.startedAt.getTime())

    // derselbe Stand kommt nie wieder
    expect((await ingest([snapshots[0]]))[0]).toMatchObject({
      outcome: "discarded",
      reason: "blocked",
    })
  })

  it("eine Scheibe ohne Quelle lehnt es ab", async () => {
    const card = await db.card.create({
      data: {
        disciplineId: site.disciplineId,
        startedAt: new Date(),
        kind: "training",
        state: "final",
        complete: true,
        origin: "pdf",
      },
    })
    await expect(db.$transaction((tx) => purgeCards(tx, [card.id], "x"))).rejects.toThrow(
      /ohne Quelle/
    )
    await db.card.delete({ where: { id: card.id } })
  })
})
