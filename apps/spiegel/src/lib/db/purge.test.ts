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
/** eine eigene ScheibenID je Test, damit sich die Fälle nicht treffen */
let nextId = 900_000

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

const STAMP = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)$/
const shiftStamp = (value: string | null, ms: number) => {
  const m = value && STAMP.exec(value)
  if (!m) return value
  const at = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) + ms
  return new Date(at).toISOString().slice(0, 19).replace("T", " ")
}

/**
 * Die gesendeten Stände der ersten Scheibe von SF-02 unter einer eigenen ScheibenID; `shotDays` verschiebt alle Zeiten
 * der Ablage (ein anderer Zyklus), `seenDays` nur die Beobachtung (die Brücke liest später nach).
 */
function card({ shotDays = 0, seenDays = 0, scheibenId = nextId++ } = {}): SnapshotV1[] {
  const expected = frozenExpected("SF-02").cards[0]
  const readings = frozenReadings("SF-02")
  return expected.sentReadings.map((n) => {
    const s = readings
      .find((r) => r.reading === n)!
      .snapshots.find((x) => x.scheibenId === expected.scheibenId)!
    const shift = (rows: typeof s.data.treffer.rows) =>
      rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k,
            k === "ScheibenID" ? String(scheibenId) : shiftStamp(v, shotDays * DAY_MS),
          ])
        )
      )
    const data = {
      scheiben: { ...s.data.scheiben, rows: shift(s.data.scheiben.rows) },
      serien: { ...s.data.serien, rows: shift(s.data.serien.rows) },
      treffer: { ...s.data.treffer, rows: shift(s.data.treffer.rows) },
    }
    const observedMs = Date.parse(s.observedAt) + (shotDays + seenDays) * DAY_MS
    return {
      ...s,
      scheibenId,
      sequence: observedMs,
      observedAt: new Date(observedMs).toISOString(),
      data,
      checksum: computeChecksum(data),
    }
  })
}

async function cardOf(scheibenId: number, cycle = 0) {
  return db.card.findFirstOrThrow({
    where: { sourceId: site.sourceId, scheibenId, cycle },
  })
}
const purge = (ids: string[]) =>
  db.$transaction((tx) => purgeCards(tx, ids, { tombstone: "nicht-meine" }))
const purgeLocked = (ids: string[]) => db.$transaction((tx) => purgeCards(tx, ids, { lock: true }))
const keyOf = (scheibenId: number) => ({ sourceId: site.sourceId, scheibenId })

describe("purgeCards", () => {
  it("entfernt Scheibe, Ableitungen und Rohdaten, setzt einen Grabstein; derselbe Stand ist danach gesperrt", async () => {
    const snapshots = card()
    const scheibenId = snapshots[0].scheibenId
    await ingest(snapshots)
    const target = await cardOf(scheibenId)
    expect(await db.rawSnapshot.count({ where: keyOf(scheibenId) })).toBeGreaterThan(0)

    await purge([target.id])

    expect(await db.card.count({ where: { id: target.id } })).toBe(0)
    expect(await db.cardRevision.count({ where: { cardId: target.id } })).toBe(0)
    expect(await db.shot.count({ where: { cardId: target.id } })).toBe(0)
    expect(await db.cardProjection.count({ where: { cardId: target.id } })).toBe(0)
    expect(await db.rawSnapshot.count({ where: keyOf(scheibenId) })).toBe(0)
    expect(await db.rawRow.count({ where: keyOf(scheibenId) })).toBe(0)
    const tombstone = await db.tombstone.findFirstOrThrow({ where: keyOf(scheibenId) })
    // wer gemeldet hat und unter welcher Nummer: Papierkorb des Schützen, Zuordnung zur Zustimmung (P2b)
    expect(tombstone).toMatchObject({
      cycle: target.cycle,
      reason: "nicht-meine",
      userId: site.ownerId,
      sportpassId: BigInt(12345678),
    })
    expect(await db.deleteLock.count({ where: keyOf(scheibenId) })).toBe(0)
    expect(tombstone.startedAt.getTime()).toBe(target.startedAt.getTime())
    expect((await ingest([snapshots[0]]))[0]).toMatchObject({
      outcome: "discarded",
      reason: "blocked",
    })
  })

  it("Stände, die die Brücke 40 Tage später nachliest, gehören trotzdem dazu (Review)", async () => {
    const early = card()
    const scheibenId = early[0].scheibenId
    await ingest(early.slice(0, 1))
    // derselbe Durchgang, Wochen später nachgelesen: Schusszeiten gleich, Beobachtung spät
    const late = card({ seenDays: 40, scheibenId })
    await ingest(late.slice(1))
    const target = await cardOf(scheibenId)
    expect(await db.card.count({ where: keyOf(scheibenId) })).toBe(1)

    await purge([target.id])

    expect(await db.rawSnapshot.count({ where: keyOf(scheibenId) })).toBe(0)
    expect(await db.rawRow.count({ where: keyOf(scheibenId) })).toBe(0)
  })

  it("ein früherer Zyklus, spät nachgelesen, bleibt mit seinen Daten (Review)", async () => {
    // Zyklus davor: Schüsse 50 Tage früher, beobachtet erst 40 Tage danach (nahe am neuen Zyklus)
    const scheibenId = nextId++
    const previous = card({ shotDays: -50, seenDays: 40, scheibenId })
    await ingest(previous)
    const current = card({ scheibenId })
    await ingest(current)
    const older = await cardOf(scheibenId, 0)
    const newer = await cardOf(scheibenId, 1)
    const keptSnapshots = await db.rawSnapshot.findMany({
      where: { ...keyOf(scheibenId), revisions: { some: { cardId: older.id } } },
      select: { id: true, scheibenRowIds: true, serienRowIds: true, trefferRowIds: true },
    })
    expect(keptSnapshots.length).toBeGreaterThan(0)

    await purge([newer.id])

    expect(await db.card.count({ where: { id: older.id } })).toBe(1)
    const after = await db.rawSnapshot.findMany({ where: keyOf(scheibenId), select: { id: true } })
    for (const s of keptSnapshots) expect(after.map((a) => a.id)).toContain(s.id)
    const rowIds = keptSnapshots.flatMap((s) => [
      ...s.scheibenRowIds,
      ...s.serienRowIds,
      ...s.trefferRowIds,
    ])
    expect(await db.rawRow.count({ where: { id: { in: rowIds } } })).toBe(new Set(rowIds).size)
    // auf die Revisionen der verbliebenen Scheibe zeigt weiter ihr Stand
    expect(await db.cardRevision.count({ where: { cardId: older.id, rawSnapshotId: null } })).toBe(
      0
    )
  })

  it("zwei Scheiben derselben ScheibenID 60 Tage auseinander, je allein entfernt: beide bleiben gesperrt (Review)", async () => {
    const scheibenId = nextId++
    const first = card({ scheibenId })
    await ingest(first)
    await purge([(await cardOf(scheibenId, 0)).id])
    // die nächste unter dieser ScheibenID bekommt einen neuen Zyklus, nicht den der entfernten
    const second = card({ shotDays: 60, scheibenId })
    await ingest(second)
    const later = await db.card.findFirstOrThrow({ where: keyOf(scheibenId) })
    expect(later.cycle).toBe(1)
    await purge([later.id])

    const tombstones = await db.tombstone.findMany({
      where: keyOf(scheibenId),
      orderBy: { cycle: "asc" },
    })
    expect(tombstones.map((t) => t.cycle)).toEqual([0, 1])
    expect((await ingest([first[0]]))[0]).toMatchObject({ reason: "blocked" })
    expect((await ingest([second[0]]))[0]).toMatchObject({ reason: "blocked" })
  })

  it("die Ablage prüft die Sperre unter ihrem Lock: ein Entfernen mitten im Stapel wird nicht überschrieben (Review)", async () => {
    const snapshots = card()
    const scheibenId = snapshots[0].scheibenId
    await ingest(snapshots.slice(0, 1))
    await purge([(await cardOf(scheibenId)).id])
    const startAtMs = Date.parse(
      `${snapshots[1].data.treffer.rows[0].Zeitstempel!.replace(" ", "T")}Z`
    )
    const stored = await storeSnapshot(db, { sourceId: site.sourceId, bridgeId }, snapshots[1], {
      nowMs: Date.parse(snapshots[1].observedAt),
      startAtMs,
    })
    expect(stored.outcome).toBe("blocked")
    expect(await db.rawSnapshot.count({ where: keyOf(scheibenId) })).toBe(0)
  })

  it("eine schon entfernte Scheibe überspringt es; eine ohne Quelle lehnt es ab", async () => {
    const snapshots = card()
    await ingest(snapshots)
    const target = await cardOf(snapshots[0].scheibenId)
    await purge([target.id])
    await expect(purge([target.id])).resolves.toBeUndefined()

    const pdf = await db.card.create({
      data: {
        disciplineId: site.disciplineId,
        startedAt: new Date(),
        kind: "training",
        state: "final",
        complete: true,
        origin: "pdf",
      },
    })
    await expect(purge([pdf.id])).rejects.toThrow(/ohne Quelle/)
    await db.card.delete({ where: { id: pdf.id } })
  })
})

describe("purgeCards mit weicher Sperre (Papierkorb, P2b)", () => {
  it("legt eine Löschsperre des Besitzers an statt eines Grabsteins; Rohdaten weg, derselbe Stand gesperrt", async () => {
    const snapshots = card()
    const scheibenId = snapshots[0].scheibenId
    await ingest(snapshots)
    const target = await cardOf(scheibenId)

    await purgeLocked([target.id])

    expect(await db.card.count({ where: { id: target.id } })).toBe(0)
    expect(await db.rawSnapshot.count({ where: keyOf(scheibenId) })).toBe(0)
    expect(await db.rawRow.count({ where: keyOf(scheibenId) })).toBe(0)
    expect(await db.tombstone.count({ where: keyOf(scheibenId) })).toBe(0)
    const lock = await db.deleteLock.findFirstOrThrow({ where: keyOf(scheibenId) })
    expect(lock).toMatchObject({ userId: site.ownerId, cycle: target.cycle })
    expect(lock.startedAt.getTime()).toBe(target.startedAt.getTime())
    expect((await ingest([snapshots[0]]))[0]).toMatchObject({
      outcome: "discarded",
      reason: "blocked",
    })
  })

  it("eine Scheibe ohne Quelle (nur PDF) wird nur gelöscht, ohne Sperre; ohne Besitzer lehnt es ab", async () => {
    const base = {
      disciplineId: site.disciplineId,
      startedAt: new Date(),
      kind: "training",
      state: "final",
      complete: true,
      origin: "pdf",
    } as const
    const pdf = await db.card.create({ data: { ...base, ownerId: site.ownerId } })
    const locksBefore = await db.deleteLock.count({ where: { userId: site.ownerId } })
    await purgeLocked([pdf.id])
    expect(await db.card.count({ where: { id: pdf.id } })).toBe(0)
    expect(await db.deleteLock.count({ where: { userId: site.ownerId } })).toBe(locksBefore)

    const snapshots = card()
    await ingest(snapshots)
    const ownerless = await cardOf(snapshots[0].scheibenId)
    await db.card.update({ where: { id: ownerless.id }, data: { ownerId: null } })
    await expect(purgeLocked([ownerless.id])).rejects.toThrow(/ohne Besitzer/)
  })
})
