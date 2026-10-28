import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { formatIsoDate } from "@vereinsheim/lib/format"

import { createFromEvening, createWithout, releaseCard } from "@/diary/entries"
import { deleteEntry } from "@/diary/trash"
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

  it("jede Zeile führt dorthin, wo sich etwas tun lässt: gelöst zum Eintrag, im Papierkorb zum Papierkorb", async () => {
    await setDiaryEnabled(db, site.ownerId, true)
    const day = formatIsoDate(new Date(Date.now() - 6 * 86_400_000), ZONE)
    const c = await card(day)
    const blocks = [{ day, familySlug: slug, cardIds: [c] }]
    const entry = (await createFromEvening(db, site.ownerId, {
      day,
      familyId: site.familyId,
      timeZone: ZONE,
    })) as { id: string }
    expect(await releaseCard(db, site.ownerId, entry.id, c)).toBeNull()
    const [offered] = await cardLines(db, { ownerId: site.ownerId, cardId: c, timeZone: ZONE })
    expect(offered).toMatchObject({ href: `/diary/${entry.id}`, action: "Eintrag öffnen" })
    expect(offered.state).toMatch(
      /^Noch in keinem Eintrag\. Der Eintrag vom \S+ \d\d\.\d\d\. bietet sie an\.$/
    )
    expect(
      (await startLines(db, { ownerId: site.ownerId, blocks, timeZone: ZONE }))[`${day}|${slug}`]
    ).toMatchObject({ href: `/diary/${entry.id}`, action: "Eintrag öffnen" })

    const d = await card(day)
    await db.diaryEntryCard.update({ where: { cardId: c }, data: { link: "linked" } })
    await db.diaryEntryCard.create({ data: { cardId: d, entryId: entry.id, link: "linked" } })
    expect(await deleteEntry(db, site.ownerId, entry.id)).toBeNull()
    const [trash] = await cardLines(db, { ownerId: site.ownerId, cardId: c, timeZone: ZONE })
    expect(trash).toMatchObject({ href: "/profile/trash", action: "Papierkorb öffnen" })
    expect(trash.state).toMatch(/^Im Eintrag vom \S+ \d\d\.\d\d\.\. Er liegt im Papierkorb\.$/)
    // stecken alle Scheiben des Blocks in einem Eintrag im Papierkorb, steht auf Start keine Zeile
    expect(
      await startLines(db, {
        ownerId: site.ownerId,
        blocks: [{ day, familySlug: slug, cardIds: [c, d] }],
        timeZone: ZONE,
      })
    ).toEqual({})
  })
})
