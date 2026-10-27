import { createHash, randomUUID } from "node:crypto"

import { printoutPdf } from "@vereinsheim/meyton-pdf/test-printout"
import { printoutReading } from "@vereinsheim/meyton-pdf/reading"
import { readPrintoutValues } from "@vereinsheim/meyton-pdf/values"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { Prisma } from "@/generated/prisma/client"
import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import {
  shotsAround,
  valuedHits,
  valuedSpec,
  type ValuedPrintoutSpec,
} from "../../../test/printout"
import { refreshDisciplineCards } from "../db/cards"
import { writeEnteredCard } from "../db/entered"
import { applyPrintoutValues } from "./apply"
import { attachPrintout } from "./queries"
import { valuesReadOf, type StoredPrintout } from "./store"

// Gegen die Dev-Datenbank, eigene Anlage. Die Lesung kommt aus erfundenen Ausdrucken (`valuedPrintout`), gelesen im
// Testprozess wie im Kindprozess.

const db = createPrismaClient()
const RUN = randomUUID()
let site: TestSite

beforeAll(async () => {
  site = await createTestSite(db, "printout-apply")
})

afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

const PRINTED = new Date("2026-10-02T17:52:12Z")

/** ein gespeicherter Ausdruck mit der Lesung eines erfundenen; `printedAt` bestimmt die Folge */
async function stored(
  spec: ValuedPrintoutSpec,
  printedAt = PRINTED,
  text = randomUUID()
): Promise<StoredPrintout> {
  const printout = valuedSpec(spec)
  const values = await readPrintoutValues(await printoutPdf(printout))
  const reading = printoutReading(values, { producer: "Qt 5.12.8" })
  return {
    sha256: createHash("sha256").update(`${RUN}-${text}`).digest("hex"),
    size: 1,
    fileName: "ausdruck.pdf",
    hex: "ff914420",
    scheibenId: -7257056,
    printedAt,
    values: valuesReadOf(reading),
  }
}

/** eine Scheibe vom Ausdruck ohne Lesung */
async function pdfCard(disciplineId = site.disciplineId): Promise<string> {
  const saved = await writeEnteredCard(db, {
    ownerId: site.ownerId,
    origin: "pdf",
    disciplineId,
    startedAtMs: PRINTED.getTime(),
    kind: "training",
    details: {},
    reason: "printout",
  })
  if (saved.kind !== "saved") throw new Error(saved.kind)
  return saved.cardId
}

const apply = (cardId: string) => db.$transaction((tx) => applyPrintoutValues(tx, cardId))
const cardOf = (id: string) =>
  db.card.findUniqueOrThrow({
    where: { id },
    include: {
      projection: true,
      currentRevision: { include: { shots: { orderBy: { seq: "asc" } } } },
    },
  })
const revisions = (cardId: string) => db.cardRevision.count({ where: { cardId } })

describe("applyPrintoutValues", () => {
  it("stimmiger Ausdruck: Schüsse mit Lage, Standnummer, Streuung, Herkunft pdf", async () => {
    const cardId = await pdfCard()
    await attachPrintout(db, await stored({}), cardId)
    expect(await apply(cardId)).toBe("taken")
    const card = await cardOf(cardId)
    expect(card).toMatchObject({ origin: "pdf", sourceId: null, stand: "7" })
    const shots = card.currentRevision!.shots
    const hits = valuedHits()
    expect(shots).toHaveLength(40)
    expect(shots.every((shot) => shot.xUm !== null && shot.distanceTenthsUm === null)).toBe(true)
    expect(Math.abs(shots[3].xUm! - hits[3].xMm * 1000)).toBeLessThanOrEqual(10)
    expect(shots[3].decimalTenths).toBe(hits[3].decimalTenths)
    const values = card.projection?.values as Record<string, { value: number } | null>
    expect(values["group.sigma"]?.value).toBeGreaterThan(0)
    expect(values["result.rings"]?.value).toBe(hits.reduce((s, h) => s + h.ring, 0))
  })

  it("ein späterer Ausdruck mit mehr Schüssen: neue Revision mit allen", async () => {
    const cardId = await pdfCard()
    const all = shotsAround(40, 11)
    await attachPrintout(db, await stored({ shotsMm: all.slice(0, 20) }), cardId)
    expect(await apply(cardId)).toBe("taken")
    expect((await cardOf(cardId)).currentRevision!.shots).toHaveLength(20)
    const before = await revisions(cardId)
    const later = new Date(PRINTED.getTime() + 20 * 60_000)
    await attachPrintout(db, await stored({ shotsMm: all }, later), cardId)
    expect(await apply(cardId)).toBe("taken")
    expect((await cardOf(cardId)).currentRevision!.shots).toHaveLength(40)
    expect(await revisions(cardId)).toBe(before + 1)
  })

  it("ein späterer Ausdruck im Widerspruch: der frühere zählt, der spätere ist inconsistent", async () => {
    const cardId = await pdfCard()
    await attachPrintout(db, await stored({ shotsMm: shotsAround(30, 12) }), cardId)
    const later = new Date(PRINTED.getTime() + 20 * 60_000)
    const bad = await stored(
      {
        shotsMm: shotsAround(40, 12),
        // die Trefferlage passt nicht zu den Marken
        tamper: (printout) => (printout.center = "9.99 mm links, 9.99 mm tief"),
      },
      later
    )
    const badId = await attachPrintout(db, bad, cardId)
    expect(await apply(cardId)).toBe("taken")
    expect((await cardOf(cardId)).currentRevision!.shots).toHaveLength(30)
    const rejected = await db.printout.findUniqueOrThrow({ where: { id: badId } })
    expect(rejected.valuesStatus).toBe("inconsistent")
    // die Lesung bleibt: Sie widerspricht sich nicht selbst, nur der Disziplin
    expect(rejected.reading).not.toBeNull()
  })

  it("derselbe Ausdruck zweimal: keine neue Revision", async () => {
    const cardId = await pdfCard()
    const file = await stored({})
    await attachPrintout(db, file, cardId)
    expect(await apply(cardId)).toBe("taken")
    const before = await revisions(cardId)
    await attachPrintout(db, file, cardId)
    expect(await apply(cardId)).toBe("taken")
    expect(await revisions(cardId)).toBe(before)
  })

  it("kein Ausdruck gibt Werte mehr: eine Revision ohne Angaben", async () => {
    const cardId = await pdfCard()
    const id = await attachPrintout(db, await stored({}), cardId)
    expect(await apply(cardId)).toBe("taken")
    // ein neuer Leser fand die Werte nicht mehr: ohne Lesung
    await db.printout.update({
      where: { id },
      data: { valuesStatus: "unreadable", reading: Prisma.DbNull },
    })
    expect(await apply(cardId)).toBe("none")
    const card = await cardOf(cardId)
    expect(card.currentRevision!.shots).toEqual([])
    expect(card.stand).toBeNull()
  })

  it("Scheibe der Brücke, im Papierkorb oder wartend: skipped, nichts geschrieben", async () => {
    const cardId = await pdfCard()
    await attachPrintout(db, await stored({}), cardId)
    const before = await revisions(cardId)
    for (const data of [
      { sourceId: site.sourceId, scheibenId: 990_000 + Math.floor(Math.random() * 9_000) },
      { deletedAt: new Date() },
      { ownerPending: true },
    ]) {
      const reset = Object.fromEntries(
        Object.keys(data).map((key) => [key, key === "ownerPending" ? false : null])
      )
      await db.card.update({ where: { id: cardId }, data })
      expect(await apply(cardId)).toBe("skipped")
      await db.card.update({ where: { id: cardId }, data: reset })
    }
    expect(await revisions(cardId)).toBe(before)
  })

  it("derselbe Ausdruck, beim zweiten Mal nicht lesbar: Werte und Revision bleiben", async () => {
    const cardId = await pdfCard()
    const file = await stored({})
    const printoutId = await attachPrintout(db, file, cardId)
    expect(await apply(cardId)).toBe("taken")
    const before = await revisions(cardId)
    await attachPrintout(
      db,
      { ...file, values: valuesReadOf({ kind: "failed", code: "timeout" }) },
      cardId
    )
    expect(await apply(cardId)).toBe("taken")
    expect(await revisions(cardId)).toBe(before)
    expect(await db.printout.findUniqueOrThrow({ where: { id: printoutId } })).toMatchObject({
      valuesStatus: "ok",
    })
    expect((await cardOf(cardId)).currentRevision!.shots).toHaveLength(40)
  })

  it("passt nicht zum Scheibenbild der Disziplin: Lesung bleibt, nach der Korrektur kommen die Werte", async () => {
    const discipline = await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: 10_199_777,
        name: "LP 40 falsch eingeordnet",
        familyId: site.familyId,
        targetId: "lg-10m",
      },
    })
    const cardId = await pdfCard(discipline.id)
    const printoutId = await attachPrintout(db, await stored({}), cardId)
    expect(await apply(cardId)).toBe("none")
    expect(await db.printout.findUniqueOrThrow({ where: { id: printoutId } })).toMatchObject({
      valuesStatus: "inconsistent",
      reading: expect.anything(),
    })
    expect((await cardOf(cardId)).currentRevision!.shots).toEqual([])
    // der Admin ordnet die Disziplin richtig ein: neues Scheibenbild, neue Version
    await db.discipline.update({
      where: { id: discipline.id },
      data: { targetId: "lp-10m", version: { increment: 1 } },
    })
    await refreshDisciplineCards(db, { cardIds: [cardId] })
    expect((await cardOf(cardId)).currentRevision!.shots).toHaveLength(40)
    expect(await db.printout.findUniqueOrThrow({ where: { id: printoutId } })).toMatchObject({
      valuesStatus: "ok",
    })
  })
})
