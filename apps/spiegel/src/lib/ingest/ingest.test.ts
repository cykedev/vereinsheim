import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import { frozenExpected, frozenReadings } from "@vereinsheim/ssmdb2-cases/frozen"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { ingestBatch } from "./ingest"

const db = createPrismaClient()
let site: TestSite
let bridgeId: number
/** der erfundene Sportpass mit Zustimmung in den Fällen (`@vereinsheim/ssmdb2-cases`) */
const MUSTER = BigInt(12345678)

beforeAll(async () => {
  site = await createTestSite(db, "ingest")
  const bridge = await db.bridge.create({
    data: { siteId: site.siteId, name: "Test", tokenHash: `test-${site.siteId}` },
  })
  bridgeId = bridge.id
  await db.sportpassConsent.create({
    data: {
      userId: site.ownerId,
      siteId: site.siteId,
      sportpassId: MUSTER,
      confirmedAt: new Date(),
    },
  })
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

const target = () => ({ bridgeId, siteId: site.siteId, timeZone: "Europe/Berlin" })
/** als käme der Stapel zur Beobachtungszeit an (die Fälle sind teils auf Tage nach heute datiert) */
const ingest = (snapshots: readonly SnapshotV1[]) =>
  ingestBatch(db, target(), snapshots, { nowMs: Date.parse(snapshots.at(-1)!.observedAt) })

/** was die Brücke von einer Scheibe eines Falls schickt: die gesendeten Lesungen */
function sent(caseId: string, scheibenId: number): SnapshotV1[] {
  const card = frozenExpected(caseId).cards.find((c) => c.scheibenId === scheibenId)!
  const readings = frozenReadings(caseId)
  return card.sentReadings.map(
    (n) =>
      readings.find((r) => r.reading === n)!.snapshots.find((s) => s.scheibenId === scheibenId)!
  )
}
/** alle Snapshots eines Falls zu einer Scheibe, auch die nicht gesendeten */
const all = (caseId: string, scheibenId: number) =>
  frozenReadings(caseId).flatMap((r) => r.snapshots.filter((s) => s.scheibenId === scheibenId))

const cardOf = (scheibenId: number) =>
  db.card.findFirst({
    where: { sourceId: site.sourceId, scheibenId },
    include: { currentRevision: { include: { shots: { orderBy: { seq: "asc" } } } } },
  })

describe("ingestBatch", () => {
  it("SF-03: Lesung für Lesung eine Scheibe des Schützen mit Zustimmung, am Ende wie am Ausdruck", async () => {
    const expected = frozenExpected("SF-03").cards[0]
    const snapshots = sent("SF-03", expected.scheibenId)
    for (const snapshot of snapshots) {
      const [result] = await ingest([snapshot])
      expect(result.outcome).toBe("stored")
    }
    const card = await cardOf(expected.scheibenId)
    expect(card?.ownerId).toBe(site.ownerId)
    expect(card?.sportpassId).toBe(MUSTER)
    expect(card?.origin).toBe("raw")
    const shots = card!.currentRevision!.shots
    const counted = shots.some((s) => s.stellung !== 0)
      ? shots.filter((s) => s.stellung !== 0)
      : shots
    expect(counted.map((s) => s.treffer)).toEqual([...expected.counted.numbers])
    // gedeutet und vermerkt
    const raw = await db.rawSnapshot.findMany({
      where: { sourceId: site.sourceId, scheibenId: expected.scheibenId },
    })
    expect(raw.every((r) => r.adapterVersion === "meyton-ssmdb2@9")).toBe(true)
    // die Rangliste der SSMDB2 ist angelegt und an der Scheibe, noch ohne Art (die ordnet der Admin zu)
    const ranking = await db.ranking.findFirstOrThrow({
      where: { siteId: site.siteId, cards: { some: { id: card!.id } } },
    })
    expect(ranking.name).toBe(snapshots.at(-1)!.data.scheiben.rows[0].Rangliste)
    expect(ranking.kind).toBeNull()
  })

  it("im Stapel deutet der Adapter je Scheibe nur den neuesten Stand; jeder Stand wird abgelegt", async () => {
    const expected = frozenExpected("SF-21").cards[0]
    const snapshots = sent("SF-21", expected.scheibenId)
    // umgekehrt geliefert: gespeichert wird nach der Folgenummer
    const results = await ingest([...snapshots].reverse())
    expect(results.map((r) => r.index)).toEqual([0, 1])
    expect(results.map((r) => r.outcome)).toEqual(["stored", "stored"])
    const card = await cardOf(expected.scheibenId)
    const newest = await db.rawSnapshot.findFirstOrThrow({
      where: { sourceId: site.sourceId, scheibenId: expected.scheibenId },
      orderBy: { sequence: "desc" },
    })
    expect(card!.currentRevision!.rawSnapshotId).toBe(newest.id)
    // nur der neueste gedeutet: eine Revision, keine Korrektur
    expect(card!.currentRevision!.number).toBe(1)
    const older = await db.rawSnapshot.findFirstOrThrow({
      where: { sourceId: site.sourceId, scheibenId: expected.scheibenId },
      orderBy: { sequence: "asc" },
    })
    expect(older.adapterVersion).toBeNull()
  })

  it("SF-21: einzeln geliefert ist die Korrektur eine neue Revision mit Merkmal „korrigiert“", async () => {
    const expected = frozenExpected("SF-22").cards[0]
    for (const snapshot of sent("SF-22", expected.scheibenId)) await ingest([snapshot])
    const card = await cardOf(expected.scheibenId)
    expect(card!.currentRevision!.number).toBe(2)
    expect([...card!.flags].sort()).toEqual([...expected.flags].sort())
  })

  it("ohne Zustimmung, verdeckt oder gesperrt: verworfen und nichts gespeichert", async () => {
    const qr = frozenExpected("SF-13").cards.find((c) => c.bridge === "nur-qr")!
    const noConsent = all("SF-13", qr.scheibenId)
    expect(
      (await ingest(noConsent)).every((r) => r.outcome === "discarded" && r.reason === "no-consent")
    ).toBe(true)

    // eine fremde SportpassID ohne Zustimmung
    const own = sent("SF-03", frozenExpected("SF-03").cards[0].scheibenId)[0]
    const foreignData = {
      ...own.data,
      scheiben: {
        ...own.data.scheiben,
        rows: own.data.scheiben.rows.map((row) => ({ ...row, SportpassID: "87654321" })),
      },
    }
    const foreign: SnapshotV1 = {
      ...own,
      scheibenId: own.scheibenId + 1,
      data: {
        ...foreignData,
        scheiben: {
          ...foreignData.scheiben,
          rows: foreignData.scheiben.rows.map((row) => ({
            ...row,
            ScheibenID: String(own.scheibenId + 1),
          })),
        },
      },
      checksum: "",
    }
    foreign.checksum = computeChecksum(foreign.data)
    expect(await ingest([foreign])).toEqual([
      { index: 0, scheibenId: foreign.scheibenId, outcome: "discarded", reason: "no-consent" },
    ])
    expect(
      await db.rawSnapshot.count({
        where: { sourceId: site.sourceId, scheibenId: foreign.scheibenId },
      })
    ).toBe(0)

    const held = frozenExpected("SF-19").cards.find((c) => c.sentReadings.length > 0)!
    const later = all("SF-19", held.scheibenId).filter(
      (s) => !sent("SF-19", held.scheibenId).some((x) => x.checksum === s.checksum)
    )
    const hidden = await ingest(later)
    expect(hidden.some((r) => r.reason === "hidden")).toBe(true)

    const blocked = frozenExpected("SF-30").cards[0]
    const [snapshot] = sent("SF-30", blocked.scheibenId)
    await db.tombstone.create({
      data: {
        sourceId: site.sourceId,
        scheibenId: blocked.scheibenId,
        startedAt: new Date(snapshot.observedAt),
        reason: "abgelehnt",
      },
    })
    expect(await ingest([snapshot])).toEqual([
      { index: 0, scheibenId: blocked.scheibenId, outcome: "discarded", reason: "blocked" },
    ])

    const stored = await db.rawSnapshot.count({
      where: { sourceId: site.sourceId, scheibenId: { in: [qr.scheibenId, blocked.scheibenId] } },
    })
    expect(stored).toBe(0)
  })

  it("eine neue Epoche wartet auf den Admin (SF-23): nichts angenommen, die Quelle unbestätigt angelegt", async () => {
    const [snapshot] = sent("SF-03", frozenExpected("SF-03").cards[0].scheibenId)
    const results = await ingest([{ ...snapshot, epoch: 2 }])
    expect(results[0].outcome).toBe("epoch-unconfirmed")
    const source = await db.source.findUniqueOrThrow({
      where: { siteId_epoch: { siteId: site.siteId, epoch: 2 } },
    })
    expect(source.confirmedAt).toBeNull()
  })

  it("unbekanntes Schema: Rohdaten abgelegt und markiert, keine Scheibe (SF-25)", async () => {
    const expected = frozenExpected("SF-07").cards[0]
    const [snapshot] = sent("SF-07", expected.scheibenId)
    const data = {
      ...snapshot.data,
      treffer: {
        ...snapshot.data.treffer,
        columns: { ...snapshot.data.treffer.columns, x: "double" },
      },
    }
    const odd: SnapshotV1 = { ...snapshot, data, checksum: computeChecksum(data) }
    expect((await ingest([odd]))[0].outcome).toBe("quarantined")
    const raw = await db.rawSnapshot.findFirstOrThrow({
      where: { sourceId: site.sourceId, scheibenId: expected.scheibenId },
    })
    expect(raw.quarantine).toBe("treffer.x hat einen anderen Typ")
    expect(raw.adapterVersion).toBeNull()
    expect(await cardOf(expected.scheibenId)).toBeNull()
  })

  it("eine andere SportpassID an derselben Scheibe: nichts geschrieben, in Quarantäne (Review, SF-37)", async () => {
    const other = await db.user.create({
      data: { email: `b-${site.siteId}@example.com`, passwordHash: "-" },
    })
    try {
      await db.sportpassConsent.create({
        data: {
          userId: other.id,
          siteId: site.siteId,
          sportpassId: BigInt(87654321),
          confirmedAt: new Date(),
        },
      })
      const expected = frozenExpected("SF-02").cards[0]
      const snapshots = sent("SF-02", expected.scheibenId)
      await ingest(snapshots.slice(0, 1))
      const before = await cardOf(expected.scheibenId)
      expect(before?.ownerId).toBe(site.ownerId)
      const last = snapshots.at(-1)!
      const data = {
        ...last.data,
        scheiben: {
          ...last.data.scheiben,
          rows: last.data.scheiben.rows.map((row) => ({ ...row, SportpassID: "87654321" })),
        },
      }
      const moved: SnapshotV1 = {
        ...last,
        sequence: Math.max(last.sequence, snapshots[0].sequence + 1),
        data,
        checksum: computeChecksum(data),
      }
      expect((await ingest([moved]))[0].outcome).toBe("quarantined")
      const after = await cardOf(expected.scheibenId)
      expect(after?.ownerId).toBe(site.ownerId)
      expect(after?.sportpassId).toBe(MUSTER)
      expect(after?.currentRevision?.shots.length).toBe(before?.currentRevision?.shots.length)
    } finally {
      await db.user.delete({ where: { id: other.id } })
    }
  })

  it("eine Scheibe, die sich nicht schreiben lässt, hält die übrigen des Stapels nicht auf; Ungedeutetes wird nachgeholt (Review)", async () => {
    const good = frozenExpected("SF-09").cards[0]
    const [ok] = sent("SF-09", good.scheibenId)
    const badSource = frozenExpected("SF-17").cards[0]
    const [base] = sent("SF-17", badSource.scheibenId)
    // zwei Zeilen mit derselben Stellung und Nummer: der Adapter liest sie, `writeRevision` lehnt sie ab
    const rows = base.data.treffer.rows
    const data = {
      ...base.data,
      treffer: { ...base.data.treffer, rows: [...rows, { ...rows[0], x: "17" }] },
    }
    const bad: SnapshotV1 = { ...base, data, checksum: computeChecksum(data) }
    const results = await ingest([bad, ok].sort((a, b) => a.sequence - b.sequence))
    const byId = new Map(results.map((r) => [r.scheibenId, r.outcome]))
    expect(byId.get(bad.scheibenId)).toBe("quarantined")
    expect(byId.get(ok.scheibenId)).toBe("stored")
    expect(await cardOf(ok.scheibenId)).not.toBeNull()
    // derselbe kaputte Stand noch einmal: endgültig, keine Schleife
    expect((await ingest([{ ...bad, sequence: bad.sequence + 1 }]))[0].outcome).toBe("unchanged")

    // ein gespeicherter, aber nie gedeuteter Stand (etwa nach einem Ausfall der Datenbank) wird beim nächsten Mal gedeutet
    await db.card.deleteMany({ where: { sourceId: site.sourceId, scheibenId: ok.scheibenId } })
    await db.rawSnapshot.updateMany({
      where: { sourceId: site.sourceId, scheibenId: ok.scheibenId },
      data: { adapterVersion: null },
    })
    expect((await ingest([{ ...ok, sequence: ok.sequence + 1 }]))[0].outcome).toBe("unchanged")
    expect(await cardOf(ok.scheibenId)).not.toBeNull()
  })

  it("nur das Lebenszeichen bewegt: vermerkt, die Scheibe wieder offen, kein neuer Stand", async () => {
    const expected = frozenExpected("SF-10").cards[0]
    const snapshots = sent("SF-10", expected.scheibenId)
    const last = snapshots.at(-1)!
    for (const snapshot of snapshots) await ingest([snapshot])
    await db.card.updateMany({
      where: { sourceId: site.sourceId, scheibenId: expected.scheibenId },
      data: { state: "resting" },
    })
    const data = {
      ...last.data,
      scheiben: {
        ...last.data.scheiben,
        rows: last.data.scheiben.rows.map((row) => ({
          ...row,
          Zeitstempel: "2026-12-31 23:59:59",
        })),
      },
    }
    const beat: SnapshotV1 = {
      ...last,
      sequence: last.sequence + 9_000,
      observedAt: new Date(Date.parse(last.observedAt) + 9_000).toISOString(),
      data,
      checksum: computeChecksum(data),
    }
    const before = await db.rawSnapshot.count({
      where: { sourceId: site.sourceId, scheibenId: expected.scheibenId },
    })
    expect((await ingest([beat]))[0].outcome).toBe("lifesign")
    const card = await cardOf(expected.scheibenId)
    expect(card?.state).toBe("open")
    expect(card?.lifesignAt?.toISOString()).toBe(beat.observedAt)
    expect(
      await db.rawSnapshot.count({
        where: { sourceId: site.sourceId, scheibenId: expected.scheibenId },
      })
    ).toBe(before)
  })
})
