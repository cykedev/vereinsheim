import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import {
  errorResponseV1,
  heartbeatResponseV1,
  pairResponseV1,
  snapshotsResponseV1,
  stateResponseV1,
} from "@vereinsheim/ingest-contract/api"
import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import { frozenExpected, frozenReadings } from "@vereinsheim/ssmdb2-cases/frozen"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { createPairing } from "./bridges"
import {
  createLimits,
  Gate,
  handleHeartbeat,
  handlePair,
  handleSnapshots,
  handleState,
  MAX_SMALL_BYTES,
  RateLimiter,
  readJson,
  type LogFields,
} from "./http"

const db = createPrismaClient()
let site: TestSite
const logs: string[] = []
const log = (event: string, fields: LogFields = {}) =>
  logs.push(JSON.stringify({ event, ...fields }))

beforeAll(async () => {
  site = await createTestSite(db, "http")
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

const BASE = "http://spiegel.test/api/ingest/v1"
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${BASE}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })

/** die Fälle zur Beobachtungszeit: sonst lehnt Spiegel ihre Folgenummer als Zukunft ab */
const SF03 = frozenExpected("SF-03").cards[0]
const sf03 = frozenReadings("SF-03").flatMap((r) =>
  r.snapshots.filter((s) => s.scheibenId === SF03.scheibenId)
)
const at = Date.parse(sf03.at(-1)!.observedAt)
const deps = (limits = createLimits()) => ({ db, now: () => at, log, limits })

async function pair(limits = createLimits()) {
  const { code } = await createPairing(db, {
    siteId: site.siteId,
    name: "Pi",
    createdById: null,
    nowMs: at,
  })
  const response = await handlePair(
    post("pair", { contractVersion: 1, code, name: null, bridgeVersion: "0.1.0" }),
    deps(limits)
  )
  expect(response.status).toBe(200)
  return pairResponseV1.parse(await response.json())
}

describe("readJson", () => {
  it("nur JSON, Grenze schon an Content-Length und beim Lesen, kaputtes JSON ist ungültig", async () => {
    const wrongType = await readJson(new Request(BASE, { method: "POST", body: "{}" }), 100)
    expect(!wrongType.ok && wrongType.response.status).toBe(415)
    const declared = await readJson(
      new Request(BASE, {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": "999999" },
        body: "{}",
      }),
      100
    )
    expect(!declared.ok && declared.response.status).toBe(413)
    // ohne Content-Length als Strom: abgebrochen, sobald die Grenze überschritten ist
    let pulled = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++
        controller.enqueue(new TextEncoder().encode(`"${"x".repeat(60)}"`))
        if (pulled > 1_000) controller.close()
      },
    })
    const streamed = await readJson(
      new Request(BASE, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: stream,
        duplex: "half",
      } as RequestInit),
      100
    )
    expect(!streamed.ok && streamed.response.status).toBe(413)
    expect(pulled).toBeLessThan(10)
    const broken = await readJson(post("x", "{nicht json"), 100)
    expect(!broken.ok && broken.response.status).toBe(400)
  })
})

describe("Grenzen", () => {
  it("Token-Bucket: so viele wie Platz, dann eine Wartezeit; füllt sich mit der Zeit wieder auf", () => {
    const limiter = new RateLimiter(2, 10_000)
    expect(limiter.take("a", 0)).toBeNull()
    expect(limiter.take("a", 0)).toBeNull()
    expect(limiter.take("a", 0)).toBe(5)
    expect(limiter.take("b", 0)).toBeNull()
    expect(limiter.take("a", 5_000)).toBeNull()
  })

  it("die Eimer haben eine Obergrenze: der am längsten nicht genutzte fällt heraus", () => {
    const limiter = new RateLimiter(1, 60_000, 3)
    for (const key of ["a", "b", "c", "d"]) expect(limiter.take(key, 0)).toBeNull()
    expect(limiter.size).toBe(3)
    // „a“ ist herausgefallen und hat wieder einen Platz, „d“ nicht
    expect(limiter.take("a", 0)).toBeNull()
    expect(limiter.take("d", 0)).not.toBeNull()
  })

  it("falsche Tokens: nach 30 Versuchen 429, ohne die Datenbank zu fragen", async () => {
    const limits = createLimits()
    const statuses: number[] = []
    for (let i = 0; i < 31; i++)
      statuses.push(
        (
          await handleState(
            new Request(`${BASE}/state`, {
              headers: { authorization: `Bearer spgl_${"A".repeat(43)}` },
            }),
            deps(limits)
          )
        ).status
      )
    expect(statuses.slice(0, 30).every((s) => s === 401)).toBe(true)
    expect(statuses[30]).toBe(429)
  })

  it("ausgelastet: 503 mit Retry-After, ohne die Anfrage zu lesen", async () => {
    const limits = createLimits()
    const paired = await pair(limits)
    const busy = await handleSnapshots(
      post("snapshots", { snapshots: [] }, { authorization: `Bearer ${paired.token}` }),
      deps({ ...limits, batches: new Gate(0) })
    )
    expect(busy.status).toBe(503)
    expect(busy.headers.get("retry-after")).toBe("2")
    expect(errorResponseV1.parse(await busy.json()).error.code).toBe("busy")
  })

  it("zu viele Heartbeats einer Brücke: 429 mit Retry-After", async () => {
    const limits = createLimits()
    const paired = await pair(limits)
    const beat = () =>
      handleHeartbeat(
        post("heartbeat", {}, { authorization: `Bearer ${paired.token}` }),
        deps(limits)
      )
    const statuses = []
    for (let i = 0; i < 7; i++) statuses.push((await beat()).status)
    expect(statuses.slice(0, 6).every((s) => s === 400)).toBe(true)
    expect(statuses[6]).toBe(429)
  })

  it("Kopplung: falscher Code 401, nach fünf Versuchen derselben Adresse 429", async () => {
    const limits = createLimits()
    const statuses = []
    for (let i = 0; i < 6; i++)
      statuses.push(
        (
          await handlePair(
            post("pair", {
              contractVersion: 1,
              code: "ABCDE-FGHJK",
              name: null,
              bridgeVersion: "1",
            }),
            deps(limits)
          )
        ).status
      )
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429])
  })

  it("ohne oder mit falschem Token: 401", async () => {
    expect((await handleState(new Request(`${BASE}/state`), deps())).status).toBe(401)
    expect(
      (
        await handleState(
          new Request(`${BASE}/state`, { headers: { authorization: "Bearer spgl_falsch" } }),
          deps()
        )
      ).status
    ).toBe(401)
    expect(
      (
        await handleSnapshots(
          post("snapshots", { snapshots: [] }, { authorization: "Bearer x" }),
          deps()
        )
      ).status
    ).toBe(401)
  })
})

describe("der ganze Weg einer Brücke", () => {
  it("koppeln, Zustand holen, Snapshots senden, Heartbeat: Antworten nach dem Vertrag, die Scheibe beim Konto", async () => {
    const limits = createLimits()
    const paired = await pair(limits)
    const auth = { authorization: `Bearer ${paired.token}` }
    const state = await handleState(new Request(`${BASE}/state`, { headers: auth }), deps(limits))
    expect(state.status).toBe(200)
    expect(stateResponseV1.parse(await state.json()).sportpass.hashes).toHaveLength(1)

    const sent = SF03.sentReadings.map(
      (n) =>
        frozenReadings("SF-03")
          .find((r) => r.reading === n)!
          .snapshots.find((s) => s.scheibenId === SF03.scheibenId)!
    )
    // je Lesung ein Stapel zu ihrer Zeit, wie die Brücke: Die Lesungen liegen 15 min auseinander (SF-79)
    for (const snapshot of sent) {
      const response = await handleSnapshots(post("snapshots", { snapshots: [snapshot] }, auth), {
        ...deps(limits),
        now: () => Date.parse(snapshot.observedAt),
      })
      expect(response.status).toBe(200)
      const body = snapshotsResponseV1.parse(await response.json())
      expect(body.results.map((r) => r.outcome)).toEqual(["stored"])
    }
    const card = await db.card.findFirst({
      where: { sourceId: site.sourceId, scheibenId: SF03.scheibenId },
    })
    expect(card?.ownerId).toBe(site.ownerId)

    // ein erledigter Auftrag zum Nachladen geht durch die Grenzen
    const consent = await db.sportpassConsent.findFirstOrThrow({ where: { siteId: site.siteId } })
    const consentId = consent.id
    const heartbeat = await handleHeartbeat(
      post(
        "heartbeat",
        {
          historyDone: [
            {
              id: consentId,
              since: (consent.historyRequestedAt ?? consent.confirmedAt!).toISOString(),
            },
          ],
          contractVersion: 1,
          bridgeVersion: "0.1.0",
          runStartedAt: new Date(at - 60_000).toISOString(),
          sentAt: new Date(at).toISOString(),
          status: "ok",
          backlog: 0,
          lastDbContactAt: null,
          queryMs: null,
          sourceClockOffsetMs: null,
          heldBack: [],
          sourceFingerprint: null,
        },
        auth
      ),
      deps(limits)
    )
    expect(heartbeat.status).toBe(200)
    heartbeatResponseV1.parse(await heartbeat.json())
    expect(
      (await db.sportpassConsent.findUniqueOrThrow({ where: { id: consentId } })).historyLoadedAt
    ).not.toBeNull()
    expect(logs.some((l) => l.includes('"event":"ingest.snapshots"'))).toBe(true)
  })
})

describe("keine Inhalte in Antworten und Logs (SF-59)", () => {
  it("ein Name geht durch jede Fehlerart, ohne in einer Antwort oder einem Log aufzutauchen", async () => {
    const limits = createLimits()
    const paired = await pair(limits)
    const auth = { authorization: `Bearer ${paired.token}` }
    const NAME = "Mustermann"
    const named = (snapshot: SnapshotV1, sportpass: string): SnapshotV1 => {
      const data = {
        ...snapshot.data,
        scheiben: {
          ...snapshot.data.scheiben,
          rows: snapshot.data.scheiben.rows.map((row) => ({
            ...row,
            Nachname: NAME,
            SportpassID: sportpass,
          })),
        },
      }
      return { ...snapshot, data, checksum: computeChecksum(data) }
    }
    const written: string[] = []
    const out = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      written.push(String(chunk))
      return true
    })
    const err = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      written.push(String(chunk))
      return true
    })
    const console_ = vi.spyOn(console, "error").mockImplementation((...args) => {
      written.push(args.map(String).join(" "))
    })
    try {
      const base = sf03[0]
      const bodies = [
        // Prüfsumme falsch
        { snapshots: [{ ...named(base, "12345678"), checksum: `sha256:${"0".repeat(64)}` }] },
        // ohne Zustimmung
        { snapshots: [named(base, "99999999")] },
        // fremde Spalte in der Hülle
        { snapshots: [{ ...named(base, "12345678"), Nachname: NAME }] },
        // als Zeile zu viel
        { snapshots: [named(base, "12345678")], Nachname: NAME },
      ]
      const responses: string[] = []
      for (const body of bodies) {
        const response = await handleSnapshots(post("snapshots", body, auth), {
          db,
          now: () => at,
          limits,
        })
        responses.push(await response.text())
      }
      const heartbeat = await handleHeartbeat(
        post("heartbeat", { contractVersion: 1, Nachname: NAME }, auth),
        {
          db,
          now: () => at,
          limits,
        }
      )
      responses.push(await heartbeat.text())
      expect(responses.join("\n")).not.toContain(NAME)
      expect([...written, ...logs].join("\n")).not.toContain(NAME)
      expect(responses[1]).toContain('"reason":"no-consent"')
    } finally {
      out.mockRestore()
      err.mockRestore()
      console_.mockRestore()
    }
  })
})

it("eine Anfrage über der kleinen Grenze ist zu groß", async () => {
  const response = await handlePair(post("pair", { padding: "x".repeat(MAX_SMALL_BYTES) }), deps())
  expect(response.status).toBe(413)
})
