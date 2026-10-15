import { afterAll, beforeAll, describe, expect, it, onTestFinished } from "vitest"

import { stateResponseV1, type HeartbeatV1 } from "@vereinsheim/ingest-contract/api"
import { parseSnapshot } from "@vereinsheim/ingest-contract/parse"
import { sportpassHash } from "@vereinsheim/ingest-contract/sportpass"
import { frozenReadings } from "@vereinsheim/ssmdb2-cases/frozen"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import {
  advanceCardStates,
  authenticateBridge,
  bridgeState,
  createPairing,
  PAIRING_TTL_MS,
  recordHeartbeat,
  redeemPairing,
  removeBridge,
  revokeBridge,
} from "./bridges"
import { storeSnapshot } from "../db/raw"

const db = createPrismaClient()
let site: TestSite
const NOW = Date.parse("2026-10-13T18:00:00.000Z")

beforeAll(async () => {
  site = await createTestSite(db, "bridges")
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

const heartbeat = (overrides: Partial<HeartbeatV1> = {}): HeartbeatV1 => ({
  contractVersion: 1,
  bridgeVersion: "0.1.0",
  runStartedAt: new Date(NOW - 3_600_000).toISOString(),
  sentAt: new Date(NOW).toISOString(),
  status: "ok",
  backlog: 0,
  lastDbContactAt: new Date(NOW).toISOString(),
  queryMs: 12,
  sourceClockOffsetMs: -2_000,
  heldBack: [],
  sourceFingerprint: null,
  ...overrides,
})

async function pairedBridge() {
  const pairing = await createPairing(db, {
    siteId: site.siteId,
    name: "Pi",
    createdById: null,
    nowMs: NOW,
  })
  const paired = await redeemPairing(db, {
    code: pairing.code,
    name: null,
    bridgeVersion: "0.1.0",
    nowMs: NOW + 1_000,
  })
  if (!paired) throw new Error("nicht gekoppelt")
  return paired
}

describe("Kopplung", () => {
  it("ein Code koppelt genau einmal, in jeder Schreibweise, nur innerhalb der Frist", async () => {
    const pairing = await createPairing(db, {
      siteId: site.siteId,
      name: "Pi im Schützenhaus",
      createdById: site.ownerId,
      nowMs: NOW,
    })
    expect(pairing.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/)
    const stored = await db.bridgePairing.findUniqueOrThrow({ where: { id: pairing.id } })
    expect(stored.codeHash).not.toContain(pairing.code.replace("-", ""))

    const typed = ` ${pairing.code.toLowerCase().replace("-", " ")} `
    const first = await redeemPairing(db, {
      code: typed,
      name: null,
      bridgeVersion: "0.1.0",
      nowMs: NOW,
    })
    expect(first?.site.timeZone).toBe("Europe/Berlin")
    expect(first?.token).toMatch(/^spgl_[A-Za-z0-9_-]{43}$/)
    const again = await redeemPairing(db, {
      code: pairing.code,
      name: null,
      bridgeVersion: "0.1.0",
      nowMs: NOW,
    })
    expect(again).toBeNull()

    const late = await createPairing(db, {
      siteId: site.siteId,
      name: "x",
      createdById: null,
      nowMs: NOW,
    })
    expect(
      await redeemPairing(db, {
        code: late.code,
        name: null,
        bridgeVersion: "0.1.0",
        nowMs: NOW + PAIRING_TTL_MS + 1,
      })
    ).toBeNull()
    expect(
      await redeemPairing(db, { code: "kein code", name: null, bridgeVersion: "1", nowMs: NOW })
    ).toBeNull()
  })

  it("der Token meldet die Brücke an, nur der Hash liegt in der Datenbank; widerrufen gilt er nicht mehr", async () => {
    const paired = await pairedBridge()
    const bridge = await db.bridge.findUniqueOrThrow({ where: { id: paired.bridgeId } })
    expect(bridge.tokenHash).not.toBe(paired.token)
    expect(bridge.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    const auth = await authenticateBridge(db, paired.token, NOW)
    expect(auth).toMatchObject({ bridgeId: paired.bridgeId, siteId: site.siteId })
    // ein Zeichen in der Mitte sicher ändern: Das letzte trägt nur 4 Bit, „…A“ war in jedem 16. Lauf der echte Token
    const at = 20
    const other = paired.token[at] === "A" ? "B" : "A"
    const wrong = `${paired.token.slice(0, at)}${other}${paired.token.slice(at + 1)}`
    expect(wrong).not.toBe(paired.token)
    expect(await authenticateBridge(db, wrong, NOW)).toBeNull()
    expect(await authenticateBridge(db, null, NOW)).toBeNull()
    await revokeBridge(db, paired.bridgeId, NOW)
    expect(await authenticateBridge(db, paired.token, NOW)).toBeNull()
  })

  it("entfernen nur, wenn getrennt; was sie geschickt hat, bleibt ohne Gerät", async () => {
    const paired = await pairedBridge()
    const [reading] = frozenReadings("SF-03")
    const parsed = parseSnapshot(reading.snapshots[0])
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues))
    await storeSnapshot(db, { sourceId: site.sourceId, bridgeId: paired.bridgeId }, parsed.value, {
      nowMs: Date.parse(parsed.value.observedAt),
    })
    const raw = await db.rawSnapshot.findFirstOrThrow({ where: { bridgeId: paired.bridgeId } })
    const pairing = await db.bridgePairing.findFirstOrThrow({
      where: { bridgeId: paired.bridgeId },
    })
    // eine laufende bleibt
    expect(await removeBridge(db, paired.bridgeId)).toBe(false)
    expect(await db.bridge.count({ where: { id: paired.bridgeId } })).toBe(1)
    await revokeBridge(db, paired.bridgeId, NOW)
    expect(await removeBridge(db, paired.bridgeId)).toBe(true)
    expect(await db.bridge.count({ where: { id: paired.bridgeId } })).toBe(0)
    // Rohdaten und Code bleiben, nur ohne Gerät
    expect(await db.rawSnapshot.findUniqueOrThrow({ where: { id: raw.id } })).toMatchObject({
      bridgeId: null,
    })
    expect(await db.bridgePairing.findUniqueOrThrow({ where: { id: pairing.id } })).toMatchObject({
      bridgeId: null,
    })
    // zweimal: schon entfernt
    expect(await removeBridge(db, paired.bridgeId)).toBe(false)
  })

  it("lastSeenAt höchstens einmal je Minute (Last)", async () => {
    const paired = await pairedBridge()
    await authenticateBridge(db, paired.token, NOW + 10_000)
    const seen = async () =>
      (await db.bridge.findUniqueOrThrow({ where: { id: paired.bridgeId } })).lastSeenAt?.getTime()
    expect(await seen()).toBe(NOW + 1_000)
    await authenticateBridge(db, paired.token, NOW + 61_000)
    expect(await seen()).toBe(NOW + 61_000)
  })
})

describe("Heartbeat", () => {
  /** eine Scheibe mit Lebenszeichen und Zustand */
  async function card(
    scheibenId: number,
    state: "open" | "resting",
    lifesignAgoMs: number,
    flags: string[] = []
  ) {
    return db.card.create({
      data: {
        sourceId: site.sourceId,
        scheibenId,
        disciplineId: site.disciplineId,
        startedAt: new Date(NOW - lifesignAgoMs - 600_000),
        kind: "training",
        state,
        complete: false,
        flags,
        origin: "raw",
        lifesignAt: new Date(NOW - lifesignAgoMs),
      },
      select: { id: true },
    })
  }
  const stateOf = async (id: string) =>
    db.card.findUniqueOrThrow({ where: { id }, select: { state: true, complete: true } })

  it("offen → ruhend nach fünf Minuten, endgültig nach zwölf Stunden; vollständig nur ohne „unvollstaendig“", async () => {
    const live = await card(9101, "open", 60_000)
    const quiet = await card(9102, "open", 6 * 60_000)
    const old = await card(9103, "resting", 13 * 3_600_000)
    const partial = await card(9104, "open", 13 * 3_600_000, ["unvollstaendig"])
    await advanceCardStates(db, site.siteId, { nowMs: NOW })
    expect(await stateOf(live.id)).toEqual({ state: "open", complete: false })
    expect(await stateOf(quiet.id)).toEqual({ state: "resting", complete: false })
    expect(await stateOf(old.id)).toEqual({ state: "final", complete: true })
    expect(await stateOf(partial.id)).toEqual({ state: "final", complete: false })
  })

  it("ohne Lebenszeichen zählt der Beginn; eine leere Scheibe ist nie vollständig", async () => {
    const none = await card(9301, "open", 0)
    await db.card.update({
      where: { id: none.id },
      data: { lifesignAt: null, startedAt: new Date(NOW - 13 * 3_600_000) },
    })
    const empty = await card(9302, "resting", 13 * 3_600_000, ["leer"])
    await advanceCardStates(db, site.siteId, { nowMs: NOW })
    expect(await stateOf(none.id)).toEqual({ state: "final", complete: true })
    expect(await stateOf(empty.id)).toEqual({ state: "final", complete: false })
  })

  it("ein neuer Lauf der Brücke macht alles davor endgültig; die Uhr wird nur bei Änderung neu vermerkt", async () => {
    const paired = await pairedBridge()
    const before = await card(9201, "resting", 20 * 60_000)
    let auth = (await authenticateBridge(db, paired.token, NOW))!
    await recordHeartbeat(db, auth, heartbeat(), NOW)
    expect((await stateOf(before.id)).state).toBe("resting")
    // dieselbe Uhr eine Minute später: keine neue Zeile
    auth = (await authenticateBridge(db, paired.token, NOW + 60_000))!
    await recordHeartbeat(db, auth, heartbeat({ sourceClockOffsetMs: -2_500 }), NOW + 60_000)
    expect(await db.clockReading.count({ where: { siteId: site.siteId } })).toBe(1)
    // die Anlage war aus: ein neuer Lauf
    auth = (await authenticateBridge(db, paired.token, NOW + 120_000))!
    await recordHeartbeat(
      db,
      auth,
      heartbeat({
        runStartedAt: new Date(NOW + 100_000).toISOString(),
        sourceClockOffsetMs: 40_000,
      }),
      NOW + 120_000
    )
    expect(await stateOf(before.id)).toEqual({ state: "final", complete: true })
    expect(await db.clockReading.count({ where: { siteId: site.siteId } })).toBe(2)
    const bridge = await db.bridge.findUniqueOrThrow({ where: { id: paired.bridgeId } })
    expect(bridge.version).toBe("0.1.0")
    expect(bridge.heartbeat).toMatchObject({ status: "ok" })
  })
})

describe("Zustand der Brücke", () => {
  it("Epoche, gehashte SportpassIDs aktiver Zustimmungen, Sperren, Wasserstand; gültig nach dem Vertrag", async () => {
    await db.sportpassConsent.createMany({
      data: [
        {
          userId: site.ownerId,
          siteId: site.siteId,
          sportpassId: BigInt(12345678),
          confirmedAt: new Date(NOW),
        },
        // wartend, abgelehnt (auch mit altem Bestätigt), zurückgegeben: keine geht an die Brücke
        { userId: site.ownerId, siteId: site.siteId, sportpassId: BigInt(555), confirmedAt: null },
        {
          userId: site.ownerId,
          siteId: site.siteId,
          sportpassId: BigInt(556),
          rejectedAt: new Date(NOW),
        },
        {
          userId: site.ownerId,
          siteId: site.siteId,
          sportpassId: BigInt(557),
          confirmedAt: new Date(NOW),
          rejectedAt: new Date(NOW),
        },
        {
          userId: site.ownerId,
          siteId: site.siteId,
          sportpassId: BigInt(558),
          returnedAt: new Date(NOW),
        },
      ],
    })
    await db.tombstone.create({
      data: {
        sourceId: site.sourceId,
        scheibenId: -7,
        startedAt: new Date(NOW - 86_400_000),
        reason: "x",
      },
    })
    const state = await bridgeState(db, site.siteId, NOW)
    expect(stateResponseV1.safeParse(state).success).toBe(true)
    expect(state.epoch).toBe(1)
    expect(state.sportpass.hashes).toEqual([sportpassHash(state.sportpass.salt, BigInt(12345678))])
    expect(state.blocked).toEqual([
      { scheibenId: -7, startedAt: new Date(NOW - 86_400_000).toISOString(), epoch: 1 },
    ])
    // das Salz bleibt
    expect((await bridgeState(db, site.siteId, NOW)).sportpass.salt).toBe(state.sportpass.salt)
  })
})

describe("Aufträge zum Nachladen", () => {
  let own: TestSite
  let other: TestSite
  beforeAll(async () => {
    own = await createTestSite(db, "history")
    other = await createTestSite(db, "history-other")
  })
  afterAll(async () => {
    await own.remove()
    await other.remove()
  })

  it("nur aktive, noch nicht nachgeladene Zustimmungen dieser Anlage mit aktivem Konto; mit Auftrag alle Sperren", async () => {
    const inactive = await db.user.create({
      data: {
        email: `history-inactive-${own.siteId}@example.com`,
        passwordHash: "-",
        isActive: false,
      },
    })
    onTestFinished(async () => {
      await db.user.delete({ where: { id: inactive.id } })
    })
    const consent = (sportpassId: number, data: Record<string, unknown> = {}) =>
      db.sportpassConsent.create({
        data: {
          userId: own.ownerId,
          siteId: own.siteId,
          sportpassId: BigInt(sportpassId),
          confirmedAt: new Date(NOW),
          ...data,
        },
      })
    const open = await consent(1001)
    await consent(1002, { historyLoadedAt: new Date(NOW) })
    await consent(1003, { rejectedAt: new Date(NOW) })
    await consent(1004, { userId: inactive.id })
    await consent(1005, { siteId: other.siteId })
    // eine alte Sperre (90 Tage) und eine junge
    for (const [scheibenId, days] of [
      [-11, 90],
      [-12, 1],
    ])
      await db.tombstone.create({
        data: {
          sourceId: own.sourceId,
          scheibenId,
          startedAt: new Date(NOW - days * 86_400_000),
          reason: "nicht-meine",
        },
      })

    const state = await bridgeState(db, own.siteId, NOW)
    expect(stateResponseV1.safeParse(state).success).toBe(true)
    expect(state.history).toEqual([
      {
        id: open.id,
        // ohne eigenen Zeitpunkt die Bestätigung
        since: new Date(NOW).toISOString(),
        sportpassHash: sportpassHash(state.sportpass.salt, BigInt(1001)),
      },
    ])
    expect(state.blocked.map((b) => b.scheibenId).sort((a, b) => a - b)).toEqual([-12, -11])

    // alles nachgeladen: keine Aufträge, Sperren wieder nur die jüngsten
    await db.sportpassConsent.update({
      where: { id: open.id },
      data: { historyLoadedAt: new Date(NOW) },
    })
    const after = await bridgeState(db, own.siteId, NOW)
    expect(after.history).toEqual([])
    expect(after.blocked.map((b) => b.scheibenId)).toEqual([-12])
  })

  it("der Heartbeat vermerkt erledigte Aufträge nur an aktiven, offenen Zustimmungen dieser Anlage mit aktivem Konto und passendem since", async () => {
    const pairing = await createPairing(db, {
      siteId: own.siteId,
      name: "Pi",
      createdById: null,
      nowMs: NOW,
    })
    const paired = await redeemPairing(db, {
      code: pairing.code,
      name: null,
      bridgeVersion: "0.1.0",
      nowMs: NOW + 1_000,
    })
    const auth = (await authenticateBridge(db, paired!.token, NOW))!
    const consent = (sportpassId: number, data: Record<string, unknown> = {}) =>
      db.sportpassConsent.create({
        data: {
          userId: own.ownerId,
          siteId: own.siteId,
          sportpassId: BigInt(sportpassId),
          confirmedAt: new Date(NOW),
          ...data,
        },
      })
    const inactive = await db.user.create({
      data: { email: `history-off-${own.siteId}@example.com`, passwordHash: "-", isActive: false },
    })
    // auch wenn eine Prüfung fällt: sonst bleibt das Konto in der Dev-Datenbank liegen
    onTestFinished(async () => {
      await db.user.delete({ where: { id: inactive.id } })
    })
    const since = new Date(NOW).toISOString()
    const reopened = new Date(NOW + 30_000)
    const open = await consent(2001)
    const rejected = await consent(2002, { rejectedAt: new Date(NOW) })
    const done = await consent(2003, { historyLoadedAt: new Date(NOW - 86_400_000) })
    const foreign = await consent(2004, { siteId: other.siteId })
    const deactivated = await consent(2005, { userId: inactive.id })
    // neu eröffnet (Meldungen aufgehoben): ein „erledigt“ mit dem alten since gilt nicht
    const lifted = await consent(2006, { historyRequestedAt: reopened })
    const loadedAt = async (id: number) =>
      (await db.sportpassConsent.findUniqueOrThrow({ where: { id } })).historyLoadedAt

    await recordHeartbeat(
      db,
      auth,
      heartbeat({
        historyDone: [open, rejected, done, foreign, deactivated, lifted]
          .map((c) => ({ id: c.id, since }))
          .concat({ id: 999_999, since }),
      }),
      NOW
    )
    expect((await loadedAt(open.id))?.getTime()).toBe(NOW)
    expect(await loadedAt(rejected.id)).toBeNull()
    expect((await loadedAt(done.id))?.getTime()).toBe(NOW - 86_400_000)
    expect(await loadedAt(foreign.id)).toBeNull()
    expect(await loadedAt(deactivated.id)).toBeNull()
    expect(await loadedAt(lifted.id)).toBeNull()
    // ein zweites Melden ändert den Zeitpunkt nicht; mit dem neuen since gilt der neue Auftrag
    await recordHeartbeat(
      db,
      auth,
      heartbeat({
        historyDone: [
          { id: open.id, since },
          { id: lifted.id, since: reopened.toISOString() },
        ],
      }),
      NOW + 60_000
    )
    expect((await loadedAt(open.id))?.getTime()).toBe(NOW)
    expect((await loadedAt(lifted.id))?.getTime()).toBe(NOW + 60_000)
  })
})
