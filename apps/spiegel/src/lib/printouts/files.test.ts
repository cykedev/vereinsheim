import { createHash, randomUUID } from "node:crypto"
import { mkdtemp, readdir, readFile, rm, utimes } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import {
  filesToRemove,
  printoutDir,
  printoutPath,
  removeOrphanPrintoutFiles,
  safePdfName,
  writePrintoutFile,
} from "./files"

const db = createPrismaClient()

const sha = (text: string) => createHash("sha256").update(text).digest("hex")
// je Lauf andere Prüfsummen: Die Dev-Datenbank teilen sich Läufe, auch liegengebliebene
const RUN = randomUUID()
const A = sha(`${RUN}-a`)
const B = sha(`${RUN}-b`)
const NOW = 1_800_000_000_000
const GRACE = 10 * 60_000
const HOUR = 3_600_000

let previousUploadDir: string | undefined
let dir: string

beforeEach(async () => {
  previousUploadDir = process.env.UPLOAD_DIR
  dir = await mkdtemp(join(tmpdir(), "spiegel-uploads-"))
  process.env.UPLOAD_DIR = dir
})

afterEach(async () => {
  if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR
  else process.env.UPLOAD_DIR = previousUploadDir
  await rm(dir, { recursive: true, force: true })
})

describe("filesToRemove", () => {
  const old = NOW - HOUR
  const young = NOW - 60_000
  const base = { referenced: new Set([B]), anyCard: true, nowMs: NOW, graceMs: GRACE }

  it("alt ohne Zeile weg; jung, mit Zeile und fremde Namen bleiben; alte .tmp- weg", () => {
    expect(
      filesToRemove({
        ...base,
        files: [
          { name: `${A}.pdf`, mtimeMs: old },
          { name: `${sha(`${RUN}-c`)}.pdf`, mtimeMs: young },
          { name: `${B}.pdf`, mtimeMs: old },
          { name: "notes.txt", mtimeMs: old },
          { name: `.tmp-${A}-1`, mtimeMs: old },
          { name: `.tmp-${A}-2`, mtimeMs: young },
        ],
      })
    ).toEqual([`${A}.pdf`, `.tmp-${A}-1`])
  })

  it("keine Tabelle der Ausdrucke, aber Scheiben: die letzte verwaiste Datei geht", () => {
    expect(
      filesToRemove({ ...base, referenced: new Set(), files: [{ name: `${A}.pdf`, mtimeMs: old }] })
    ).toEqual([`${A}.pdf`])
  })

  it("keine Scheibe: keine Datei, solange Ausdrucke da sind; sonst nur .tmp-", () => {
    expect(
      filesToRemove({
        ...base,
        anyCard: false,
        files: [
          { name: `${A}.pdf`, mtimeMs: old },
          { name: `.tmp-${A}-1`, mtimeMs: old },
        ],
      })
    ).toEqual([])
    expect(
      filesToRemove({ ...base, anyCard: false, files: [{ name: `.tmp-${A}-1`, mtimeMs: old }] })
    ).toEqual([`.tmp-${A}-1`])
  })
})

describe("Dateien", () => {
  it("dieselben Bytes zweimal: eine Datei, gleicher Inhalt", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 Test")
    await writePrintoutFile(A, bytes)
    await writePrintoutFile(A, bytes)
    expect(await readdir(printoutDir())).toEqual([`${A}.pdf`])
    expect(new Uint8Array(await readFile(printoutPath(A)))).toEqual(bytes)
  })

  it("nur gültige Prüfsummen und harmlose Namen", () => {
    expect(() => printoutPath("../x")).toThrow()
    expect(safePdfName("print_x.pdf")).toBe("print_x.pdf")
    expect(safePdfName("../x.pdf")).toBeNull()
    expect(safePdfName("x.html")).toBeNull()
    expect(safePdfName(null)).toBeNull()
  })

  it("ohne Verzeichnis: nichts zu tun", async () => {
    expect(await removeOrphanPrintoutFiles(db)).toEqual({ removed: 0, skipped: false })
  })
})

describe("removeOrphanPrintoutFiles mit Datenbank", () => {
  let site: TestSite

  beforeAll(async () => {
    site = await createTestSite(db, "printout-files")
  })

  afterAll(async () => {
    await site.remove()
    await db.$disconnect()
  })

  const pdfCard = () =>
    db.card.create({
      data: {
        disciplineId: site.disciplineId,
        ownerId: site.ownerId,
        startedAt: new Date(),
        kind: "training",
        state: "final",
        complete: true,
        origin: "pdf",
      },
    })
  const attach = (cardId: string, sha256: string) =>
    db.printout.create({ data: { cardId, sha256, fileName: "ausdruck.pdf", size: 13 } })

  it("eine Datei bleibt, solange eine Zeile auf sie zeigt", async () => {
    const first = await pdfCard()
    const second = await pdfCard()
    await attach(first.id, A)
    await attach(second.id, A)
    await writePrintoutFile(A, new TextEncoder().encode("%PDF-1.4 Test"))
    const hourAgo = new Date(Date.now() - HOUR)
    await utimes(printoutPath(A), hourAgo, hourAgo)

    expect(await removeOrphanPrintoutFiles(db)).toEqual({ removed: 0, skipped: false })

    await db.card.delete({ where: { id: first.id } })
    expect(await removeOrphanPrintoutFiles(db)).toEqual({ removed: 0, skipped: false })
    expect(await readdir(printoutDir())).toEqual([`${A}.pdf`])

    await db.card.delete({ where: { id: second.id } })
    expect(await removeOrphanPrintoutFiles(db)).toEqual({ removed: 1, skipped: false })
    expect(await readdir(printoutDir())).toEqual([])
  })
})
