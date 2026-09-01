import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { extractTextFromPdfBuffer } from "@/lib/sessions/meyton-import/pdfText"
import { MAX_EXTRACTED_TEXT_CHARS, MAX_TEXT_ITEMS } from "@/lib/sessions/meyton-import/constants"

import {
  buildTestPdf,
  buildTextBombPdf,
} from "@/lib/sessions/meyton-import/__fixtures__/buildTestPdf"

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

  it("bleibt bei echten PDFs deutlich unter den Grenzen", async () => {
    const text = await extractTextFromPdfBuffer(
      readFileSync(join(FIXTURES, "meyton-qt-identity-h.pdf"))
    )

    expect(text.length).toBeLessThan(MAX_EXTRACTED_TEXT_CHARS)
  })

  it("haelt Serien zweier Seiten mit identischen y-Werten auseinander", async () => {
    // y-Koordinaten sind seitenlokal und wiederholen sich im Meyton-Template auf
    // jeder Seite exakt. Bewusst durch echtes pdf.js statt nur ueber die
    // Layout-Funktion: der Seitenbezug muss die Extraktion ueberleben.
    const pdf = buildTestPdf([
      [
        { str: "Serie 1:", x: 154, y: 584 },
        { str: "10.0 9.7", x: 199, y: 572 },
      ],
      [
        { str: "Serie 2:", x: 154, y: 584 },
        { str: "5.1 5.2", x: 199, y: 572 },
      ],
    ])

    const text = await extractTextFromPdfBuffer(pdf)

    expect(text.split("\n")).toEqual(["Serie 1:", "10.0 9.7", "Serie 2:", "5.1 5.2"])
  })

  it("bricht bei zu vielen Textitems ab statt still zu kuerzen", async () => {
    // Ersetzt den frueheren Dekompressions-Cap-Test. Eine gekuerzte Einheit saehe
    // in der Vorschau plausibel aus und wuerde uebernommen — deshalb Abbruch.
    const bomb = buildTextBombPdf(MAX_TEXT_ITEMS + 5_000)

    await expect(extractTextFromPdfBuffer(bomb)).rejects.toThrow("zu viel Text")
  }, 60_000)

  it("greift, bevor der Speicher volllaeuft", async () => {
    // Der Cap muss *waehrend* des Parsens ziehen, nicht danach: getTextContent()
    // materialisierte frueher die ganze Seite (gemessen 3,2-MB-PDF → 665 MB RSS).
    const bomb = buildTextBombPdf(MAX_TEXT_ITEMS * 4)
    const before = process.memoryUsage().heapUsed

    await expect(extractTextFromPdfBuffer(bomb)).rejects.toThrow("zu viel Text")

    const grownMB = (process.memoryUsage().heapUsed - before) / 1024 / 1024
    expect(grownMB).toBeLessThan(150)
  }, 120_000)
})
