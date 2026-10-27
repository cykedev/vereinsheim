import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { generateSeason } from "../../test/generate"
import { createTestSite, type TestSite } from "../../test/fixtures"
import { writeRevision } from "./db/cards"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
  revalidated: 0,
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))
vi.mock("next/cache", () => ({ revalidatePath: () => void mocks.revalidated++ }))

const { setCardKind } = await import("./card-kind-actions")

let site: TestSite
let own: string
let trash: string
let probeOnly: string

beforeAll(async () => {
  site = await createTestSite(db, "kind-action")
  const cards = generateSeason({
    seed: 13,
    cards: 12,
    firstMs: Date.UTC(2026, 4, 5, 17),
    everyDays: 2,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId: site.ownerId,
    scheibenIdBase: 6500,
  })
  const withMatch = cards.filter((c) => c.shots.some((s) => s.stellung !== 0))
  const onlyProbe = cards.find((c) => c.shots.every((s) => s.stellung === 0))
  if (!onlyProbe || withMatch.length < 2) throw new Error("keine passende Scheibe im Seed")
  own = (await writeRevision(db, withMatch[0])).cardId
  trash = (await writeRevision(db, withMatch[1])).cardId
  await db.card.update({ where: { id: trash }, data: { deletedAt: new Date() } })
  probeOnly = (await writeRevision(db, onlyProbe)).cardId
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

const choiceOf = async (cardId: string) =>
  (await db.card.findUniqueOrThrow({ where: { id: cardId } })).kindChoice

describe("setCardKind", () => {
  it("speichert die Art der eigenen Scheibe; fremde, gelöschte und unbekannte nicht", async () => {
    mocks.session = { user: { id: site.ownerId, role: "USER" } }
    const before = mocks.revalidated
    expect(await setCardKind(own, "competition")).toEqual({ success: true })
    expect(await choiceOf(own)).toBe("competition")
    // kein `revalidatePath`: Danach scrollt Next zum Anker der Adresse; die Hülle lädt mit `router.refresh()` neu
    expect(mocks.revalidated).toBe(before)
    expect(await setCardKind(own, "training")).toEqual({ success: true })
    expect(await choiceOf(own)).toBe("training")

    const missing = { error: "Diese Scheibe gibt es nicht mehr." }
    expect(await setCardKind(trash, "competition")).toEqual(missing)
    expect(await choiceOf(trash)).toBeNull()
    expect(await setCardKind("gibt-es-nicht", "competition")).toEqual(missing)
    expect(await setCardKind(42 as unknown as string, "competition")).toEqual(missing)
    expect(await setCardKind(own, "probe" as "training")).toEqual({
      error: "Das ließ sich nicht speichern. Bitte lade die Seite neu.",
    })
    mocks.session = { user: { id: "jemand-anderes", role: "ADMIN" } }
    expect(await setCardKind(own, "competition")).toEqual(missing)
    expect(await choiceOf(own)).toBe("training")
  })

  it("eine Scheibe nur aus Probe bekommt die gewählte Art", async () => {
    mocks.session = { user: { id: site.ownerId, role: "USER" } }
    expect(await setCardKind(probeOnly, "competition")).toEqual({ success: true })
    expect(await choiceOf(probeOnly)).toBe("competition")
    expect(await setCardKind(probeOnly, "training")).toEqual({ success: true })
    expect(await choiceOf(probeOnly)).toBe("training")
  })

  it("ohne Sitzung oder mit Passwort vom Admin ein Fehler", async () => {
    mocks.session = null
    expect(await setCardKind(own, "competition")).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
    mocks.session = { user: { id: site.ownerId, role: "USER", mustChangePassword: true } }
    expect(await setCardKind(own, "competition")).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
    expect(await choiceOf(own)).toBe("training")
  })
})
