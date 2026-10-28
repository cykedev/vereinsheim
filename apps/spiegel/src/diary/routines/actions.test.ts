import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"

import { setDiaryEnabled } from "../settings"
import { ERRORS } from "../texts"
import { ROUTINE_ERRORS } from "./texts"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string } },
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const { createRoutineAction, updateRoutineAction, deleteRoutineAction, setRoutineFamilyAction } =
  await import("./actions")

let userId: string
let otherId: string
const input = { name: "Mein Ablauf", familyId: null, text: "Atmen\n\nAbziehen" }

beforeAll(async () => {
  const user = (tag: string) =>
    db.user.create({
      data: { email: `routines-${tag}-${randomUUID().slice(0, 8)}@example.com`, passwordHash: "-" },
    })
  userId = (await user("actions")).id
  otherId = (await user("actions-other")).id
})
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: [userId, otherId] } } })
})

describe("Actions der Abläufe", () => {
  it("gehen nicht ohne Sitzung und nicht bei ausgeschaltetem Tagebuch", async () => {
    mocks.session = null
    expect(await createRoutineAction(input)).toEqual({ error: ERRORS.session })
    mocks.session = { user: { id: userId, role: "USER" } }
    expect(await createRoutineAction(input)).toEqual({ error: ERRORS.off })
    expect(await db.diaryRoutine.count({ where: { userId } })).toBe(0)
  })

  it("legen an, geben Feldfehler als Liste je Feld und ändern nur eigene Abläufe", async () => {
    await setDiaryEnabled(db, userId, true)
    await setDiaryEnabled(db, otherId, true)
    mocks.session = { user: { id: userId, role: "USER" } }
    expect(await createRoutineAction({ ...input, name: "", text: "" })).toEqual({
      error: { name: [ROUTINE_ERRORS.name], text: [ROUTINE_ERRORS.steps] },
    })
    const created = await createRoutineAction(input)
    expect("success" in created).toBe(true)
    const id = (created as { data: { id: string } }).data.id
    expect(await updateRoutineAction(id, { name: "Kurz", text: "Atmen" })).toEqual({
      success: true,
    })
    expect(await updateRoutineAction("../x", { name: "Kurz", text: "Atmen" })).toEqual({
      error: ERRORS.failed,
    })
    expect(await setRoutineFamilyAction(id, -1)).toEqual({ error: ERRORS.failed })
    mocks.session = { user: { id: otherId, role: "USER" } }
    expect(await updateRoutineAction(id, { name: "fremd", text: "x" })).toEqual({
      error: ROUTINE_ERRORS.missing,
    })
    expect(await deleteRoutineAction(id)).toEqual({ error: ROUTINE_ERRORS.missing })
    expect((await db.diaryRoutine.findUniqueOrThrow({ where: { id } })).name).toBe("Kurz")
  })
})
