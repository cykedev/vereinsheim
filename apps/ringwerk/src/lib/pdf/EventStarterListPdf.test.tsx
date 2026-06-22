import { describe, expect, it } from "vitest"
import { inflateSync } from "node:zlib"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import { EventStarterListPdf, type EventStarterListPdfProps } from "@/lib/pdf/EventStarterListPdf"

/**
 * Extract readable text from a PDF buffer.
 * Decompresses FlateDecode streams and decodes hex-encoded text in TJ operators.
 * Numeric kerning adjustments between hex strings are stripped, but text-origin
 * numbers (like "2026") that came from <hex> are preserved.
 */
function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString("binary")
  const parts: string[] = [raw] // include raw for uncompressed metadata

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match: RegExpExecArray | null
  while ((match = streamRegex.exec(raw)) !== null) {
    try {
      const streamBytes = Buffer.from(match[1], "binary")
      const decompressed = inflateSync(streamBytes).toString("latin1")

      // Process TJ arrays: extract and decode only hex strings, skip kerning numbers
      // TJ array format: [ <hex1> num <hex2> num ... ] TJ
      const decoded = decompressed.replace(/\[([^\]]*)\] TJ/g, (_m, content: string) => {
        // Extract only hex substrings (<...>) from TJ arrays
        const texts: string[] = []
        const hexRegex = /<([0-9a-fA-F]+)>/g
        let hexMatch: RegExpExecArray | null
        while ((hexMatch = hexRegex.exec(content)) !== null) {
          try {
            texts.push(Buffer.from(hexMatch[1], "hex").toString("latin1"))
          } catch {
            // skip
          }
        }
        return texts.join("") + " "
      })
      parts.push(decoded)
    } catch {
      // not a compressed stream — skip
    }
  }
  return parts.join("\n")
}

describe("EventStarterListPdf", () => {
  const baseProps = {
    competitionName: "Kranzlschiessen 2026",
    eventDate: new Date("2026-06-15T08:00:00.000Z"),
    participants: [
      { nr: 1, firstName: "Anna", lastName: "Schuetz", disciplineName: "Luftpistole" },
      { nr: 2, firstName: "Bert", lastName: "Mueller", disciplineName: "Luftgewehr" },
    ],
    generatedAt: new Date("2026-05-24T10:00:00.000Z"),
  }

  function render(props: EventStarterListPdfProps) {
    return renderToBuffer(createElement(EventStarterListPdf, props) as ReactElement<DocumentProps>)
  }

  it("renders with participants", async () => {
    const buffer = await render(baseProps)
    const text = extractPdfText(buffer)
    expect(text).toContain("Starterliste")
    expect(text).toContain("Kranzlschiessen 2026")
    expect(text).toContain("Schuetz")
    expect(text).toContain("Anna")
    expect(text).toContain("Mueller")
    expect(text).toContain("Bert")
    expect(text).toContain("Luftpistole")
    expect(text).toContain("Luftgewehr")
  })

  it("renders without participants (blank list)", async () => {
    const buffer = await render({ ...baseProps, participants: [] })
    const text = extractPdfText(buffer)
    expect(text).toContain("Starterliste")
    expect(text).toContain("Kranzlschiessen 2026")
  })

  it("omits date segment from subtitle when eventDate is null", async () => {
    const textWithDate = extractPdfText(await render(baseProps))
    const textWithoutDate = extractPdfText(await render({ ...baseProps, eventDate: null }))

    // Both contain competition name
    expect(textWithoutDate).toContain("Kranzlschiessen 2026")
    // With date: subtitle contains the event date
    expect(textWithDate).toContain("15.06.2026")
    // Without date: subtitle does NOT contain the event date
    expect(textWithoutDate).not.toContain("15.06.2026")
  })
})
