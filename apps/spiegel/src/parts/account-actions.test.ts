import { randomUUID } from "node:crypto"

import bcrypt from "bcryptjs"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import { createWithout } from "@/diary/entries"
import { setDiaryEnabled } from "@/diary/settings"
import { db } from "@/lib/db"
import { writeRevision } from "@/lib/db/cards"
import { generateSeason } from "../../test/generate"
import { createTestSite, type TestSite } from "../../test/fixtures"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
}))
vi.mock("@/lib/auth-helpers", () => ({ getAuthSession: async () => mocks.session }))
vi.mock("@/lib/uploads", () => ({ sweepUploadsSoon: () => {} }))

const { deleteOwnAccount } = await import("./account-actions")
const { deleteAccountIn } = await import("./account")

const PASSWORD = "mein-eigenes-pw-1"
let site: TestSite
let base = 8700
const created: string[] = []

async function account(role: "USER" | "ADMIN" = "USER"): Promise<string> {
  const user = await db.user.create({
    data: {
      email: `konto-loeschen-${randomUUID().slice(0, 8)}@example.com`,
      passwordHash: await bcrypt.hash(PASSWORD, 4),
      role,
    },
  })
  created.push(user.id)
  return user.id
}

/** eine Scheibe der Brücke für das Konto */
async function card(ownerId: string): Promise<string> {
  const [input] = generateSeason({
    seed: base,
    cards: 1,
    firstMs: Date.UTC(2026, 6, 2, 17) + base * 60_000,
    everyDays: 1,
    sourceId: site.sourceId,
    disciplineId: site.disciplineId,
    ownerId,
    scheibenIdBase: base,
  })
  base += 1
  return (await writeRevision(db, input)).cardId
}

const as = (id: string, role = "USER") => {
  mocks.session = { user: { id, role } }
}

beforeAll(async () => {
  site = await createTestSite(db, "account-delete")
})
afterAll(async () => {
  await db.tombstone.deleteMany({ where: { sourceId: site.sourceId } })
  await site.remove()
  await db.user.deleteMany({ where: { id: { in: created } } })
  await db.$disconnect()
})

describe("deleteOwnAccount", () => {
  it("falsches Passwort ändert nichts", async () => {
    const id = await account()
    const own = await card(id)
    as(id)
    expect(await deleteOwnAccount("falsch-falsch-1")).toEqual({
      error: "Das Passwort stimmt nicht.",
    })
    expect(await db.user.count({ where: { id } })).toBe(1)
    expect(await db.card.count({ where: { id: own } })).toBe(1)
  })

  it("ohne Sitzung oder mit einem Passwort vom Admin nichts", async () => {
    const id = await account()
    mocks.session = null
    expect(await deleteOwnAccount(PASSWORD)).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
    mocks.session = { user: { id, role: "USER", mustChangePassword: true } }
    expect(await deleteOwnAccount(PASSWORD)).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
    expect(await db.user.count({ where: { id } })).toBe(1)
  })

  it("das einzige aktive Admin-Konto bleibt, mit einem zweiten geht es", async () => {
    const id = await account("ADMIN")
    // die Dev-Datenbank hat eigene Admins: in einer Transaktion, die zurückrollt, sind sie kurz inaktiv
    const rollback = new Error("zurück")
    await expect(
      db.$transaction(async (tx) => {
        await tx.user.updateMany({
          where: { role: "ADMIN", NOT: { id } },
          data: { isActive: false },
        })
        expect(await deleteAccountIn(tx, id)).toBe("lastAdmin")
        expect(await tx.user.count({ where: { id } })).toBe(1)
        throw rollback
      })
    ).rejects.toBe(rollback)
    await account("ADMIN")
    as(id, "ADMIN")
    expect(await deleteOwnAccount(PASSWORD)).toEqual({ success: true })
    expect(await db.user.count({ where: { id } })).toBe(0)
  })

  it("löscht beide Teile: keine Zeile mehr mit dem Konto, Meldung bleibt ohne Konto, fremde Scheibe bleibt", async () => {
    const id = await account()
    const other = await account()
    const own = [await card(id), await card(id)]
    await db.card.update({ where: { id: own[1] }, data: { deletedAt: new Date() } })
    const foreign = await card(other)
    await db.sportpassConsent.create({
      data: {
        userId: id,
        siteId: site.siteId,
        sportpassId: BigInt(4_711_000_001),
        confirmedAt: new Date(),
      },
    })
    await db.namedPeriod.create({
      data: {
        ownerId: id,
        name: "Vorbereitung",
        from: new Date("2026-06-01"),
        to: new Date("2026-07-01"),
      },
    })
    await db.tombstone.create({
      data: {
        sourceId: site.sourceId,
        scheibenId: 999_001,
        cycle: 0,
        startedAt: new Date(),
        reason: "nicht-meine",
        userId: id,
        sportpassId: BigInt(4_711_000_001),
      },
    })
    await setDiaryEnabled(db, id, true)
    const entry = (await createWithout(db, id, {
      day: "2026-07-03",
      kind: "mental",
      familyId: null,
      timeZone: "Europe/Berlin",
    })) as { id: string }
    const goal = await db.diaryGoal.create({
      data: {
        userId: id,
        title: "Ziel",
        kind: "process",
        from: new Date("2026-09-01T00:00:00Z"),
        to: new Date("2027-08-31T00:00:00Z"),
      },
    })
    const routine = await db.diaryRoutine.create({
      data: { userId: id, name: "Ablauf", steps: [{ title: "Atmen" }] },
    })

    as(id)
    expect(await deleteOwnAccount(PASSWORD)).toEqual({ success: true })

    expect(await db.user.count({ where: { id } })).toBe(0)
    expect(await db.card.count({ where: { OR: [{ id: { in: own } }, { ownerId: id }] } })).toBe(0)
    expect(await db.sportpassConsent.count({ where: { userId: id } })).toBe(0)
    expect(await db.namedPeriod.count({ where: { ownerId: id } })).toBe(0)
    expect(await db.deleteLock.count({ where: { userId: id } })).toBe(0)
    expect(await db.diarySettings.count({ where: { userId: id } })).toBe(0)
    expect(await db.diaryEntry.count({ where: { id: entry.id } })).toBe(0)
    expect(await db.diaryGoal.count({ where: { id: goal.id } })).toBe(0)
    expect(await db.diaryRoutine.count({ where: { id: routine.id } })).toBe(0)
    expect(
      await db.tombstone.findFirst({ where: { sourceId: site.sourceId, scheibenId: 999_001 } })
    ).toMatchObject({ userId: null, sportpassId: BigInt(4_711_000_001) })
    expect(await db.card.findUnique({ where: { id: foreign }, select: { ownerId: true } })).toEqual(
      {
        ownerId: other,
      }
    )
    // ein zweites Mal: das Konto gibt es nicht mehr
    expect(await deleteOwnAccount(PASSWORD)).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
  })
})
