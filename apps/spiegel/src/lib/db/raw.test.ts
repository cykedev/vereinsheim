import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import { parseSnapshot } from "@vereinsheim/ingest-contract/parse"
import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import { frozenReadings } from "@vereinsheim/ssmdb2-cases/frozen"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import {
  loadSnapshot,
  loadSnapshotData,
  MAX_OBSERVED_LAG_MS,
  MAX_SEQUENCE_AHEAD_MS,
  setSnapshotsRead,
  storeSnapshot,
} from "./raw"

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
    expect((await store(at(second, 20))).outcome).toBe("stored")
    // ein anderer Stand mit kleinerer Folgenummer
    expect(await store(at(first, 10))).toEqual({
      outcome: "stale",
      latestSequence: BigInt(20),
    })
    // derselbe Stand noch einmal, dann ein anderer Stand dazwischen: auch der ist veraltet
    expect((await store(at(second, 30))).outcome).toBe("unchanged")
    expect((await store(at(first, 25))).outcome).toBe("stale")
    expect(await db.rawSnapshot.count({ where: { sourceId: site.sourceId, scheibenId } })).toBe(1)
  })

  it("ein Stand aus der Zukunft wird abgelehnt und friert die Scheibe nicht ein", async () => {
    const [first] = snapshotsOf("SF-03")
    const nowMs = Date.UTC(2026, 9, 10, 12)
    const observedAt = new Date(nowMs).toISOString()
    const ahead = {
      ...first,
      scheibenId: 777_002,
      observedAt,
      sequence: nowMs + MAX_SEQUENCE_AHEAD_MS + 1,
    }
    expect(await storeSnapshot(db, { sourceId: site.sourceId }, ahead, { nowMs })).toEqual({
      outcome: "future",
      sequence: BigInt(ahead.sequence),
    })
    const now = { ...first, scheibenId: 777_002, observedAt, sequence: nowMs }
    expect((await storeSnapshot(db, { sourceId: site.sourceId }, now, { nowMs })).outcome).toBe(
      "stored"
    )
  })

  it("SF-79: eine Beobachtung mehr als 15 min vor der Empfangszeit wird abgelehnt, nichts abgelegt", async () => {
    const [first] = snapshotsOf("SF-03")
    const observedMs = Date.parse(first.observedAt)
    const old = { ...first, scheibenId: 777_004 }
    const lag = (ms: number) =>
      storeSnapshot(db, { sourceId: site.sourceId }, old, { nowMs: observedMs + ms })
    expect(await lag(MAX_OBSERVED_LAG_MS + 1_000)).toEqual({
      outcome: "past",
      observedAt: new Date(observedMs),
    })
    expect(
      await db.rawSnapshot.count({ where: { sourceId: site.sourceId, scheibenId: 777_004 } })
    ).toBe(0)
    // nach Retry-After (bis 10 min) und einer Runde liest die Brücke neu; so alt wird ein Stand nicht, er gilt noch
    expect((await lag(MAX_OBSERVED_LAG_MS - 1_000)).outcome).toBe("stored")
    expect(MAX_OBSERVED_LAG_MS).toBe(15 * 60_000)
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
    const result = await store(parsed.value)
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

describe("Lebenszeichen", () => {
  /** derselbe Stand mit einem anderen Lebenszeichen und späterer Folgenummer */
  const withLifesign = (snapshot: SnapshotV1, lifesign: string, laterMs: number): SnapshotV1 => {
    const data = {
      ...snapshot.data,
      scheiben: {
        ...snapshot.data.scheiben,
        rows: snapshot.data.scheiben.rows.map((row) => ({ ...row, Zeitstempel: lifesign })),
      },
    }
    const observedAt = new Date(Date.parse(snapshot.observedAt) + laterMs).toISOString()
    return {
      ...snapshot,
      sequence: snapshot.sequence + laterMs,
      observedAt,
      data,
      checksum: computeChecksum(data),
    }
  }

  it("ändert sich nur das Lebenszeichen, entsteht keine Zeile und kein Snapshot; ein echter Stand danach schon", async () => {
    const [first] = snapshotsOf("SF-10")
    const id = first.scheibenId
    await db.rawSnapshot.deleteMany({ where: { sourceId: site.sourceId, scheibenId: id } })
    await db.rawRow.deleteMany({ where: { sourceId: site.sourceId, scheibenId: id } })
    const stored = await store(first)
    expect(stored.outcome).toBe("stored")
    const rows = await storedRows(id)
    const beat = withLifesign(first, "2026-06-01 20:00:07", 7_000)
    const result = await store(beat)
    expect(result).toMatchObject({
      outcome: "lifesign",
      previousLifesign: first.data.scheiben.rows[0].Zeitstempel,
    })
    expect(await storedRows(id)).toBe(rows)
    expect(await db.rawSnapshot.count({ where: { sourceId: site.sourceId, scheibenId: id } })).toBe(
      1
    )
    const latest = await db.rawSnapshot.findFirstOrThrow({
      where: { sourceId: site.sourceId, scheibenId: id },
    })
    expect(latest.lifesign).toBe("2026-06-01 20:00:07")
    expect(latest.lastSequence).toBe(BigInt(beat.sequence))
    // dieselbe Lieferung noch einmal (Wiederholung der Brücke): wieder nur das Lebenszeichen, nichts Neues
    expect((await store(beat)).outcome).toBe("stale")
    // ein echter neuer Stand: der Schuss fällt weg, gespeichert, mit dem Lebenszeichen davor für den Adapter; neu ist nur
    // die Zeile `Scheiben` mit dem zuletzt nur vermerkten Lebenszeichen
    const fewer = {
      ...beat,
      sequence: beat.sequence + 5_000,
      observedAt: new Date(Date.parse(beat.observedAt) + 5_000).toISOString(),
      data: {
        ...beat.data,
        treffer: { ...beat.data.treffer, rows: beat.data.treffer.rows.slice(1) },
      },
    }
    const real = { ...fewer, checksum: computeChecksum(fewer.data) }
    expect(await store(real)).toMatchObject({
      outcome: "stored",
      newRows: 1,
      previousLifesign: "2026-06-01 20:00:07",
    })
  })
})

describe("loadSnapshot", () => {
  it("ein gespeicherter Stand kommt als derselbe Snapshot zurück: gleiche Hülle, Daten mit gleicher Prüfsumme", async () => {
    // eine eigene ScheibenID, damit kein Stand eines anderen Tests schon da ist
    for (const snapshot of snapshotsOf("SF-72")) {
      const original = { ...snapshot, scheibenId: snapshot.scheibenId + 9 }
      const result = await store(original)
      // Lesung 2 zeigt denselben Stand wie Lesung 1
      if (result.outcome === "unchanged") continue
      if (result.outcome !== "stored") throw new Error(result.outcome)
      const { data, ...envelope } = await loadSnapshot(db, result.snapshotId)
      const { data: sent, ...sentEnvelope } = original
      expect(envelope).toEqual(sentEnvelope)
      // die Zeilen in kanonischer Folge, wie die Prüfsumme sie sortiert
      expect(computeChecksum(data)).toBe(original.checksum)
      expect(data.treffer.rows).toHaveLength(sent.treffer.rows.length)
    }
  })
})

describe("setSnapshotsRead", () => {
  it("vermerkt Version des Adapters und Block an den Ständen", async () => {
    const saved = await db.rawSnapshot.findMany({
      where: { sourceId: site.sourceId },
      select: { id: true },
      take: 2,
    })
    await setSnapshotsRead(
      db,
      saved.map((s) => s.id),
      { adapterVersion: "test@1", block: 3 }
    )
    const read = await db.rawSnapshot.findMany({
      where: { id: { in: saved.map((s) => s.id) } },
      select: { adapterVersion: true, block: true },
    })
    expect(read).toEqual(saved.map(() => ({ adapterVersion: "test@1", block: 3 })))
  })
})
