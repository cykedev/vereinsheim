import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { setScale, createWithout } from "@/diary/entries"
import { setDiaryEnabled } from "@/diary/settings"
import { db } from "@/lib/db"
import { writeEnteredCard } from "@/lib/db/entered"
import { createTestSite, type TestSite } from "../../test/fixtures"

import { accountExport } from "./account"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))

const { GET } = await import("../app/api/account/export/route")

let site: TestSite
let disciplineId: number
let otherId: string
const ids: string[] = []
let foreign: string
let pending: string

async function card(i: number, ownerId = site.ownerId) {
  const saved = await writeEnteredCard(db, {
    ownerId,
    origin: "manual",
    disciplineId,
    startedAtMs: Date.UTC(2026, 3, 1 + i, 17),
    kind: "training",
    details: { series: [{ series: 1, shots: 10, rings: 90 + i }] },
    reason: "eingetragen",
  })
  if (saved.kind !== "saved") throw new Error(saved.kind)
  return saved.cardId
}

beforeAll(async () => {
  site = await createTestSite(db, "account-export")
  disciplineId = (
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: null,
        name: "LP 10 Export",
        familyId: site.familyId,
        targetId: "lp-10m",
        plannedShots: 10,
        seriesShots: 10,
        confirmedAt: new Date(),
      },
    })
  ).id
  otherId = (
    await db.user.create({
      data: { email: `export-other-${site.siteId}@example.com`, passwordHash: "-" },
    })
  ).id
  for (let i = 0; i < 5; i++) ids.push(await card(i))
  await db.card.update({ where: { id: ids[0] }, data: { deletedAt: new Date() } })
  pending = await card(9)
  await db.card.update({ where: { id: pending }, data: { ownerPending: true } })
  foreign = await card(7, otherId)
  await setDiaryEnabled(db, site.ownerId, true)
  const entry = (await createWithout(db, site.ownerId, {
    day: "2026-04-02",
    kind: "mental",
    familyId: null,
    timeZone: "Europe/Berlin",
  })) as { id: string }
  await db.diaryEntry.update({
    where: { id: entry.id },
    data: { note: "Kopf frei", deletedAt: new Date() },
  })
  await setScale(db, site.ownerId, entry.id, {
    part: "wellbeing",
    aspect: "sleep",
    stage: 4,
  }).catch(() => null)
  await db.diaryScale.create({
    data: { entryId: entry.id, part: "wellbeing", aspect: "stress", value: 43 },
  })
})
afterAll(async () => {
  await site.remove()
  await db.card.deleteMany({ where: { ownerId: otherId } })
  await db.user.delete({ where: { id: otherId } })
})

const read = async (stream: ReadableStream<Uint8Array>) =>
  JSON.parse(await new Response(stream).text())

describe("Export über beide Teile", () => {
  it("gültiges JSON über mehrere Stapel, nur eigene Scheiben samt Papierkorb, das Tagebuch als eigener Teil", async () => {
    const user = await db.user.findUniqueOrThrow({ where: { id: site.ownerId } })
    const data = await read(accountExport(db, user, 2))
    expect(data.format).toBe("spiegel-export")
    expect(data.version).toBe(1)
    expect(data.account.email).toBe(user.email)
    const exported = data.results.cards.map((c: { id: string }) => c.id).sort()
    expect(exported).toEqual([...ids].sort())
    expect(exported).not.toContain(foreign)
    expect(exported).not.toContain(pending)
    const deleted = data.results.cards.find((c: { id: string }) => c.id === ids[0])
    expect(deleted.deletedAt).not.toBeNull()
    expect(deleted.currentRevision.seriesSums).toEqual([
      { series: 1, shots: 10, rings: 90, decimalTenths: null },
    ])
    expect(data.diary.settings.enabled).toBe(true)
    expect(data.diary.entries).toHaveLength(1)
    expect(data.diary.entries[0]).toMatchObject({
      kind: "mental",
      note: "Kopf frei",
      day: "2026-04-02",
    })
    expect(data.diary.entries[0].deletedAt).not.toBeNull()
    expect(data.diary.entries[0].scales).toContainEqual({
      part: "wellbeing",
      aspect: "stress",
      value: 43,
    })
  })

  it("die Route: ohne Sitzung 401, sonst eine Datei, privat und ohne Cache", async () => {
    mocks.session = null
    expect((await GET()).status).toBe(401)
    mocks.session = { user: { id: site.ownerId, role: "USER", mustChangePassword: true } }
    expect((await GET()).status).toBe(401)
    mocks.session = { user: { id: site.ownerId, role: "USER" } }
    const response = await GET()
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="spiegel-\d{4}-\d{2}-\d{2}\.json"$/
    )
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect((await response.json()).results.cards).toHaveLength(ids.length)
  })
})
