import { describe, expect, it } from "vitest"
import { inflateSync } from "node:zlib"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import { SchedulePdf, type SchedulePdfProps } from "@/lib/pdf/SchedulePdf"

// Wie in EventStarterListPdf.test.tsx: FlateDecode-Streams entpacken und
// Hex-Text aus TJ-Arrays dekodieren.
function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString("binary")
  const parts: string[] = [raw]
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match: RegExpExecArray | null
  while ((match = streamRegex.exec(raw)) !== null) {
    try {
      const decompressed = inflateSync(Buffer.from(match[1], "binary")).toString("latin1")
      parts.push(
        decompressed.replace(/\[([^\]]*)\] TJ/g, (_m, content: string) => {
          const texts: string[] = []
          const hexRegex = /<([0-9a-fA-F]+)>/g
          let hexMatch: RegExpExecArray | null
          while ((hexMatch = hexRegex.exec(content)) !== null) {
            texts.push(Buffer.from(hexMatch[1], "hex").toString("latin1"))
          }
          return texts.join("") + " "
        })
      )
    } catch {
      // nicht komprimiert
    }
  }
  return parts.join("\n")
}

describe("SchedulePdf — Abgabefristen", () => {
  // Mitternacht Europe/Berlin am 16.06. ist 22:00 UTC am 15.06. Ohne
  // uebergebene Zeitzone formatierte der Renderer in der Zone des Containers
  // (UTC) und druckte den Vortag auf den Spielplan.
  const berlinMidnight = new Date("2026-06-15T22:00:00.000Z")

  const baseProps: SchedulePdfProps = {
    leagueName: "Bezirksliga 2026",
    disciplineName: "Luftgewehr",
    scoringType: "WHOLE",
    standings: [],
    matchups: [
      {
        id: "m1",
        round: "FIRST_LEG",
        status: "OPEN",
        homeParticipant: { id: "p1", firstName: "Anna", lastName: "Schuetz" },
        awayParticipant: { id: "p2", firstName: "Bert", lastName: "Mueller" },
        results: [],
      },
    ] as unknown as SchedulePdfProps["matchups"],
    firstLegDeadline: berlinMidnight,
    secondLegDeadline: null,
    generatedAt: new Date("2026-05-24T10:00:00.000Z"),
    displayTimeZone: "Europe/Berlin",
  }

  function render(props: SchedulePdfProps) {
    return renderToBuffer(createElement(SchedulePdf, props) as ReactElement<DocumentProps>)
  }

  it("druckt die Frist in der uebergebenen Zeitzone", async () => {
    const text = extractPdfText(await render(baseProps))
    expect(text).toContain("16.06.2026")
    expect(text).not.toContain("15.06.2026")
  })

  it("druckt dieselbe Frist in UTC einen Tag frueher", async () => {
    const text = extractPdfText(await render({ ...baseProps, displayTimeZone: "UTC" }))
    expect(text).toContain("15.06.2026")
  })
})
