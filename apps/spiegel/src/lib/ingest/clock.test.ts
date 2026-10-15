import { afterAll, beforeAll, describe, expect, it } from "vitest"

import type { HeartbeatV1 } from "@vereinsheim/ingest-contract/api"
import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import type { RowV1, SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import { frozenReadings } from "@vereinsheim/ssmdb2-cases/frozen"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { authenticateBridge, createPairing, recordHeartbeat, redeemPairing } from "./bridges"
import { ingestBatch } from "./ingest"

// Uhr der Brücke falsch (SF-79): Die Brücke startet mit einer Uhr, die 45 h nachgeht (Pi ohne Echtzeituhr, fake-hwclock
// vor NTP); die Uhr der Anlage stimmt. Ohne Prüfung nähme Spiegel alles an, verschöbe die Scheibe um 45 h, schaltete sie
// mitten im Schießen endgültig und hielte die Uhr der Anlage für falsch.

const db = createPrismaClient()
let site: TestSite
const MUSTER = BigInt(12345678)
const BEHIND_MS = 45 * 3_600_000

beforeAll(async () => {
  site = await createTestSite(db, "clock")
  await db.sportpassConsent.create({
    data: {
      userId: site.ownerId,
      siteId: site.siteId,
      sportpassId: MUSTER,
      confirmedAt: new Date(),
      firstCardConfirmedAt: new Date(),
    },
  })
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

const iso = (ms: number) => new Date(ms).toISOString()
/** Wanduhr der Anlage (Europe/Berlin, Oktober: UTC+2) als Text wie in der SSMDB2 */
const wall = (ms: number) =>
  iso(ms + 2 * 3_600_000)
    .slice(0, 19)
    .replace("T", " ")

/** ein Stand mit anderem Lebenszeichen und den ersten `shots` Treffern; die Beobachtung nach der Uhr der Brücke */
function variant(
  base: SnapshotV1,
  { shots, lifesignMs, observedMs }: { shots: RowV1[]; lifesignMs: number; observedMs: number }
): SnapshotV1 {
  const data = {
    ...base.data,
    scheiben: {
      ...base.data.scheiben,
      rows: base.data.scheiben.rows.map((row) => ({ ...row, Zeitstempel: wall(lifesignMs) })),
    },
    treffer: { ...base.data.treffer, rows: shots },
  }
  return {
    ...base,
    sequence: observedMs,
    observedAt: iso(observedMs),
    data,
    checksum: computeChecksum(data),
  }
}

describe("Uhr der Brücke geht 45 h nach (SF-79)", () => {
  it("Spiegel nimmt weder Stände noch Uhrmessung an; mit richtiger Uhr stimmt die Scheibe", async () => {
    // SF-03, dritte Lesung: 20 Schüsse 19:03:47 bis 19:18:13 Ortszeit. Gesendet mit 18, 19 und 20 Schüssen.
    const base = frozenReadings("SF-03")[2].snapshots[0]
    const rows = base.data.treffer.rows
    const shotAt = (i: number) => Date.parse(rows[i].Zeitstempel!.replace(" ", "T") + "+02:00")
    const firstShot = shotAt(0)
    // zwei Stände 22 s auseinander, das Lebenszeichen läuft (Meyton schreibt es alle 5 bis 10 s)
    const realB = shotAt(rows.length - 2) + 10_000
    const realA = realB - 22_000
    const stand = (shots: number, observedMs: number) =>
      variant(base, { shots: rows.slice(0, shots), lifesignMs: shotAt(shots - 1), observedMs })

    const pairing = await createPairing(db, {
      siteId: site.siteId,
      name: "Pi",
      createdById: null,
      nowMs: realA - 120_000,
    })
    const paired = (await redeemPairing(db, {
      code: pairing.code,
      name: null,
      bridgeVersion: "0.1.0",
      nowMs: realA - 110_000,
    }))!
    const auth = async (nowMs: number) => (await authenticateBridge(db, paired.token, nowMs))!
    const heartbeat = (realMs: number, behindMs: number, offsetMs: number): HeartbeatV1 => ({
      contractVersion: 1,
      bridgeVersion: "0.1.0",
      runStartedAt: iso(realA - 100_000 - behindMs),
      sentAt: iso(realMs - behindMs),
      status: "ok",
      backlog: 0,
      lastDbContactAt: iso(realMs - behindMs),
      queryMs: 12,
      sourceClockOffsetMs: offsetMs,
      heldBack: [],
      sourceFingerprint: null,
    })
    const readings = () => db.clockReading.findMany({ where: { siteId: site.siteId } })

    // eine Brücke ohne eigene Prüfung: Heartbeat mit der Uhr vom Vorabend, die Anlage scheint 45 h vorzugehen
    const hb1 = realA - 60_000
    await recordHeartbeat(db, await auth(hb1), heartbeat(hb1, BEHIND_MS, BEHIND_MS), hb1)
    expect(await readings()).toEqual([])

    const target = { bridgeId: paired.bridgeId, siteId: site.siteId, timeZone: "Europe/Berlin" }
    const behind = await ingestBatch(db, target, [stand(18, realA - BEHIND_MS)], { nowMs: realA })
    const behindB = await ingestBatch(db, target, [stand(19, realB - BEHIND_MS)], { nowMs: realB })
    expect([behind[0].outcome, behindB[0].outcome]).toEqual(["past", "past"])
    const key = { sourceId: site.sourceId, scheibenId: base.scheibenId }
    expect(await db.rawSnapshot.count({ where: key })).toBe(0)
    expect(await db.card.count({ where: key })).toBe(0)

    // NTP: dieselben Stände mit richtiger Zeit, der Heartbeat wieder richtig
    const hb2 = realA - 5_000
    await recordHeartbeat(db, await auth(hb2), heartbeat(hb2, 0, -2_000), hb2)
    expect((await readings()).map((r) => r.offsetMs)).toEqual([-2_000])
    const [ra] = await ingestBatch(db, target, [stand(18, realA)], { nowMs: realA })
    const [rb] = await ingestBatch(db, target, [stand(19, realB)], { nowMs: realB })
    expect([ra.outcome, rb.outcome]).toEqual(["stored", "stored"])
    const card = await db.card.findFirstOrThrow({ where: key })
    // Schusszeiten mit Millisekunden, `shotAt` nur auf die Sekunde
    const second = (ms: number, expected: number) => ms - expected >= 0 && ms - expected < 1_000
    expect(second(card.startedAt.getTime(), firstShot)).toBe(true)
    expect(second(card.endedAt!.getTime(), shotAt(rows.length - 2))).toBe(true)
    expect(card.flags).not.toContain("uhr-abweichung")
    expect(card.state).toBe("open")
    const hb3 = realB + 30_000
    await recordHeartbeat(db, await auth(hb3), heartbeat(hb3, 0, -2_000), hb3)
    expect((await db.card.findUniqueOrThrow({ where: { id: card.id } })).state).toBe("open")

    // eine neue Scheibe nimmt die richtige Messung der Anlage
    const other = frozenReadings("SF-10")[0].snapshots[0]
    const [ro] = await ingestBatch(db, target, [other], { nowMs: Date.parse(other.observedAt) })
    const otherCard = await db.card.findFirstOrThrow({
      where: { sourceId: site.sourceId, scheibenId: other.scheibenId },
    })
    const otherFirst = Date.parse(
      other.data.treffer.rows[0].Zeitstempel!.replace(" ", "T") + "+02:00"
    )
    expect(ro.outcome).toBe("stored")
    expect(second(otherCard.startedAt.getTime(), otherFirst)).toBe(true)
  })
})
