import { getDocumentProxy } from "unpdf"
import {
  MAX_EXTRACTED_TEXT_CHARS,
  MAX_PDF_PAGES,
  MAX_PDF_PARSE_MS,
} from "@/lib/sessions/meyton-import/constants"
import { buildTextLinesFromItems, type PdfTextItem } from "@/lib/sessions/meyton-import/textLayout"

async function extractItems(buffer: Buffer): Promise<PdfTextItem[]> {
  // Eigene Kopie: pdf.js uebernimmt das Uint8Array und kann es beim Parsen leeren.
  const pdf = await getDocumentProxy(new Uint8Array(buffer), {
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: false,
    maxImageSize: 1024 * 1024,
  })

  try {
    const items: PdfTextItem[] = []
    let totalChars = 0
    const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES)

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()

      for (const item of textContent.items) {
        if (!("str" in item) || typeof item.str !== "string") continue

        totalChars += item.str.length
        if (totalChars > MAX_EXTRACTED_TEXT_CHARS) return items

        items.push({ str: item.str, x: item.transform[4], y: item.transform[5] })
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
 * Wirft bei unlesbarer PDF-Struktur — der Aufrufer uebersetzt das in eine
 * Nutzermeldung, statt still einen leeren Text weiterzureichen.
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  let timeoutHandle: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error("Zeitueberschreitung beim Lesen der PDF.")),
      MAX_PDF_PARSE_MS
    )
  })

  try {
    const items = await Promise.race([extractItems(buffer), timeout])
    return buildTextLinesFromItems(items).join("\n")
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  }
}
