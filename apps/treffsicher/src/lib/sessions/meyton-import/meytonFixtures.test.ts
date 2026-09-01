import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  extractMeytonDateTime,
  extractMeytonHitLocation,
  extractTextFromPdfBuffer,
  parseMeytonSeriesFromText,
} from "@/lib/sessions/meytonImport"

const FIXTURES = join(__dirname, "__fixtures__")

/**
 * Regressionsschutz ueber die volle Extraktions- und Parse-Kette, je einmal pro
 * Meyton-Druckpfad. Die synthetisch gebauten PDFs der frueheren Tests konnten
 * einen Formatwechsel der echten Quelle strukturell nicht bemerken.
 */
describe("Meyton-Import ueber beide PDF-Formate", () => {
  it("Qt/Identity-H: Serien, Datum und Trefferlage", async () => {
    const text = await extractTextFromPdfBuffer(
      readFileSync(join(FIXTURES, "meyton-qt-identity-h.pdf"))
    )

    expect(parseMeytonSeriesFromText(text)).toEqual({
      serien: [
        { nr: 1, shots: [10, 10, 8.5, 10.2, 9.7, 9.7, 9.9, 8.9, 9.3, 10.1] },
        { nr: 2, shots: [9.4, 10.4, 10.1, 10.1, 10, 8.8, 9.4, 9.1, 10, 9.3] },
        { nr: 3, shots: [10.1, 9.7, 8.4, 9.6, 10.3, 9.8, 8.8, 10.5, 9.1, 9.4] },
        { nr: 4, shots: [10.1, 9.9, 10.6, 10.1, 10.4, 10.3, 9.8, 8.9, 10, 9.8] },
      ],
    })
    expect(extractMeytonDateTime(text)).toBe("2026-08-28T18:09")
    expect(extractMeytonHitLocation(text)).toEqual({
      horizontalMm: 2.47,
      horizontalDirection: "LEFT",
      verticalMm: 2.11,
      verticalDirection: "HIGH",
    })
  })

  it("Ghostscript/Type1: unveraendert gegenueber dem alten Extractor", async () => {
    const text = await extractTextFromPdfBuffer(
      readFileSync(join(FIXTURES, "meyton-ghostscript-type1.pdf"))
    )

    // Diese Werte sind woertlich die Ausgabe des frueheren Eigenbau-Extractors —
    // der Test belegt, dass die Umstellung am alten Format nichts veraendert.
    expect(parseMeytonSeriesFromText(text)).toEqual({
      serien: [
        { nr: 1, shots: [8.7, 9.8, 9.7, 9.4, 9.4, 10.8, 9.3, 9.4, 8.3, 10.8] },
        { nr: 2, shots: [7.1, 7.6, 10.5, 10.4, 8.9, 8.8, 8, 8.4, 10.6, 9.6] },
        { nr: 3, shots: [9.2, 10.2, 9.4, 10.3, 9.2, 7.5, 9.8, 10.4, 6.6, 10.5] },
        { nr: 4, shots: [6.7, 7.5, 7.3, 10.4, 9.3, 9, 9.6, 8.6, 9.6, 9.7] },
      ],
    })
    // Das Alt-PDF traegt keinen Zeitstempel.
    expect(extractMeytonDateTime(text)).toBeNull()
    expect(extractMeytonHitLocation(text)).toEqual({
      horizontalMm: 1.39,
      horizontalDirection: "LEFT",
      verticalMm: 2.44,
      verticalDirection: "HIGH",
    })
  })
})
