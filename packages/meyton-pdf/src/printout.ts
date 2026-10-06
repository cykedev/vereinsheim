// Liest aus einem Meyton-Ausdruck nur zwei Dinge, beide unabhängig vom Layout (ADR-028): die ID im Fuß
// und die Erstellzeit aus den Metadaten. Dazu Seitenzahl und Druckweg (Producer, Creator) als Hinweis.
//
// pdf.js liest fremde Dateien. Deshalb gelten Grenzen für Größe, Seiten, Textmenge und Zeit (SF-48),
// geprüft zwischen den Schritten von pdf.js. Gegen ein präpariertes PDF schützen sie nicht: Das muss der
// Aufrufer in einem kurzlebigen Kindprozess lesen (siehe limits.ts). Nach außen gehen nur eigene
// Meldungen (MeytonPdfError), die Ursache steht in `cause`.

import { getDocumentProxy, getMeta } from "unpdf"

import { MeytonPdfError } from "./errors"
import { DEFAULT_LIMITS, type PrintoutLimits } from "./limits"
import { parsePdfDate, parseXmpDate, type PdfDate } from "./pdfDate"
import { findPrintoutId, type PrintoutIdResult } from "./printoutId"

export { MeytonPdfError } from "./errors"
export { DEFAULT_LIMITS, type PrintoutLimits } from "./limits"
export type { PdfDate } from "./pdfDate"
export type { PrintoutIdResult } from "./printoutId"

export interface Printout {
  pages: number
  id: PrintoutIdResult
  /** Erstellzeit; null ohne lesbare Metadaten */
  createdAt: (PdfDate & { source: "info" | "xmp" }) | null
  producer: string | null
  creator: string | null
}

export interface ReadOptions {
  limits?: Partial<PrintoutLimits>
  /** monotone Uhr in ms; für Tests ersetzbar */
  now?: () => number
}

type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>

const PDF_HEADER = new TextEncoder().encode("%PDF-")
/** So weit vorne muss der Kopf stehen; pdf.js duldet davor bis zu 1024 Bytes. */
const HEADER_WINDOW = 1024
const UNREADABLE = "Die PDF-Datei ist beschädigt oder nicht lesbar."

function hasPdfHeader(bytes: Uint8Array): boolean {
  const last = Math.min(bytes.length, HEADER_WINDOW) - PDF_HEADER.length
  for (let start = 0; start <= last; start++) {
    if (PDF_HEADER.every((byte, i) => bytes[start + i] === byte)) return true
  }
  return false
}

function sizeLabel(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return mb >= 1 ? `${Math.round(mb)} MB` : `${Math.round(bytes / 1024)} KB`
}

const shortText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, 200) : null

function xmpCreateDate(metadata: unknown): PdfDate | null {
  // Qt schreibt kein XMP; dann ist `metadata` ein leeres Objekt ohne `get`. pdf.js schlüsselt nach dem
  // wörtlichen Präfix, ältere Erzeuger schreiben `xap:` statt `xmp:`.
  const get = (metadata as { get?: unknown } | null)?.get
  if (typeof get !== "function") return null
  for (const key of ["xmp:createdate", "xap:createdate"]) {
    const raw: unknown = get.call(metadata, key)
    const date = typeof raw === "string" ? parseXmpDate(raw) : null
    if (date) return date
  }
  return null
}

/** Info vor XMP, aber ein Datum mit Zeitzone vor einem ohne. */
function creationDate(info: Record<string, unknown>, metadata: unknown): Printout["createdAt"] {
  const fromInfo = typeof info.CreationDate === "string" ? parsePdfDate(info.CreationDate) : null
  const fromXmp = xmpCreateDate(metadata)
  if (fromInfo && fromInfo.offsetMinutes !== null) return { ...fromInfo, source: "info" }
  if (fromXmp && fromXmp.offsetMinutes !== null) return { ...fromXmp, source: "xmp" }
  if (fromInfo) return { ...fromInfo, source: "info" }
  if (fromXmp) return { ...fromXmp, source: "xmp" }
  return null
}

export async function readPrintout(
  bytes: Uint8Array,
  options: ReadOptions = {}
): Promise<Printout> {
  const limits: PrintoutLimits = { ...DEFAULT_LIMITS, ...options.limits }
  const now = options.now ?? (() => performance.now())
  const startedAt = now()
  const checkTime = () => {
    if (now() - startedAt > limits.maxParseMs) {
      throw new MeytonPdfError("Zeitüberschreitung beim Lesen der PDF-Datei.")
    }
  }

  if (bytes.length > limits.maxBytes) {
    throw new MeytonPdfError(`Die PDF-Datei ist größer als ${sizeLabel(limits.maxBytes)}.`)
  }
  if (!hasPdfHeader(bytes)) throw new MeytonPdfError("Das ist keine PDF-Datei.")

  let pdf: PdfDocument
  try {
    // Eigene Kopie: pdf.js übernimmt den Puffer und leert ihn.
    pdf = await getDocumentProxy(new Uint8Array(bytes), {
      disableFontFace: true,
      useSystemFonts: false,
      stopAtErrors: false,
      maxImageSize: 1024 * 1024,
      // Keine Warnungen ins Log: ein präpariertes PDF könnte es fluten.
      verbosity: 0,
    })
  } catch (error) {
    throw new MeytonPdfError(UNREADABLE, { cause: error })
  }

  try {
    checkTime()
    if (pdf.numPages > limits.maxPages) {
      throw new MeytonPdfError(`Die PDF-Datei hat mehr als ${limits.maxPages} Seiten.`)
    }

    const { info, metadata } = await getMeta(pdf)
    checkTime()

    const pageTexts: string[] = []
    let items = 0
    let chars = 0
    for (let number = 1; number <= pdf.numPages; number++) {
      checkTime()
      const page = await pdf.getPage(number)
      // Gestreamt statt getTextContent(): Die Grenzen greifen zwischen den Stücken einer Seite.
      // Kein reader.cancel() beim Abbruch, das hängt mitten im Strom; destroy() unten räumt auf.
      const reader = page.streamTextContent().getReader()
      const parts: string[] = []
      while (true) {
        checkTime()
        const { done, value } = await reader.read()
        if (done) break
        for (const item of value?.items ?? []) {
          if (!("str" in item) || typeof item.str !== "string") continue
          items++
          chars += item.str.length
          if (items > limits.maxTextItems || chars > limits.maxChars) {
            throw new MeytonPdfError("Die PDF-Datei enthält zu viel Text.")
          }
          parts.push(item.str)
        }
      }
      pageTexts.push(parts.join(" "))
    }

    return {
      pages: pdf.numPages,
      id: findPrintoutId(pageTexts),
      createdAt: creationDate(info, metadata),
      producer: shortText(info.Producer),
      creator: shortText(info.Creator),
    }
  } catch (error) {
    if (error instanceof MeytonPdfError) throw error
    throw new MeytonPdfError(UNREADABLE, { cause: error })
  } finally {
    // destroy() hängt am loadingTask: Es gibt Worker und Puffer frei. Ein Fehler hier darf den
    // eigentlichen nicht verdecken.
    await pdf.loadingTask.destroy().catch(() => {})
  }
}
