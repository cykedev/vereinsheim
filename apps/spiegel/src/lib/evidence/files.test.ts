import { createHash, randomUUID } from "node:crypto"
import { mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"
import { filesToRemove } from "../printouts/files"

import {
  evidenceDir,
  evidencePath,
  evidenceTypeOf,
  readEvidenceBytes,
  removeOrphanEvidenceFiles,
  writeEvidenceFile,
} from "./files"

const db = createPrismaClient()
const sha = (text: string) => createHash("sha256").update(text).digest("hex")
const RUN = randomUUID()
const A = sha(`${RUN}-a`)
const HOUR = 3_600_000

let previousUploadDir: string | undefined
let dir: string
beforeEach(async () => {
  previousUploadDir = process.env.UPLOAD_DIR
  dir = await mkdtemp(join(tmpdir(), "spiegel-evidence-"))
  process.env.UPLOAD_DIR = dir
})
afterEach(async () => {
  if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR
  else process.env.UPLOAD_DIR = previousUploadDir
  await rm(dir, { recursive: true, force: true })
})

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v]))
  )

describe("evidenceTypeOf", () => {
  it("am Anfang der Bytes, nie am Namen", () => {
    expect(evidenceTypeOf(bytes("%PDF-1.7"))).toBe("application/pdf")
    expect(evidenceTypeOf(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg")
    expect(evidenceTypeOf(bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png")
    expect(evidenceTypeOf(bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toBe("image/webp")
    expect(evidenceTypeOf(bytes("RIFF", 0, 0, 0, 0, "WAVE"))).toBeNull()
    expect(evidenceTypeOf(bytes("<svg"))).toBeNull()
    expect(evidenceTypeOf(bytes())).toBeNull()
  })
})

describe("Dateien", () => {
  it("unter evidence/ nach Prüfsumme und Endung, dieselben Bytes eine Datei", async () => {
    const content = bytes(0xff, 0xd8, 0xff, 1, 2, 3)
    await writeEvidenceFile(A, "image/jpeg", content)
    await writeEvidenceFile(A, "image/jpeg", content)
    expect(await readdir(evidenceDir())).toEqual([`${A}.jpg`])
    expect(new Uint8Array((await readEvidenceBytes(A, "image/jpeg"))!)).toEqual(content)
    expect(await readEvidenceBytes(A, "image/png")).toBeNull()
    expect(() => evidencePath("../x", "image/jpeg")).toThrow()
  })

  it("das Muster der Belege nimmt nur ihre Endungen", () => {
    const files = ["pdf", "jpg", "png", "webp", "gif"].map((ext) => ({
      name: `${A}.${ext}`,
      mtimeMs: 0,
    }))
    expect(
      filesToRemove({
        files,
        referenced: new Set(),
        anyCard: true,
        nowMs: HOUR,
        graceMs: 1,
        pattern: /^([0-9a-f]{64})\.(?:pdf|jpg|png|webp)$/,
      })
    ).toEqual([`${A}.pdf`, `${A}.jpg`, `${A}.png`, `${A}.webp`])
  })
})

describe("removeOrphanEvidenceFiles mit Datenbank", () => {
  let site: TestSite
  beforeAll(async () => {
    site = await createTestSite(db, "evidence-files")
  })
  afterAll(async () => {
    await site.remove()
    await db.$disconnect()
  })

  it("ein Beleg bleibt mit seiner Zeile und geht, wenn die Scheibe endgültig gelöscht ist", async () => {
    const card = await db.card.create({
      data: {
        disciplineId: site.disciplineId,
        ownerId: site.ownerId,
        startedAt: new Date(),
        kind: "training",
        state: "final",
        complete: false,
        origin: "manual",
      },
    })
    await db.cardEvidence.create({
      data: { cardId: card.id, sha256: A, contentType: "image/png", size: 8 },
    })
    await writeEvidenceFile(A, "image/png", bytes(0x89, "PNG", 0x0d, 0x0a, 0x1a, 0x0a))
    await writeFile(join(evidenceDir(), "fremd.txt"), "x")
    const hourAgo = new Date(Date.now() - HOUR)
    await utimes(evidencePath(A, "image/png"), hourAgo, hourAgo)
    await utimes(join(evidenceDir(), "fremd.txt"), hourAgo, hourAgo)

    expect(await removeOrphanEvidenceFiles(db)).toEqual({ removed: 0, skipped: false })
    await db.card.delete({ where: { id: card.id } })
    expect(await removeOrphanEvidenceFiles(db)).toEqual({ removed: 1, skipped: false })
    expect(await readdir(evidenceDir())).toEqual(["fremd.txt"])
  })
  it("dieselbe Datei an zwei Scheiben: sie bleibt, bis keine Zeile mehr auf sie zeigt", async () => {
    const B = sha(`${RUN}-b`)
    const cards = await Promise.all(
      [0, 1].map(() =>
        db.card.create({
          data: {
            disciplineId: site.disciplineId,
            ownerId: site.ownerId,
            startedAt: new Date(),
            kind: "training",
            state: "final",
            complete: false,
            origin: "manual",
          },
        })
      )
    )
    const rows = await Promise.all(
      cards.map((card) =>
        db.cardEvidence.create({
          data: { cardId: card.id, sha256: B, contentType: "image/jpeg", size: 4 },
        })
      )
    )
    await writeEvidenceFile(B, "image/jpeg", bytes(0xff, 0xd8, 0xff, 9))
    await db.cardEvidence.delete({ where: { id: rows[0]!.id } })
    expect(await removeOrphanEvidenceFiles(db, { graceMs: 0 })).toEqual({
      removed: 0,
      skipped: false,
    })
    expect(await readdir(evidenceDir())).toEqual([`${B}.jpg`])
    await db.cardEvidence.delete({ where: { id: rows[1]!.id } })
    expect(await removeOrphanEvidenceFiles(db, { graceMs: 0 })).toEqual({
      removed: 1,
      skipped: false,
    })
    expect(await readdir(evidenceDir())).toEqual([])
  })
})
