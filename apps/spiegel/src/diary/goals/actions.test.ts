import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"

import { setDiaryEnabled } from "../settings"
import { ERRORS } from "../texts"
import { GOAL_ERRORS } from "./texts"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const { createGoalAction, saveGoalNote, previewGoalAction, deleteGoalAction } =
  await import("./actions")

let userId: string
let otherId: string
const input = {
  title: "Beim Schuss bleiben",
  kind: "process",
  familyId: null,
  from: "2026-09-01",
  to: "2027-08-31",
  measure: null,
}

beforeAll(async () => {
  const user = (tag: string) =>
    db.user.create({
      data: { email: `goals-${tag}-${randomUUID().slice(0, 8)}@example.com`, passwordHash: "-" },
    })
  userId = (await user("actions")).id
  otherId = (await user("actions-other")).id
})
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: [userId, otherId] } } })
})

describe("Actions der Ziele", () => {
  it("gehen nicht ohne Sitzung und nicht bei ausgeschaltetem Tagebuch", async () => {
    mocks.session = null
    expect(await createGoalAction(input)).toEqual({ error: ERRORS.session })
    mocks.session = { user: { id: userId, role: "USER" } }
    expect(await createGoalAction(input)).toEqual({ error: ERRORS.off })
    expect(await db.diaryGoal.count({ where: { userId } })).toBe(0)
  })

  it("legen an, geben Feldfehler als Liste je Feld und ändern nur eigene Ziele", async () => {
    await setDiaryEnabled(db, userId, true)
    await setDiaryEnabled(db, otherId, true)
    mocks.session = { user: { id: userId, role: "USER" } }
    expect(await createGoalAction({ ...input, title: "" })).toEqual({
      error: { title: [GOAL_ERRORS.title] },
    })
    const created = await createGoalAction(input)
    expect("success" in created).toBe(true)
    const id = (created as { data: { id: string } }).data.id
    expect(await saveGoalNote(id, "ruhig")).toEqual({ success: true })
    mocks.session = { user: { id: otherId, role: "USER" } }
    expect(await saveGoalNote(id, "fremd")).toEqual({ error: GOAL_ERRORS.missing })
    expect(await deleteGoalAction(id)).toEqual({ error: GOAL_ERRORS.missing })
    expect((await db.diaryGoal.findUniqueOrThrow({ where: { id } })).note).toBe("ruhig")
  })

  it("Vorschau: unvollständig kein Satz, ohne Scheiben der Satz dafür", async () => {
    mocks.session = { user: { id: userId, role: "USER" } }
    const preview = {
      familyId: 1,
      from: "2026-09-01",
      to: "2027-08-31",
      measure: "card" as const,
      threshold: "",
      scoring: "rings" as const,
      shots: 40,
      cards: "all" as const,
    }
    expect(await previewGoalAction(preview)).toEqual({ success: true, data: { text: null } })
    expect(await previewGoalAction({ ...preview, threshold: "355" })).toEqual({
      success: true,
      data: { text: "Bisher keine Scheibe in diesem Zeitraum." },
    })
  })
})
