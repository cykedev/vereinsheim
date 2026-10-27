import { createHash, randomUUID } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { printoutReading } from "@vereinsheim/meyton-pdf/reading"
import { printoutPdf } from "@vereinsheim/meyton-pdf/test-printout"
import { readPrintoutValues } from "@vereinsheim/meyton-pdf/values"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { valuedSpec } from "../../../test/printout"
import { writeEnteredCard } from "../db/entered"
import { writePrintoutFile } from "./files"
import { attachPrintout } from "./queries"
import type { IsolatedRead } from "./reader"
import { rereadOutdatedPrintouts } from "./reread"
import { NO_VALUES } from "./store"

// Gegen die Dev-Datenbank, eigene Anlage; der Kindprozess ist ein Stub, der die Lesung eines erfundenen Ausdrucks
// liefert. Die Dev-Datenbank ist eine Prod-Kopie mit echten Ausdrucken: Jeder Lauf hier nimmt nur die eigene Anlage.

const db = createPrismaClient()
const RUN = randomUUID()
let site: TestSite
let dir: string
let previousUploadDir: string | undefined
let values: Extract<IsolatedRead, { kind: "read" }>["values"]

beforeAll(async () => {
  site = await createTestSite(db, "printout-reread")
  previousUploadDir = process.env.UPLOAD_DIR
  dir = await mkdtemp(join(tmpdir(), "spiegel-reread-"))
  process.env.UPLOAD_DIR = dir
  const reading = printoutReading(await readPrintoutValues(await printoutPdf(valuedSpec())), {
    producer: "Qt 5.12.8",
  })
  if (reading.kind !== "ok") throw new Error(reading.problem)
  values = reading
})

afterAll(async () => {
  if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR
  else process.env.UPLOAD_DIR = previousUploadDir
  await rm(dir, { recursive: true, force: true })
  await site.remove()
  await db.$disconnect()
})

const stub = (calls: { n: number }, result?: IsolatedRead) => async (): Promise<IsolatedRead> => {
  calls.n++
  return (
    result ?? {
      kind: "read",
      pages: 1,
      id: { kind: "found", hex: "ff914420", value: -7257056, pages: [1] },
      createdAt: null,
      producer: "Qt 5.12.8",
      values,
      maxRssKb: 1,
    }
  )
}

/** eine Scheibe vom Ausdruck mit einem Ausdruck, den noch kein Leser der Werte gelesen hat */
async function oldPrintout(
  card: { deletedAt?: Date; sourceId?: number; scheibenId?: number } = {}
) {
  const saved = await writeEnteredCard(db, {
    ownerId: site.ownerId,
    origin: "pdf",
    disciplineId: site.disciplineId,
    startedAtMs: Date.parse("2026-10-02T17:52:12Z"),
    kind: "training",
    details: {},
    reason: "printout",
  })
  if (saved.kind !== "saved") throw new Error(saved.kind)
  const sha256 = createHash("sha256").update(`${RUN}-${randomUUID()}`).digest("hex")
  await writePrintoutFile(sha256, new TextEncoder().encode("%PDF-1.4 erfunden"))
  const printoutId = await attachPrintout(
    db,
    {
      sha256,
      size: 1,
      fileName: "ausdruck.pdf",
      hex: "ff914420",
      scheibenId: -7257056,
      printedAt: new Date("2026-10-02T17:52:12Z"),
      values: NO_VALUES,
    },
    saved.cardId
  )
  // wie vor 1c gespeichert: ohne Version und Status
  await db.printout.update({
    where: { id: printoutId },
    data: { readerVersion: null, valuesStatus: null, storedAt: new Date(0) },
  })
  if (Object.keys(card).length) await db.card.update({ where: { id: saved.cardId }, data: card })
  return { cardId: saved.cardId, printoutId }
}

const printoutOf = (id: string) => db.printout.findUniqueOrThrow({ where: { id } })
const shotsOf = async (cardId: string) => {
  const card = await db.card.findUniqueOrThrow({
    where: { id: cardId },
    select: { currentRevision: { select: { _count: { select: { shots: true } } } } },
  })
  return card.currentRevision?._count.shots ?? 0
}
const run = (read: ReturnType<typeof stub>) =>
  rereadOutdatedPrintouts(db, { siteId: site.siteId, read })

describe("rereadOutdatedPrintouts", () => {
  it("eine alte Version: neu gelesen und angewandt; Papierkorb und Brücke bleiben", async () => {
    const fresh = await oldPrintout()
    const trashed = await oldPrintout({ deletedAt: new Date() })
    const bridged = await oldPrintout({ sourceId: site.sourceId, scheibenId: 994_001 })
    const calls = { n: 0 }
    const result = await run(stub(calls))
    expect(result).toEqual({ read: 1, taken: 1, failed: 0, missing: 0 })
    expect(calls.n).toBe(1)
    expect(await printoutOf(fresh.printoutId)).toMatchObject({
      readerVersion: "meyton-values@1",
      valuesStatus: "ok",
      layout: "qt",
    })
    expect(await shotsOf(fresh.cardId)).toBe(40)
    for (const skipped of [trashed, bridged]) {
      expect(await printoutOf(skipped.printoutId)).toMatchObject({
        readerVersion: null,
        valuesStatus: null,
      })
      expect(await shotsOf(skipped.cardId)).toBe(0)
    }
  })

  it("ein zweiter Lauf liest nichts mehr von diesen", async () => {
    const { printoutId } = await oldPrintout()
    await run(stub({ n: 0 }))
    expect((await printoutOf(printoutId)).readerVersion).toBe("meyton-values@1")
    const calls = { n: 0 }
    expect(await run(stub(calls))).toEqual({ read: 0, taken: 0, failed: 0, missing: 0 })
    expect(calls.n).toBe(0)
  })

  it("belegt: der Lauf endet sofort, nichts geschrieben", async () => {
    const { printoutId } = await oldPrintout()
    const calls = { n: 0 }
    const result = await run(stub(calls, { kind: "failed", reason: "busy" }))
    expect(calls.n).toBe(1)
    expect(result.read).toBe(0)
    expect((await printoutOf(printoutId)).readerVersion).toBeNull()
  })

  it("Lesen scheitert: die Zeile bleibt für einen späteren Lauf", async () => {
    const { printoutId } = await oldPrintout()
    const result = await run(stub({ n: 0 }, { kind: "failed", reason: "nodeVersion" }))
    expect(result.read).toBe(0)
    expect(result.failed).toBeGreaterThanOrEqual(1)
    expect((await printoutOf(printoutId)).readerVersion).toBeNull()
  })

  it("ein Lesefehler bei einer älteren Version lässt die stimmige Lesung stehen", async () => {
    const { cardId, printoutId } = await oldPrintout()
    await run(stub({ n: 0 }))
    expect(await shotsOf(cardId)).toBe(40)
    await db.printout.update({
      where: { id: printoutId },
      data: { readerVersion: "meyton-values@0" },
    })
    const result = await run(
      stub(
        { n: 0 },
        {
          kind: "read",
          pages: 1,
          id: { kind: "found", hex: "ff914420", value: -7257056, pages: [1] },
          createdAt: null,
          producer: "Qt 5.12.8",
          values: { kind: "failed", code: "timeout" },
          maxRssKb: 1,
        }
      )
    )
    expect(result).toMatchObject({ read: 1, failed: 1 })
    expect(await printoutOf(printoutId)).toMatchObject({ valuesStatus: "ok" })
    expect(await shotsOf(cardId)).toBe(40)
  })
})
