import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { stateResponseV1, type HeartbeatV1 } from "@vereinsheim/ingest-contract/api"
import { sportpassHash } from "@vereinsheim/ingest-contract/sportpass"

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
  revokeBridge,
} from "./bridges"

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
    expect(await authenticateBridge(db, `${paired.token.slice(0, -1)}A`, NOW)).toBeNull()
    expect(await authenticateBridge(db, null, NOW)).toBeNull()
    await revokeBridge(db, paired.bridgeId, NOW)
    expect(await authenticateBridge(db, paired.token, NOW)).toBeNull()
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

  it("ohne Lebenszeichen zählt der Beginn; eine leere Scheibe ist nie vollständig (Review)", async () => {
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
  it("Epoche, gehashte SportpassIDs bestätigter Zustimmungen, Sperren, Wasserstand; gültig nach dem Vertrag", async () => {
    await db.sportpassConsent.createMany({
      data: [
        {
          userId: site.ownerId,
          siteId: site.siteId,
          sportpassId: BigInt(12345678),
          confirmedAt: new Date(NOW),
        },
        { userId: site.ownerId, siteId: site.siteId, sportpassId: BigInt(555), confirmedAt: null },
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
      { scheibenId: -7, startedAt: new Date(NOW - 86_400_000).toISOString() },
    ])
    // das Salz bleibt
    expect((await bridgeState(db, site.siteId, NOW)).sportpass.salt).toBe(state.sportpass.salt)
  })
})
