import { createHash, randomUUID } from "node:crypto"

import { printoutReading, type PrintoutReading } from "@vereinsheim/meyton-pdf/reading"
import { printoutPdf } from "@vereinsheim/meyton-pdf/test-printout"
import { readPrintoutValues } from "@vereinsheim/meyton-pdf/values"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { valuedSpec, type ValuedPrintoutSpec } from "../../../test/printout"
import { writeEnteredCardIn } from "../db/entered"
import type { DetailsInput } from "../entered/details"
import { valuesReadOf, type PrintoutValuesRead, type StoredPrintout } from "../printouts/store"
import { scoringReading } from "../printouts/values"
import { writeTransferCard } from "../transfer/write"
import { adoptIntoTransferred, printoutFits, transferredCardsFitting } from "./transferred"

const ZONE = "Europe/Berlin"

// 40 Schuss mit 382 Ringen und 3906 Zehnteln: die beiden Wertungen sind nicht ineinander umzurechnen
const reading = (over: Partial<PrintoutReading> = {}): PrintoutReading =>
  ({
    probe: false,
    shots: Array.from({ length: 40 }, () => ({ series: 1, decimalTenths: 98, innerTen: false })),
    total: { rings: 382, decimalTenths: 3906 },
    ...over,
  }) as PrintoutReading

const printout = (
  over: { reading?: PrintoutReading | null; status?: "ok" | "inconsistent"; printedAt?: Date } = {}
) => ({
  // 19:30 in Berlin
  printedAt: over.printedAt ?? new Date("2026-03-13T18:30:00Z"),
  values: {
    status: over.status ?? ("ok" as const),
    reading: over.reading === undefined ? reading() : over.reading,
  },
})

const unit = (over: Partial<Parameters<typeof printoutFits>[1]> = {}) => ({
  day: "2026-03-13",
  scoring: "WHOLE" as const,
  shots: 40,
  total: { rings: 382 },
  ...over,
})

describe("printoutFits", () => {
  it("passt in ganzen Ringen und in Zehnteln", () => {
    expect(printoutFits(printout(), unit(), ZONE)).toBe(true)
    expect(
      printoutFits(printout(), unit({ scoring: "TENTH", total: { decimalTenths: 3906 } }), ZONE)
    ).toBe(true)
  })

  it("anderes Ergebnis in der Wertung von Treffsicher passt nicht", () => {
    expect(printoutFits(printout(), unit({ total: { rings: 381 } }), ZONE)).toBe(false)
    // in Zehnteln zählen die Zehntel, nicht die Ringe
    expect(
      printoutFits(printout(), unit({ scoring: "TENTH", total: { decimalTenths: 3820 } }), ZONE)
    ).toBe(false)
    // in ganzen Ringen zählen die Ringe
    expect(printoutFits(printout(), unit({ total: { rings: 390 } }), ZONE)).toBe(false)
  })

  it("andere Schusszahl passt nicht", () => {
    expect(printoutFits(printout(), unit({ shots: 30 }), ZONE)).toBe(false)
  })

  it("anderer Abend passt nicht; nach Mitternacht vor 4 Uhr ist noch derselbe", () => {
    expect(printoutFits(printout(), unit({ day: "2026-03-12" }), ZONE)).toBe(false)
    const late = printout({ printedAt: new Date("2026-03-14T01:30:00Z") })
    expect(printoutFits(late, unit(), ZONE)).toBe(true)
  })

  it("im Modus Probe zählt die Summe der Schüsse in der Wertung von Treffsicher", () => {
    // 39 × 9,8 und eine 10,4: 361 Ringe, 3926 Zehntel
    const probe = printout({
      reading: reading({
        probe: true,
        total: null,
        shots: [
          ...Array.from({ length: 39 }, () => ({ series: 1, decimalTenths: 98, innerTen: false })),
          { series: 4, decimalTenths: 104, innerTen: true },
        ],
      }),
    })
    expect(printoutFits(probe, unit({ total: { rings: 361 } }), ZONE)).toBe(true)
    expect(
      printoutFits(probe, unit({ scoring: "TENTH", total: { decimalTenths: 3926 } }), ZONE)
    ).toBe(true)
    // Gegenprobe: eins daneben passt nicht
    expect(printoutFits(probe, unit({ total: { rings: 360 } }), ZONE)).toBe(false)
    expect(printoutFits(probe, unit({ total: { rings: 362 } }), ZONE)).toBe(false)
    expect(
      printoutFits(probe, unit({ scoring: "TENTH", total: { decimalTenths: 3925 } }), ZONE)
    ).toBe(false)
    expect(printoutFits(probe, unit({ shots: 39, total: { rings: 361 } }), ZONE)).toBe(false)
  })

  it("ohne gelesene Werte oder ohne Ergebnis in Treffsicher passt nichts", () => {
    expect(printoutFits(printout({ status: "inconsistent" }), unit(), ZONE)).toBe(false)
    expect(printoutFits(printout({ reading: null }), unit(), ZONE)).toBe(false)
    expect(printoutFits(printout(), unit({ total: null }), ZONE)).toBe(false)
    expect(printoutFits(printout(), unit({ total: {} }), ZONE)).toBe(false)
  })
})

// Gegen die Dev-Datenbank, eigene Anlage mit eingeordneter Disziplin „LP 40“ (ganze Ringe) und einem zweiten Konto; je
// Fall ein eigener Abend im September 2026, je Scheibe ein eigener Schlüssel.

const db = createPrismaClient()
const RUN = randomUUID()
let site: TestSite
let other: string
/** ein stimmig gelesener Ausdruck mit 40 Schuss, einmal in Wertung, einmal im Modus Probe */
let scored: PrintoutValuesRead
let probe: PrintoutValuesRead
let nextEvening = 0
let nextKey = 0

async function readValues(spec: ValuedPrintoutSpec) {
  const values = await readPrintoutValues(await printoutPdf(valuedSpec(spec)))
  return valuesReadOf(printoutReading(values, { producer: "Qt 5.12.8" }))
}

beforeAll(async () => {
  site = await createTestSite(db, "transferred")
  await db.discipline.update({
    where: { id: site.disciplineId },
    data: { confirmedAt: new Date() },
  })
  other = (
    await db.user.create({
      data: { email: `transferred-b-${site.siteId}@example.com`, name: "B", passwordHash: "-" },
    })
  ).id
  scored = await readValues({})
  probe = await readValues({ mode: "Probe" })
})

afterAll(async () => {
  await db.card.deleteMany({ where: { ownerId: other } })
  await site.remove()
  await db.user.delete({ where: { id: other } })
  await db.$disconnect()
})

/** ein eigener Abend: Tag, Druck um 19:52 Uhr in Berlin, Beginn um 19 Uhr */
function evening() {
  const n = nextEvening++
  const at = (hour: number, minute = 0, dayOffset = 0) =>
    Date.UTC(2026, 8, 1 + 2 * n + dayOffset, hour, minute)
  return {
    day: new Date(at(12)).toISOString().slice(0, 10),
    printedAt: new Date(at(17, 52)),
    startedAtMs: at(17),
    at,
  }
}

function file(printedAt: Date, values: PrintoutValuesRead = scored): StoredPrintout {
  const scheibenId = 97_000 + nextKey++
  return {
    sha256: createHash("sha256").update(`${RUN}-${scheibenId}`).digest("hex"),
    size: 1,
    fileName: "ausdruck.pdf",
    hex: (scheibenId >>> 0).toString(16).padStart(8, "0"),
    scheibenId,
    printedAt,
    values,
  }
}

const totalOf = (values: PrintoutValuesRead) => scoringReading(values.reading!).total!

async function transferCard(
  startedAtMs: number,
  total: NonNullable<DetailsInput["total"]>,
  ownerId = site.ownerId
) {
  const saved = await db.$transaction((tx) =>
    writeTransferCard(tx, {
      ownerId,
      disciplineId: site.disciplineId,
      startedAtMs,
      kind: "training",
      place: null,
      importKey: `treffsicher:fit-${RUN}-${nextKey++}`,
      details: { total },
    })
  )
  if (saved.kind !== "saved") throw new Error(saved.kind)
  return saved.cardId
}

const search = (day: string, pdf: StoredPrintout, userId = site.ownerId) =>
  db.$transaction((tx) => transferredCardsFitting(tx, { userId, day, timeZone: ZONE, file: pdf }))

describe("transferredCardsFitting", () => {
  it("findet die eine passende unter Scheiben, die nicht zählen", async () => {
    const e = evening()
    const { rings, decimalTenths } = totalOf(scored)
    const fitting = await transferCard(e.startedAtMs, { shots: 40, rings })
    // anderes Ergebnis, andere Schusszahl, Vorabend, Papierkorb, fremd
    await transferCard(e.startedAtMs, { shots: 40, rings: rings - 1 })
    await transferCard(e.startedAtMs, { shots: 41, rings })
    await transferCard(e.at(17, 0, -1), { shots: 40, rings })
    const trashed = await transferCard(e.startedAtMs, { shots: 40, rings })
    await db.card.update({ where: { id: trashed }, data: { deletedAt: new Date() } })
    const foreign = await transferCard(e.startedAtMs, { shots: 40, rings }, other)
    // in Zehnteln zählen die Zehntel: dieselben Ringe, ein Zehntel mehr
    await transferCard(e.startedAtMs, { shots: 40, rings, decimalTenths: decimalTenths + 1 })
    // eine Scheibe vom Ausdruck mit demselben Ergebnis
    await db.$transaction((tx) =>
      writeEnteredCardIn(tx, {
        ownerId: site.ownerId,
        origin: "pdf",
        disciplineId: site.disciplineId,
        startedAtMs: e.startedAtMs,
        kind: "training",
        kindChoice: "training",
        details: { total: { shots: 40, rings } },
        reason: "printout",
      })
    )
    expect(await search(e.day, file(e.printedAt))).toEqual({ kind: "one", cardId: fitting })
    // das andere Konto: seine eine
    expect(await search(e.day, file(e.printedAt), other)).toEqual({ kind: "one", cardId: foreign })
  })

  it("zwei passende: mehrere, Spiegel rät nicht", async () => {
    const e = evening()
    const { rings } = totalOf(scored)
    await transferCard(e.startedAtMs, { shots: 40, rings })
    await transferCard(e.at(18, 30), { shots: 40, rings })
    expect(await search(e.day, file(e.printedAt))).toEqual({ kind: "several" })
  })

  it("Wertung der Scheibe: Zehntel, wenn sie Zehntel hat, sonst ganze Ringe", async () => {
    const { rings, decimalTenths } = totalOf(scored)
    const tenth = evening()
    const inTenths = await transferCard(tenth.startedAtMs, { shots: 40, decimalTenths })
    expect(await search(tenth.day, file(tenth.printedAt))).toEqual({
      kind: "one",
      cardId: inTenths,
    })
    // ganze Ringe gleich, Zehntel anders: passt nicht
    const off = evening()
    await transferCard(off.startedAtMs, { shots: 40, rings, decimalTenths: decimalTenths + 1 })
    expect(await search(off.day, file(off.printedAt))).toEqual({ kind: "none" })
  })

  it("nach Mitternacht vor 4 Uhr gehört die Scheibe zum Abend davor", async () => {
    const e = evening()
    const { rings } = totalOf(scored)
    const late = await transferCard(e.at(0, 30, 1), { shots: 40, rings })
    expect(await search(e.day, file(e.printedAt))).toEqual({ kind: "one", cardId: late })
    // um 4 Uhr beginnt der nächste Abend
    const next = evening()
    await transferCard(next.at(2, 0, 1), { shots: 40, rings })
    expect(await search(next.day, file(next.printedAt))).toEqual({ kind: "none" })
  })

  it("ein Ausdruck im Modus Probe zählt mit der Summe seiner Schüsse", async () => {
    const e = evening()
    const { rings } = totalOf(probe)
    expect(probe.reading!.probe).toBe(true)
    const card = await transferCard(e.startedAtMs, { shots: 40, rings })
    expect(await search(e.day, file(e.printedAt, probe))).toEqual({ kind: "one", cardId: card })
  })

  it("ohne stimmige Lesung passt keine", async () => {
    const e = evening()
    await transferCard(e.startedAtMs, { shots: 40, rings: totalOf(scored).rings })
    expect(await search(e.day, file(e.printedAt, { ...scored, status: "inconsistent" }))).toEqual({
      kind: "none",
    })
  })
})

describe("adoptIntoTransferred", () => {
  const revisionsOf = (cardId: string) =>
    db.cardRevision.findMany({
      where: { cardId },
      orderBy: { number: "asc" },
      select: { number: true, reason: true, totalRings: true, _count: { select: { shots: true } } },
    })

  it("die Scheibe behält ihre ID und wird vom Ausdruck; Revision 1 bleibt, Revision 2 trägt seine Werte", async () => {
    const e = evening()
    const { rings } = totalOf(scored)
    const cardId = await transferCard(e.startedAtMs, { shots: 40, rings })
    const pdf = file(e.printedAt)
    expect(
      await db.$transaction((tx) =>
        adoptIntoTransferred(tx, { cardId, ownerId: site.ownerId, file: pdf })
      )
    ).toEqual({ values: true })
    const card = await db.card.findUniqueOrThrow({
      where: { id: cardId },
      include: { printouts: true },
    })
    expect(card.origin).toBe("pdf")
    expect(card.printouts.map((p) => p.footerId)).toEqual([pdf.hex])
    expect(
      (await revisionsOf(cardId)).map((r) => [r.number, r.reason, r.totalRings, r._count.shots])
    ).toEqual([
      [1, "treffsicher", rings, 0],
      [2, "printout", rings, 40],
    ])
  })

  it("Werte, die die Scheibe nicht nimmt: angehängt ohne Werte, Herkunft und Revision bleiben", async () => {
    const e = evening()
    const cardId = await transferCard(e.startedAtMs, { shots: 40, rings: totalOf(scored).rings })
    const rifle = await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: 10_199_777,
        name: "LG 40",
        familyId: site.familyId,
        targetId: "lg-10m",
      },
    })
    await db.card.update({ where: { id: cardId }, data: { disciplineId: rifle.id } })
    expect(
      await db.$transaction((tx) =>
        adoptIntoTransferred(tx, { cardId, ownerId: site.ownerId, file: file(e.printedAt) })
      )
    ).toEqual({ values: false })
    const card = await db.card.findUniqueOrThrow({
      where: { id: cardId },
      include: { printouts: true },
    })
    expect(card.origin).toBe("treffsicher")
    expect(card.printouts).toHaveLength(1)
    expect(card.printouts[0].valuesStatus).toBe("inconsistent")
    expect((await revisionsOf(cardId)).map((r) => r.number)).toEqual([1])
  })

  it("eine Scheibe im Papierkorb nimmt nichts an", async () => {
    const e = evening()
    const cardId = await transferCard(e.startedAtMs, { shots: 40, rings: totalOf(scored).rings })
    await db.card.update({ where: { id: cardId }, data: { deletedAt: new Date() } })
    await expect(
      db.$transaction((tx) =>
        adoptIntoTransferred(tx, { cardId, ownerId: site.ownerId, file: file(e.printedAt) })
      )
    ).rejects.toThrow()
    expect(await db.printout.count({ where: { cardId } })).toBe(0)
  })
})
