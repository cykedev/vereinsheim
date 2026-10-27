// Speichert einen Ausdruck als Original: Größe und Kopf prüfen, sha256, ID, Druckzeit und Werte im Kindprozess lesen,
// dann die Datei nach `UPLOAD_DIR/printouts/<sha256>.pdf`. Nur mit lesbarer ID und Druckzeit entsteht eine Datei; die
// Werte sind ein Versuch mit Status (`PrintoutValuesRead`).
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
import {
  READER_VERSION,
  type PrintoutLayout,
  type PrintoutReading,
} from "@vereinsheim/meyton-pdf/reading"

import { safePdfName, writePrintoutFile } from "./files"
import type { ValuesRead } from "./protocol"
import { readPrintoutIsolated, type IsolatedReadOptions, type ReadFailure } from "./reader"

/** Status der Werte eines Ausdrucks, wie `Printout.valuesStatus` */
export type PrintoutValuesStatus = "ok" | "empty" | "inconsistent" | "unreadable"

/** was der Leser an Werten fand; die Lesung nur bei `ok` */
export interface PrintoutValuesRead {
  readerVersion: string
  layout: PrintoutLayout | null
  status: PrintoutValuesStatus
  reading: PrintoutReading | null
  /** Disziplin im Kopf, auch ohne Werte (Vorbelegung im Blatt „Neue Scheibe“) */
  discipline: string | null
}

/** ein Ausdruck ohne Werte darauf, für Tests und Werkzeuge, die nur die Zuordnung prüfen */
export const NO_VALUES: PrintoutValuesRead = Object.freeze({
  readerVersion: READER_VERSION,
  layout: null,
  status: "empty",
  reading: null,
  discipline: null,
})

/** das Ergebnis des Kindprozesses als Status mit Version des Lesers */
export function valuesReadOf(values: ValuesRead): PrintoutValuesRead {
  const base = { readerVersion: READER_VERSION }
  switch (values.kind) {
    case "ok":
      return {
        ...base,
        layout: values.reading.layout,
        status: "ok",
        reading: values.reading,
        discipline: values.reading.discipline,
      }
    case "rejected":
      return {
        ...base,
        layout: values.layout,
        status: values.problem === "empty" ? "empty" : "inconsistent",
        reading: null,
        discipline: values.discipline,
      }
    case "failed":
      return { ...base, layout: null, status: "unreadable", reading: null, discipline: null }
  }
}

export interface StoredPrintout {
  sha256: string
  size: number
  fileName: string
  /** die ID im Fuß, acht Hex-Zeichen */
  hex: string
  /** dieselbe ID als ScheibenID */
  scheibenId: number
  printedAt: Date
  values: PrintoutValuesRead
}

export type StoreRejection =
  | "tooLarge"
  | "notPdf"
  | "unreadable"
  | "noId"
  | "idConflict"
  | "noTime"
  | "timeout"
  | "busy"
  | "nodeVersion"

export type StoreResult =
  | { kind: "stored"; file: StoredPrintout; maxRssKb: number }
  | { kind: "rejected"; reason: StoreRejection }

const rejected = (reason: StoreRejection): StoreResult => ({ kind: "rejected", reason })

/** die Gründe des Kindprozesses in die wenigen, die ein Aufrufer unterscheidet */
function rejectionOf(reason: ReadFailure): StoreRejection {
  switch (reason) {
    case "busy":
    case "timeout":
    case "tooLarge":
    case "notPdf":
    case "nodeVersion":
      return reason
    default:
      return "unreadable"
  }
}

/** `write: false` liest nur und legt keine Datei an (Probelauf des Imports) */
export async function storePrintout(
  input: { bytes: Uint8Array; timeZone: string; fileName?: string | null },
  options: Pick<IsolatedReadOptions, "script" | "maxParseMs" | "nodeVersion"> & {
    write?: boolean
  } = {}
): Promise<StoreResult> {
  const { bytes } = input
  if (bytes.length === 0) return rejected("notPdf")
  if (bytes.length > DEFAULT_LIMITS.maxBytes) return rejected("tooLarge")
  if (!hasPdfHeader(bytes)) return rejected("notPdf")

  const sha256 = createHash("sha256").update(bytes).digest("hex")
  const { write = true, ...readOptions } = options
  const read = await readPrintoutIsolated(bytes, readOptions)
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

  if (write) await writePrintoutFile(sha256, bytes)
  return {
    kind: "stored",
    maxRssKb: read.maxRssKb,
    file: {
      sha256,
      size: bytes.length,
      fileName: safePdfName(input.fileName) ?? `ausdruck-${read.id.hex}.pdf`,
      hex: read.id.hex,
      scheibenId: read.id.value,
      printedAt,
      values: valuesReadOf(read.values),
    },
  }
}
