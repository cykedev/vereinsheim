import { randomInt, randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"

vi.mock("@/lib/auth-helpers", () => ({ requireAdmin: async () => ({}) }))

const { consentRows, openConsents } = await import("./queries")

const tag = randomUUID().slice(0, 8)
const zone = "Europe/Berlin"
let siteId: number
let shooterId: string
const ids: Record<"requested" | "active" | "rejected" | "returned", bigint> = {
  requested: BigInt(910_000_000_000 + randomInt(9_999_999)),
  active: BigInt(920_000_000_000 + randomInt(9_999_999)),
  rejected: BigInt(930_000_000_000 + randomInt(9_999_999)),
  returned: BigInt(940_000_000_000 + randomInt(9_999_999)),
}

beforeAll(async () => {
  siteId = (await db.site.create({ data: { name: `Test ${tag}`, timeZone: zone } })).id
  shooterId = (
    await db.user.create({
      data: { email: `schuetze-${tag}@example.com`, name: `Schütze ${tag}`, passwordHash: "-" },
    })
  ).id
  const now = Date.now()
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000)
  await db.sportpassConsent.createMany({
    data: [
      // die zurückgegebene ist älter als die wartende: offene stehen nach dem Alter der Zustimmung
      { sportpassId: ids.returned, consentedAt: at(30), returnedAt: at(5) },
      { sportpassId: ids.requested, consentedAt: at(20) },
      { sportpassId: ids.active, consentedAt: at(40), confirmedAt: at(35) },
      { sportpassId: ids.rejected, consentedAt: at(10), rejectedAt: at(9) },
    ].map((row) => ({ ...row, siteId, userId: shooterId })),
  })
})
afterAll(async () => {
  await db.user.deleteMany({ where: { email: `schuetze-${tag}@example.com` } })
  await db.site.delete({ where: { id: siteId } })
  await db.$disconnect()
})

describe("Zustimmungen lesen", () => {
  it("die eigenen mit Status in Worten, in der Folge der Zustimmung", async () => {
    const rows = await consentRows(shooterId, zone)
    expect(rows.map((r) => r.status)).toEqual(["active", "returned", "requested", "rejected"])
    expect(rows.map((r) => r.sportpassId)).toEqual(
      [ids.active, ids.returned, ids.requested, ids.rejected].map(String)
    )
    expect(rows[0]!.statusText).toMatch(/^aktiv seit \d\d\.\d\d\.\d{4}/)
    expect(rows[2]!.statusText).toBe("wartet auf den Admin")
    expect(rows.every((r) => r.consentVersion === "v1")).toBe(true)
  })

  it("offen für den Admin: wartende und zurückgegebene, ältere zuerst", async () => {
    const mine = (await openConsents(zone)).filter((r) => r.userId === shooterId)
    expect(mine.map((r) => r.status)).toEqual(["returned", "requested"])
    expect(mine[0]!.userLabel).toBe(`Schütze ${tag}`)
    expect(mine[0]!.sportpassId).toBe(String(ids.returned))
  })
})
