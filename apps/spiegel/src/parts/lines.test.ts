import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { formatIsoDate } from "@vereinsheim/lib/format"

import { createWithout } from "@/diary/entries"
import { setDiaryEnabled } from "@/diary/settings"
import { createPrismaClient } from "@/lib/db"
import { writeEnteredCard } from "@/lib/db/entered"
import { createTestSite, type TestSite } from "../../test/fixtures"

import { cardLines, startLines } from "./lines"

const db = createPrismaClient()
const ZONE = "Europe/Berlin"
let site: TestSite
let disciplineId: number
let slug: string

beforeAll(async () => {
  site = await createTestSite(db, "part-lines")
  disciplineId = (
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: null,
        name: "LP 20 Stellen",
        familyId: site.familyId,
        targetId: "lp-10m",
        plannedShots: 20,
        confirmedAt: new Date(),
      },
    })
  ).id
  slug = (await db.family.findUniqueOrThrow({ where: { id: site.familyId } })).slug
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

async function card(day: string) {
  const saved = await writeEnteredCard(db, {
    ownerId: site.ownerId,
    origin: "manual",
    disciplineId,
    startedAtMs: Date.parse(`${day}T17:00:00Z`),
    kind: "training",
    details: { total: { shots: 20, rings: 180 } },
    reason: "eingetragen",
  })
  if (saved.kind !== "saved") throw new Error(saved.kind)
  return saved.cardId
}

describe("Stellen für das Tagebuch", () => {
  it("ohne Tagebuch keine Zeile", async () => {
    const day = formatIsoDate(new Date(Date.now() - 4 * 86_400_000), ZONE)
    const c = await card(day)
    expect(await cardLines(db, { ownerId: site.ownerId, cardId: c, timeZone: ZONE })).toEqual([])
    expect(
      await startLines(db, {
        ownerId: site.ownerId,
        blocks: [{ day, familySlug: slug, cardIds: [c] }],
        timeZone: ZONE,
      })
    ).toEqual({})
  })

  it("an der Scheibe und auf Start: ohne Eintrag „anlegen“, mit Eintrag „öffnen“", async () => {
    await setDiaryEnabled(db, site.ownerId, true)
    const day = formatIsoDate(new Date(Date.now() - 5 * 86_400_000), ZONE)
    const c = await card(day)
    const blocks = [{ day, familySlug: slug, cardIds: [c] }]
    expect(await cardLines(db, { ownerId: site.ownerId, cardId: c, timeZone: ZONE })).toEqual([
      {
        key: "diary",
        title: "Tagebuch",
        state: "Noch in keinem Eintrag.",
        href: `/diary/new?card=${c}`,
        action: "Eintrag anlegen",
      },
    ])
    expect(
      (await startLines(db, { ownerId: site.ownerId, blocks, timeZone: ZONE }))[`${day}|${slug}`]
    ).toMatchObject({
      href: `/diary/new?card=${c}`,
      action: "Eintrag anlegen",
    })
    const entry = (await createWithout(db, site.ownerId, {
      day,
      kind: "shooting",
      familyId: site.familyId,
      timeZone: ZONE,
    })) as { id: string }
    const [line] = await cardLines(db, { ownerId: site.ownerId, cardId: c, timeZone: ZONE })
    expect(line).toMatchObject({ href: `/diary/${entry.id}`, action: "Eintrag öffnen" })
    expect(line.state).toMatch(/^Im Eintrag vom \S+ \d\d\.\d\d\.\.$/)
    expect(
      (await startLines(db, { ownerId: site.ownerId, blocks, timeZone: ZONE }))[`${day}|${slug}`]
    ).toMatchObject({
      href: `/diary/${entry.id}`,
      action: "Eintrag öffnen",
    })
  })
})
