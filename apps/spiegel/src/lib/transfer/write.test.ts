import { createHash, randomUUID } from "node:crypto"

import { printoutReading } from "@vereinsheim/meyton-pdf/reading"
import { printoutPdf } from "@vereinsheim/meyton-pdf/test-printout"
import { readPrintoutValues } from "@vereinsheim/meyton-pdf/values"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { valuedSpec, type ValuedPrintoutSpec } from "../../../test/printout"
import { importPrintout } from "../fetch-card/import"
import { valuesReadOf, type StoredPrintout } from "../printouts/store"
import { placeAttachment, writeTransferCard, type PreparedAttachment } from "./write"

// Gegen die Dev-Datenbank, eigene Anlage mit eingeordneter Disziplin „LP 40“ (ganze Ringe); je Fall eine eigene
// ScheibenID und ein eigener Schlüssel.

const db = createPrismaClient()
const RUN = randomUUID()
const ZONE = "Europe/Berlin"
let site: TestSite
let nextId = 96_000

beforeAll(async () => {
  site = await createTestSite(db, "transfer-write")
  await db.discipline.update({
    where: { id: site.disciplineId },
    data: { confirmedAt: new Date() },
  })
})

afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

/** 2. Oktober 2026, 19:52 Uhr in Berlin, wie die Vorgabe von `valuedSpec` */
const PRINTED = new Date("2026-10-02T17:52:12Z")
const DAY = "2026-10-02"

async function stored(scheibenId: number, spec: ValuedPrintoutSpec = {}): Promise<StoredPrintout> {
  const values = await readPrintoutValues(await printoutPdf(valuedSpec(spec)))
  return {
    sha256: createHash("sha256").update(`${RUN}-${scheibenId}`).digest("hex"),
    size: 1,
    fileName: "ausdruck.pdf",
    hex: (scheibenId >>> 0).toString(16).padStart(8, "0"),
    scheibenId,
    printedAt: PRINTED,
    values: valuesReadOf(printoutReading(values, { producer: "Qt 5.12.8" })),
  }
}

/** eine Scheibe „aus Treffsicher“ mit diesem Gesamtergebnis in ganzen Ringen, 40 Schuss, am Abend des Ausdrucks */
async function transferCard(rings: number) {
  const saved = await db.$transaction((tx) =>
    writeTransferCard(tx, {
      ownerId: site.ownerId,
      disciplineId: site.disciplineId,
      startedAtMs: Date.parse(`${DAY}T17:00:00Z`),
      kind: "training",
      place: "Schützenhaus",
      importKey: `treffsicher:write-${RUN}-${nextId}`,
      details: { total: { shots: 40, rings } },
    })
  )
  if (saved.kind !== "saved") throw new Error(saved.kind)
  return saved.cardId
}

const place = (card: string | null, attachment: PreparedAttachment, rings: number | null) =>
  db.$transaction((tx) =>
    placeAttachment(tx, {
      ownerId: site.ownerId,
      siteId: site.siteId,
      timeZone: ZONE,
      card: card === null ? null : { id: card },
      unit: rings === null ? null : { day: DAY, scoring: "WHOLE", shots: 40, total: { rings } },
      attachment,
    })
  )

const revisionsOf = (cardId: string) =>
  db.cardRevision.findMany({
    where: { cardId },
    orderBy: { number: "asc" },
    select: { number: true, reason: true, totalRings: true, _count: { select: { shots: true } } },
  })

describe("placeAttachment: Meyton-Ausdruck", () => {
  it("passt: seine Werte werden Revision 2, Revision 1 aus Treffsicher bleibt, Herkunft vom Ausdruck", async () => {
    const file = await stored(nextId++)
    const rings = file.values.reading!.total!.rings
    const cardId = await transferCard(rings)
    const placed = await place(cardId, { kind: "printout", file }, rings)
    expect(placed).toEqual({ kind: "printoutUnitCard", cardId, fits: true, adopted: "adopted" })
    const card = await db.card.findUniqueOrThrow({
      where: { id: cardId },
      include: { printouts: true },
    })
    expect(card.origin).toBe("pdf")
    expect(card.printouts).toHaveLength(1)
    const revisions = await revisionsOf(cardId)
    expect(revisions.map((r) => [r.number, r.reason])).toEqual([
      [1, "treffsicher"],
      [2, "printout"],
    ])
    expect(revisions[0]._count.shots).toBe(0)
    expect(revisions[1]._count.shots).toBe(40)
  })

  it("passt nicht: angehängt ohne Werte, keine neue Revision", async () => {
    const file = await stored(nextId++)
    const rings = file.values.reading!.total!.rings - 1
    const cardId = await transferCard(rings)
    const placed = await place(cardId, { kind: "printout", file }, rings)
    expect(placed).toEqual({
      kind: "printoutUnitCard",
      cardId,
      fits: false,
      adopted: "notFitting",
    })
    const card = await db.card.findUniqueOrThrow({
      where: { id: cardId },
      include: { printouts: true },
    })
    expect(card.origin).toBe("treffsicher")
    expect(card.printouts).toHaveLength(1)
    expect((await revisionsOf(cardId)).map((r) => r.number)).toEqual([1])
  })

  it("Scheibe mit dieser ID schon da: dort angehängt, die Scheibe der Einheit bleibt ohne", async () => {
    const id = nextId++
    const file = await stored(id)
    const imported = await importPrintout(db, {
      userId: site.ownerId,
      siteId: site.siteId,
      file: { ...file, sha256: createHash("sha256").update(`${RUN}-erst-${id}`).digest("hex") },
    })
    if (imported.kind !== "created") throw new Error(imported.kind)
    const rings = file.values.reading!.total!.rings
    const cardId = await transferCard(rings)
    const placed = await place(cardId, { kind: "printout", file }, rings)
    expect(placed).toMatchObject({ kind: "printoutOwnCard", cardId: imported.cardId })
    expect(await db.printout.count({ where: { cardId: imported.cardId } })).toBe(2)
    expect(await db.printout.count({ where: { cardId } })).toBe(0)
    expect((await db.card.findUniqueOrThrow({ where: { id: cardId } })).origin).toBe("treffsicher")
  })

  it("ohne Scheibe der Einheit: wie ein alter Ausdruck eine Scheibe vom Ausdruck", async () => {
    const file = await stored(nextId++)
    const placed = await place(null, { kind: "printout", file }, null)
    expect(placed).toMatchObject({ kind: "printoutImported", result: { kind: "created" } })
  })
})

describe("placeAttachment: Beleg", () => {
  const evidence = (n: number): PreparedAttachment => ({
    kind: "evidence",
    sha256: createHash("sha256").update(`${RUN}-beleg-${n}`).digest("hex"),
    type: "image/jpeg",
    size: 1000,
    fileName: "foto.jpg",
  })

  it("an die Scheibe der Einheit, dieselbe Datei nur einmal", async () => {
    const cardId = await transferCard(360)
    expect(await place(cardId, evidence(1), 360)).toEqual({
      kind: "evidence",
      cardId,
      result: "attached",
    })
    expect(await place(cardId, evidence(1), 360)).toEqual({
      kind: "evidence",
      cardId,
      result: "duplicate",
    })
    expect(await db.cardEvidence.count({ where: { cardId } })).toBe(1)
  })

  it("ohne Scheibe kein Beleg", async () => {
    expect(await place(null, evidence(2), null)).toEqual({ kind: "evidenceNoCard" })
  })
})
