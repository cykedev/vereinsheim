import { createHash } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import { zonedDayStartMs, zonedWallTimeMs } from "@vereinsheim/lib/format"
import { frozenExpected, frozenReadings } from "@vereinsheim/ssmdb2-cases/frozen"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { eveningOfStart, printedId } from "../card-requests/id"
import { startHintMs } from "../db/blocks"
import { writeEnteredCard } from "../db/entered"
import type { EnteredShot } from "../entered/details"
import { purgeCards } from "../db/purge"
import { attachPrintout } from "../printouts/queries"
import { NO_VALUES } from "../printouts/store"

import { finishRequests, recordRequestOutcomes } from "../card-requests/queries"

import { bridgeState, recordHeartbeat } from "./bridges"
import { ingestBatch } from "./ingest"
import { shotValuesOf } from "./meyton-ssmdb2"

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
  it("ohne Zustimmung, mit Auftrag und passendem Abend: beim Auftraggeber, nicht wartend; erledigt, wenn endgültig", async () => {
    const snapshots = as(sent("SF-03"), "87654321", 70_001)
    const r = await request(site.ownerId, 70_001, eveningOf(snapshots[0]))
    // die ersten Stände: Die Scheibe hängt am Auftrag, er bleibt offen, damit weitere Schüsse nachkommen
    const first = await ingest(snapshots.slice(0, 2))
    expect(first.every((x) => x.outcome !== "discarded")).toBe(true)
    const card = await db.card.findFirstOrThrow({
      where: { sourceId: site.sourceId, scheibenId: 70_001 },
      orderBy: { block: "desc" },
    })
    expect(card.ownerId).toBe(site.ownerId)
    expect(card.ownerPending).toBe(false)
    expect(card.state).not.toBe("final")
    await finishRequests(db, site.siteId)
    expect(await statusOf(r.id)).toEqual({ status: "open", cardId: card.id })
    const rest = await ingest(snapshots.slice(2))
    expect(rest.every((x) => x.outcome !== "discarded")).toBe(true)
    // der Heartbeat schaltet die Scheibe endgültig: der Auftrag ist erledigt
    await db.card.updateMany({
      where: { sourceId: site.sourceId, scheibenId: 70_001 },
      data: { state: "final" },
    })
    await finishRequests(db, site.siteId)
    expect((await statusOf(r.id)).status).toBe("done")
    // danach gilt der Auftrag nicht mehr: ein späterer Stand ohne Zustimmung bleibt draußen
    const later = as(sent("SF-03"), "87654321", 70_001).map((s) => ({
      ...s,
      sequence: s.sequence + 10_000_000,
    }))
    expect((await ingest([later.at(-1)!]))[0].reason).toBe("no-consent")
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
    expect((await statusOf(first.id)).cardId).not.toBeNull()
    expect((await statusOf(second.id)).status).toBe("taken")
  })

  it("eine Sportpassnummer, die ein anderes Konto eingetragen hat (auch wartend), schützt die Scheibe", async () => {
    await db.sportpassConsent.create({
      data: { userId: other, siteId: site.siteId, sportpassId: BigInt(55555555) },
    })
    const snapshots = as(sent("SF-03"), "55555555", 70_007)
    const r = await request(site.ownerId, 70_007, eveningOf(snapshots[0]))
    const results = await ingest(snapshots)
    expect(results.every((x) => x.reason === "no-consent")).toBe(true)
    expect(await stored(70_007)).toBe(0)
    expect((await statusOf(r.id)).status).toBe("taken")
  })

  it("gesperrt (Grabstein): nichts gespeichert, Auftrag gehalten", async () => {
    const snapshots = as(sent("SF-03"), "87654321", 70_008)
    await db.tombstone.create({
      data: {
        sourceId: site.sourceId,
        scheibenId: 70_008,
        startedAt: new Date(
          startHintMs(
            snapshots[0].data.treffer.rows.map((row) => row.Zeitstempel),
            Date.parse(snapshots[0].observedAt)
          )
        ),
        reason: "not-mine",
      },
    })
    const r = await request(site.ownerId, 70_008, eveningOf(snapshots[0]))
    const results = await ingest(snapshots)
    // der erste Stand trifft die Sperre und hält den Auftrag; danach gilt keiner mehr
    expect(results.map((x) => x.reason)).toEqual([
      "blocked",
      ...results.slice(1).map(() => "no-consent"),
    ])
    expect(await stored(70_008)).toBe(0)
    expect((await statusOf(r.id)).status).toBe("held")
  })

  it("ein Auftrag eines deaktivierten Kontos zählt nicht", async () => {
    const snapshots = as(sent("SF-03"), "87654321", 70_009)
    const r = await request(site.ownerId, 70_009, eveningOf(snapshots[0]))
    await db.user.update({ where: { id: site.ownerId }, data: { isActive: false } })
    try {
      const results = await ingest(snapshots)
      expect(results.every((x) => x.reason === "no-consent")).toBe(true)
      expect(await stored(70_009)).toBe(0)
      expect((await statusOf(r.id)).status).toBe("open")
    } finally {
      await db.user.update({ where: { id: site.ownerId }, data: { isActive: true } })
    }
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
  it("der Zustand nennt offene Aufträge aktiver Konten mit ihrem Abend, mit offenem Auftrag alle Sperren", async () => {
    // eine alte Sperre (vor dem Fenster von 60 Tagen): ohne Auftrag nicht im Zustand, mit Auftrag schon
    const oldBlock = { scheibenId: 70_150, startedAt: new Date(Date.now() - 200 * 86_400_000) }
    await db.deleteLock.create({
      data: { sourceId: site.sourceId, userId: site.ownerId, ...oldBlock },
    })
    const hasOldBlock = (state: Awaited<ReturnType<typeof bridgeState>>) =>
      state.blocked.some((b) => b.scheibenId === oldBlock.scheibenId)
    // ohne Auftrag und ohne Nachladen nur die jüngsten Sperren
    await db.cardRequest.updateMany({
      where: { siteId: site.siteId, status: "open" },
      data: { status: "withdrawn" },
    })
    await db.sportpassConsent.updateMany({
      where: { siteId: site.siteId },
      data: { historyLoadedAt: new Date() },
    })
    expect(hasOldBlock(await bridgeState(db, site.siteId))).toBe(false)

    const r = await request(site.ownerId, 70_101, "2026-10-21")
    const state = await bridgeState(db, site.siteId)
    expect(state.requests).toContainEqual({ id: r.id, scheibenId: 70_101, day: "2026-10-21" })
    expect(hasOldBlock(state)).toBe(true)
    await db.user.update({ where: { id: site.ownerId }, data: { isActive: false } })
    try {
      expect((await bridgeState(db, site.siteId)).requests?.map((q) => q.id)).not.toContain(r.id)
    } finally {
      await db.user.update({ where: { id: site.ownerId }, data: { isActive: true } })
    }
  })

  it("der Heartbeat schließt „nicht in der Ablage“ und „gehalten“, „gesendet“ nicht; nur offene der Anlage", async () => {
    const missing = await request(site.ownerId, 70_201, "2026-10-21")
    const held = await request(site.ownerId, 70_202, "2026-10-21")
    const sentOne = await request(site.ownerId, 70_203, "2026-10-21")
    const wrongDay = await request(site.ownerId, 70_205, "2026-10-21")
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
          { id: wrongDay.id, outcome: "mismatch" },
        ],
      },
      now
    )
    expect((await statusOf(missing.id)).status).toBe("missing")
    expect((await statusOf(held.id)).status).toBe("held")
    expect((await statusOf(sentOne.id)).status).toBe("open")
    expect((await statusOf(closed.id)).status).toBe("withdrawn")
    expect((await statusOf(wrongDay.id)).status).toBe("mismatch")
  })

  it("ein Auftrag, der schon eine Scheibe hat, bleibt bei „nicht gefunden“ offen", async () => {
    const fetching = await request(site.ownerId, 70_206, "2026-10-21")
    const card = await db.card.findFirstOrThrow({ where: { sourceId: site.sourceId } })
    await db.cardRequest.update({ where: { id: fetching.id }, data: { cardId: card.id } })
    await recordRequestOutcomes(db, site.siteId, [
      { id: fetching.id, outcome: "missing" },
      { id: fetching.id, outcome: "held" },
    ])
    expect((await statusOf(fetching.id)).status).toBe("open")
  })
})

describe("Scheibe vom Ausdruck", () => {
  const ZONE = "Europe/Berlin"
  const MINUTE = 60_000
  /** Beginn eines Stands als Wanduhr der Anlage (Felder als UTC) */
  const wallStart = (snapshot: SnapshotV1) =>
    startHintMs(
      snapshot.data.treffer.rows.map((row) => row.Zeitstempel),
      Date.parse(snapshot.observedAt)
    )
  const lastShotWall = (snapshot: SnapshotV1) =>
    Math.max(
      ...snapshot.data.treffer.rows.map((row) =>
        Date.parse(`${row.Zeitstempel!.replace(" ", "T")}Z`)
      )
    )
  const STAMP = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)$/
  const shiftStamp = (value: string | null, ms: number) => {
    const m = value && STAMP.exec(value)
    if (!m) return value
    const at = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) + ms
    return new Date(at).toISOString().slice(0, 19).replace("T", " ")
  }
  /**
   * derselbe Stand später: alle Zeiten der Ablage, Beobachtung und Folgenummer um `ms` verschoben; mit `shotsOnly` nur die
   * Zeiten der Ablage
   */
  const shifted = (snapshot: SnapshotV1, ms: number, shotsOnly = false): SnapshotV1 => {
    const shift = (rows: typeof snapshot.data.treffer.rows) =>
      rows.map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [k, k === "ScheibenID" ? v : shiftStamp(v, ms)])
        )
      )
    const data = {
      scheiben: { ...snapshot.data.scheiben, rows: shift(snapshot.data.scheiben.rows) },
      serien: { ...snapshot.data.serien, rows: shift(snapshot.data.serien.rows) },
      treffer: { ...snapshot.data.treffer, rows: shift(snapshot.data.treffer.rows) },
    }
    if (shotsOnly) return { ...snapshot, data, checksum: computeChecksum(data) }
    const observedMs = Date.parse(snapshot.observedAt) + ms
    return {
      ...snapshot,
      sequence: snapshot.sequence + ms,
      observedAt: new Date(observedMs).toISOString(),
      data,
      checksum: computeChecksum(data),
    }
  }

  /**
   * eine Scheibe vom Ausdruck des Schützen mit Auftrag, wie „Scheibe holen“ sie anlegt: mit einer Druckzeit (Wanduhr der
   * Anlage) ein erfundener Ausdruck daran, ohne (getippte ID) 12 Uhr des Tags
   */
  async function pdfCard(
    scheibenId: number,
    day: string,
    printedWallMs: number | null,
    userId = site.ownerId,
    shots: EnteredShot[] = []
  ) {
    const saved = await writeEnteredCard(db, {
      ownerId: userId,
      origin: "pdf",
      disciplineId: site.disciplineId,
      startedAtMs:
        printedWallMs === null
          ? zonedDayStartMs(day, ZONE) + 12 * 60 * MINUTE
          : zonedWallTimeMs(printedWallMs, ZONE),
      kind: "training",
      details: shots.length ? { shots } : {},
      reason: "printout",
    })
    if (saved.kind !== "saved") throw new Error(saved.kind)
    if (printedWallMs !== null)
      await attachPrintout(
        db,
        {
          sha256: createHash("sha256").update(`${site.siteId}-${scheibenId}`).digest("hex"),
          size: 1,
          fileName: "ausdruck.pdf",
          hex: printedId(scheibenId),
          scheibenId,
          printedAt: new Date(zonedWallTimeMs(printedWallMs, ZONE)),
          values: NO_VALUES,
        },
        saved.cardId
      )
    const r = await db.cardRequest.create({
      data: { userId, siteId: site.siteId, scheibenId, day, cardId: saved.cardId },
    })
    return { cardId: saved.cardId, requestId: r.id }
  }
  const cardsOf = (scheibenId: number) =>
    db.card.findMany({
      where: { sourceId: site.sourceId, scheibenId },
      orderBy: { block: "asc" },
    })
  const cardById = (id: string) => db.card.findUniqueOrThrow({ where: { id } })

  /** nur die Wertung von SF-03 (ein Block) unter eigener ScheibenID */
  const scoring = (scheibenId: number, sportpass = "87654321") =>
    as(sent("SF-03").slice(1), sportpass, scheibenId)

  it("gedruckt nach den Schüssen: dieselbe Scheibe bekommt Quelle und Rohdaten, keine zweite", async () => {
    const snapshots = scoring(71_001)
    const { cardId, requestId } = await pdfCard(
      71_001,
      eveningOf(snapshots[0]),
      lastShotWall(snapshots.at(-1)!) + 2 * MINUTE
    )
    const results = await ingest(snapshots)
    expect(results.every((x) => x.outcome !== "discarded")).toBe(true)
    const card = await cardById(cardId)
    expect(card).toMatchObject({
      sourceId: site.sourceId,
      scheibenId: 71_001,
      origin: "raw",
      place: null,
      ownerId: site.ownerId,
    })
    // die Disziplin des Stands (LP 20), nicht die gewählte
    expect(card.disciplineId).not.toBe(site.disciplineId)
    expect(await db.cardRevision.count({ where: { cardId } })).toBe(2)
    expect((await cardsOf(71_001)).map((c) => c.id)).toEqual([cardId])
    expect(await statusOf(requestId)).toEqual({ status: "open", cardId })
  })

  it("gedruckt sechs Minuten vor dem ersten Schuss: nichts gespeichert, „passt nicht zum Ausdruck“", async () => {
    const snapshots = scoring(71_002)
    const { cardId, requestId } = await pdfCard(
      71_002,
      eveningOf(snapshots[0]),
      wallStart(snapshots[0]) - 6 * MINUTE
    )
    const results = await ingest(snapshots)
    expect(results.every((x) => x.reason === "no-consent")).toBe(true)
    expect(await stored(71_002)).toBe(0)
    expect((await statusOf(requestId)).status).toBe("printMismatch")
    expect(await cardById(cardId)).toMatchObject({ origin: "pdf", sourceId: null })
  })

  it("gedruckt drei Minuten vor dem ersten Schuss: gefüllt (Uhren der Anlage, SF-29)", async () => {
    const snapshots = scoring(71_003)
    const { cardId } = await pdfCard(
      71_003,
      eveningOf(snapshots[0]),
      wallStart(snapshots[0]) - 3 * MINUTE
    )
    await ingest(snapshots)
    expect((await cardById(cardId)).sourceId).toBe(site.sourceId)
  })

  describe("mit Werten vom Ausdruck: Schuss für Schuss", () => {
    /** die Schüsse einer Art aus dem letzten Stand, wie ein Ausdruck sie zeigt (Zehntel, ohne Lage) */
    const printedOf = (snapshot: SnapshotV1, probe = false): EnteredShot[] =>
      shotValuesOf(snapshot)
        .filter((shot) => (shot.stellung === 0) === probe)
        .sort((a, b) => a.treffer - b.treffer)
        .map((shot) => ({
          series: null,
          ring: shot.ring,
          decimalTenths: shot.decimalTenths,
          probe,
        }))
    const printedAfter = (snapshots: readonly SnapshotV1[]) =>
      lastShotWall(snapshots.at(-1)!) + 2 * MINUTE

    it("gleiche Werte: gefüllt, neue Revision mit Lagen und Zeiten der Rohdaten", async () => {
      const snapshots = scoring(71_101)
      const shots = printedOf(snapshots.at(-1)!)
      expect(shots.length).toBeGreaterThan(0)
      const { cardId } = await pdfCard(
        71_101,
        eveningOf(snapshots[0]),
        printedAfter(snapshots),
        site.ownerId,
        shots
      )
      await ingest(snapshots)
      const card = await cardById(cardId)
      expect(card).toMatchObject({ sourceId: site.sourceId, origin: "raw" })
      expect(await db.cardRevision.count({ where: { cardId } })).toBe(2)
      const current = await db.shot.findMany({
        where: { revisionId: card.currentRevisionId! },
        orderBy: { seq: "asc" },
      })
      expect(current.length).toBeGreaterThanOrEqual(shots.length)
      expect(current.every((shot) => shot.xUm !== null && shot.firedAt !== null)).toBe(true)
    })

    it("Zwischenausdruck mit den ersten Schüssen: gefüllt", async () => {
      const snapshots = scoring(71_102)
      const shots = printedOf(snapshots.at(-1)!)
      const { cardId } = await pdfCard(
        71_102,
        eveningOf(snapshots[0]),
        printedAfter(snapshots),
        site.ownerId,
        shots.slice(0, Math.ceil(shots.length / 2))
      )
      await ingest(snapshots)
      expect((await cardById(cardId)).sourceId).toBe(site.sourceId)
    })

    it("ein Zehntel anders: nichts gespeichert, „passt nicht zum Ausdruck“, die Werte bleiben", async () => {
      const snapshots = scoring(71_103)
      const shots = printedOf(snapshots.at(-1)!)
      const at = shots.findIndex(
        (shot) => shot.decimalTenths! % 10 < 9 && shot.decimalTenths! < 100
      )
      shots[at] = { ...shots[at], decimalTenths: shots[at].decimalTenths! + 1 }
      const { cardId, requestId } = await pdfCard(
        71_103,
        eveningOf(snapshots[0]),
        printedAfter(snapshots),
        site.ownerId,
        shots
      )
      const results = await ingest(snapshots)
      expect(results.every((x) => x.reason === "no-consent")).toBe(true)
      expect(await stored(71_103)).toBe(0)
      expect((await statusOf(requestId)).status).toBe("printMismatch")
      const card = await cardById(cardId)
      expect(card).toMatchObject({ origin: "pdf", sourceId: null })
      expect(await db.shot.count({ where: { revisionId: card.currentRevisionId! } })).toBe(
        shots.length
      )
    })

    it("Ausdruck im Modus Probe gegen eine Wertung: „passt nicht zum Ausdruck“", async () => {
      const snapshots = scoring(71_104)
      const shots = printedOf(snapshots.at(-1)!).map((shot) => ({ ...shot, probe: true }))
      const { requestId } = await pdfCard(
        71_104,
        eveningOf(snapshots[0]),
        printedAfter(snapshots),
        site.ownerId,
        shots
      )
      await ingest(snapshots)
      expect(await stored(71_104)).toBe(0)
      expect((await statusOf(requestId)).status).toBe("printMismatch")
    })
  })

  describe("zwei Blöcke (SF-03, die Probe 20 Minuten früher)", () => {
    const twoBlocks = (scheibenId: number) => {
      const [probe, ...rest] = as(sent("SF-03"), "87654321", scheibenId)
      return [shifted(probe, -20 * MINUTE, true), ...rest]
    }
    /** in einem Stapel, „jetzt“ nahe der Probe: Sonst ist ihre Beobachtung zu alt (SF-79) */
    const ingestTwo = (snapshots: readonly SnapshotV1[]) =>
      ingestBatch(db, target(), snapshots, {
        nowMs: Date.parse(snapshots[0].observedAt) + 10 * MINUTE,
      })

    it("nach beiden Blöcken gedruckt: Die Scheibe vom Ausdruck ist die Wertung, die Probe eine eigene", async () => {
      const snapshots = twoBlocks(71_004)
      const { cardId } = await pdfCard(
        71_004,
        eveningOf(snapshots[0]),
        lastShotWall(snapshots.at(-1)!) + 2 * MINUTE
      )
      await ingestTwo(snapshots)
      const cards = await cardsOf(71_004)
      expect(cards.map((c) => [c.block, c.id === cardId, c.ownerId])).toEqual([
        [0, false, site.ownerId],
        [1, true, site.ownerId],
      ])
    })

    it("zwischen den Blöcken gedruckt: Die Scheibe vom Ausdruck ist die Probe, die Wertung neu", async () => {
      const snapshots = twoBlocks(71_005)
      const { cardId } = await pdfCard(
        71_005,
        eveningOf(snapshots[0]),
        wallStart(snapshots[0]) + 10 * MINUTE
      )
      await ingestTwo(snapshots)
      const cards = await cardsOf(71_005)
      expect(cards.map((c) => [c.block, c.id === cardId])).toEqual([
        [0, true],
        [1, false],
      ])
    })
  })

  it("zwei Konten, der ältere Ausdruck passt nicht: er endet so, der passende bekommt die Scheibe", async () => {
    const snapshots = scoring(71_013)
    const day = eveningOf(snapshots[0])
    const early = await pdfCard(71_013, day, wallStart(snapshots[0]) - 30 * MINUTE, other)
    const fits = await pdfCard(71_013, day, lastShotWall(snapshots.at(-1)!) + 2 * MINUTE)
    await ingest(snapshots)
    expect((await statusOf(early.requestId)).status).toBe("printMismatch")
    expect(await statusOf(fits.requestId)).toEqual({ status: "open", cardId: fits.cardId })
    expect((await cardById(fits.cardId)).sourceId).toBe(site.sourceId)
    expect((await cardById(early.cardId)).sourceId).toBeNull()
  })

  it("passt nur ein Stand, der nicht zu deuten ist, füllt ein späterer Block die Scheibe vom Ausdruck nicht", async () => {
    // die Probe (vor dem Druck) ohne DisziplinID geht in Quarantäne, die Wertung begann erst nach dem Druck
    const [probe, ...rest] = as(sent("SF-03"), "87654321", 71_014)
    const data = {
      ...probe.data,
      scheiben: {
        ...probe.data.scheiben,
        rows: probe.data.scheiben.rows.map((row) => ({ ...row, DisziplinID: "" })),
      },
    }
    const broken = shifted({ ...probe, data, checksum: computeChecksum(data) }, -20 * MINUTE, true)
    const snapshots = [broken, ...rest]
    const { cardId, requestId } = await pdfCard(
      71_014,
      eveningOf(snapshots[0]),
      wallStart(snapshots[0]) + 10 * MINUTE
    )
    await ingestBatch(db, target(), snapshots, {
      nowMs: Date.parse(snapshots[0].observedAt) + 10 * MINUTE,
    })
    expect(await cardById(cardId)).toMatchObject({ origin: "pdf", sourceId: null })
    expect((await statusOf(requestId)).status).toBe("open")
  })

  it("getippte ID ohne Ausdruck: gefüllt; ein Stand eines anderen Abends schließt den gefüllten Auftrag nicht", async () => {
    const snapshots = scoring(71_006)
    const day = eveningOf(snapshots[0])
    const { cardId, requestId } = await pdfCard(71_006, day, null)
    await ingest(snapshots)
    expect((await cardById(cardId)).sourceId).toBe(site.sourceId)
    const later = shifted(snapshots.at(-1)!, 3 * 86_400_000)
    expect(eveningOf(later)).not.toBe(day)
    expect((await ingest([later]))[0].reason).toBe("no-consent")
    expect(await statusOf(requestId)).toEqual({ status: "open", cardId })
  })

  it("Zustimmung eines anderen Kontos geht vor: vergeben, die Scheibe vom Ausdruck bleibt, wie sie ist", async () => {
    const snapshots = scoring(71_007, String(MUSTER))
    const { cardId, requestId } = await pdfCard(
      71_007,
      eveningOf(snapshots[0]),
      lastShotWall(snapshots.at(-1)!) + 2 * MINUTE
    )
    await ingest(snapshots)
    expect((await statusOf(requestId)).status).toBe("taken")
    expect(await cardById(cardId)).toMatchObject({ origin: "pdf", sourceId: null })
    expect((await cardsOf(71_007)).map((c) => c.ownerId)).toEqual([other])
  })

  it("Heartbeat „nicht gefunden“: an der ungefüllten Scheibe geschlossen, an der gefüllten nicht", async () => {
    const snapshots = scoring(71_008)
    const day = eveningOf(snapshots[0])
    const unfilled = await pdfCard(71_009, day, null)
    const filled = await pdfCard(71_008, day, null)
    await ingest(snapshots)
    await recordRequestOutcomes(db, site.siteId, [
      { id: unfilled.requestId, outcome: "missing" },
      { id: filled.requestId, outcome: "missing" },
    ])
    expect((await statusOf(unfilled.requestId)).status).toBe("missing")
    expect((await statusOf(filled.requestId)).status).toBe("open")
  })

  it("„endgültig“: ungefüllt bleibt offen, gefüllt und endgültig ist erledigt", async () => {
    const snapshots = scoring(71_010)
    const day = eveningOf(snapshots[0])
    const unfilled = await pdfCard(71_011, day, null)
    const filled = await pdfCard(71_010, day, null)
    await ingest(snapshots)
    await db.card.update({ where: { id: filled.cardId }, data: { state: "final" } })
    await finishRequests(db, site.siteId)
    expect((await statusOf(unfilled.requestId)).status).toBe("open")
    expect((await statusOf(filled.requestId)).status).toBe("done")
  })

  it("endgültig gelöscht, dann ein Stand: verworfen, keine Scheibe", async () => {
    const snapshots = scoring(71_012)
    const { cardId } = await pdfCard(71_012, eveningOf(snapshots[0]), null)
    await db.$transaction((tx) => purgeCards(tx, [cardId], { lock: true }))
    const results = await ingest(snapshots)
    expect(results.every((x) => x.reason === "no-consent")).toBe(true)
    expect(await cardsOf(71_012)).toEqual([])
  })
})
