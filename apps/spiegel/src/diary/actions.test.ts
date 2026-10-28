import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { formatIsoDate } from "@vereinsheim/lib/format"

import { db } from "@/lib/db"

import { setDiaryEnabled } from "./settings"
import { ERRORS } from "./texts"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const { createEntryWithout, saveEntryText, saveScale } = await import("./actions")

let userId: string
let otherId: string
const today = formatIsoDate(new Date(), "Europe/Berlin")
beforeAll(async () => {
  const user = (tag: string) =>
    db.user.create({
      data: { email: `diary-${tag}-${randomUUID().slice(0, 8)}@example.com`, passwordHash: "-" },
    })
  userId = (await user("actions")).id
  otherId = (await user("actions-other")).id
})
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: [userId, otherId] } } })
})

describe("Actions des Tagebuchs", () => {
  it("gehen nicht ohne Sitzung und nicht bei ausgeschaltetem Tagebuch", async () => {
    mocks.session = null
    expect(await createEntryWithout({ day: today, kind: "mental", familyId: null })).toEqual({
      error: ERRORS.session,
    })
    mocks.session = { user: { id: userId, role: "USER" } }
    expect(await createEntryWithout({ day: today, kind: "mental", familyId: null })).toEqual({
      error: ERRORS.off,
    })
    expect(await db.diaryEntry.count({ where: { userId } })).toBe(0)
  })

  it("legen an und ändern nur eigene Einträge", async () => {
    await setDiaryEnabled(db, userId, true)
    await setDiaryEnabled(db, otherId, true)
    mocks.session = { user: { id: userId, role: "USER" } }
    const created = await createEntryWithout({ day: today, kind: "mental", familyId: null })
    expect("success" in created).toBe(true)
    const id = (created as { data: { id: string } }).data.id
    expect(await saveEntryText(id, "note", "Kopf frei")).toEqual({ success: true })
    expect(await saveScale(id, "wellbeing", "stress", 2)).toEqual({ success: true })
    mocks.session = { user: { id: otherId, role: "USER" } }
    expect(await saveEntryText(id, "note", "fremd")).toEqual({ error: ERRORS.missing })
    expect(await saveEntryText(id, "importKey" as never, "x")).toEqual({ error: ERRORS.missing })
    const row = await db.diaryEntry.findUniqueOrThrow({ where: { id } })
    expect(row.note).toBe("Kopf frei")
  })
})
