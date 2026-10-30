import { createHash, randomUUID } from "node:crypto"

import { printoutReading, ringOf } from "@vereinsheim/meyton-pdf/reading"
import { printoutPdf } from "@vereinsheim/meyton-pdf/test-printout"
import { readPrintoutValues } from "@vereinsheim/meyton-pdf/values"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { setScale } from "@/diary/entries"
import { createPrismaClient } from "@/lib/db"
import { refreshDisciplineCards, refreshProjections } from "@/lib/db/cards"
import { writeEnteredCard } from "@/lib/db/entered"
import { valuesReadOf, type StoredPrintout } from "@/lib/printouts/store"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { valuedSpec } from "../../../test/printout"

import { runTransfer, type TransferInput, type TransferOutcome } from "./run"
import type { TreffsicherSource } from "./source"
import type { TreffsicherAccount, TreffsicherSession } from "./treffsicher-export"

// Gegen die Dev-Datenbank: eigene Anlage mit eingeordneter Disziplin (40 Schuss, ganze Ringe), je Fall ein eigenes
// Konto in Spiegel (über die Übernahme angelegt oder vorher) und eines in Treffsicher aus dem Speicher.

const db = createPrismaClient()
let site: TestSite
let familyName: string
let familySlug: string
let disciplineId: number
let fixture = 0
const emails: string[] = []

beforeAll(async () => {
  site = await createTestSite(db, "transfer-run")
  const family = await db.family.findUniqueOrThrow({ where: { id: site.familyId } })
  familyName = family.name
  familySlug = family.slug
  disciplineId = (
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: null,
        name: "LP 40 Übernahme",
        familyId: site.familyId,
        targetId: "lp-10m",
        plannedShots: 40,
        seriesShots: 10,
        officialScoring: "rings",
        confirmedAt: new Date(),
      },
    })
  ).id
})

afterAll(async () => {
  await site.remove()
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.$disconnect()
})

/** Treffsicher im Speicher: Konten nach E-Mail; `markMoved` setzt das Merkmal wie die Quelle für Dev */
class MemorySource implements TreffsicherSource {
  readonly accounts = new Map<string, TreffsicherAccount>()
  async readAccount(email: string) {
    const account = this.accounts.get(email)
    return account ? structuredClone(account) : null
  }
  async sessionOwners(ids: readonly string[]) {
    const owners = new Map<string, string>()
    for (const account of this.accounts.values())
      for (const id of [
        ...account.sessions.map((s) => s.id),
        ...account.goals.map((g) => g.id),
        ...account.routines.map((r) => r.id),
      ])
        if (ids.includes(id)) owners.set(id, account.user.id)
    return owners
  }
  async markMoved(userId: string, at: Date | null) {
    for (const account of this.accounts.values())
      if (account.user.id === userId) account.user.movedToSpiegelAt = at?.toISOString() ?? null
  }
}

const ten = (value: string) => Array.from({ length: 10 }, () => value)

/** ein Fall: ein Konto in Treffsicher (`from`), eine E-Mail in Spiegel (`to`), Kennungen mit eigenem Präfix */
function newCase(label: string) {
  const tag = `${label}${site.siteId}x${fixture++}`
  const to = `transfer-${tag}@example.com`.toLowerCase()
  emails.push(to)
  const source = new MemorySource()
  const from = `ts-${tag}@example.com`
  const id = (name: string) => `${name}${tag}`
  const session = (name: string, day: string, over: Partial<TreffsicherSession> = {}) =>
    ({
      id: id(name),
      date: `${day}T18:00:00.000Z`,
      type: "TRAINING",
      location: "Schützenhaus",
      trainingGoal: "Abzug ruhig",
      isFavourite: false,
      discipline: { name: familyName, scoringType: "WHOLE", shotsPerSeries: 10 },
      hitLocation: null,
      wellbeing: { sleep: 70, energy: 50, stress: 30, motivation: 90 },
      prognosis: null,
      feedback: null,
      reflection: {
        observations: "ruhig",
        insight: null,
        learningQuestion: null,
        routineDeviation: null,
      },
      series: [1, 2, 3, 4].map((position) => ({
        position,
        isPractice: false,
        scoreTotal: 90,
        shots: ten("9"),
        executionQuality: 4,
      })),
      attachments: [],
      ...over,
    }) satisfies TreffsicherSession
  const account = (sessions: TreffsicherSession[], over: Partial<TreffsicherAccount> = {}) => {
    const value: TreffsicherAccount = {
      user: {
        id: id("u"),
        name: "Erfunden",
        email: from,
        passwordHash: "$2b$10$erfundenerHashDerNieZuEinemPasswortPasst000000000000",
        isActive: true,
        movedToSpiegelAt: null,
      },
      sessions,
      goals: [],
      routines: [],
      ...over,
    }
    source.accounts.set(from, value)
    return value
  }
  const run = (over: Partial<TransferInput> = {}) =>
    runTransfer(db, {
      source,
      from,
      to,
      dryRun: false,
      files: null,
      families: [],
      siteId: site.siteId,
      ...over,
    })
  return { tag, to, from, id, source, session, account, run }
}

const done = (outcome: TransferOutcome) => {
  if (outcome.kind !== "done") throw new Error(`abgebrochen: ${outcome.abort.kind}`)
  return outcome.report
}

const userOf = (email: string) => db.user.findUniqueOrThrow({ where: { email } })

async function rowsOf(email: string) {
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return null
  const userId = user.id
  return {
    cards: await db.card.findMany({
      where: { ownerId: userId },
      orderBy: { id: "asc" },
      select: { id: true, origin: true, currentRevisionId: true, deletedAt: true },
    }),
    entries: await db.diaryEntry.findMany({
      where: { userId },
      orderBy: { id: "asc" },
      include: {
        scales: { orderBy: [{ part: "asc" }, { aspect: "asc" }] },
        cards: { orderBy: { cardId: "asc" } },
        executions: { orderBy: [{ cardId: "asc" }, { series: "asc" }] },
      },
    }),
    goals: await db.diaryGoal.findMany({ where: { userId }, orderBy: { id: "asc" } }),
    routines: await db.diaryRoutine.findMany({ where: { userId }, orderBy: { id: "asc" } }),
  }
}

/** eine Scheibe von Hand im Konto, 40 Schuss mit 360 Ringen bzw. nur Probe */
async function handCard(ownerId: string, day: string, probeOnly = false) {
  const saved = await writeEnteredCard(db, {
    ownerId,
    origin: "manual",
    disciplineId,
    startedAtMs: Date.parse(`${day}T17:00:00Z`),
    kind: "training",
    details: probeOnly
      ? { shots: ten("9").map(() => ({ series: null, ring: 9, decimalTenths: null, probe: true })) }
      : {
          shots: [1, 2, 3, 4].flatMap((series) =>
            ten("9").map(() => ({ series, ring: 9, decimalTenths: null }))
          ),
        },
    reason: "eingetragen",
  })
  if (saved.kind !== "saved") throw new Error(saved.kind)
  return saved.cardId
}

const target = async (email: string) =>
  (await db.user.create({ data: { email, passwordHash: "-" }, select: { id: true } })).id

describe("runTransfer: erster Lauf", () => {
  it("legt das Konto an (Hash, Name, Status, Rolle Schütze) mit Scheibe, Einträgen, Ziel und Ablauf", async () => {
    const c = newCase("neu")
    const account = c.account(
      [
        c.session("s1", "2026-04-01"),
        c.session("s2", "2026-04-02", { type: "MENTAL", discipline: null, series: [] }),
      ],
      {
        goals: [
          {
            id: c.id("g1"),
            title: "360 Ringe",
            description: "ruhig",
            type: "RESULT",
            dateFrom: "2026-03-31T22:00:00.000Z",
            dateTo: "2026-04-29T22:00:00.000Z",
            sessionIds: [c.id("s1")],
          },
        ],
        routines: [
          {
            id: c.id("r1"),
            name: "Vor dem Schuss",
            discipline: { name: familyName },
            steps: [
              { order: 2, title: "Zielen" },
              { order: 1, title: "Atmen" },
            ],
          },
        ],
      }
    )
    const report = done(await c.run())
    expect(report.accountCreated).toBe(true)
    expect(report.decisions).toMatchObject({ new: 1, notShooting: 1 })
    expect(report.check.findings).toBe(0)
    const user = await userOf(c.to)
    expect(user).toMatchObject({
      name: "Erfunden",
      passwordHash: account.user.passwordHash,
      isActive: true,
      role: "USER",
      mustChangePassword: false,
    })
    const rows = (await rowsOf(c.to))!
    expect(rows.cards).toHaveLength(1)
    expect(rows.cards[0].origin).toBe("treffsicher")
    expect(rows.entries).toHaveLength(2)
    const shooting = rows.entries.find((e) => e.importKey === `treffsicher:${c.id("s1")}`)!
    expect(shooting.cards).toMatchObject([{ cardId: rows.cards[0].id, link: "linked" }])
    expect(shooting.executions).toHaveLength(4)
    expect(rows.goals).toMatchObject([{ title: "360 Ringe", familyId: site.familyId }])
    expect(rows.routines[0].steps).toEqual([{ title: "Atmen" }, { title: "Zielen" }])
    expect((await db.diarySettings.findUniqueOrThrow({ where: { userId: user.id } })).enabled).toBe(
      true
    )
    expect(c.source.accounts.get(c.from)!.user.movedToSpiegelAt).not.toBeNull()
  })

  it("verknüpft eine passende Scheibe; ein Abend nur aus Probe bekommt keine", async () => {
    const c = newCase("da")
    const ownerId = await target(c.to)
    const fitting = await handCard(ownerId, "2026-05-01")
    const probe = await handCard(ownerId, "2026-05-02", true)
    c.account([c.session("s1", "2026-05-01"), c.session("s2", "2026-05-02")])
    const report = done(await c.run())
    expect(report.decisions).toMatchObject({ existing: 1, probeEvening: 1 })
    expect(report.accountCreated).toBe(false)
    const rows = (await rowsOf(c.to))!
    expect(rows.cards.map((card) => card.id).sort()).toEqual([fitting, probe].sort())
    const first = rows.entries.find((e) => e.importKey === `treffsicher:${c.id("s1")}`)!
    expect(first.cards).toMatchObject([{ cardId: fitting, link: "linked" }])
    const second = rows.entries.find((e) => e.importKey === `treffsicher:${c.id("s2")}`)!
    expect(second.cards).toEqual([])
    // die eine Scheibe des Abends nur aus Probe trägt die Ausführung nicht (andere Serien)
    expect(report.check.findings).toBe(0)
  })

  it("ein Probelauf schreibt nichts und markiert nichts", async () => {
    const c = newCase("probe")
    c.account([c.session("s1", "2026-06-01")])
    const report = done(await c.run({ dryRun: true }))
    expect(report.dryRun).toBe(true)
    expect(report.decisions.new).toBe(1)
    expect(report.check.findings).toBe(0)
    expect(await db.user.findUnique({ where: { email: c.to } })).toBeNull()
    expect(await db.card.count({ where: { importKey: `treffsicher:${c.id("s1")}` } })).toBe(0)
    expect(c.source.accounts.get(c.from)!.user.movedToSpiegelAt).toBeNull()
  })
})

describe("runTransfer: nur Werte, kein Eintrag", () => {
  it("eine Einheit nur mit Werten wird nur Scheibe; die Verknüpfung mit dem Ziel bestimmt weiter seine Familie", async () => {
    const c = newCase("werte")
    const bare = {
      trainingGoal: null,
      isFavourite: false,
      wellbeing: null,
      prognosis: null,
      feedback: null,
      reflection: null,
    }
    const values = c.session("s1", "2026-05-05", bare)
    values.series = values.series.map((series) => ({ ...series, executionQuality: null }))
    // ohne Ergebnis: keine Scheibe, kein Eintrag
    const empty = c.session("s2", "2026-05-06", {
      ...bare,
      series: [
        { position: 1, isPractice: false, scoreTotal: null, shots: null, executionQuality: null },
      ],
    })
    c.account([values, empty, c.session("s3", "2026-05-07")], {
      goals: [
        {
          id: c.id("g1"),
          title: "360 Ringe",
          description: null,
          type: "RESULT",
          dateFrom: "2026-04-30T22:00:00.000Z",
          dateTo: "2026-05-30T22:00:00.000Z",
          sessionIds: [c.id("s1")],
        },
      ],
    })
    const report = done(await c.run())
    expect(report.cardOnly).toEqual({ units: 2, goalLinked: 1, noCard: 1 })
    expect(report.entries).toMatchObject({ created: 1 })
    expect(report.check.findings).toBe(0)
    const rows = (await rowsOf(c.to))!
    expect(rows.entries.map((e) => e.importKey)).toEqual([`treffsicher:${c.id("s3")}`])
    expect(await db.card.count({ where: { importKey: `treffsicher:${c.id("s1")}` } })).toBe(1)
    expect(rows.goals).toMatchObject([{ title: "360 Ringe", familyId: site.familyId }])
    // ein zweiter Lauf legt auch keinen an
    const second = done(await c.run())
    expect(second.cardOnly.units).toBe(2)
    expect((await rowsOf(c.to))!.entries).toHaveLength(1)
  })
})

describe("runTransfer: Ausdruck einer Einheit ohne Scheibe", () => {
  /** ein Meyton-Ausdruck vom 2. Oktober 2026 (40 Schuss), dessen Kopf eine Disziplin nennt, die Spiegel nicht kennt */
  async function unknownHeader(tag: string): Promise<StoredPrintout> {
    const values = valuesReadOf(
      printoutReading(await readPrintoutValues(await printoutPdf(valuedSpec())), {
        producer: "Qt 5.12.8",
      })
    )
    const scheibenId = 97_000 + fixture
    return {
      sha256: createHash("sha256").update(`ausdruck-${tag}`).digest("hex"),
      size: 1,
      fileName: "ausdruck.pdf",
      hex: (scheibenId >>> 0).toString(16).padStart(8, "0"),
      scheibenId,
      printedAt: new Date("2026-10-02T17:52:12Z"),
      values: { ...values, discipline: "LP Balken 28x110 mm" },
    }
  }

  /** eine Einheit ohne Ergebnis am Abend des Ausdrucks, mit ihm als Anhang */
  function caseWithPrintout(label: string) {
    const c = newCase(label)
    const noResult = c.session("s1", "2026-10-02", {
      series: [
        { position: 1, isPractice: false, scoreTotal: null, shots: null, executionQuality: null },
      ],
      attachments: [
        {
          id: c.id("a1"),
          filePath: "ausdruck.pdf",
          fileType: "PDF",
          originalName: "ausdruck.pdf",
          createdAt: "2026-10-02T18:00:00.000Z",
        },
      ],
    })
    c.account([noResult])
    return c
  }
  const pdf = { read: async () => new TextEncoder().encode("%PDF-1.4") }

  it("nennt der Kopf keine bekannte Disziplin, nimmt der Ausdruck die der Einheit", async () => {
    const c = caseWithPrintout("ausdruck")
    const file = await unknownHeader(c.tag)
    const report = done(
      await c.run({ files: pdf, readPrintout: async () => ({ kind: "stored", file, maxRssKb: 0 }) })
    )
    expect(report.attachments.printouts.imported).toBe(1)
    expect(report.check.findings).toBe(0)
    const { card } = await db.printout.findFirstOrThrow({
      where: { sha256: file.sha256, card: { ownerId: (await userOf(c.to)).id } },
      select: { card: { select: { disciplineId: true, origin: true } } },
    })
    expect(card).toEqual({ disciplineId, origin: "pdf" })
  })

  it("die Scheibe vom Ausdruck bleibt mit dem Eintrag verknüpft, auch in Lauf 2 und 3", async () => {
    const c = caseWithPrintout("halten")
    const file = await unknownHeader(c.tag)
    const run = () =>
      c.run({ files: pdf, readPrintout: async () => ({ kind: "stored", file, maxRssKb: 0 }) })
    const links = async () =>
      (
        await db.diaryEntry.findUniqueOrThrow({
          where: { importKey: `treffsicher:${c.id("s1")}` },
          include: { cards: true },
        })
      ).cards.map((l) => l.link)
    expect(done(await run()).attachments.printouts.imported).toBe(1)
    expect(await links()).toEqual(["linked"])
    const second = done(await run())
    expect(second.attachments.printouts.ownCard).toBe(1)
    expect(second.entries).toMatchObject({ updated: 1, kept: 0 })
    expect(await links()).toEqual(["linked"])
    const third = done(await run())
    expect(third.entries).toMatchObject({ updated: 1, kept: 0 })
    expect(await links()).toEqual(["linked"])
  })

  it("die Scheibe, die Lauf 1 aus dem Ausdruck anlegte, ändert in Lauf 2 nicht die Entscheidung", async () => {
    const c = newCase("abend")
    const ownerId = await target(c.to)
    await handCard(ownerId, "2026-10-02", true)
    c.account([
      c.session("s1", "2026-10-02", {
        attachments: [
          {
            id: c.id("a1"),
            filePath: "ausdruck.pdf",
            fileType: "PDF",
            originalName: "ausdruck.pdf",
            createdAt: "2026-10-02T18:00:00.000Z",
          },
        ],
      }),
    ])
    // die Prüfsumme der Datei, wie `storePrintout` sie aus den Bytes rechnet
    const bytes = await pdf.read()
    const file = {
      ...(await unknownHeader(c.tag)),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    }
    const run = () =>
      c.run({ files: pdf, readPrintout: async () => ({ kind: "stored", file, maxRssKb: 0 }) })
    const first = done(await run())
    expect(first.decisions).toMatchObject({ probeEvening: 1 })
    expect(first.attachments.printouts.imported).toBe(1)
    const second = done(await run())
    expect(second.decisions).toMatchObject({ probeEvening: 1 })
    expect(second.deletedInSpiegel.cards).toBe(0)
    expect(second.check.findings).toBe(0)
  })

  it("bleibt er ohne Scheibe, ist das ein Befund, nicht still", async () => {
    const tag = `${site.siteId}-${fixture++}`
    // Gleichstand: zwei Disziplinen mit 40 Schuss, keine meistgenutzt, der Ausdruck findet keine
    const alt = await db.discipline.create({
      data: {
        siteId: site.siteId,
        name: `LP 40 zwei ${tag}`,
        familyId: site.familyId,
        targetId: "lp-10m",
        plannedShots: 40,
        officialScoring: "rings",
        confirmedAt: new Date(),
      },
    })
    try {
      const c = caseWithPrintout("ohne")
      const file = await unknownHeader(c.tag)
      const report = done(
        await c.run({
          files: pdf,
          readPrintout: async () => ({ kind: "stored", file, maxRssKb: 0 }),
        })
      )
      expect(report.attachments.printouts.notPlaced).toBe(1)
      expect(report.printoutsNotPlaced).toEqual({ noDiscipline: 1 })
      expect(report.check.findings).toBeGreaterThan(0)
      // auch in Lauf 2: nicht „in Spiegel gelöscht“, sondern weiter nicht angehängt
      const second = done(
        await c.run({
          files: pdf,
          readPrintout: async () => ({ kind: "stored", file, maxRssKb: 0 }),
        })
      )
      expect(second.attachments.printouts.notPlaced).toBe(1)
      expect(second.deletedInSpiegel.attachments).toBe(0)
      expect(second.check.findings).toBeGreaterThan(0)
      // die Ursache behoben (eine Disziplin weniger, kein Gleichstand): Er war nie platziert, Lauf 3 legt ihn an
      await db.discipline.delete({ where: { id: alt.id } })
      const third = done(
        await c.run({
          files: pdf,
          readPrintout: async () => ({ kind: "stored", file, maxRssKb: 0 }),
        })
      )
      expect(third.attachments.printouts.imported).toBe(1)
      expect(third.deletedInSpiegel.attachments).toBe(0)
      expect(third.check.findings).toBe(0)
    } finally {
      await db.discipline.deleteMany({ where: { id: alt.id } })
    }
  })
})

describe("runTransfer: Tagebuch an", () => {
  it("nur beim ersten Lauf, auch bei einem Konto nur mit Werten", async () => {
    const c = newCase("schalter")
    const values = c.session("s1", "2026-05-12", {
      trainingGoal: null,
      isFavourite: false,
      wellbeing: null,
      prognosis: null,
      feedback: null,
      reflection: null,
    })
    values.series = values.series.map((series) => ({ ...series, executionQuality: null }))
    c.account([values])
    const first = done(await c.run())
    expect(first.cardOnly.units).toBe(1)
    expect(first.diaryEnabled).toBe(true)
    const userId = (await userOf(c.to)).id
    await db.diarySettings.update({ where: { userId }, data: { enabled: false } })
    const second = done(await c.run())
    expect(second.diaryEnabled).toBe(false)
  })
})

describe("runTransfer: was der User in Spiegel ändert oder löscht", () => {
  const goalOf = (c: ReturnType<typeof newCase>) => ({
    id: c.id("g1"),
    title: "360 Ringe",
    description: null,
    type: "RESULT" as const,
    dateFrom: "2026-05-31T22:00:00.000Z",
    dateTo: "2026-06-29T22:00:00.000Z",
    sessionIds: [c.id("s1")],
  })

  it("was der User endgültig gelöscht hat, legt ein späterer Lauf nicht wieder an", async () => {
    const c = newCase("geloescht")
    c.account([c.session("s1", "2026-06-02"), c.session("s2", "2026-06-05")], {
      goals: [goalOf(c)],
    })
    done(await c.run())
    const key = `treffsicher:${c.id("s1")}`
    const card = await db.card.findUniqueOrThrow({ where: { importKey: key } })
    await db.diaryEntry.delete({ where: { importKey: key } })
    await db.diaryEntryCard.deleteMany({ where: { cardId: card.id } })
    await db.card.delete({ where: { id: card.id } })
    await db.diaryGoal.delete({ where: { importKey: `treffsicher:${c.id("g1")}` } })

    const report = done(await c.run())
    expect(report.deletedInSpiegel).toEqual({
      cards: 1,
      entries: 1,
      goals: 1,
      routines: 0,
      attachments: 0,
    })
    expect(report.cards.created).toBe(0)
    expect(report.entries.created).toBe(0)
    expect(report.goals.created).toBe(0)
    expect(report.check.findings).toBe(0)
    expect(await db.card.count({ where: { importKey: key } })).toBe(0)
    expect(await db.diaryEntry.count({ where: { importKey: key } })).toBe(0)
  })

  it("eine Änderung zwischen dem Lesen vor der Transaktion und dem Schreiben bleibt stehen", async () => {
    const c = newCase("dazwischen")
    const s1 = c.session("s1", "2026-06-03", {
      attachments: [
        {
          id: c.id("a1"),
          filePath: "beleg.pdf",
          fileType: "PDF",
          originalName: "beleg.pdf",
          createdAt: "2026-06-03T18:00:00.000Z",
        },
      ],
    })
    c.account([s1], { goals: [goalOf(c)] })
    const files = { read: async () => new TextEncoder().encode("%PDF-1.4") }
    const plain = { files, writeEvidence: async () => {} }
    done(
      await c.run({ ...plain, readPrintout: async () => ({ kind: "rejected", reason: "noId" }) })
    )
    const entryKey = `treffsicher:${c.id("s1")}`
    const goalKey = `treffsicher:${c.id("g1")}`
    // Lauf 2 liest die Zeilen, dann die Anhänge: In dieser Zeit ändert der User Eintrag und Ziel in der App
    const report = done(
      await c.run({
        ...plain,
        readPrintout: async () => {
          await db.diaryEntry.update({
            where: { importKey: entryKey },
            data: { intention: "dazwischen" },
          })
          await db.diaryGoal.update({
            where: { importKey: goalKey },
            data: { title: "dazwischen" },
          })
          return { kind: "rejected", reason: "noId" }
        },
      })
    )
    expect(report.entries).toMatchObject({ kept: 1, updated: 0 })
    expect(report.goals).toMatchObject({ kept: 1, updated: 0 })
    expect(report.check.findings).toBe(0)
    expect(
      (await db.diaryEntry.findUniqueOrThrow({ where: { importKey: entryKey } })).intention
    ).toBe("dazwischen")
    expect((await db.diaryGoal.findUniqueOrThrow({ where: { importKey: goalKey } })).title).toBe(
      "dazwischen"
    )
  })
})

describe("runTransfer: Merkmal, Befunde und eigene Wahl über mehrere Läufe", () => {
  it("eine Scheibe, die schon Lauf 1 nicht anlegen konnte, bleibt in Lauf 2 ein Befund", async () => {
    const c = newCase("ungueltig")
    // eine Serie mit 200 Ringen auf 10 Schuss: ungültige Angaben
    const broken = c.session("s1", "2026-11-04")
    broken.series = broken.series.map((series, i) =>
      i ? series : { ...series, scoreTotal: 200, shots: null }
    )
    c.account([broken, c.session("s2", "2026-11-05")])
    const first = done(await c.run())
    expect(Object.values(first.cards.invalid).reduce((sum, n) => sum + (n ?? 0), 0)).toBe(1)
    expect(first.check.findings).toBeGreaterThan(0)
    const second = done(await c.run())
    expect(second.deletedInSpiegel.cards).toBe(0)
    expect(Object.values(second.cards.invalid).reduce((sum, n) => sum + (n ?? 0), 0)).toBe(1)
    expect(second.check.findings).toBeGreaterThan(0)
  })

  it("ein Ort, den Spiegel nicht nimmt, bleibt in Lauf 2 ein Befund, nicht „gelöscht“", async () => {
    const c = newCase("ort")
    // Treffsicher nimmt 200 Zeichen, Spiegel 80
    c.account([
      c.session("s1", "2026-11-10", { location: "Schützenhaus ".repeat(10) }),
      c.session("s2", "2026-11-11"),
    ])
    const first = done(await c.run())
    expect(first.cards.invalid).toEqual({ place: 1 })
    const second = done(await c.run())
    expect(second.cards.invalid).toEqual({ place: 1 })
    expect(second.deletedInSpiegel.cards).toBe(0)
    expect(second.check.findings).toBeGreaterThan(0)
  })

  it("ein Beleg, den der User entfernt hat, kommt nicht wieder", async () => {
    const c = newCase("belegweg")
    c.account([
      c.session("s1", "2026-11-12", {
        attachments: [
          {
            id: c.id("a1"),
            filePath: "foto.png",
            fileType: "IMAGE",
            originalName: "foto.png",
            createdAt: "2026-11-12T18:00:00.000Z",
          },
        ],
      }),
    ])
    const png = {
      read: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 2]),
    }
    const plain = { files: png, writeEvidence: async () => {} }
    expect(done(await c.run(plain)).attachments.evidence.attached).toBe(1)
    const card = await db.card.findUniqueOrThrow({
      where: { importKey: `treffsicher:${c.id("s1")}` },
    })
    await db.cardEvidence.deleteMany({ where: { cardId: card.id } })
    const second = done(await c.run(plain))
    expect(second.deletedInSpiegel.attachments).toBe(1)
    expect(second.check.findings).toBe(0)
    expect(await db.cardEvidence.count({ where: { cardId: card.id } })).toBe(0)
  })

  it("Belege aus Treffsicher machen eine Scheibe nicht zu einer vom User ergänzten", async () => {
    const c = newCase("eigenebelege")
    c.account([
      c.session("s1", "2026-11-07", {
        attachments: [
          {
            id: c.id("a1"),
            filePath: "foto.png",
            fileType: "IMAGE",
            originalName: "foto.png",
            createdAt: "2026-11-07T18:00:00.000Z",
          },
        ],
      }),
    ])
    const png = {
      read: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]),
    }
    const plain = { files: png, writeEvidence: async () => {} }
    const first = done(await c.run(plain))
    expect(first.decisions.new).toBe(1)
    expect(first.attachments.evidence.attached).toBe(1)
    // später kommt am Abend eine passende Scheibe dazu: Lauf 2 verknüpft sie, die Scheibe aus Treffsicher geht
    await handCard((await userOf(c.to)).id, "2026-11-07")
    const second = done(await c.run(plain))
    expect(second.decisions.existing).toBe(1)
    expect(second.cards).toMatchObject({ removed: 1, kept: 0 })
    expect(await db.card.count({ where: { importKey: `treffsicher:${c.id("s1")}` } })).toBe(0)
    // der Beleg der entfernten Scheibe geht an die verknüpfte, nicht als „gelöscht“ verloren
    expect(second.attachments.evidence.attached).toBe(1)
    expect(second.deletedInSpiegel.attachments).toBe(0)
    expect(
      await db.cardEvidence.count({ where: { card: { ownerId: (await userOf(c.to)).id } } })
    ).toBe(1)
    // Lauf 3 findet ihn dort, wo Lauf 2 ihn ablegte
    const third = done(await c.run(plain))
    expect(third.attachments.evidence.duplicate).toBe(1)
    expect(third.deletedInSpiegel.attachments).toBe(0)
  })

  it("eine eigene Wahl der Disziplin an einer Scheibe aus Treffsicher bleibt, mit ihrer Ausführung", async () => {
    const c = newCase("wahl")
    c.account([c.session("s1", "2026-11-08")])
    done(await c.run())
    const key = `treffsicher:${c.id("s1")}`
    // eine andere Disziplin derselben Familie, ohne feste Schusszahl (kein Kandidat der Wahl nach Schusszahl)
    const other = await db.discipline.create({
      data: {
        siteId: site.siteId,
        name: `LP offen ${site.siteId}-${fixture++}`,
        familyId: site.familyId,
        targetId: "lp-10m",
        plannedShots: 0,
        officialScoring: "rings",
        confirmedAt: new Date(),
      },
    })
    try {
      await db.card.update({
        where: { importKey: key },
        data: { disciplineId: other.id, standDisciplineId: other.id },
      })
      const executions = async () =>
        (
          await db.diaryEntry.findUniqueOrThrow({
            where: { importKey: key },
            include: { executions: true },
          })
        ).executions.length
      expect(await executions()).toBe(4)
      const second = done(await c.run())
      expect(second.cards.kept).toBe(1)
      expect(second.kept).toContainEqual({
        what: "card",
        day: "2026-11-08",
        reason: "vom User ergänzt",
      })
      expect(await db.card.findUniqueOrThrow({ where: { importKey: key } })).toMatchObject({
        disciplineId: other.id,
        standDisciplineId: other.id,
      })
      expect(await executions()).toBe(4)
    } finally {
      await db.card.updateMany({
        where: { disciplineId: other.id },
        data: { disciplineId, standDisciplineId: null },
      })
      await db.discipline.delete({ where: { id: other.id } })
    }
  })

  it("eine Änderung, die einen Eintrag während des Laufs gesperrt hält, bleibt", async () => {
    const c = newCase("gesperrt")
    c.account([c.session("s1", "2026-11-09")])
    done(await c.run())
    const key = `treffsicher:${c.id("s1")}`
    const { id } = await db.diaryEntry.findUniqueOrThrow({ where: { importKey: key } })
    let running: ReturnType<typeof c.run> | null = null
    // wie die App: den Eintrag sperren, ändern, und erst nach dem Start des Laufs freigeben
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "DiaryEntry" WHERE id = ${id} FOR UPDATE`
      await tx.diaryEntry.update({ where: { id }, data: { intention: "gesperrt" } })
      running = c.run()
      await new Promise((resolve) => setTimeout(resolve, 500))
    })
    const report = done(await running!)
    expect(report.entries.kept).toBe(1)
    expect((await db.diaryEntry.findUniqueOrThrow({ where: { id } })).intention).toBe("gesperrt")
  })
})

describe("runTransfer: über drei Läufe", () => {
  it("eine Änderung in der App nach Lauf 1 steht auch nach Lauf 2 und Lauf 3", async () => {
    const c = newCase("drei")
    c.account([c.session("s1", "2026-06-24"), c.session("s2", "2026-06-25")])
    done(await c.run())
    const ownerId = (await userOf(c.to)).id
    const key = `treffsicher:${c.id("s1")}`
    const entry = await db.diaryEntry.findUniqueOrThrow({ where: { importKey: key } })
    // in Treffsicher Schlaf 70, in der App auf „schlecht“ (Stufe 1) getippt
    expect(
      await setScale(db, ownerId, entry.id, { part: "wellbeing", aspect: "sleep", stage: 1 })
    ).toBeNull()
    const sleep = async () =>
      (
        await db.diaryScale.findUniqueOrThrow({
          where: { entryId_part_aspect: { entryId: entry.id, part: "wellbeing", aspect: "sleep" } },
        })
      ).value
    const tipped = await sleep()
    expect(tipped).not.toBe(70)

    const second = done(await c.run())
    expect(second.entries).toMatchObject({ kept: 1, updated: 1 })
    expect(await sleep()).toBe(tipped)
    const third = done(await c.run())
    expect(third.entries).toMatchObject({ kept: 1, updated: 1 })
    expect(third.check.findings).toBe(0)
    expect(await sleep()).toBe(tipped)
  })
  it("wechselt die Einheit auf Wettkampf, wird die Scheibe Wettkampf; Lauf 3 zählt sie unverändert", async () => {
    const c = newCase("art")
    const account = c.account([c.session("s1", "2026-06-26"), c.session("s2", "2026-06-27")])
    done(await c.run())
    account.sessions[0].type = "WETTKAMPF"
    done(await c.run())
    const kindOf = (name: string) =>
      db.card.findUniqueOrThrow({
        where: { importKey: `treffsicher:${c.id(name)}` },
        select: { kind: true, kindChoice: true },
      })
    expect(await kindOf("s1")).toEqual({ kind: "competition", kindChoice: "competition" })
    expect(await kindOf("s2")).toEqual({ kind: "training", kindChoice: "training" })
    const third = done(await c.run())
    expect(third.cards).toMatchObject({ created: 0, revised: 0, unchanged: 2, kept: 0 })
    expect(third.check.findings).toBe(0)
  })

  it("eine eigene Wahl der Art bleibt, auch wenn die Einheit danach wechselt", async () => {
    const c = newCase("eigeneart")
    const account = c.account([c.session("s1", "2026-06-28")])
    done(await c.run())
    const importKey = `treffsicher:${c.id("s1")}`
    // in der App auf Wettkampf gestellt (wie `setCardKind`), danach in Treffsicher erst Wettkampf, dann wieder Training
    await db.card.update({ where: { importKey }, data: { kindChoice: "competition" } })
    account.sessions[0].type = "WETTKAMPF"
    const second = done(await c.run())
    expect(second.cards.kept).toBe(1)
    account.sessions[0].type = "TRAINING"
    done(await c.run())
    expect(
      await db.card.findUniqueOrThrow({
        where: { importKey },
        select: { kind: true, kindChoice: true },
      })
    ).toEqual({ kind: "training", kindChoice: "competition" })
  })
})

describe("runTransfer: zweiter Lauf", () => {
  it("ohne Änderung ändert er nichts", async () => {
    const c = newCase("zwei")
    c.account([c.session("s1", "2026-06-10"), c.session("s2", "2026-06-11")])
    done(await c.run())
    const before = await rowsOf(c.to)
    const report = done(await c.run())
    expect(report.cards).toMatchObject({ created: 0, revised: 0, unchanged: 2, removed: 0 })
    expect(report.entries).toMatchObject({ created: 0, updated: 2, kept: 0 })
    expect(report.check.findings).toBe(0)
    const after = await rowsOf(c.to)
    const stable = (rows: typeof before) =>
      rows && {
        cards: rows.cards,
        entries: rows.entries.map(({ updatedAt: _u, ...rest }) => ({
          ...rest,
          cards: rest.cards.map(({ updatedAt: _c, createdAt: _d, ...link }) => link),
        })),
      }
    expect(stable(after)).toEqual(stable(before))
  })

  it("ein geänderter Eintrag und eine von Hand geänderte Scheibe bleiben", async () => {
    const c = newCase("geaendert")
    c.account([c.session("s1", "2026-06-20"), c.session("s2", "2026-06-21")])
    done(await c.run())
    await new Promise((resolve) => setTimeout(resolve, 10))
    const entryKey = `treffsicher:${c.id("s1")}`
    await db.diaryEntry.update({ where: { importKey: entryKey }, data: { intention: "selbst" } })
    const card = await db.card.findUniqueOrThrow({
      where: { importKey: `treffsicher:${c.id("s2")}` },
    })
    const ownerId = (await userOf(c.to)).id
    const edited = await writeEnteredCard(db, {
      cardId: card.id,
      ownerId,
      origin: "manual",
      disciplineId,
      startedAtMs: card.startedAt.getTime(),
      kind: "training",
      details: {
        series: [90, 90, 90, 85].map((rings, i) => ({ series: i + 1, shots: 10, rings })),
        total: { shots: 40, rings: 355 },
      },
      reason: "eingetragen",
    })
    expect(edited).toMatchObject({ kind: "saved", change: "revised" })
    const executionsOf = async (key: string) =>
      (
        await db.diaryEntry.findUniqueOrThrow({
          where: { importKey: key },
          include: { executions: { orderBy: { series: "asc" } } },
        })
      ).executions.map((e) => [e.cardId, e.series])
    const s2Key = `treffsicher:${c.id("s2")}`
    const before = await executionsOf(s2Key)
    expect(before).toHaveLength(4)

    const report = done(await c.run())
    expect(report.entries.kept).toBe(1)
    expect(report.cards.kept).toBe(1)
    expect(report.kept.map((k) => [k.what, k.reason]).sort()).toEqual([
      ["card", "von Hand geändert"],
      ["entry", "geändert"],
    ])
    expect(report.check.findings).toBe(0)
    expect(
      (await db.diaryEntry.findUniqueOrThrow({ where: { importKey: entryKey } })).intention
    ).toBe("selbst")
    expect(await db.card.findUniqueOrThrow({ where: { id: card.id } })).toMatchObject({
      origin: "manual",
      currentRevisionId: edited.kind === "saved" ? edited.revisionId : null,
    })
    // die Ausführung bleibt auf der geänderten Scheibe, ihre Serien sind dieselben
    expect(await executionsOf(s2Key)).toEqual(before)

    // auch jeder weitere Lauf lässt beide stehen, obwohl das Merkmal weiterrückt
    const third = done(await c.run())
    expect(third.entries).toMatchObject({ kept: 1, updated: 1 })
    expect(third.cards.kept).toBe(1)
    expect(
      (await db.diaryEntry.findUniqueOrThrow({ where: { importKey: entryKey } })).intention
    ).toBe("selbst")
  })

  it("eine in Treffsicher verschwundene Einheit nimmt ihre unveränderten Zeilen mit", async () => {
    const c = newCase("weg")
    const account = c.account([c.session("s1", "2026-07-01"), c.session("s2", "2026-07-02")])
    done(await c.run())
    account.sessions = account.sessions.slice(0, 1)
    c.source.accounts.set(c.from, {
      ...account,
      user: c.source.accounts.get(c.from)!.user,
    })
    const report = done(await c.run())
    expect(report.cards.removed).toBe(1)
    expect(report.entries.removed).toBe(1)
    expect(await db.card.count({ where: { importKey: `treffsicher:${c.id("s2")}` } })).toBe(0)
    expect(await db.diaryEntry.count({ where: { importKey: `treffsicher:${c.id("s2")}` } })).toBe(0)
    expect(await db.card.count({ where: { importKey: `treffsicher:${c.id("s1")}` } })).toBe(1)
  })

  it("eine Scheibe, die der User geteilt hat, bleibt, auch wenn ihre Einheit verschwindet", async () => {
    const c = newCase("geteilt")
    const account = c.account([c.session("s1", "2026-07-03"), c.session("s2", "2026-07-04")])
    done(await c.run())
    const key = `treffsicher:${c.id("s2")}`
    await db.card.update({ where: { importKey: key }, data: { shareId: randomUUID() } })
    c.source.accounts.set(c.from, {
      ...account,
      sessions: account.sessions.slice(0, 1),
      user: c.source.accounts.get(c.from)!.user,
    })
    const report = done(await c.run())
    expect(report.cards).toMatchObject({ removed: 0, kept: 1 })
    expect(report.kept).toContainEqual({ what: "card", day: "", reason: "vom User ergänzt" })
    expect(await db.card.count({ where: { importKey: key } })).toBe(1)
  })

  it("Gegenprobe: eine Scheibe mit falschem Wert ist ein Befund", async () => {
    const c = newCase("falsch")
    c.account([c.session("s1", "2026-07-10")])
    done(await c.run())
    const card = await db.card.findUniqueOrThrow({
      where: { importKey: `treffsicher:${c.id("s1")}` },
      include: { projection: true },
    })
    const values = card.projection!.values as Record<string, { value: number; n: number }>
    await db.cardProjection.update({
      where: { cardId: card.id },
      data: { values: { ...values, "result.rings": { ...values["result.rings"], value: 359 } } },
    })
    const report = done(await c.run())
    expect(report.cards.unchanged).toBe(1)
    expect(report.check.findings).toBe(1)
    expect(report.check.units[0].status).toEqual({ kind: "finding", reason: "different" })
  })
})

describe("runTransfer: Merkmal in Treffsicher", () => {
  it("scheitert das Merkmal, ist in Spiegel nichts geschrieben und es wird zurückgesetzt", async () => {
    const c = newCase("merkmal")
    c.account([c.session("s1", "2026-09-01")])
    const mark = c.source.markMoved.bind(c.source)
    const calls: (string | null)[] = []
    // schreibt und meldet trotzdem einen Fehler (etwa `docker compose exec` mit Exit-Code ungleich 0)
    c.source.markMoved = async (userId, at) => {
      calls.push(at?.toISOString() ?? null)
      await mark(userId, at)
      if (at !== null) throw new Error("psql nicht erreichbar")
    }
    await expect(c.run()).rejects.toThrow("psql nicht erreichbar")
    expect(calls).toHaveLength(2)
    expect(calls[1]).toBeNull()
    expect(c.source.accounts.get(c.from)!.user.movedToSpiegelAt).toBeNull()
    expect(await db.user.findUnique({ where: { email: c.to } })).toBeNull()
    expect(await db.card.count({ where: { importKey: `treffsicher:${c.id("s1")}` } })).toBe(0)
    expect(await db.diaryEntry.count({ where: { importKey: `treffsicher:${c.id("s1")}` } })).toBe(0)
  })

  /** das Merkmal gelingt, braucht aber länger als die Transaktion darf; das Zurücksetzen gelingt oder nicht */
  function slowMark(c: ReturnType<typeof newCase>, restore: "ok" | "fails") {
    const mark = c.source.markMoved.bind(c.source)
    let calls = 0
    c.source.markMoved = async (userId, at) => {
      calls += 1
      if (calls === 1) {
        await mark(userId, at)
        await new Promise((resolve) => setTimeout(resolve, 3_000))
        return
      }
      if (restore === "fails") throw new Error("psql nicht erreichbar")
      await mark(userId, at)
    }
  }

  it("scheitert der Commit nach dem Merkmal, nimmt der Lauf es zurück und nichts ist geschrieben", async () => {
    const c = newCase("commit")
    c.account([c.session("s1", "2026-09-02")])
    slowMark(c, "ok")
    await expect(c.run({ timeoutMs: 2_000 })).rejects.toThrow()
    expect(c.source.accounts.get(c.from)!.user.movedToSpiegelAt).toBeNull()
    expect(await db.user.findUnique({ where: { email: c.to } })).toBeNull()
    expect(await db.card.count({ where: { importKey: `treffsicher:${c.id("s1")}` } })).toBe(0)
  }, 15_000)

  it("geht auch das Zurücknehmen nicht, sagt der Lauf es laut", async () => {
    const c = newCase("commit2")
    c.account([c.session("s1", "2026-09-03")])
    slowMark(c, "fails")
    expect(await c.run({ timeoutMs: 2_000 })).toEqual({
      kind: "aborted",
      abort: { kind: "markedNotSaved", previous: null },
    })
    expect(c.source.accounts.get(c.from)!.user.movedToSpiegelAt).not.toBeNull()
    expect(await db.user.findUnique({ where: { email: c.to } })).toBeNull()
    expect(await db.card.count({ where: { importKey: `treffsicher:${c.id("s1")}` } })).toBe(0)
  }, 15_000)

  it("eine Quelle ohne markMoved schreibt und überlässt das Merkmal dem Aufrufer", async () => {
    const c = newCase("aufrufer")
    c.account([c.session("s1", "2026-09-06")])
    const report = done(
      await c.run({
        source: {
          readAccount: (email) => c.source.readAccount(email),
          sessionOwners: (ids) => c.source.sessionOwners(ids),
        },
      })
    )
    expect(report.marked).toBe("caller")
    expect(c.source.accounts.get(c.from)!.user.movedToSpiegelAt).toBeNull()
    expect(await db.transferRun.count({ where: { userId: (await userOf(c.to)).id } })).toBe(1)
    expect(await db.card.count({ where: { importKey: `treffsicher:${c.id("s1")}` } })).toBe(1)
  })
})

describe("runTransfer: Abbruch vor dem Schreiben", () => {
  it("Zeilen der Übernahme im Ziel ohne Hauptbuch: kein Raten", async () => {
    const c = newCase("ohnebuch")
    c.account([c.session("s1", "2026-09-04")])
    done(await c.run())
    const userId = (await userOf(c.to)).id
    await db.transferItem.deleteMany({ where: { userId } })
    await db.transferRun.deleteMany({ where: { userId } })
    expect(await c.run()).toEqual({ kind: "aborted", abort: { kind: "ledgerMissing", rows: 2 } })
  })

  it("das Merkmal in Treffsicher entscheidet nichts: ein fremder Wert ändert den Lauf nicht", async () => {
    const c = newCase("fremdmerkmal")
    c.account([c.session("s1", "2026-09-05")])
    done(await c.run())
    c.source.accounts.get(c.from)!.user.movedToSpiegelAt = "2026-01-01T00:00:00.000Z"
    const second = done(await c.run())
    expect(second.entries).toMatchObject({ updated: 1, kept: 0 })
    expect(second.cards.unchanged).toBe(1)
  })

  it("ein Konto nur mit Werten: Lauf 2 läuft durch, ohne Eintrag im Tagebuch", async () => {
    const c = newCase("nurwerte")
    const values = c.session("s1", "2026-09-06", {
      trainingGoal: null,
      isFavourite: false,
      wellbeing: null,
      prognosis: null,
      feedback: null,
      reflection: null,
    })
    values.series = values.series.map((series) => ({ ...series, executionQuality: null }))
    c.account([values])
    done(await c.run())
    const second = done(await c.run())
    expect(second.cards.unchanged).toBe(1)
    expect(second.check.findings).toBe(0)
  })

  it("Jobs an der Scheibe zwischen zwei Läufen sind keine Änderung des Users: Lauf 2 korrigiert", async () => {
    const c = newCase("job")
    const account = c.account([c.session("s1", "2026-09-11")])
    done(await c.run())
    const key = `treffsicher:${c.id("s1")}`
    const card = await db.card.findUniqueOrThrow({ where: { importKey: key } })
    // Nachrechnen nach einer neuen Version der Disziplin und neue Projektion: ändern die Zeile, nicht Revision oder Wahl
    await db.card.update({ where: { id: card.id }, data: { disciplineVersion: { decrement: 1 } } })
    expect(await refreshDisciplineCards(db, { cardIds: [card.id] })).toBe(1)
    await refreshProjections(db, { cardIds: [card.id] })
    const after = await db.card.findUniqueOrThrow({ where: { id: card.id } })
    expect(after.updatedAt.getTime()).toBeGreaterThan(card.updatedAt.getTime())
    // in Treffsicher eine Serie berichtigt: Lauf 2 ersetzt die Scheibe
    account.sessions[0].series[0].scoreTotal = 91
    account.sessions[0].series[0].shots = [...ten("9").slice(0, 9), "10"]
    const second = done(await c.run())
    expect(second.cards).toMatchObject({ revised: 1, kept: 0 })
    expect(second.check.findings).toBe(0)
  })

  it("ein Konto, dessen erster Lauf keine Zeile schreibt, läuft auch beim zweiten durch", async () => {
    const c = newCase("ohnezeile")
    const ownerId = await target(c.to)
    // nur Werte, passend zu einer vorhandenen Scheibe: weder Scheibe noch Eintrag
    await handCard(ownerId, "2026-09-09")
    const values = c.session("s1", "2026-09-09", {
      trainingGoal: null,
      isFavourite: false,
      wellbeing: null,
      prognosis: null,
      feedback: null,
      reflection: null,
    })
    values.series = values.series.map((series) => ({ ...series, executionQuality: null }))
    c.account([values])
    const first = done(await c.run())
    expect(first.decisions.existing).toBe(1)
    expect(first.cardOnly.units).toBe(1)
    expect(await db.transferItem.count({ where: { userId: ownerId } })).toBe(0)
    const second = done(await c.run())
    expect(second.check.findings).toBe(0)
    expect(await db.transferRun.count({ where: { userId: ownerId } })).toBe(2)
  })

  it("hat der User alles Übernommene gelöscht, legt der nächste Lauf nichts wieder an", async () => {
    const c = newCase("allesweg")
    c.account([c.session("s1", "2026-09-10")])
    done(await c.run())
    const userId = (await userOf(c.to)).id
    await db.diaryEntry.deleteMany({ where: { userId } })
    await db.diaryEntryCard.deleteMany({
      where: {
        cardId: {
          in: (await db.card.findMany({ where: { ownerId: userId } })).map((card) => card.id),
        },
      },
    })
    await db.card.deleteMany({ where: { ownerId: userId } })
    const second = done(await c.run())
    expect(second.deletedInSpiegel).toMatchObject({ cards: 1, entries: 1 })
    expect(second.cards.created).toBe(0)
    expect(second.entries.created).toBe(0)
    expect(await db.card.count({ where: { ownerId: userId } })).toBe(0)
  })

  it("ein Konto nur mit einem Ziel: eine Änderung bleibt über drei Läufe", async () => {
    const c = newCase("einziel")
    c.account([], {
      goals: [
        {
          id: c.id("g1"),
          title: "360 Ringe",
          description: null,
          type: "RESULT",
          dateFrom: "2026-05-31T22:00:00.000Z",
          dateTo: "2026-06-29T22:00:00.000Z",
          sessionIds: [],
        },
      ],
    })
    done(await c.run())
    const key = `treffsicher:${c.id("g1")}`
    await db.diaryGoal.update({ where: { importKey: key }, data: { title: "selbst" } })
    for (const run of [2, 3]) {
      const report = done(await c.run())
      expect(report.goals, `Lauf ${run}`).toMatchObject({ kept: 1, updated: 0 })
    }
    expect((await db.diaryGoal.findUniqueOrThrow({ where: { importKey: key } })).title).toBe(
      "selbst"
    )
  })

  it("alles übernommene im Tagebuch geändert oder gelöscht: Lauf 2 läuft durch", async () => {
    const c = newCase("allesgeaendert")
    c.account([c.session("s1", "2026-09-07"), c.session("s2", "2026-09-08")])
    done(await c.run())
    await new Promise((resolve) => setTimeout(resolve, 5))
    await db.diaryEntry.update({
      where: { importKey: `treffsicher:${c.id("s1")}` },
      data: { intention: "selbst" },
    })
    await new Promise((resolve) => setTimeout(resolve, 5))
    // die Verknüpfung von s2 gelöst und wieder gesetzt: eine neue Zeit an der Zeile
    const s2 = await db.diaryEntry.findUniqueOrThrow({
      where: { importKey: `treffsicher:${c.id("s2")}` },
      include: { cards: true },
    })
    await db.diaryEntryCard.update({
      where: { cardId: s2.cards[0].cardId },
      data: { link: "released" },
    })
    await new Promise((resolve) => setTimeout(resolve, 5))
    await db.diaryEntry.update({ where: { id: s2.id }, data: { learned: "selbst" } })
    // die Verknüpfung von s1 trägt noch die Zeit von Lauf 1, allein: keine Zeit eines Laufs mehr
    await db.diaryEntryCard.update({
      where: {
        cardId: (
          await db.card.findUniqueOrThrow({ where: { importKey: `treffsicher:${c.id("s1")}` } })
        ).id,
      },
      data: { link: "released" },
    })
    const second = done(await c.run())
    expect(second.entries).toMatchObject({ kept: 2, updated: 0 })
    expect(second.check.findings).toBe(0)
  })

  it("ohne Konto in Treffsicher", async () => {
    const c = newCase("ohne")
    expect(await c.run()).toEqual({ kind: "aborted", abort: { kind: "noSource" } })
  })

  it("solange das Ziel Zeilen der Vorschau hat", async () => {
    const c = newCase("vorschau")
    const ownerId = await target(c.to)
    await db.diaryEntry.create({
      data: {
        userId: ownerId,
        day: new Date("2026-03-14T00:00:00Z"),
        importKey: `preview:${c.tag}`,
      },
    })
    c.account([c.session("s1", "2026-08-01")])
    expect(await c.run()).toEqual({ kind: "aborted", abort: { kind: "preview", rows: 1 } })
  })

  it("das Ziel trägt Übernommenes aus einem anderen Treffsicher-Konto", async () => {
    const a = newCase("fremdA")
    const b = newCase("fremdB")
    a.account([a.session("s1", "2026-08-02")])
    b.account([b.session("s1", "2026-08-03")])
    done(await a.run())
    // dieselbe Quelle für beide, damit sie die Kennungen von A kennt
    b.source.accounts.set(a.from, a.source.accounts.get(a.from)!)
    expect(await b.run({ to: a.to })).toEqual({
      kind: "aborted",
      abort: { kind: "foreignInTarget", rows: 1 },
    })
  })

  it("Übernommenes dieses Kontos steht an einem anderen Spiegel-Konto", async () => {
    const c = newCase("anders")
    c.account([c.session("s1", "2026-08-04")])
    done(await c.run())
    const other = `${c.tag}-zwei@example.com`.toLowerCase()
    emails.push(other)
    expect(await c.run({ to: other })).toEqual({
      kind: "aborted",
      abort: { kind: "sourceElsewhere", rows: 2 },
    })
  })

  it("Familie unbekannt: nennt die Namen; mit `--family` geht es durch", async () => {
    const c = newCase("familie")
    c.account([
      c.session("s1", "2026-08-05", {
        discipline: { name: "Luftgewehr (Zehntel)", scoringType: "TENTH", shotsPerSeries: 10 },
      }),
    ])
    expect(await c.run()).toEqual({
      kind: "aborted",
      abort: { kind: "unknownFamily", names: { "Luftgewehr (Zehntel)": 1 } },
    })
    const report = done(
      await c.run({ dryRun: true, families: [{ name: "luftgewehr (zehntel)", slug: familySlug }] })
    )
    expect(report.decisions.new).toBe(1)
  })

  it("`--family` mit unbekannter Kennung oder doppeltem Namen", async () => {
    const c = newCase("option")
    c.account([c.session("s1", "2026-08-06")])
    expect(
      await c.run({
        families: [
          { name: "A", slug: "gibt-es-nicht" },
          { name: "B", slug: familySlug },
          { name: " b ", slug: familySlug },
        ],
      })
    ).toEqual({
      kind: "aborted",
      abort: { kind: "badFamilyOption", unknownSlugs: ["gibt-es-nicht"], duplicateNames: ["b"] },
    })
  })

  it("ein Gleichstand ohne meistgenutzte bricht ab; `--discipline` wählt, eine falsche Option bricht vorher ab", async () => {
    const tag = `${site.siteId}-${fixture++}`
    const alt = await db.discipline.create({
      data: {
        siteId: site.siteId,
        name: `LP 40 alt ${tag}`,
        familyId: site.familyId,
        targetId: "lp-10m",
        plannedShots: 40,
        seriesShots: 10,
        officialScoring: "rings",
        confirmedAt: new Date(),
      },
    })
    const twenty = await db.discipline.create({
      data: {
        siteId: site.siteId,
        name: `LP 20 ${tag}`,
        familyId: site.familyId,
        targetId: "lp-10m",
        plannedShots: 20,
        seriesShots: 10,
        officialScoring: "rings",
        confirmedAt: new Date(),
      },
    })
    const other = await db.family.create({ data: { slug: `fremd-${tag}`, name: `Fremd ${tag}` } })
    const foreign = await db.discipline.create({
      data: {
        siteId: site.siteId,
        name: `Fremd 40 ${tag}`,
        familyId: other.id,
        targetId: "lp-10m",
        plannedShots: 40,
        officialScoring: "rings",
        confirmedAt: new Date(),
      },
    })
    try {
      const c = newCase("gleich")
      const short = c.session("s2", "2026-08-11")
      short.series = short.series.slice(0, 2)
      c.account([c.session("s1", "2026-08-09"), short])
      expect(await c.run()).toEqual({
        kind: "aborted",
        abort: {
          kind: "noDiscipline",
          cases: [{ family: familyName, shots: 40, sessions: 1, reason: "tie", plannedShots: 40 }],
        },
      })
      expect(
        await c.run({
          disciplines: [
            { name: familyName, target: "Gibt es nicht" },
            { name: familyName.toUpperCase(), target: foreign.name },
          ],
        })
      ).toEqual({
        kind: "aborted",
        abort: {
          kind: "badDisciplineOption",
          unknownTargets: ["Gibt es nicht"],
          outsideFamily: [`${familyName.toUpperCase()}=${foreign.name}`],
          duplicateNames: [familyName.toLowerCase()],
        },
      })
      const report = done(
        await c.run({ disciplines: [{ name: familyName, target: alt.name.toUpperCase() }] })
      )
      expect(report.disciplines).toEqual({ larger: 0, largest: 0, option: 1 })
      const disciplineOf = async (name: string) =>
        (
          await db.card.findFirstOrThrow({
            where: { importKey: `treffsicher:${c.id(name)}` },
            select: { disciplineId: true },
          })
        ).disciplineId
      expect(await disciplineOf("s1")).toBe(alt.id)
      // die Einheit mit 20 Schuss hat ihre Disziplin ohne die Option und behält sie
      expect(await disciplineOf("s2")).toBe(twenty.id)
    } finally {
      const ids = [alt.id, twenty.id, foreign.id]
      await db.card.deleteMany({ where: { disciplineId: { in: ids } } })
      await db.discipline.deleteMany({ where: { id: { in: ids } } })
      await db.family.delete({ where: { id: other.id } })
    }
  })
})

describe("runTransfer: Hauptbuch über mehrere Läufe", () => {
  const png = (byte: number) => ({
    read: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, byte]),
  })
  const photo = (c: ReturnType<typeof newCase>, day: string) => ({
    id: c.id("a1"),
    filePath: "foto.png",
    fileType: "IMAGE" as const,
    originalName: "foto.png",
    createdAt: `${day}T18:00:00.000Z`,
  })
  /** eine Einheit nur mit Werten: kein Eintrag, also keine Verknüpfung im Hauptbuch */
  const valuesOnly = {
    trainingGoal: null,
    wellbeing: null,
    reflection: null,
    series: [1, 2, 3, 4].map((position) => ({
      position,
      isPractice: false,
      scoreTotal: 90,
      shots: ten("9"),
      executionQuality: null,
    })),
  }

  it("übernimmt eine Scheibe die Werte ihres Ausdrucks, ist sie in Lauf 2 und 3 unverändert", async () => {
    const c = newCase("uebernahme")
    const read = printoutReading(await readPrintoutValues(await printoutPdf(valuedSpec())), {
      producer: "Qt 5.12.8",
    })
    const values = valuesReadOf(read)
    const shots = values.reading!.shots
    const series = [1, 2, 3, 4].map((position) => {
      const rings = shots
        .slice((position - 1) * 10, position * 10)
        .map((s) => ringOf(s.decimalTenths))
      return {
        position,
        isPractice: false,
        scoreTotal: rings.reduce((sum, ring) => sum + ring, 0),
        shots: rings.map(String),
        executionQuality: 4,
      }
    })
    c.account([
      c.session("s1", "2026-10-02", {
        series,
        attachments: [
          {
            id: c.id("a1"),
            filePath: "ausdruck.pdf",
            fileType: "PDF",
            originalName: "ausdruck.pdf",
            createdAt: "2026-10-02T18:00:00.000Z",
          },
        ],
      }),
    ])
    const bytes = new TextEncoder().encode(`%PDF-1.4 ${c.tag}`)
    const file: StoredPrintout = {
      sha256: createHash("sha256").update(bytes).digest("hex"),
      size: bytes.length,
      fileName: "ausdruck.pdf",
      hex: (98_000 + fixture).toString(16).padStart(8, "0"),
      scheibenId: 98_000 + fixture,
      printedAt: new Date("2026-10-02T17:52:12Z"),
      values: { ...values, discipline: "LP Balken 28x110 mm" },
    }
    const run = () =>
      c.run({
        files: { read: async () => bytes },
        readPrintout: async () => ({ kind: "stored", file, maxRssKb: 0 }),
      })
    const first = done(await run())
    expect(first.attachments.printouts.adopted).toBe(1)
    const key = `treffsicher:${c.id("s1")}`
    const card = await db.card.findUniqueOrThrow({ where: { importKey: key } })
    expect(card.origin).toBe("pdf")
    for (const later of [done(await run()), done(await run())]) {
      expect(later.cards).toMatchObject({ unchanged: 1, kept: 0, created: 0 })
      expect(later.kept).toEqual([])
      expect(later.check.findings).toBe(0)
    }
    expect((await db.card.findUniqueOrThrow({ where: { importKey: key } })).id).toBe(card.id)
  })

  it("entfernt ein Lauf seine Scheibe und findet der Beleg keine andere, ist er später nicht „gelöscht“", async () => {
    const c = newCase("belegohne")
    c.account([c.session("s1", "2026-11-17", { attachments: [photo(c, "2026-11-17")] })])
    const plain = { files: png(5), writeEvidence: async () => {} }
    expect(done(await c.run(plain)).attachments.evidence.attached).toBe(1)
    // zwei Scheiben nur aus Probe am Abend: keine Scheibe aus Treffsicher mehr, der Beleg weiß nicht, wohin
    const ownerId = (await userOf(c.to)).id
    await handCard(ownerId, "2026-11-17", true)
    await handCard(ownerId, "2026-11-17", true)
    const second = done(await c.run(plain))
    expect(second.decisions.probeEvening).toBe(1)
    expect(second.cards.removed).toBe(1)
    expect(second.attachments.evidence.noCard).toBe(1)
    const third = done(await c.run(plain))
    expect(third.deletedInSpiegel.attachments).toBe(0)
    expect(third.attachments.evidence.noCard).toBe(1)
  })

  it("ein späterer Lauf ohne Dateien bricht ab, wenn das Hauptbuch Anhänge kennt", async () => {
    const c = newCase("ohnedateien")
    c.account([c.session("s1", "2026-11-13", { attachments: [photo(c, "2026-11-13")] })])
    done(await c.run({ files: png(3), writeEvidence: async () => {} }))
    const outcome = await c.run()
    expect(outcome.kind === "aborted" && outcome.abort).toEqual({
      kind: "filesMissing",
      attachments: 1,
    })
  })

  it("eine gelöschte Scheibe bleibt gelöscht, auch wenn die Entscheidung dazwischen kippt", async () => {
    const c = newCase("kippt")
    c.account([c.session("s1", "2026-11-14", valuesOnly)])
    done(await c.run())
    const ownerId = (await userOf(c.to)).id
    const key = `treffsicher:${c.id("s1")}`
    await db.card.delete({ where: { importKey: key } })
    expect(done(await c.run()).deletedInSpiegel.cards).toBe(1)
    // eine passende Scheibe kommt dazu, und der User löscht sie wieder
    const hand = await handCard(ownerId, "2026-11-14")
    expect(done(await c.run()).decisions.existing).toBe(1)
    await db.card.delete({ where: { id: hand } })
    const last = done(await c.run())
    expect(last.decisions.new).toBe(1)
    expect(last.deletedInSpiegel.cards).toBe(1)
    expect(last.cards.created).toBe(0)
    expect(await db.card.count({ where: { importKey: key } })).toBe(0)
  })

  it("ist die verknüpfte Scheibe gelöscht, entsteht keine Scheibe aus Treffsicher", async () => {
    const c = newCase("verknuepftweg")
    const ownerId = await target(c.to)
    const hand = await handCard(ownerId, "2026-11-15")
    c.account([c.session("s1", "2026-11-15")])
    expect(done(await c.run()).decisions.existing).toBe(1)
    await db.diaryEntryCard.deleteMany({ where: { cardId: hand } })
    await db.card.delete({ where: { id: hand } })
    const second = done(await c.run())
    expect(second.decisions.new).toBe(1)
    expect(second.deletedInSpiegel.cards).toBe(1)
    expect(second.cards.created).toBe(0)
    expect(await db.card.count({ where: { ownerId } })).toBe(0)
  })

  it("ein Beleg an seiner verzeichneten Scheibe kommt nicht ein zweites Mal an eine andere", async () => {
    const c = newCase("zweimal")
    const ownerId = await target(c.to)
    const hand = await handCard(ownerId, "2026-11-16")
    c.account([c.session("s1", "2026-11-16", { attachments: [photo(c, "2026-11-16")] })])
    const plain = { files: png(4), writeEvidence: async () => {} }
    const first = done(await c.run(plain))
    expect(first.decisions.existing).toBe(1)
    expect(first.attachments.evidence.attached).toBe(1)
    // der User ändert die verknüpfte Scheibe: Sie passt nicht mehr, Lauf 2 legt eine Scheibe aus Treffsicher an
    const changed = await writeEnteredCard(db, {
      cardId: hand,
      ownerId,
      origin: "manual",
      disciplineId,
      startedAtMs: Date.parse("2026-11-16T17:00:00Z"),
      kind: "training",
      details: {
        shots: [1, 2, 3, 4].flatMap((series) =>
          ten("8").map(() => ({ series, ring: 8, decimalTenths: null }))
        ),
      },
      reason: "eingetragen",
    })
    expect(changed.kind).toBe("saved")
    const second = done(await c.run(plain))
    expect(second.decisions.uncertain).toBe(1)
    expect(second.cards.created).toBe(1)
    expect(second.attachments.atRecordedCard).toBe(1)
    expect(second.attachments.evidence.attached).toBe(0)
    expect(await db.cardEvidence.count({ where: { card: { ownerId } } })).toBe(1)
    expect(await db.cardEvidence.count({ where: { cardId: hand } })).toBe(1)
  })
})

describe("runTransfer: Disziplin nach Schusszahl", () => {
  it("legt eine Einheit mit 30 Schuss auf die Disziplin mit 40 an, als unvollständig", async () => {
    const c = newCase("groesser")
    const three = c.session("s1", "2026-08-08")
    three.series = three.series.slice(0, 3)
    c.account([three])
    const report = done(await c.run())
    expect(report.disciplines).toEqual({ larger: 1, largest: 0, option: 0 })
    expect(report.check.findings).toBe(0)
    const card = await db.card.findFirstOrThrow({
      where: { importKey: `treffsicher:${c.id("s1")}` },
      select: { disciplineId: true, flags: true, complete: true },
    })
    expect(card).toEqual({ disciplineId, flags: ["unvollstaendig"], complete: false })
  })

  it("legt eine Einheit mit 50 Schuss auf die größte Disziplin (40) an, mit mehr Schüssen als geplant", async () => {
    const c = newCase("groesste")
    const five = c.session("s1", "2026-08-10")
    five.series = [...five.series, { ...five.series[0], position: 5 }]
    c.account([five])
    const report = done(await c.run())
    expect(report.disciplines).toEqual({ larger: 0, largest: 1, option: 0 })
    expect(report.check.findings).toBe(0)
    const card = await db.card.findFirstOrThrow({
      where: { importKey: `treffsicher:${c.id("s1")}` },
      select: { disciplineId: true, flags: true, complete: true },
    })
    expect(card).toEqual({ disciplineId, flags: ["ueber-soll"], complete: true })
  })
})
