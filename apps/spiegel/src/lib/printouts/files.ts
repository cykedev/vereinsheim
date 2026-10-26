// Dateien der Ausdrucke: `UPLOAD_DIR/printouts/<sha256>.pdf`, in Produktion ein Volume mit Backup. Gleiche Bytes
// ergeben dieselbe Datei, mehrere Zeilen `Printout` können auf sie zeigen.
//
// Gelöscht wird eine Datei nur über `removeOrphanPrintoutFiles`: Zeilen verschwinden auf vielen Wegen („Nicht meine“,
// Papierkorb, Kaskaden über Konto und Anlage), und eine Datei darf erst gehen, wenn keine Zeile mehr auf sie zeigt.

import { randomUUID } from "node:crypto"
import { mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"

import type { Db } from "@/lib/db"

export const SHA256 = /^[0-9a-f]{64}$/
const PDF_FILE = /^([0-9a-f]{64})\.pdf$/
const TMP_PREFIX = ".tmp-"

/** so lange bleibt eine Datei ohne Zeile: Ihre Zeile entsteht erst nach dem Schreiben, in der Transaktion des Aufrufers */
export const SWEEP_GRACE_MS = 10 * 60_000
const SWEEP_BATCH = 500

/** `UPLOAD_DIR`; in Produktion Pflicht, sonst `uploads` im Arbeitsverzeichnis der App (gitignored) */
export function uploadDir(): string {
  const dir = process.env.UPLOAD_DIR
  if (dir) return dir
  if (process.env.NODE_ENV === "production") throw new Error("UPLOAD_DIR fehlt")
  return resolve("uploads")
}

export function printoutDir(): string {
  return join(uploadDir(), "printouts")
}

export function printoutPath(sha256: string): string {
  if (!SHA256.test(sha256)) throw new Error("ungültige Prüfsumme")
  return join(printoutDir(), `${sha256}.pdf`)
}

/** harmloser Dateiname eines PDFs; sonst null */
export function safePdfName(name: string | null | undefined): string | null {
  return name && /^[A-Za-z0-9._-]{1,100}\.pdf$/i.test(name) ? name : null
}

/** schreibt atomar: erst eine temporäre Datei, dann `rename`; gleiche Bytes ergeben dieselbe Datei */
export async function writePrintoutFile(sha256: string, bytes: Uint8Array): Promise<void> {
  const target = printoutPath(sha256)
  const dir = printoutDir()
  await mkdir(dir, { recursive: true })
  const tmp = join(dir, `${TMP_PREFIX}${sha256}-${randomUUID()}`)
  try {
    await writeFile(tmp, bytes, { mode: 0o640 })
    await rename(tmp, target)
  } catch (error) {
    await rm(tmp, { force: true })
    throw error
  }
}

const isMissing = (error: unknown) =>
  error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT"

export async function readPrintoutBytes(sha256: string): Promise<Buffer | null> {
  try {
    return await readFile(printoutPath(sha256))
  } catch (error) {
    if (isMissing(error)) return null
    throw error
  }
}

export interface SweepFile {
  name: string
  mtimeMs: number
}

/**
 * Welche Dateien weg dürfen: `<sha256>.pdf` ohne Zeile und liegengebliebene `.tmp-*`, beide älter als `graceMs`; andere
 * Namen nie. Ist die Tabelle ganz leer und liegen Ausdrucke da, nichts: Dann zeigt die App womöglich auf eine falsche
 * oder leere Datenbank.
 */
export function filesToRemove(input: {
  files: readonly SweepFile[]
  referenced: ReadonlySet<string>
  totalRows: number
  nowMs: number
  graceMs: number
}): string[] {
  const { files, referenced, totalRows, nowMs, graceMs } = input
  const old = (file: SweepFile) => nowMs - file.mtimeMs > graceMs
  if (totalRows === 0 && files.some((file) => PDF_FILE.test(file.name))) return []
  return files
    .filter((file) => {
      if (file.name.startsWith(TMP_PREFIX)) return old(file)
      const sha = PDF_FILE.exec(file.name)?.[1]
      return sha !== undefined && !referenced.has(sha) && old(file)
    })
    .map((file) => file.name)
}

/** löscht die Dateien, auf die keine Zeile mehr zeigt (`filesToRemove`); `skipped`, wenn die Sperre der leeren Tabelle griff */
export async function removeOrphanPrintoutFiles(
  db: Db,
  { nowMs = Date.now(), graceMs = SWEEP_GRACE_MS }: { nowMs?: number; graceMs?: number } = {}
): Promise<{ removed: number; skipped: boolean }> {
  const dir = printoutDir()
  let names: string[]
  try {
    names = await readdir(dir)
  } catch (error) {
    if (isMissing(error)) return { removed: 0, skipped: false }
    throw error
  }

  const files: SweepFile[] = []
  for (const name of names) {
    try {
      const info = await stat(join(dir, name))
      if (info.isFile()) files.push({ name, mtimeMs: info.mtimeMs })
    } catch (error) {
      if (!isMissing(error)) throw error
    }
  }

  const totalRows = await db.printout.count()
  const shas = files.flatMap((file) => PDF_FILE.exec(file.name)?.[1] ?? [])
  const referenced = new Set<string>()
  for (let start = 0; start < shas.length; start += SWEEP_BATCH) {
    const rows = await db.printout.findMany({
      where: { sha256: { in: shas.slice(start, start + SWEEP_BATCH) } },
      select: { sha256: true },
      distinct: ["sha256"],
    })
    for (const row of rows) referenced.add(row.sha256)
  }

  const remove = filesToRemove({ files, referenced, totalRows, nowMs, graceMs })
  for (const name of remove) {
    try {
      await unlink(join(dir, name))
    } catch (error) {
      if (!isMissing(error)) throw error
    }
  }
  const skipped = totalRows === 0 && files.some((file) => PDF_FILE.test(file.name))
  return { removed: remove.length, skipped }
}

/** räumt im Hintergrund auf; ins Log nur Zahlen und den Namen eines Fehlers */
export function sweepPrintoutsSoon(db: Db): void {
  void removeOrphanPrintoutFiles(db)
    .then(({ removed, skipped }) => {
      if (removed) console.warn(`${removed} Ausdrucke ohne Scheibe gelöscht`)
      if (skipped) console.warn("Ausdrucke: Tabelle leer, Dateien bleiben")
    })
    .catch((error: unknown) =>
      console.error(
        "Ausdrucke nicht aufgeräumt:",
        error instanceof Error ? error.name : "unbekannter Fehler"
      )
    )
}
