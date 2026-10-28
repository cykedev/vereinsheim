import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"
import { generateSeason } from "../../../test/generate"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { writeRevision } from "../db/cards"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
  after: 0,
}))
vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: async () => mocks.session,
  isAdmin: (role: string) => role === "ADMIN",
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
vi.mock("next/server", () => ({ after: () => void mocks.after++ }))

const {
  createDiscipline,
  createFamily,
  removeFamily,
  renameFamily,
  saveDiscipline,
  setDisciplineIgnored,
} = await import("./discipline-actions")
const { newCardChoices } = await import("@/lib/fetch-card/queries")

const tag = randomUUID().slice(0, 8)
let adminId: string
let siteId: number
let createdSite: number | null = null
let other: TestSite
let familyA: number
let familyB: number
const disciplineIds: number[] = []

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

async function discipline(data: Record<string, unknown> = {}) {
  const created = await db.discipline.create({
    data: {
      siteId,
      meytonId: 10_210_040,
      name: `LP 40 ${tag} ${disciplineIds.length}`,
      targetId: "lp-10m",
      familyId: familyA,
      ...data,
    },
  })
  disciplineIds.push(created.id)
  return created.id
}
const read = (id: number) => db.discipline.findUniqueOrThrow({ where: { id } })
const input = (over: Partial<Parameters<typeof saveDiscipline>[1]> = {}) => ({
  targetId: "lp-10m",
  familyId: familyA as number | null,
  officialScoring: "open" as const,
  plannedShots: { mode: "id" as const },
  ...over,
})

beforeAll(async () => {
  adminId = (
    await db.user.create({
      data: { email: `admin-${tag}@example.com`, passwordHash: "-", role: "ADMIN" },
    })
  ).id
  const first = await db.site.findFirst({ orderBy: { id: "asc" }, select: { id: true } })
  if (first) siteId = first.id
  else
    siteId = createdSite = (
      await db.site.create({ data: { name: `Test ${tag}`, timeZone: "Europe/Berlin" } })
    ).id
  familyA = (await db.family.create({ data: { slug: `a-${tag}`, name: `A ${tag}` } })).id
  familyB = (await db.family.create({ data: { slug: `b-${tag}`, name: `B ${tag}` } })).id
  other = await createTestSite(db, "discipline-actions")
})
beforeEach(() => {
  mocks.session = { user: { id: adminId, role: "ADMIN" } }
})
afterAll(async () => {
  await db.card.deleteMany({ where: { disciplineId: { in: disciplineIds } } })
  await db.discipline.deleteMany({ where: { id: { in: disciplineIds } } })
  await db.family.deleteMany({ where: { name: { contains: tag } } })
  await other.remove()
  await db.user.deleteMany({ where: { email: { endsWith: `-${tag}@example.com` } } })
  if (createdSite) await db.site.delete({ where: { id: createdSite } })
  await db.$disconnect()
})

describe("saveDiscipline", () => {
  it("nur ein Admin", async () => {
    const id = await discipline()
    mocks.session = { user: { id: adminId, role: "USER" } }
    expect(await saveDiscipline(id, input())).toEqual({ error: "Das darf nur ein Admin." })
    expect((await read(id)).confirmedAt).toBeNull()
  })

  it("einordnen ohne Änderung setzt nur `confirmedAt`; die Wertung allein hebt die Version nicht", async () => {
    const id = await discipline()
    expect(await saveDiscipline(id, input())).toEqual({ success: true })
    let row = await read(id)
    expect(row.confirmedAt).not.toBeNull()
    expect(row.version).toBe(0)
    await saveDiscipline(id, input({ officialScoring: "rings" }))
    row = await read(id)
    expect(row.officialScoring).toBe("rings")
    expect(row.version).toBe(0)
  })

  it("Scheibe oder Schusszahl heben die Version und rechnen im Hintergrund nach", async () => {
    const id = await discipline()
    const before = mocks.after
    await saveDiscipline(id, input({ targetId: "own" }))
    expect(await read(id)).toMatchObject({ targetId: null, version: 1 })
    expect(mocks.after).toBe(before + 1)
    await saveDiscipline(id, input({ targetId: "own", plannedShots: { mode: "count", count: 3 } }))
    expect(await read(id)).toMatchObject({ plannedShots: 3, version: 2 })
    await saveDiscipline(id, input({ targetId: "own", plannedShots: { mode: "open" } }))
    expect(await read(id)).toMatchObject({ plannedShots: 0, version: 3 })
    await saveDiscipline(id, input({ targetId: "own", plannedShots: { mode: "id" } }))
    expect(await read(id)).toMatchObject({ plannedShots: null, version: 4 })
  })

  it("die Serienlänge nur, wenn sie mitkommt, und ohne neue Version", async () => {
    const id = await discipline({ seriesShots: 5 })
    await saveDiscipline(id, input())
    expect(await read(id)).toMatchObject({ seriesShots: 5, version: 0 })
    await saveDiscipline(id, input({ seriesShots: 0 }))
    expect(await read(id)).toMatchObject({ seriesShots: 0, version: 0 })
  })

  it("eine andere Familie zieht die Scheiben mit", async () => {
    const id = await discipline()
    const generated = generateSeason({
      seed: 3,
      cards: 3,
      firstMs: Date.UTC(2026, 9, 2, 18),
      everyDays: 1,
      sourceId: 0,
      disciplineId: id,
      ownerId: adminId,
      scheibenIdBase: 0,
    })[0]
    const { cardId } = await writeRevision(db, {
      ...generated,
      card: { ...generated.card, sourceId: null, scheibenId: null, origin: "pdf" },
    })
    await saveDiscipline(id, input({ familyId: familyB }))
    expect((await read(id)).familyId).toBe(familyB)
    expect((await db.card.findUniqueOrThrow({ where: { id: cardId } })).familyId).toBe(familyB)
  })

  it("abgewiesen: falsche Eingaben, fremde Anlage, unbekannte Familie, ignorierte Disziplin", async () => {
    const id = await discipline()
    const reload = { error: "Das ließ sich nicht speichern. Bitte lade die Seite neu." }
    expect(await saveDiscipline(id, input({ targetId: "kk-50m" }))).toEqual(reload)
    // geerbte Schlüssel sind kein Scheibenbild
    expect(await saveDiscipline(id, input({ targetId: "constructor" }))).toEqual(reload)
    expect(await saveDiscipline(id, input({ targetId: "toString" }))).toEqual(reload)
    expect(await saveDiscipline(id, input({ plannedShots: { mode: "count", count: 0 } }))).toEqual(
      reload
    )
    expect(await saveDiscipline(other.disciplineId, input())).toEqual(reload)
    expect(await saveDiscipline(id, input({ familyId: 2_000_000_000 }))).toEqual(reload)
    expect(await saveDiscipline(-1, input())).toEqual(reload)
    const ignored = await discipline({ ignoredAt: new Date() })
    expect(await saveDiscipline(ignored, input())).toEqual(reload)
    expect((await read(ignored)).confirmedAt).toBeNull()
  })
})

describe("createDiscipline", () => {
  const fresh = (over: Partial<Parameters<typeof createDiscipline>[0]> = {}) => ({
    name: `KK 3x20 ${tag}`,
    targetId: "lg-10m",
    familyId: familyA,
    officialScoring: "rings" as const,
    plannedShots: 60,
    seriesShots: 10,
    ...over,
  })
  const created = (result: Awaited<ReturnType<typeof createDiscipline>>) => {
    if (!("success" in result) || !result.data) throw new Error("nicht angelegt")
    disciplineIds.push(result.data.id)
    return result.data.id
  }

  it("legt ohne Meyton an, eingeordnet und wählbar", async () => {
    const id = created(await createDiscipline(fresh({ name: `  KK   3x20 ${tag} ` })))
    expect(await read(id)).toMatchObject({
      siteId,
      meytonId: null,
      name: `KK 3x20 ${tag}`,
      targetId: "lg-10m",
      familyId: familyA,
      officialScoring: "rings",
      plannedShots: 60,
      seriesShots: 10,
      ignoredAt: null,
    })
    expect((await read(id)).confirmedAt).not.toBeNull()
    const { options } = await newCardChoices(db, { siteId, userId: adminId })
    expect(options.some((option) => option.id === id)).toBe(true)
  })

  it("ein Name nur einmal je Anlage, ohne Groß- und Kleinschreibung", async () => {
    created(await createDiscipline(fresh({ name: `LP Zivil ${tag}` })))
    expect(await createDiscipline(fresh({ name: `lp zivil ${tag.toUpperCase()}` }))).toEqual({
      error: { name: ["Eine Disziplin mit diesem Namen gibt es schon."] },
    })
    expect(await createDiscipline(fresh({ name: "   " }))).toEqual({
      error: { name: ["Gib der Disziplin einen Namen."] },
    })
  })

  it("abgewiesen: kein Admin, kein Scheibenbild, unbekannte Familie, falsche Zahlen", async () => {
    const reload = { error: "Das ließ sich nicht speichern. Bitte lade die Seite neu." }
    expect(await createDiscipline(fresh({ targetId: "own" }))).toEqual(reload)
    expect(await createDiscipline(fresh({ targetId: "constructor" }))).toEqual(reload)
    expect(await createDiscipline(fresh({ familyId: 2_000_000_000 }))).toEqual(reload)
    expect(await createDiscipline(fresh({ plannedShots: -1 }))).toEqual(reload)
    expect(await createDiscipline(fresh({ seriesShots: 1.5 }))).toEqual(reload)
    mocks.session = { user: { id: adminId, role: "USER" } }
    expect(await createDiscipline(fresh({ name: `Neu ${tag}` }))).toEqual({
      error: "Das darf nur ein Admin.",
    })
    expect(await db.discipline.count({ where: { name: `Neu ${tag}` } })).toBe(0)
  })
})

describe("nur ein Admin", () => {
  it("ignorieren, Familien anlegen, umbenennen und entfernen", async () => {
    const id = await discipline()
    mocks.session = { user: { id: adminId, role: "USER" } }
    const denied = { error: "Das darf nur ein Admin." }
    expect(await setDisciplineIgnored(id, true)).toEqual(denied)
    expect(await createFamily(null, form({ name: `Verboten ${tag}` }))).toEqual(denied)
    expect(await renameFamily(familyA, `Verboten ${tag}`)).toEqual(denied)
    expect(await removeFamily(familyA)).toEqual(denied)
    expect((await read(id)).ignoredAt).toBeNull()
    expect(await db.family.findFirst({ where: { name: `Verboten ${tag}` } })).toBeNull()
  })
})

describe("setDisciplineIgnored", () => {
  it("ignorieren ordnet ein; wieder zeigen ohne Scheibe steht wieder unter „Neu“", async () => {
    const id = await discipline({ targetId: null })
    expect(await setDisciplineIgnored(id, true)).toEqual({ success: true })
    let row = await read(id)
    expect(row.ignoredAt).not.toBeNull()
    expect(row.confirmedAt).not.toBeNull()
    await setDisciplineIgnored(id, false)
    row = await read(id)
    expect(row.ignoredAt).toBeNull()
    expect(row.confirmedAt).toBeNull()
  })

  it("wieder zeigen mit Scheibe und Familie bleibt eingeordnet; fremde Anlage abgewiesen", async () => {
    const id = await discipline({ ignoredAt: new Date() })
    await setDisciplineIgnored(id, false)
    expect((await read(id)).confirmedAt).not.toBeNull()
    // aus einem veralteten Tab noch einmal: nichts mehr zu tun, nichts geändert
    expect(await setDisciplineIgnored(id, false)).toEqual({
      error: "Das ließ sich nicht speichern. Bitte lade die Seite neu.",
    })
    expect((await read(id)).confirmedAt).not.toBeNull()
    expect(await setDisciplineIgnored(other.disciplineId, true)).toEqual({
      error: "Das ließ sich nicht speichern. Bitte lade die Seite neu.",
    })
  })
})

describe("Familien", () => {
  it("anlegen mit Kennung aus dem Namen; doppelter Name abgewiesen", async () => {
    expect(await createFamily(null, form({ name: `Zimmerstutzen ${tag}` }))).toEqual({
      success: true,
    })
    const family = await db.family.findFirstOrThrow({ where: { name: `Zimmerstutzen ${tag}` } })
    expect(family.slug).toBe(`zimmerstutzen-${tag}`)
    expect(await createFamily(null, form({ name: `ZIMMERSTUTZEN ${tag}` }))).toEqual({
      error: { name: ["Diesen Namen hat schon eine Familie."] },
    })
    expect(await createFamily(null, form({ name: "  " }))).toEqual({
      error: { name: ["Bitte einen Namen eingeben."] },
    })
  })

  it("umbenennen behält die Kennung", async () => {
    await createFamily(null, form({ name: `Kranzl ${tag}` }))
    const family = await db.family.findFirstOrThrow({ where: { name: `Kranzl ${tag}` } })
    expect(await renameFamily(family.id, `Kranzlschießen ${tag}`)).toEqual({ success: true })
    expect(await db.family.findUniqueOrThrow({ where: { id: family.id } })).toMatchObject({
      name: `Kranzlschießen ${tag}`,
      slug: family.slug,
    })
    expect(await renameFamily(family.id, `A ${tag}`)).toEqual({
      error: { name: ["Diesen Namen hat schon eine Familie."] },
    })
  })

  it("entfernen nur ohne Disziplinen und Scheiben", async () => {
    await discipline({ familyId: familyB })
    expect(await removeFamily(familyB)).toEqual({
      error: "Zu dieser Familie gehören noch Disziplinen oder Scheiben. Lade die Seite neu.",
    })
    // nur Scheiben, keine Disziplin: bleibt auch
    await createFamily(null, form({ name: `Nur Scheiben ${tag}` }))
    const cardsOnly = await db.family.findFirstOrThrow({ where: { name: `Nur Scheiben ${tag}` } })
    const holder = await discipline()
    const generated = generateSeason({
      seed: 5,
      cards: 3,
      firstMs: Date.UTC(2026, 9, 2, 18),
      everyDays: 1,
      sourceId: 0,
      disciplineId: holder,
      ownerId: adminId,
      scheibenIdBase: 0,
    })[0]
    const { cardId } = await writeRevision(db, {
      ...generated,
      card: { ...generated.card, sourceId: null, scheibenId: null, origin: "pdf" },
    })
    await db.card.update({ where: { id: cardId }, data: { familyId: cardsOnly.id } })
    expect(await removeFamily(cardsOnly.id)).toEqual({
      error: "Zu dieser Familie gehören noch Disziplinen oder Scheiben. Lade die Seite neu.",
    })
    await createFamily(null, form({ name: `Leer ${tag}` }))
    const empty = await db.family.findFirstOrThrow({ where: { name: `Leer ${tag}` } })
    expect(await removeFamily(empty.id)).toEqual({ success: true })
    expect(await db.family.findUnique({ where: { id: empty.id } })).toBeNull()
  })
})
