import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"

import { diarySettings, markNoticeSeen, setDiaryEnabled } from "./settings"

const db = createPrismaClient()
let userId: string

beforeAll(async () => {
  userId = (
    await db.user.create({
      data: { email: `diary-settings-${randomUUID().slice(0, 8)}@example.com`, passwordHash: "-" },
    })
  ).id
})
afterAll(async () => {
  await db.user.delete({ where: { id: userId } })
  await db.$disconnect()
})

describe("Einstellung des Tagebuchs", () => {
  it("ist ohne Zeile aus und der Hinweis ungesehen", async () => {
    expect(await diarySettings(db, userId)).toEqual({ enabled: false, noticeSeen: false })
  })

  it("schaltet ein und aus", async () => {
    await setDiaryEnabled(db, userId, true)
    expect((await diarySettings(db, userId)).enabled).toBe(true)
    await setDiaryEnabled(db, userId, false)
    expect((await diarySettings(db, userId)).enabled).toBe(false)
  })

  it("merkt den Hinweis einmal, ein zweites Mal ändert die Zeit nicht", async () => {
    await markNoticeSeen(db, userId)
    const first = await db.diarySettings.findUniqueOrThrow({ where: { userId } })
    expect(first.noticeSeenAt).not.toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 5))
    await markNoticeSeen(db, userId)
    const second = await db.diarySettings.findUniqueOrThrow({ where: { userId } })
    expect(second.noticeSeenAt).toEqual(first.noticeSeenAt)
    expect(await diarySettings(db, userId)).toEqual({ enabled: false, noticeSeen: true })
  })

  it("geht mit dem Konto", async () => {
    const other = await db.user.create({
      data: { email: `diary-settings-${randomUUID().slice(0, 8)}@example.com`, passwordHash: "-" },
    })
    await setDiaryEnabled(db, other.id, true)
    await db.user.delete({ where: { id: other.id } })
    expect(await db.diarySettings.count({ where: { userId: other.id } })).toBe(0)
  })
})
