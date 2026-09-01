import { deflateSync } from "node:zlib"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { extractTextFromPdfBuffer } from "@/lib/sessions/meyton-import/pdfText"
import { MAX_EXTRACTED_TEXT_CHARS, MAX_TEXT_ITEMS } from "@/lib/sessions/meyton-import/constants"

const FIXTURES = join(__dirname, "__fixtures__")

/**
 * Baut ein gueltiges PDF, dessen Inhaltsstrom sehr viele einzeln positionierte
 * Textitems erzeugt. Zur Laufzeit gebaut statt als Fixture eingecheckt: die
 * Datei waere mehrere MB gross und ihr einziger Zweck ist dieser eine Test.
 */
function buildTextBombPdf(itemCount: number): Buffer {
  const ops = [Buffer.from("BT /F1 8 Tf\n", "latin1")]
  for (let i = 0; i < itemCount; i++) {
    const x = 10 + (i % 500) * 1.1
    const y = 800 - (Math.floor(i / 500) % 700) * 1.1
    ops.push(Buffer.from(`1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (x) Tj\n`, "latin1"))
  }
  ops.push(Buffer.from("ET\n", "latin1"))
  const compressed = deflateSync(Buffer.concat(ops))

  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
    null, // Stream-Objekt, unten separat zusammengesetzt
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ]

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n", "latin1")]
  const offsets: number[] = []
  let position = chunks[0].length

  objects.forEach((body, index) => {
    const number = index + 1
    const parts =
      body === null
        ? [
            Buffer.from(
              `${number} 0 obj\n<</Length ${compressed.length}/Filter/FlateDecode>>\nstream\n`,
              "latin1"
            ),
            compressed,
            Buffer.from("\nendstream\nendobj\n", "latin1"),
          ]
        : [Buffer.from(`${number} 0 obj\n${body}\nendobj\n`, "latin1")]

    offsets.push(position)
    for (const part of parts) {
      chunks.push(part)
      position += part.length
    }
  })

  const xrefOffset = position
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) xref += `${String(offset).padStart(10, "0")} 00000 n \n`
  xref += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF\n`
  chunks.push(Buffer.from(xref, "latin1"))

  return Buffer.concat(chunks)
}

describe("extractTextFromPdfBuffer", () => {
  it("liest das Qt/Identity-H-Format (Hex-Glyph-IDs)", async () => {
    const text = await extractTextFromPdfBuffer(
      readFileSync(join(FIXTURES, "meyton-qt-identity-h.pdf"))
    )

    expect(text).toContain("Serie 1: 96.3 (92)")
    expect(text).toContain("10.0 10.0 8.5 10.2 9.7")
    expect(text).toContain("Trefferlage: 2.47 mm links, 2.11 mm hoch")
  })

  it("liest das Ghostscript/Type1-Format (Literal-Strings)", async () => {
    const text = await extractTextFromPdfBuffer(
      readFileSync(join(FIXTURES, "meyton-ghostscript-type1.pdf"))
    )

    expect(text).toContain("Serie 1: 90 (95.6)")
    expect(text).toContain("8.7 9.8 9.7 9.4 9.4")
  })

  it("haelt die Scheiben-Grafik aus den Schusszeilen heraus", async () => {
    const text = await extractTextFromPdfBuffer(
      readFileSync(join(FIXTURES, "meyton-qt-identity-h.pdf"))
    )

    // Die Grafik-Nummern liegen auf derselben Zeilenhoehe wie die Schusswerte.
    // Ohne Spaltenschnitt stuenden sie mit in diesen Zeilen.
    const shotLines = text.split("\n").filter((line) => line.startsWith("10.0 10.0"))
    expect(shotLines).toEqual(["10.0 10.0 8.5 10.2 9.7"])
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
