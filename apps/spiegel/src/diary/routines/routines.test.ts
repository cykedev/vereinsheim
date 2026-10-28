import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { ERRORS } from "../texts"
import { diaryTrashThings } from "../trash"
import {
  ROUTINE_TRASH_ERRORS,
  createRoutine,
  deleteRoutine,
  purgeRoutineNow,
  restoreRoutine,
  setRoutineFamily,
  updateRoutine,
} from "./routines"
import { routineList, routineView } from "./queries"
import { ROUTINE_ERRORS } from "./texts"
import { parseRoutine } from "./validation"

const db = createPrismaClient()
const DAY = 86_400_000
let site: TestSite
let otherId: string

beforeAll(async () => {
  site = await createTestSite(db, "diary-routines")
  // eine eingeordnete Disziplin der Familie, damit `resultFamilies` sie anbietet
  await db.discipline.create({
    data: {
      siteId: site.siteId,
      meytonId: null,
      name: "LP Abläufe",
      familyId: site.familyId,
      targetId: "lp-10m",
      plannedShots: 40,
      seriesShots: 10,
      confirmedAt: new Date(),
    },
  })
  otherId = (
    await db.user.create({
      data: { email: `diary-routines-other-${site.siteId}@example.com`, passwordHash: "-" },
    })
  ).id
})
afterAll(async () => {
  await site.remove()
  await db.user.delete({ where: { id: otherId } })
  await db.$disconnect()
})

const TEXT = "Griff fassen\nHand ganz hoch.\n\nAtmen\n\nAbziehen und nachhalten"

describe("parseRoutine", () => {
  const families = new Set([7])
  it("Name, Disziplin oder keine, Schritte aus dem Text", () => {
    expect(parseRoutine({ name: " Mein  Ablauf ", familyId: null, text: TEXT }, families)).toEqual({
      data: {
        name: "Mein Ablauf",
        familyId: null,
        steps: [
          { title: "Griff fassen", description: "Hand ganz hoch." },
          { title: "Atmen" },
          { title: "Abziehen und nachhalten" },
        ],
      },
    })
  })

  it("Feldfehler und ungültige Disziplin", () => {
    expect(parseRoutine({ name: "", familyId: 7, text: " \n\n " }, families)).toEqual({
      fieldErrors: { name: [ROUTINE_ERRORS.name], text: [ROUTINE_ERRORS.steps] },
    })
    const many = Array.from({ length: 201 }, (_, i) => `S${i}`).join("\n\n")
    expect(parseRoutine({ name: "x", familyId: 7, text: many }, families)).toEqual({
      fieldErrors: { text: [ROUTINE_ERRORS.tooMany] },
    })
    expect(parseRoutine({ name: "x", familyId: 8, text: TEXT }, families)).toEqual({
      invalid: true,
    })
  })
})

describe("Abläufe schreiben und lesen", () => {
  it("anlegen, lesen, bearbeiten; die Disziplin bleibt beim Bearbeiten", async () => {
    const created = await createRoutine(db, site.ownerId, {
      name: "Mein Ablauf",
      familyId: site.familyId,
      text: TEXT,
    })
    const id = (created as { id: string }).id
    expect(await routineView(db, site.ownerId, id)).toMatchObject({
      name: "Mein Ablauf",
      family: { id: site.familyId },
      steps: [{ title: "Griff fassen" }, { title: "Atmen" }, { title: "Abziehen und nachhalten" }],
    })
    expect(
      await updateRoutine(db, site.ownerId, id, { name: "Kurz", text: "Nur einer" })
    ).toBeNull()
    expect(await routineView(db, site.ownerId, id)).toMatchObject({
      name: "Kurz",
      family: { id: site.familyId },
      steps: [{ title: "Nur einer" }],
    })
    expect((await routineList(db, site.ownerId)).find((r) => r.id === id)).toEqual({
      id,
      name: "Kurz",
      familyId: site.familyId,
      steps: 1,
    })
  })

  it("ohne Disziplin anlegen und später festlegen", async () => {
    const id = (
      (await createRoutine(db, site.ownerId, { name: "Stand", familyId: null, text: TEXT })) as {
        id: string
      }
    ).id
    expect((await routineView(db, site.ownerId, id))?.family).toBeNull()
    expect(await setRoutineFamily(db, site.ownerId, id, site.familyId)).toBeNull()
    expect((await routineView(db, site.ownerId, id))?.family?.id).toBe(site.familyId)
    expect(await setRoutineFamily(db, site.ownerId, id, 2_000_000_000)).toBe(ERRORS.failed)
  })

  it("ein fremder Ablauf ändert niemand", async () => {
    const id = (
      (await createRoutine(db, otherId, { name: "Fremd", familyId: null, text: TEXT })) as {
        id: string
      }
    ).id
    expect(await updateRoutine(db, site.ownerId, id, { name: "x", text: "y" })).toEqual({
      error: ROUTINE_ERRORS.missing,
    })
    expect(await deleteRoutine(db, site.ownerId, id)).toBe(ROUTINE_ERRORS.missing)
    expect(await routineView(db, site.ownerId, id)).toBeNull()
    await db.diaryRoutine.delete({ where: { id } })
  })

  it("Papierkorb: löschen, wiederherstellen, endgültig, nach 30 Tagen nicht mehr zurück", async () => {
    const id = (
      (await createRoutine(db, site.ownerId, { name: "Weg", familyId: null, text: TEXT })) as {
        id: string
      }
    ).id
    expect(await deleteRoutine(db, site.ownerId, id)).toBeNull()
    expect((await routineList(db, site.ownerId)).some((r) => r.id === id)).toBe(false)
    expect((await diaryTrashThings(db, site.ownerId)).routines.find((r) => r.id === id)).toEqual({
      id,
      name: "Weg",
      left: "noch 30 Tage",
    })
    expect(await restoreRoutine(db, site.ownerId, id)).toBeNull()
    expect(await deleteRoutine(db, site.ownerId, id)).toBeNull()
    expect(await restoreRoutine(db, site.ownerId, id, Date.now() + 31 * DAY)).toBe(
      ROUTINE_TRASH_ERRORS.expired
    )
    expect(await purgeRoutineNow(db, site.ownerId, id)).toBeNull()
    expect(await purgeRoutineNow(db, site.ownerId, id)).toBe(ROUTINE_TRASH_ERRORS.notInTrash)
  })
})
