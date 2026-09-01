import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { extractTextFromPdfBuffer } from "@/lib/sessions/meyton-import/pdfText"
import { MAX_EXTRACTED_TEXT_CHARS } from "@/lib/sessions/meyton-import/constants"

const FIXTURES = join(__dirname, "__fixtures__")

describe("extractTextFromPdfBuffer", () => {
  it("liest das Qt/Identity-H-Format (Hex-Glyph-IDs)", async () => {
    const text = await extractTextFromPdfBuffer(
      readFileSync(join(FIXTURES, "meyton-qt-identity-h.pdf"))
    )

    expect(text).toContain("Serie 1: 55.0 (50)")
    expect(text).toContain("1.0 2.0 3.0 4.0 5.0")
    expect(text).toContain("Trefferlage: 1.00 mm links, 1.00 mm hoch")
  })

  it("liest das Ghostscript/Type1-Format (Literal-Strings)", async () => {
    const text = await extractTextFromPdfBuffer(
      readFileSync(join(FIXTURES, "meyton-ghostscript-type1.pdf"))
    )

    expect(text).toContain("Serie 1: 50 (55.0)")
    expect(text).toContain("5.0 4.0 3.0 2.0 1.0")
  })

  it("haelt die Scheiben-Grafik aus den Schusszeilen heraus", async () => {
    const text = await extractTextFromPdfBuffer(
      readFileSync(join(FIXTURES, "meyton-qt-identity-h.pdf"))
    )

    // Die Grafik-Nummern liegen auf derselben Zeilenhoehe wie die Schusswerte.
    // Ohne Spaltenschnitt stuenden sie mit in diesen Zeilen.
    const shotLines = text.split("\n").filter((line) => line.startsWith("10.0 10.0"))
    expect(shotLines).toEqual(["1.0 2.0 3.0 4.0 5.0"])
  })

  it("wirft bei kaputter PDF-Struktur", async () => {
    await expect(
      extractTextFromPdfBuffer(Buffer.from("%PDF-1.4\nkein echtes PDF\n%%EOF", "latin1"))
    ).rejects.toThrow()
  })

  it("begrenzt die extrahierte Textmenge", async () => {
    // Ersetzt den frueheren Dekompressions-Cap-Test: die Bomben-Abwehr sitzt jetzt
    // auf Zeichen/Seiten/Laufzeit statt auf Inflate-Groessen.
    const text = await extractTextFromPdfBuffer(
      readFileSync(join(FIXTURES, "meyton-qt-identity-h.pdf"))
    )

    expect(text.length).toBeLessThan(MAX_EXTRACTED_TEXT_CHARS)
  })
})
