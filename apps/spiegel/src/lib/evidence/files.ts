// Dateien der Belege eingetragener Scheiben ([[adr-033]]): `UPLOAD_DIR/evidence/<sha256>.<Endung>`, im selben Volume wie
// die Ausdrucke und mit ihm im Backup. Gleiche Bytes ergeben dieselbe Datei. Gelöscht wird eine Datei nur über
// `removeOrphanEvidenceFiles`, wie bei den Ausdrucken erst, wenn keine Zeile `CardEvidence` mehr auf sie zeigt.

import { randomUUID } from "node:crypto"
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import type { Db } from "@/lib/db"

import { removeOrphanFiles, SHA256, TMP_PREFIX, uploadDir } from "../printouts/files"

export const EVIDENCE_TYPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const
export type EvidenceType = keyof typeof EVIDENCE_TYPES

const EVIDENCE_FILE = /^([0-9a-f]{64})\.(?:pdf|jpg|png|webp)$/

const startsWith = (bytes: Uint8Array, prefix: readonly number[], at = 0) =>
  bytes.length >= at + prefix.length && prefix.every((byte, i) => bytes[at + i] === byte)
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0))

/** der Typ an den ersten Bytes, nie am Namen: PDF, JPEG, PNG oder WebP; sonst null */
export function evidenceTypeOf(bytes: Uint8Array): EvidenceType | null {
  if (startsWith(bytes, ascii("%PDF-"))) return "application/pdf"
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg"
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png"
  if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp"
  return null
}

export function evidenceDir(): string {
  return join(uploadDir(), "evidence")
}

export function evidencePath(sha256: string, type: EvidenceType): string {
  if (!SHA256.test(sha256)) throw new Error("ungültige Prüfsumme")
  return join(evidenceDir(), `${sha256}.${EVIDENCE_TYPES[type]}`)
}

/** schreibt atomar: erst eine temporäre Datei, dann `rename`; gleiche Bytes ergeben dieselbe Datei */
export async function writeEvidenceFile(
  sha256: string,
  type: EvidenceType,
  bytes: Uint8Array
): Promise<void> {
  const target = evidencePath(sha256, type)
  const dir = evidenceDir()
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

export async function readEvidenceBytes(
  sha256: string,
  type: EvidenceType
): Promise<Buffer | null> {
  try {
    return await readFile(evidencePath(sha256, type))
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") return null
    throw error
  }
}

/** löscht die Belege, auf die keine Zeile mehr zeigt (`removeOrphanFiles` wie bei den Ausdrucken) */
export function removeOrphanEvidenceFiles(
  db: Db,
  options: { nowMs?: number; graceMs?: number } = {}
): Promise<{ removed: number; skipped: boolean }> {
  return removeOrphanFiles(db, {
    ...options,
    dir: evidenceDir(),
    pattern: EVIDENCE_FILE,
    referencedOf: async (shas) =>
      (
        await db.cardEvidence.findMany({
          where: { sha256: { in: shas } },
          select: { sha256: true },
          distinct: ["sha256"],
        })
      ).map((row) => row.sha256),
  })
}
