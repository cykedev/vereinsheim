import { createHash } from "node:crypto"

import { printoutReading } from "@vereinsheim/meyton-pdf/reading"
import { printoutPdf } from "@vereinsheim/meyton-pdf/test-printout"
import { readPrintoutValues } from "@vereinsheim/meyton-pdf/values"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { setScale } from "@/diary/entries"
import { createPrismaClient } from "@/lib/db"
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
    } finally {
      await db.discipline.delete({ where: { id: alt.id } })
    }
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
  it("scheitert das Merkmal, ist in Spiegel nichts geschrieben", async () => {
    const c = newCase("merkmal")
    c.account([c.session("s1", "2026-09-01")])
    c.source.markMoved = async () => {
      throw new Error("psql nicht erreichbar")
    }
    await expect(c.run()).rejects.toThrow("psql nicht erreichbar")
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
})

describe("runTransfer: Abbruch vor dem Schreiben", () => {
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
