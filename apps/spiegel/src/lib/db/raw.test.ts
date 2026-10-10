import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import { parseSnapshot } from "@vereinsheim/ingest-contract/parse"
import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import { frozenReadings } from "@vereinsheim/ssmdb2-cases/frozen"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { loadSnapshotData, MAX_SEQUENCE_AHEAD_MS, storeSnapshot } from "./raw"

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

/** ablegen, als käme der Snapshot gerade an (die Fälle sind teils auf Tage nach heute datiert) */
const store = (snapshot: SnapshotV1) =>
  storeSnapshot(db, { sourceId: site.sourceId }, snapshot, {
    nowMs: Date.parse(snapshot.observedAt),
  })

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
    for (const snapshot of snapshots) results.push(await store(snapshot))
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
    for (const snapshot of snapshots) results.push(await store(snapshot))
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
      const result = await store(snapshot)
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

  it("ein Stand aus der Zukunft wird abgelehnt und friert die Scheibe nicht ein", async () => {
    const [first] = snapshotsOf("SF-03")
    const nowMs = Date.UTC(2026, 9, 10, 12)
    const ahead = { ...first, scheibenId: 777_002, sequence: nowMs + MAX_SEQUENCE_AHEAD_MS + 1 }
    expect(await storeSnapshot(db, { sourceId: site.sourceId }, ahead, { nowMs })).toEqual({
      outcome: "future",
      sequence: BigInt(ahead.sequence),
    })
    const now = { ...first, scheibenId: 777_002, sequence: nowMs }
    expect((await storeSnapshot(db, { sourceId: site.sourceId }, now, { nowMs })).outcome).toBe(
      "stored"
    )
  })

  it("ein Nullzeichen in einer Zelle (der Vertrag erlaubt es) wird gespeichert und kommt unverändert zurück", async () => {
    const [first] = snapshotsOf("SF-03")
    const [row] = first.data.scheiben.rows
    const name = Object.keys(row).find((key) => row[key] !== null)!
    const data = {
      ...first.data,
      scheiben: { ...first.data.scheiben, rows: [{ ...row, [name]: "a\u0000b" }] },
    }
    const parsed = parseSnapshot({
      ...first,
      scheibenId: 777_003,
      data,
      checksum: computeChecksum(data),
    })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    const result = await storeSnapshot(db, { sourceId: site.sourceId }, parsed.value)
    expect(result.outcome).toBe("stored")
    if (result.outcome !== "stored") return
    const loaded = await loadSnapshotData(db, result.snapshotId)
    expect(loaded.data.scheiben.rows[0][name]).toBe("a\u0000b")
    expect(computeChecksum(loaded.data)).toBe(parsed.value.checksum)
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
