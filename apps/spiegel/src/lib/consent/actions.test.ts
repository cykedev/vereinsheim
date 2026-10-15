import { randomInt, randomUUID } from "node:crypto"

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { db } from "@/lib/db"

import { createTestSite, type TestSite } from "../../../test/fixtures"

import { consentStatus } from "./status"
import { CURRENT_CONSENT_VERSION } from "./texts"

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string; role: string; mustChangePassword?: boolean } },
}))
vi.mock("@/lib/auth-helpers", () => ({
  getAuthSession: async () => mocks.session,
  isAdmin: (role: string) => role === "ADMIN",
}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))

const {
  confirmConsent,
  liftNotMine,
  rejectConsent,
  removeConsent,
  requestSportpass,
  revokeSportpass,
} = await import("./actions")

const tag = randomUUID().slice(0, 8)
let adminId: string
let shooterId: string
let otherId: string
let createdSite: number | null = null
let cardSite: TestSite
/** SportpassIDs, die es in der Dev-Datenbank sicher nicht gibt */
const sportpass = () => String(900_000_000_000 + randomInt(99_999_999))

const form = (fields: Record<string, string>) => {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}
const asShooter = (id = shooterId) => {
  mocks.session = { user: { id, role: "USER" } }
}
const asAdmin = () => {
  mocks.session = { user: { id: adminId, role: "ADMIN" } }
}
/** eine Zustimmung des Schützen, wie sie das Profil anlegt */
async function requested(userId = shooterId) {
  asShooter(userId)
  const id = sportpass()
  expect(
    await requestSportpass(
      null,
      form({ sportpass: id, agree: "on", version: CURRENT_CONSENT_VERSION })
    )
  ).toEqual({
    success: true,
  })
  return db.sportpassConsent.findFirstOrThrow({
    where: { userId, sportpassId: BigInt(id) },
  })
}

beforeAll(async () => {
  const user = (email: string, role: "ADMIN" | "USER" = "USER") =>
    db.user.create({ data: { email, passwordHash: "-", role } }).then((u) => u.id)
  adminId = await user(`admin-${tag}@example.com`, "ADMIN")
  shooterId = await user(`schuetze-${tag}@example.com`)
  otherId = await user(`andere-${tag}@example.com`)
  // die Actions arbeiten auf der ersten Anlage; gibt es keine, legt der Test eine an und räumt sie weg
  if (!(await db.site.findFirst({ select: { id: true } })))
    createdSite = (
      await db.site.create({ data: { name: `Test ${tag}`, timeZone: "Europe/Berlin" } })
    ).id
  cardSite = await createTestSite(db, "zustimmung")
})
afterAll(async () => {
  await cardSite.remove()
  await db.user.deleteMany({ where: { email: { endsWith: `-${tag}@example.com` } } })
  if (createdSite) await db.site.delete({ where: { id: createdSite } })
  await db.$disconnect()
})
beforeEach(() => {
  mocks.session = null
})

describe("Zustimmung durch den Schützen", () => {
  it("legt eine wartende Zustimmung mit der Version des Hinweistexts an", async () => {
    const consent = await requested()
    expect(consentStatus(consent)).toBe("requested")
    expect(consent.consentVersion).toBe(CURRENT_CONSENT_VERSION)
    expect(consent.confirmedAt).toBeNull()
    // eine Nummer je Konto: aufräumen, sonst scheitern die folgenden an der Grenze
    await db.sportpassConsent.delete({ where: { id: consent.id } })
  })

  it("einem älteren Hinweistext (v1) stimmt niemand mehr neu zu (P2f)", async () => {
    asShooter()
    const id = sportpass()
    expect(CURRENT_CONSENT_VERSION).toBe("v2")
    expect(
      await requestSportpass(null, form({ sportpass: id, agree: "on", version: "v1" }))
    ).toEqual({
      error: "Der Hinweis hat sich geändert. Bitte die Seite neu laden und neu lesen.",
    })
    expect(await db.sportpassConsent.count({ where: { sportpassId: BigInt(id) } })).toBe(0)
  })

  it("ohne Haken keine Zeile, sondern ein Feldfehler", async () => {
    asShooter()
    const id = sportpass()
    expect(
      await requestSportpass(null, form({ sportpass: id, version: CURRENT_CONSENT_VERSION }))
    ).toEqual({
      error: { agree: ["Bitte setz das Häkchen, wenn du zustimmst."] },
    })
    expect(await db.sportpassConsent.count({ where: { sportpassId: BigInt(id) } })).toBe(0)
  })

  it("nur Ziffern bis zwölf Stellen, ohne Anmeldung nichts", async () => {
    asShooter()
    expect(
      await requestSportpass(
        null,
        form({ sportpass: "12a", agree: "on", version: CURRENT_CONSENT_VERSION })
      )
    ).toEqual({
      error: { sportpass: ["Eine Sportpassnummer hat höchstens zwölf Ziffern."] },
    })
    mocks.session = null
    expect(
      await requestSportpass(
        null,
        form({ sportpass: sportpass(), agree: "on", version: CURRENT_CONSENT_VERSION })
      )
    ).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
  })

  it("eine Sportpassnummer je Konto (User, 15. Oktober 2026), auch eine abgelehnte zählt", async () => {
    const userId = otherId
    const first = await requested(userId)
    await db.sportpassConsent.update({ where: { id: first.id }, data: { rejectedAt: new Date() } })
    asShooter(userId)
    expect(
      await requestSportpass(
        null,
        form({ sportpass: sportpass(), agree: "on", version: CURRENT_CONSENT_VERSION })
      )
    ).toEqual({
      error: {
        sportpass: ["Du hast schon eine Sportpassnummer. Für eine neue widerrufe erst die alte."],
      },
    })
    expect(await db.sportpassConsent.count({ where: { userId } })).toBe(1)
    await db.sportpassConsent.deleteMany({ where: { userId } })
  })

  it("eine vergebene SportpassID verrät nicht, wem sie gehört", async () => {
    const taken = await requested(otherId)
    asShooter()
    expect(
      await requestSportpass(
        null,
        form({
          sportpass: taken.sportpassId.toString(),
          agree: "on",
          version: CURRENT_CONSENT_VERSION,
        })
      )
    ).toEqual({
      error: {
        sportpass: [
          "Diese Sportpassnummer hat schon jemand eingetragen. Wende dich an einen Admin.",
        ],
      },
    })
    await db.sportpassConsent.delete({ where: { id: taken.id } })
  })
})

describe("Grenzen der Zustimmung (Review)", () => {
  it("die Version ist die des gezeigten Texts; ein veralteter Text legt nichts an", async () => {
    asShooter()
    const id = sportpass()
    expect(
      await requestSportpass(null, form({ sportpass: id, agree: "on", version: "v0" }))
    ).toEqual({
      error: "Der Hinweis hat sich geändert. Bitte die Seite neu laden und neu lesen.",
    })
    expect(await requestSportpass(null, form({ sportpass: id, agree: "on" }))).toEqual({
      error: "Der Hinweis hat sich geändert. Bitte die Seite neu laden und neu lesen.",
    })
    expect(await db.sportpassConsent.count({ where: { sportpassId: BigInt(id) } })).toBe(0)
  })

  it("die eigene SportpassID noch einmal: die Meldung der Grenze, das Konto hat ja schon eine", async () => {
    const own = await requested()
    asShooter()
    expect(
      await requestSportpass(
        null,
        form({
          sportpass: own.sportpassId.toString(),
          agree: "on",
          version: CURRENT_CONSENT_VERSION,
        })
      )
    ).toEqual({
      error: {
        sportpass: ["Du hast schon eine Sportpassnummer. Für eine neue widerrufe erst die alte."],
      },
    })
    await db.sportpassConsent.delete({ where: { id: own.id } })
  })

  it("höchstens eine, auch bei gleichzeitigem Absenden", async () => {
    const userId = otherId
    asShooter(userId)
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        requestSportpass(
          null,
          form({ sportpass: sportpass(), agree: "on", version: CURRENT_CONSENT_VERSION })
        )
      )
    )
    expect(results.filter((r) => "success" in r)).toHaveLength(1)
    expect(await db.sportpassConsent.count({ where: { userId } })).toBe(1)
    await db.sportpassConsent.deleteMany({ where: { userId } })
  })

  it("mit einem Passwort vom Admin: weder zustimmen noch widerrufen noch entscheiden", async () => {
    const consent = await requested()
    const before = await db.sportpassConsent.count({ where: { userId: shooterId } })
    mocks.session = { user: { id: shooterId, role: "USER", mustChangePassword: true } }
    expect(
      await requestSportpass(
        null,
        form({ sportpass: sportpass(), agree: "on", version: CURRENT_CONSENT_VERSION })
      )
    ).toEqual({ error: "Das geht gerade nicht. Lade die Seite neu." })
    expect(await revokeSportpass(consent.id)).toEqual({
      error: "Das geht gerade nicht. Lade die Seite neu.",
    })
    mocks.session = { user: { id: adminId, role: "ADMIN", mustChangePassword: true } }
    expect(await confirmConsent(consent.id)).toEqual({
      error: "Bitte zuerst das eigene Passwort ändern.",
    })
    const unchanged = await db.sportpassConsent.findUniqueOrThrow({ where: { id: consent.id } })
    expect(consentStatus(unchanged)).toBe("requested")
    expect(await db.sportpassConsent.count({ where: { userId: shooterId } })).toBe(before)
    await db.sportpassConsent.delete({ where: { id: consent.id } })
  })
})

describe("Widerruf", () => {
  it("nur die eigene; eine fremde bleibt", async () => {
    const foreign = await requested(otherId)
    asShooter()
    expect(await revokeSportpass(foreign.id)).toEqual({
      error: "Diese Sportpassnummer gibt es hier nicht mehr. Lade die Seite neu.",
    })
    expect(await db.sportpassConsent.count({ where: { id: foreign.id } })).toBe(1)
    asShooter(otherId)
    expect(await revokeSportpass(foreign.id)).toEqual({ success: true })
    expect(await db.sportpassConsent.count({ where: { id: foreign.id } })).toBe(0)
  })

  it("die hochgeladenen Scheiben bleiben beim Schützen", async () => {
    const consent = await requested()
    const card = await db.card.create({
      data: {
        ownerId: shooterId,
        disciplineId: cardSite.disciplineId,
        startedAt: new Date(),
        kind: "training",
        state: "final",
        complete: true,
        origin: "raw",
      },
    })
    asShooter()
    expect(await revokeSportpass(consent.id)).toEqual({ success: true })
    expect((await db.card.findUniqueOrThrow({ where: { id: card.id } })).ownerId).toBe(shooterId)
    await db.card.delete({ where: { id: card.id } })
  })
})

describe("Entscheidung des Admins", () => {
  it("nur ein Admin bestätigt; zweimal ist schon entschieden", async () => {
    const consent = await requested()
    asShooter()
    expect(await confirmConsent(consent.id)).toEqual({ error: "Das darf nur ein Admin." })
    asAdmin()
    expect(await confirmConsent(consent.id)).toEqual({ success: true })
    const active = await db.sportpassConsent.findUniqueOrThrow({ where: { id: consent.id } })
    expect(consentStatus(active)).toBe("active")
    // ein Auftrag zum Nachladen ist eröffnet (Review P2d)
    expect(active.historyRequestedAt).not.toBeNull()
    expect(await confirmConsent(consent.id)).toEqual({
      error: "Das hat gerade schon jemand entschieden. Lade die Seite neu.",
    })
    await db.sportpassConsent.delete({ where: { id: consent.id } })
  })

  it("ablehnen, auch nach dem Bestätigen; danach kein Bestätigen mehr", async () => {
    const consent = await requested()
    asAdmin()
    expect(await confirmConsent(consent.id)).toEqual({ success: true })
    expect(await rejectConsent(consent.id)).toEqual({ success: true })
    const rejected = await db.sportpassConsent.findUniqueOrThrow({ where: { id: consent.id } })
    expect(consentStatus(rejected)).toBe("rejected")
    expect(rejected.confirmedAt).toBeNull()
    expect(await rejectConsent(consent.id)).toEqual({
      error: "Das hat gerade schon jemand entschieden. Lade die Seite neu.",
    })
    expect(await confirmConsent(consent.id)).toEqual({
      error: "Das hat gerade schon jemand entschieden. Lade die Seite neu.",
    })
    // der Schütze entfernt die Ablehnung und kann neu eintragen
    asShooter()
    expect(await revokeSportpass(consent.id)).toEqual({ success: true })
  })

  it("eine zurückgegebene wird beim Bestätigen wieder aktiv", async () => {
    const consent = await requested()
    await db.sportpassConsent.update({
      where: { id: consent.id },
      data: { returnedAt: new Date() },
    })
    asAdmin()
    expect(await confirmConsent(consent.id)).toEqual({ success: true })
    const active = await db.sportpassConsent.findUniqueOrThrow({ where: { id: consent.id } })
    expect(consentStatus(active)).toBe("active")
    expect(active.returnedAt).toBeNull()
    await db.sportpassConsent.delete({ where: { id: consent.id } })
  })

  it("entfernen; eine unbekannte Kennung ist ein Fehler", async () => {
    const consent = await requested()
    asAdmin()
    expect(await removeConsent(consent.id)).toEqual({ success: true })
    expect(await removeConsent(consent.id)).toEqual({
      error: "Diese Sportpassnummer gibt es hier nicht mehr. Lade die Seite neu.",
    })
    expect(await confirmConsent(-1)).toEqual({
      error: "Diese Sportpassnummer gibt es hier nicht mehr. Lade die Seite neu.",
    })
  })
})

describe("Meldungen „nicht meine“ aufheben (P2d)", () => {
  it("nur ein Admin; nur Meldungen dieser Nummer an dieser Anlage; die erste Scheibe wartet wieder", async () => {
    const consent = await requested()
    await db.sportpassConsent.update({
      where: { id: consent.id },
      data: {
        confirmedAt: new Date(),
        firstCardConfirmedAt: new Date(),
        historyLoadedAt: new Date(),
      },
    })
    const source =
      (await db.source.findFirst({ where: { siteId: consent.siteId }, select: { id: true } })) ??
      (await db.source.create({
        data: { siteId: consent.siteId, epoch: 99, confirmedAt: new Date() },
        select: { id: true },
      }))
    const base = -900_000_000 - randomInt(1_000_000)
    const tombstone = (n: number, sportpassId: bigint, reason = "nicht-meine") =>
      db.tombstone.create({
        data: {
          sourceId: source.id,
          scheibenId: base - n,
          startedAt: new Date(),
          reason,
          sportpassId,
        },
        select: { id: true },
      })
    const lifted = [
      await tombstone(1, consent.sportpassId),
      await tombstone(2, consent.sportpassId),
    ]
    const kept = [
      await tombstone(3, consent.sportpassId, "anderer"),
      await tombstone(4, BigInt(sportpass())),
    ]
    try {
      asShooter()
      expect(await liftNotMine(consent.id)).toEqual({ error: "Das darf nur ein Admin." })
      asAdmin()
      expect(await liftNotMine(consent.id)).toEqual({ success: true })
      const ids = (rows: { id: number }[]) => ({ id: { in: rows.map((r) => r.id) } })
      expect(await db.tombstone.count({ where: ids(lifted) })).toBe(0)
      expect(await db.tombstone.count({ where: ids(kept) })).toBe(2)
      const after = await db.sportpassConsent.findUniqueOrThrow({ where: { id: consent.id } })
      expect(after.historyLoadedAt).toBeNull()
      expect(after.firstCardConfirmedAt).toBeNull()
      // ein neuer Auftrag, den die Brücke von einem erledigten unterscheidet (Review)
      expect(after.historyRequestedAt).not.toBeNull()
      expect(consentStatus(after)).toBe("active")
      expect(await liftNotMine(consent.id)).toEqual({
        error: "Unter dieser Nummer ist keine Scheibe mehr zurückgewiesen.",
      })
      expect(await liftNotMine(-1)).toEqual({
        error: "Diese Sportpassnummer gibt es hier nicht mehr. Lade die Seite neu.",
      })
    } finally {
      await db.tombstone.deleteMany({ where: { scheibenId: { lte: base, gt: base - 10 } } })
      await db.sportpassConsent.delete({ where: { id: consent.id } })
    }
  })

  it("ein Datenbankfehler wird zu Text", async () => {
    const consent = await requested()
    asAdmin()
    const spy = vi.spyOn(db, "$transaction").mockRejectedValue(new Error("down"))
    try {
      expect(await liftNotMine(consent.id)).toEqual({
        error: "Das ließ sich nicht speichern. Bitte noch einmal versuchen.",
      })
    } finally {
      spy.mockRestore()
      await db.sportpassConsent.delete({ where: { id: consent.id } })
    }
  })
})
