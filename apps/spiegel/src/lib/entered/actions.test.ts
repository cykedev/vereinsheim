import { randomUUID } from "node:crypto"

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"

import { writeEnteredCard } from "../db/entered"
import { emptyForm, TEXTS, type EnteredFormState } from "./form"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
}))
vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: async () => mocks.session,
  isAdmin: (role: string) => role === "ADMIN",
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const { saveEnteredCard } = await import("./actions")
const { cardForEdit, ownPlaces } = await import("./queries")

// eigene Zeilen an der ersten Anlage (die Dev-Datenbank ist eine Prod-Kopie): ein Schütze, eine Familie, zwei Disziplinen
const tag = randomUUID().slice(0, 8)
let ownerId: string
let otherId: string
let disciplineId: number
let hiddenId: number
let familyId: number
const TZ = "Europe/Berlin"
const DISCIPLINE = { plannedShots: 40, seriesShots: 10, officialScoring: "decimal" as const }

beforeAll(async () => {
  const site = await db.site.findFirstOrThrow({ orderBy: { id: "asc" }, select: { id: true } })
  ownerId = (
    await db.user.create({ data: { email: `hand-${tag}@example.com`, passwordHash: "-" } })
  ).id
  otherId = (
    await db.user.create({ data: { email: `other-${tag}@example.com`, passwordHash: "-" } })
  ).id
  familyId = (await db.family.create({ data: { slug: `hand-${tag}`, name: `Hand ${tag}` } })).id
  const discipline = (name: string, confirmed: boolean) =>
    db.discipline.create({
      data: {
        siteId: site.id,
        meytonId: null,
        name,
        familyId,
        targetId: "lg-10m",
        plannedShots: 40,
        seriesShots: 10,
        confirmedAt: confirmed ? new Date() : null,
      },
    })
  disciplineId = (await discipline(`Hand ${tag}`, true)).id
  hiddenId = (await discipline(`Hand neu ${tag}`, false)).id
})
afterAll(async () => {
  await db.card.deleteMany({ where: { disciplineId: { in: [disciplineId, hiddenId] } } })
  await db.discipline.deleteMany({ where: { id: { in: [disciplineId, hiddenId] } } })
  await db.family.delete({ where: { id: familyId } })
  await db.user.deleteMany({ where: { email: { endsWith: `-${tag}@example.com` } } })
  await db.$disconnect()
})
beforeEach(() => {
  mocks.session = { user: { id: ownerId, role: "USER" } }
})

const form = (over: Partial<EnteredFormState> = {}): EnteredFormState => ({
  ...emptyForm(DISCIPLINE, "2026-10-20"),
  ...over,
})
const sums = (...values: string[]) => values.map((sum) => ({ sum, open: false, shots: [] }))
const created = async (over: Partial<EnteredFormState> = {}) => {
  const result = await saveEnteredCard({ disciplineId, kind: "competition", form: form(over) })
  if (!("success" in result) || !result.data) throw new Error(JSON.stringify(result))
  return result.data.cardId
}

describe("saveEnteredCard", () => {
  it("legt eine eingetragene Scheibe an: Tag ohne Uhrzeit, Ort, Art als Wahl, Serien", async () => {
    const cardId = await created({ series: sums("102,4", "101,9"), place: " Schützenhaus  Nord " })
    const card = await db.card.findUniqueOrThrow({
      where: { id: cardId },
      include: { currentRevision: { include: { seriesSums: true } } },
    })
    expect(card).toMatchObject({
      origin: "manual",
      ownerId,
      disciplineId,
      kind: "competition",
      kindChoice: "competition",
      timeUnknown: true,
      place: "Schützenhaus Nord",
      startedAt: new Date(Date.UTC(2026, 9, 20, 10)),
    })
    expect(card.currentRevision?.reason).toBe("von Hand eingetragen")
    expect(card.currentRevision?.seriesSums.map((s) => s.decimalTenths)).toEqual([1024, 1019])
    expect(await ownPlaces(db, ownerId)).toEqual(["Schützenhaus Nord"])
  })

  it("ändern: neue Revision bei neuen Werten, gleiche Werte nur Tag und Ort", async () => {
    const cardId = await created({ series: sums("98", "97") })
    const edit = await cardForEdit(db, { cardId, ownerId, timeZone: TZ })
    expect(edit).toMatchObject({ day: "2026-10-20", time: "", kind: "competition" })
    const again = await saveEnteredCard({
      cardId,
      form: form({ series: sums("98", "97"), time: "19:30", place: "Halle" }),
    })
    expect(again).toEqual({ success: true, data: { cardId } })
    let card = await db.card.findUniqueOrThrow({
      where: { id: cardId },
      include: { currentRevision: true },
    })
    expect(card).toMatchObject({ timeUnknown: false, place: "Halle" })
    expect(card.startedAt).toEqual(new Date(Date.UTC(2026, 9, 20, 17, 30)))
    expect(card.currentRevision?.number).toBe(1)
    await saveEnteredCard({ cardId, form: form({ series: sums("98", "97,5") }) })
    card = await db.card.findUniqueOrThrow({
      where: { id: cardId },
      include: { currentRevision: true },
    })
    expect(card.currentRevision).toMatchObject({ number: 2, reason: "von Hand geändert" })
  })

  it("Fehler je Feld, nichts geschrieben", async () => {
    const before = await db.card.count({ where: { ownerId } })
    expect(
      await saveEnteredCard({
        disciplineId,
        kind: "training",
        form: form({ day: "2999-01-01", series: sums("98", "", "97") }),
      })
    ).toEqual({ error: { day: [TEXTS.dayFuture], "series.1.sum": [TEXTS.gap(2)] } })
    expect(await db.card.count({ where: { ownerId } })).toBe(before)
  })

  it("abgewiesen: fremde Scheibe, nicht eingeordnete Disziplin, ohne Anmeldung", async () => {
    const cardId = await created({ series: sums("98") })
    mocks.session = { user: { id: otherId, role: "USER" } }
    expect(await saveEnteredCard({ cardId, form: form() })).toEqual({
      error: "Diese Scheibe gibt es nicht mehr.",
    })
    expect(
      await saveEnteredCard({
        disciplineId: hiddenId,
        kind: "training",
        form: form({ series: sums("98") }),
      })
    ).toEqual({ error: TEXTS.reload })
    mocks.session = null
    expect(await saveEnteredCard({ disciplineId, kind: "training", form: form() })).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
  })

  it("was das Formular nicht ganz zeigen kann, überschreibt es nicht; der Beginn bleibt, wenn Tag und Uhrzeit bleiben", async () => {
    const placed = await writeEnteredCard(db, {
      ownerId,
      origin: "manual",
      disciplineId,
      startedAtMs: Date.UTC(2026, 9, 18, 17, 0, 42, 123),
      kind: "training",
      details: {
        shots: [{ series: 1, ring: 10, decimalTenths: null, xUm: 500, yUm: -300 }],
        series: [{ series: 1, shots: 1, rings: 10 }],
      },
      reason: "Test",
    })
    if (placed.kind !== "saved") throw new Error(placed.kind)
    expect(
      await saveEnteredCard({ cardId: placed.cardId, form: form({ series: sums("98") }) })
    ).toEqual({
      error: TEXTS.notEditable,
    })
    expect(
      (await db.shot.findMany({ where: { cardId: placed.cardId } })).map((s) => s.xUm)
    ).toEqual([500])

    const plain = await writeEnteredCard(db, {
      ownerId,
      origin: "manual",
      disciplineId,
      startedAtMs: Date.UTC(2026, 9, 18, 17, 0, 42, 123),
      kind: "training",
      details: { series: [{ series: 1, decimalTenths: 980 }] },
      reason: "Test",
    })
    if (plain.kind !== "saved") throw new Error(plain.kind)
    const edit = await cardForEdit(db, { cardId: plain.cardId, ownerId, timeZone: TZ })
    expect(edit).toMatchObject({ day: "2026-10-18", time: "19:00" })
    await saveEnteredCard({
      cardId: plain.cardId,
      form: form({ day: "2026-10-18", time: "19:00", series: sums("98,0"), place: "Halle" }),
    })
    const kept = await db.card.findUniqueOrThrow({ where: { id: plain.cardId } })
    expect(kept.startedAt.getTime()).toBe(Date.UTC(2026, 9, 18, 17, 0, 42, 123))
    expect(kept.place).toBe("Halle")
  })

  it("eine Scheibe vom Ausdruck lässt sich hier nicht ändern", async () => {
    const pdf = await writeEnteredCard(db, {
      ownerId,
      origin: "pdf",
      disciplineId,
      startedAtMs: Date.UTC(2026, 9, 19, 17),
      kind: "training",
      details: {},
      reason: "Test",
    })
    if (pdf.kind !== "saved") throw new Error(pdf.kind)
    expect(await cardForEdit(db, { cardId: pdf.cardId, ownerId, timeZone: TZ })).toBeNull()
    expect(
      await saveEnteredCard({ cardId: pdf.cardId, form: form({ series: sums("98") }) })
    ).toEqual({
      error: "Diese Scheibe gibt es nicht mehr.",
    })
  })
})
