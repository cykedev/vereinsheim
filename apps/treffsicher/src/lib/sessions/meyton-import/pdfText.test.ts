import { describe, expect, it } from "vitest"
import { extractTextFromPdfBuffer } from "@/lib/sessions/meyton-import/pdfText"
import { MAX_TEXT_ITEMS } from "@/lib/sessions/meyton-import/constants"

import {
  buildTestPdf,
  buildTextBombPdf,
} from "@/lib/sessions/meyton-import/__fixtures__/buildTestPdf"

describe("extractTextFromPdfBuffer", () => {
  it("wirft bei kaputter PDF-Struktur", async () => {
    await expect(
      extractTextFromPdfBuffer(Buffer.from("%PDF-1.4\nkein echtes PDF\n%%EOF", "latin1"))
    ).rejects.toThrow()
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
    // Eine gekuerzte Einheit saehe in der Vorschau plausibel aus und wuerde
    // uebernommen — deshalb Abbruch.
    const bomb = buildTextBombPdf(MAX_TEXT_ITEMS + 5_000)

    await expect(extractTextFromPdfBuffer(bomb)).rejects.toThrow("zu viel Text")
  }, 60_000)

  it("greift, bevor der Speicher volllaeuft", async () => {
    // Der Cap muss *waehrend* des Parsens ziehen, nicht danach: getTextContent()
    // materialisiert die ganze Seite (gemessen 3,2-MB-PDF → 665 MB RSS).
    const bomb = buildTextBombPdf(MAX_TEXT_ITEMS * 4)
    const before = process.memoryUsage().heapUsed

    await expect(extractTextFromPdfBuffer(bomb)).rejects.toThrow("zu viel Text")

    const grownMB = (process.memoryUsage().heapUsed - before) / 1024 / 1024
    expect(grownMB).toBeLessThan(150)
  }, 120_000)
})
