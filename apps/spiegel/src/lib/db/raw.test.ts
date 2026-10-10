import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import { parseSnapshot } from "@vereinsheim/ingest-contract/parse"
import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import { frozenReadings } from "@vereinsheim/ssmdb2-cases/frozen"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { loadSnapshotData, storeSnapshot } from "./raw"

const db = createPrismaClient()
let site: TestSite

beforeAll(async () => {
  site = await createTestSite(db, "raw")
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

/** die Snapshots eines Falls in der Folge der Lesungen, durch den Vertrag geprüft */
function snapshotsOf(caseId: string): SnapshotV1[] {
  return frozenReadings(caseId).flatMap(({ snapshots }) =>
    snapshots.map((snapshot) => {
      const parsed = parseSnapshot(snapshot)
      if (!parsed.ok) throw new Error(`${caseId}: ${JSON.stringify(parsed.issues)}`)
      return parsed.value
    })
  )
}

const rowCount = (snapshot: SnapshotV1) =>
  snapshot.data.scheiben.rows.length +
  snapshot.data.serien.rows.length +
  snapshot.data.treffer.rows.length

async function storedRows(scheibenId: number) {
  return db.rawRow.count({ where: { sourceId: site.sourceId, scheibenId } })
}

describe("storeSnapshot", () => {
  it("SF-71: derselbe Stand nach einer Lücke legt keine Zeile neu ab", async () => {
    const snapshots = snapshotsOf("SF-71")
    const results = []
    for (const snapshot of snapshots)
      results.push(await storeSnapshot(db, { sourceId: site.sourceId }, snapshot))
    // jede Lesung ist ein anderer Stand als die vorige, also gespeichert
    expect(results.map((r) => r.outcome)).toEqual([
      "stored",
      "stored",
      "stored",
      "stored",
      "stored",
    ])
    // Lesung 3 und 5 bringen den Stand von Lesung 1 zurück: keine neue Zeile
    expect(results.map((r) => (r.outcome === "stored" ? r.newRows : -1))).toEqual([
      rowCount(snapshots[0]),
      expect.any(Number),
      0,
      expect.any(Number),
      0,
    ])
    const rows = await storedRows(snapshots[0].scheibenId)
    const sum = snapshots.reduce((n, s) => n + rowCount(s), 0)
    expect(rows).toBeLessThan(sum)
    expect(rows).toBe(results.reduce((n, r) => n + (r.outcome === "stored" ? r.newRows : 0), 0))
  })

  it("SF-72: derselbe Stand gleich danach ist kein neuer Snapshot", async () => {
    const snapshots = snapshotsOf("SF-72")
    const results = []
    for (const snapshot of snapshots)
      results.push(await storeSnapshot(db, { sourceId: site.sourceId }, snapshot))
    expect(results.map((r) => r.outcome)).toEqual(["stored", "unchanged", "stored"])
    const scheibenId = snapshots[0].scheibenId
    expect(await db.rawSnapshot.count({ where: { sourceId: site.sourceId, scheibenId } })).toBe(2)
    // die Wiederholung hebt die letzte Folgenummer des ersten Snapshots
    const first = await db.rawSnapshot.findFirstOrThrow({
      where: { sourceId: site.sourceId, scheibenId },
      orderBy: { sequence: "asc" },
    })
    expect(first.lastSequence).toBe(BigInt(snapshots[1].sequence))
  })

  it("SF-03: ein wachsender Durchgang legt nur die neuen Zeilen ab", async () => {
    const snapshots = snapshotsOf("SF-03")
    let total = 0
    for (const snapshot of snapshots) {
      const result = await storeSnapshot(db, { sourceId: site.sourceId }, snapshot)
      expect(result.outcome).toBe("stored")
      if (result.outcome === "stored") total += result.newRows
    }
    expect(await storedRows(snapshots[0].scheibenId)).toBe(total)
    expect(total).toBeLessThan(snapshots.reduce((n, s) => n + rowCount(s), 0))
  })

  it("ein älterer Stand überholt nie einen neueren (SF-26), eine Wiederholung ändert nichts", async () => {
    const [first, second] = snapshotsOf("SF-03")
    const scheibenId = 777_001
    const at = (s: SnapshotV1, sequence: number): SnapshotV1 => ({ ...s, scheibenId, sequence })
    expect((await storeSnapshot(db, { sourceId: site.sourceId }, at(second, 20))).outcome).toBe(
      "stored"
    )
    // ein anderer Stand mit kleinerer Folgenummer
    expect(await storeSnapshot(db, { sourceId: site.sourceId }, at(first, 10))).toEqual({
      outcome: "stale",
      latestSequence: BigInt(20),
    })
    // derselbe Stand noch einmal, dann ein anderer Stand dazwischen: auch der ist veraltet
    expect((await storeSnapshot(db, { sourceId: site.sourceId }, at(second, 30))).outcome).toBe(
      "unchanged"
    )
    expect((await storeSnapshot(db, { sourceId: site.sourceId }, at(first, 25))).outcome).toBe(
      "stale"
    )
    expect(await db.rawSnapshot.count({ where: { sourceId: site.sourceId, scheibenId } })).toBe(1)
  })

  it("jeder gespeicherte Snapshot lässt sich mit gleicher Prüfsumme wieder zusammensetzen", async () => {
    const saved = await db.rawSnapshot.findMany({
      where: { sourceId: site.sourceId },
      select: { id: true },
    })
    expect(saved.length).toBeGreaterThanOrEqual(10)
    for (const { id } of saved) {
      const { data, checksum } = await loadSnapshotData(db, id)
      expect(computeChecksum(data)).toBe(checksum)
    }
  })
})
