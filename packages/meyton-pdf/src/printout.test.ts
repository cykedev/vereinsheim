import { describe, expect, it } from "vitest"

import { buildPdf, type TestText } from "./__fixtures__/buildPdf"
import { MeytonPdfError, readPrintout } from "./printout"

// Erfundene Ausdrucke ohne Namen, nach dem Muster des Ausdrucks vom 2. Oktober 2026.
const QT_INFO = {
  CreationDate: "D:20261002195212+02'00'",
  Producer: "Qt 5.12.8",
  Creator: "Meyton Elektronik GmbH",
}

const footer = (id: string, page: number): TestText[] => [
  { str: "initialisiert 19:21 gedruckt 19:52", x: 57, y: 26 },
  { str: `ID: ${id} - Seite: ${page}`, x: 258, y: 26 },
  { str: "(C) Meyton Elektronik GmbH 2026", x: 416, y: 26 },
]

const header: TestText[] = [
  { str: "LP 40 alt", x: 57, y: 782 },
  { str: "StandNr: 8", x: 57, y: 766 },
  { str: "Wertung 02.10.2026 19:51", x: 280, y: 766 },
  { str: "Schütze A", x: 57, y: 750 },
  { str: "Serie 1: 10,5 10,5 10,3 7,6 6,7 6,2", x: 153, y: 700 },
]

const card = (id: string, page = 1): TestText[] => [...header, ...footer(id, page)]

describe("readPrintout: die zwei Druckwege", () => {
  it("Qt: Identity-H, ein Glyph je Tj, Info-Dict wie beim Ausdruck", async () => {
    const pdf = await buildPdf({ pages: [card("ff914420")], font: "identity-h", info: QT_INFO })
    expect(await readPrintout(pdf)).toEqual({
      pages: 1,
      id: { kind: "found", hex: "ff914420", value: -7257056, pages: [1] },
      createdAt: {
        local: "2026-10-02T19:52:12",
        offsetMinutes: 120,
        epochMs: 1790963532000,
        source: "info",
      },
      producer: "Qt 5.12.8",
      creator: "Meyton Elektronik GmbH",
    })
  })

  it("Ghostscript: Type1 mit Literal-Strings, Info und XMP", async () => {
    const pdf = await buildPdf({
      pages: [card("ed850812")],
      font: "type1",
      info: { CreationDate: "D:20260811182954+02'00'", Producer: "GPL Ghostscript 9.55.0" },
      xmpCreateDate: "2026-08-11T18:29:54+02:00",
    })
    const printout = await readPrintout(pdf)
    expect(printout.id).toMatchObject({ kind: "found", hex: "ed850812", value: -310048750 })
    expect(printout.createdAt).toMatchObject({ epochMs: 1786465794000, source: "info" })
    expect(printout.creator).toBeNull()
  })

  it("ohne Info-Datum gilt xmp:CreateDate", async () => {
    const pdf = await buildPdf({
      pages: [card("ed850812")],
      info: { Producer: "GPL Ghostscript 9.55.0" },
      xmpCreateDate: "2026-08-11T18:29:54+02:00",
    })
    expect((await readPrintout(pdf)).createdAt).toEqual({
      local: "2026-08-11T18:29:54",
      offsetMinutes: 120,
      epochMs: 1786465794000,
      source: "xmp",
    })
  })
})

describe("readPrintout: unabhängig vom Layout (SF-46)", () => {
  it("anderes Layout: Fuß oben, größere Schrift, ähnliche Muster daneben", async () => {
    const pdf = await buildPdf({
      pages: [
        [
          { str: "Ausdruck-ID: 46a13c20", x: 400, y: 810, size: 14 },
          { str: "DisziplinID: 19210040", x: 40, y: 810, size: 14 },
          { str: "Ergebnis 352 (371,4)", x: 40, y: 400, size: 20 },
          { str: "Seite 1 von 1", x: 40, y: 20, size: 6 },
        ],
      ],
      font: "identity-h",
      info: QT_INFO,
    })
    expect((await readPrintout(pdf)).id).toEqual({
      kind: "found",
      hex: "46a13c20",
      value: 1184971808,
      pages: [1],
    })
  })

  it("einzeln gesetzte Glyphen mit Lücken", async () => {
    const pdf = await buildPdf({
      pages: [card("ff914420")],
      font: "identity-h",
      glyphAdvance: 1.2,
      info: QT_INFO,
    })
    expect((await readPrintout(pdf)).id).toMatchObject({ kind: "found", hex: "ff914420" })
  })

  it("Probe-Ausdruck mit ID im Fuß", async () => {
    const pdf = await buildPdf({
      pages: [
        [
          { str: "LP 40 alt", x: 57, y: 782 },
          { str: "Probe 02.10.2026 19:30", x: 280, y: 766 },
          { str: "Probe: 9,8 10,1 8,7 10,4 9,9", x: 153, y: 700 },
          ...footer("ff914420", 1),
        ],
      ],
      info: QT_INFO,
    })
    expect((await readPrintout(pdf)).id).toMatchObject({ kind: "found", hex: "ff914420" })
  })
})

describe("readPrintout: mehrseitig (SF-44)", () => {
  it("ID auf allen Seiten", async () => {
    const pdf = await buildPdf({
      pages: [card("ff914420", 1), footer("ff914420", 2), footer("ff914420", 3)],
      font: "identity-h",
      info: QT_INFO,
    })
    const printout = await readPrintout(pdf)
    expect(printout.pages).toBe(3)
    expect(printout.id).toMatchObject({ kind: "found", pages: [1, 2, 3] })
  })

  it("ID nur auf der letzten Seite", async () => {
    const pdf = await buildPdf({ pages: [header, header, footer("ff914420", 3)], info: QT_INFO })
    expect((await readPrintout(pdf)).id).toMatchObject({ kind: "found", pages: [3] })
  })

  it("zwei verschiedene IDs: Widerspruch statt Raten", async () => {
    const pdf = await buildPdf({
      pages: [card("ff914420", 1), footer("46a13c20", 2)],
      info: QT_INFO,
    })
    expect((await readPrintout(pdf)).id).toEqual({
      kind: "conflict",
      hexes: ["46a13c20", "ff914420"],
    })
  })
})

describe("readPrintout: fehlende Angaben sind kein Fehler", () => {
  it("ohne ID: missing, die Zeit bleibt", async () => {
    const printout = await readPrintout(await buildPdf({ pages: [header], info: QT_INFO }))
    expect(printout.id).toEqual({ kind: "missing" })
    expect(printout.createdAt?.epochMs).toBe(1790963532000)
  })

  it("ohne Metadaten: keine Zeit, kein Druckweg, die ID bleibt", async () => {
    const printout = await readPrintout(await buildPdf({ pages: [card("ff914420")], info: null }))
    expect(printout.createdAt).toBeNull()
    expect(printout.producer).toBeNull()
    expect(printout.creator).toBeNull()
    expect(printout.id).toMatchObject({ kind: "found", hex: "ff914420" })
  })

  it("Datum ohne Zeitzone: kein absoluter Zeitpunkt", async () => {
    const pdf = await buildPdf({
      pages: [card("ff914420")],
      info: { CreationDate: "D:20261002195212" },
    })
    expect((await readPrintout(pdf)).createdAt).toEqual({
      local: "2026-10-02T19:52:12",
      offsetMinutes: null,
      epochMs: null,
      source: "info",
    })
  })
})

describe("readPrintout: Grenzen (SF-48)", () => {
  it("zu groß: abgelehnt, bevor pdf.js liest", async () => {
    const big = new Uint8Array(1024 * 1024 + 1)
    big.set(new TextEncoder().encode("%PDF-1.4\n"))
    await expect(readPrintout(big)).rejects.toThrow(/größer als 1 MB/)
  })

  it("kein PDF", async () => {
    await expect(readPrintout(new TextEncoder().encode("Hallo"))).rejects.toThrow(/keine PDF-Datei/)
  })

  it("zu viele Seiten", async () => {
    const pages = Array.from({ length: 11 }, (_, i) => footer("ff914420", i + 1))
    await expect(readPrintout(await buildPdf({ pages, info: QT_INFO }))).rejects.toThrow(
      /mehr als 10 Seiten/
    )
  })

  it("zu viel Text", async () => {
    const lines = Array.from({ length: 60 }, (_, i) => ({
      str: `Zeile ${i}`,
      x: 40,
      y: 800 - i * 12,
    }))
    const pdf = await buildPdf({ pages: [lines], info: QT_INFO })
    await expect(readPrintout(pdf, { limits: { maxTextItems: 50 } })).rejects.toThrow(
      /zu viel Text/
    )
  })

  it("Zeitüberschreitung", async () => {
    let clock = 0
    const pdf = await buildPdf({ pages: [card("ff914420")], info: QT_INFO })
    await expect(readPrintout(pdf, { now: () => (clock += 10_000) })).rejects.toThrow(
      /Zeitüberschreitung/
    )
  })

  it("zu viele Zeichen", async () => {
    const pdf = await buildPdf({ pages: [[{ str: "x".repeat(60), x: 40, y: 400 }]], info: QT_INFO })
    await expect(readPrintout(pdf, { limits: { maxChars: 20 } })).rejects.toThrow(/zu viel Text/)
  })

  it("Zeitüberschreitung auch mitten im Lesen der Seiten", async () => {
    // Jede Abfrage der Uhr kostet eine Sekunde: Laden und Metadaten bleiben unter 5 s, erst das
    // Lesen der Seiten reißt die Grenze.
    let clock = -1000
    const pages = Array.from({ length: 4 }, (_, i) => footer("ff914420", i + 1))
    const pdf = await buildPdf({ pages, info: QT_INFO })
    await expect(readPrintout(pdf, { now: () => (clock += 1000) })).rejects.toThrow(
      /Zeitüberschreitung/
    )
  })

  it("beschädigt: sauberer Fehler statt pdf.js-Interna", async () => {
    const broken = new TextEncoder().encode("%PDF-1.4\n" + "Datenmüll ".repeat(200))
    const error = await readPrintout(broken).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(MeytonPdfError)
    expect((error as Error).message).toMatch(/beschädigt oder nicht lesbar/)
  })

  it("der übergebene Puffer bleibt unverändert", async () => {
    const pdf = await buildPdf({ pages: [card("ff914420")], info: QT_INFO })
    const before = pdf.slice()
    await readPrintout(pdf)
    expect(pdf).toEqual(before)
  })
})
