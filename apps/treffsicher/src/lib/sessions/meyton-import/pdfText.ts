import { getDocumentProxy } from "unpdf"
import {
  MAX_EXTRACTED_TEXT_CHARS,
  MAX_PDF_PAGES,
  MAX_PDF_PARSE_MS,
  MAX_TEXT_ITEMS,
} from "@/lib/sessions/meyton-import/constants"
import { MeytonPdfError } from "@/lib/sessions/meyton-import/errors"
import { buildTextLinesFromItems, type PdfTextItem } from "@/lib/sessions/meyton-import/textLayout"

interface StreamedTextItem {
  str?: unknown
  transform?: unknown
}

function toPdfTextItem(item: StreamedTextItem, page: number): PdfTextItem | null {
  if (typeof item.str !== "string") return null
  if (!Array.isArray(item.transform) || item.transform.length < 6) return null

  const x = item.transform[4]
  const y = item.transform[5]
  if (typeof x !== "number" || typeof y !== "number") return null

  return { page, str: item.str, x, y }
}

async function extractItems(buffer: Buffer, startedAt: number): Promise<PdfTextItem[]> {
  // Eigene Kopie: pdf.js uebernimmt das Uint8Array und kann es beim Parsen leeren.
  const pdf = await getDocumentProxy(new Uint8Array(buffer), {
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: false,
    maxImageSize: 1024 * 1024,
  })

  try {
    // Das Laden selbst laesst sich in-process nicht abbrechen: blockiert eine
    // praeparierte PDF den Event-Loop, feuert kein Timer und auch kein
    // Promise.race. Wir koennen die Ueberschreitung nur danach feststellen und
    // die teure Textextraktion gar nicht erst beginnen.
    if (Date.now() - startedAt > MAX_PDF_PARSE_MS) {
      throw new MeytonPdfError("Zeitueberschreitung beim Lesen der PDF.")
    }

    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new MeytonPdfError(`Die PDF hat mehr als ${MAX_PDF_PAGES} Seiten.`)
    }

    const items: PdfTextItem[] = []
    let totalChars = 0

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber)

      // Gestreamt statt getTextContent(): der Cap muss greifen, *bevor* pdf.js die
      // ganze Seite materialisiert hat.
      const reader = page.streamTextContent().getReader()

      // Bewusst kein reader.cancel() beim Abbruch: mitten im Stream loest das
      // nicht auf und haengt (gemessen). Das loadingTask.destroy() unten beendet
      // den Worker-Task sauber (gemessen: 1 ms, "Worker task was terminated").
      while (true) {
        // Gegen Date.now() statt gegen einen Timer: bei praeparierten PDFs
        // blockiert das Parsen den Event-Loop, Timer feuern dann gar nicht.
        if (Date.now() - startedAt > MAX_PDF_PARSE_MS) {
          throw new MeytonPdfError("Zeitueberschreitung beim Lesen der PDF.")
        }

        const { done, value } = await reader.read()
        if (done) break
        if (!value?.items) continue

        for (const rawItem of value.items as StreamedTextItem[]) {
          const item = toPdfTextItem(rawItem, pageNumber)
          if (!item) continue

          totalChars += item.str.length
          if (items.length >= MAX_TEXT_ITEMS || totalChars > MAX_EXTRACTED_TEXT_CHARS) {
            throw new MeytonPdfError("Die PDF enthaelt zu viel Text.")
          }

          items.push(item)
        }
      }
    }

    return items
  } finally {
    // destroy() haengt am loadingTask, nicht am Dokument-Proxy — es gibt Worker
    // und Puffer frei, cleanup() allein wuerde das Dokument offen lassen.
    await pdf.loadingTask.destroy()
  }
}

/**
 * Extrahiert den Text eines Meyton-PDFs in Lesereihenfolge.
 *
 * Deckt beide Meyton-Druckpfade ab: Ghostscript/Type1 (Literal-Strings) und
 * Qt/Type0-Identity-H (Hex-Glyph-IDs). pdf.js dekodiert beides, daher gibt es
 * hier bewusst keine Formatunterscheidung.
 *
 * Wirft bei unlesbarer PDF-Struktur und bei gerissenen Limits, statt still einen
 * gekuerzten Text weiterzureichen — eine gekuerzte Einheit saehe in der Vorschau
 * plausibel aus und wuerde so uebernommen.
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  const items = await extractItems(buffer, Date.now())
  return buildTextLinesFromItems(items).join("\n")
}
