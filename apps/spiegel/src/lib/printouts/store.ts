// Speichert einen Ausdruck als Original: Größe und Kopf prüfen, sha256, ID und Druckzeit im Kindprozess lesen, dann die
// Datei nach `UPLOAD_DIR/printouts/<sha256>.pdf`. Nur mit lesbarer ID und Druckzeit entsteht eine Datei.
//
// Fehler beim Schreiben der Datei (Rechte, voller Datenträger, `UPLOAD_DIR` fehlt in Produktion) wirft es; abgelehnte
// Ausdrucke kommen als fester Grund zurück.
//
// Keine Zeile in der Datenbank: Die legt `attachPrintout` in der Transaktion des Aufrufers an. Eine Datei ohne Zeile
// räumt `removeOrphanPrintoutFiles` nach `SWEEP_GRACE_MS` ab.

import { createHash } from "node:crypto"

import { zonedWallTimeMs } from "@vereinsheim/lib/format"
import { hasPdfHeader } from "@vereinsheim/meyton-pdf/header"
import { DEFAULT_LIMITS } from "@vereinsheim/meyton-pdf/limits"

import { safePdfName, writePrintoutFile } from "./files"
import { readPrintoutIsolated, type IsolatedReadOptions, type ReadFailure } from "./reader"

export interface StoredPrintout {
  sha256: string
  size: number
  fileName: string
  /** die ID im Fuß, acht Hex-Zeichen */
  hex: string
  /** dieselbe ID als ScheibenID */
  scheibenId: number
  printedAt: Date
}

export type StoreRejection =
  "tooLarge" | "notPdf" | "unreadable" | "noId" | "idConflict" | "noTime" | "timeout" | "busy"

export type StoreResult =
  { kind: "stored"; file: StoredPrintout } | { kind: "rejected"; reason: StoreRejection }

const rejected = (reason: StoreRejection): StoreResult => ({ kind: "rejected", reason })

/** die Gründe des Kindprozesses in die wenigen, die ein Aufrufer unterscheidet */
function rejectionOf(reason: ReadFailure): StoreRejection {
  switch (reason) {
    case "busy":
    case "timeout":
    case "tooLarge":
    case "notPdf":
      return reason
    default:
      return "unreadable"
  }
}

export async function storePrintout(
  input: { bytes: Uint8Array; timeZone: string; fileName?: string | null },
  options: Pick<IsolatedReadOptions, "script" | "maxParseMs"> = {}
): Promise<StoreResult> {
  const { bytes } = input
  if (bytes.length === 0) return rejected("notPdf")
  if (bytes.length > DEFAULT_LIMITS.maxBytes) return rejected("tooLarge")
  if (!hasPdfHeader(bytes)) return rejected("notPdf")

  const sha256 = createHash("sha256").update(bytes).digest("hex")
  const read = await readPrintoutIsolated(bytes, options)
  if (read.kind === "failed") return rejected(rejectionOf(read.reason))
  if (read.id.kind === "missing") return rejected("noId")
  if (read.id.kind === "conflict") return rejected("idConflict")

  // ohne Zeitzone im PDF gilt die Wanduhr in der Zone der Anlage
  const createdAt = read.createdAt
  if (createdAt === null) return rejected("noTime")
  const printedAt = new Date(
    createdAt.epochMs ?? zonedWallTimeMs(Date.parse(`${createdAt.local}Z`), input.timeZone)
  )
  if (Number.isNaN(printedAt.getTime())) return rejected("noTime")

  await writePrintoutFile(sha256, bytes)
  return {
    kind: "stored",
    file: {
      sha256,
      size: bytes.length,
      fileName: safePdfName(input.fileName) ?? `ausdruck-${read.id.hex}.pdf`,
      hex: read.id.hex,
      scheibenId: read.id.value,
      printedAt,
    },
  }
}
