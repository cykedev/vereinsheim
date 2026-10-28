import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"

import { diarySettings } from "./settings"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const { markNoticeSeenAction, setDiaryEnabledAction } = await import("./settings-actions")

let userId: string
beforeAll(async () => {
  userId = (
    await db.user.create({
      data: { email: `diary-actions-${randomUUID().slice(0, 8)}@example.com`, passwordHash: "-" },
    })
  ).id
})
afterAll(async () => {
  await db.user.delete({ where: { id: userId } })
})

describe("Einstellung des Tagebuchs aus dem Browser", () => {
  it("geht nicht ohne Sitzung und nicht mit einem Passwort vom Admin", async () => {
    mocks.session = null
    expect(await setDiaryEnabledAction(true)).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
    mocks.session = { user: { id: userId, role: "USER", mustChangePassword: true } }
    expect("error" in (await setDiaryEnabledAction(true))).toBe(true)
    expect((await diarySettings(db, userId)).enabled).toBe(false)
  })

  it("schaltet nur das eigene Konto um und merkt den Hinweis", async () => {
    mocks.session = { user: { id: userId, role: "USER" } }
    expect(await setDiaryEnabledAction(true)).toEqual({ success: true })
    expect((await diarySettings(db, userId)).enabled).toBe(true)
    expect(await markNoticeSeenAction()).toEqual({ success: true })
    expect(await diarySettings(db, userId)).toEqual({ enabled: true, noticeSeen: true })
    expect(await setDiaryEnabledAction(false)).toEqual({ success: true })
    expect((await diarySettings(db, userId)).enabled).toBe(false)
  })

  it("nimmt nur ja oder nein", async () => {
    mocks.session = { user: { id: userId, role: "USER" } }
    expect("error" in (await setDiaryEnabledAction("ja" as unknown as boolean))).toBe(true)
  })
})
