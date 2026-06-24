import { describe, expect, it } from "vitest"
import { inflateSync } from "node:zlib"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import { BestOfSchedulePdf, type BestOfSchedulePdfProps } from "@/lib/pdf/BestOfSchedulePdf"
import type { BestOfStandingRow } from "@/lib/standings/queries"

/**
 * Extract readable text from a PDF buffer.
 * Decompresses FlateDecode streams and decodes hex-encoded text in TJ operators.
 */
function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString("binary")
  const parts: string[] = [raw]

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match: RegExpExecArray | null
  while ((match = streamRegex.exec(raw)) !== null) {
    try {
      const streamBytes = Buffer.from(match[1], "binary")
      const decompressed = inflateSync(streamBytes).toString("latin1")
      const decoded = decompressed.replace(/\[([^\]]*)\] TJ/g, (_m, content: string) => {
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

/** Build a standings row; only the fields the PDF reads matter. */
function mkRow(
  over: Partial<BestOfStandingRow> & Pick<BestOfStandingRow, "participantId">
): BestOfStandingRow {
  return {
    firstName: "F",
    lastName: "L",
    withdrawn: false,
    played: 3,
    wins: 2,
    losses: 1,
    duelsWon: 5,
    duelsLost: 4,
    duelDiff: 1,
    bestRingteiler: null,
    bestRings: null,
    directComparison: null,
    rank: 1,
    ...over,
  }
}

describe("BestOfSchedulePdf — Direktvergleich column", () => {
  const baseProps: BestOfSchedulePdfProps = {
    leagueName: "Bezirksliga 2026",
    disciplineName: "Luftgewehr",
    scoringMode: "RINGTEILER",
    disciplineId: "disc-1",
    groupBestOf: 3,
    groupPlayAllDuels: true,
    groupTiebreaker1: null,
    groupTiebreaker2: null,
    matchups: [],
    generatedAt: new Date("2026-06-24T10:00:00.000Z"),
    standings: [
      mkRow({
        participantId: "A",
        firstName: "Anna",
        lastName: "Huber",
        rank: 1,
        directComparison: { kind: "decided", result: "win", satz: [2, 1], opponent: "Schmidt" },
      }),
      mkRow({
        participantId: "B",
        firstName: "Bert",
        lastName: "Schmidt",
        rank: 2,
        directComparison: { kind: "decided", result: "loss", satz: [1, 2], opponent: "Huber" },
      }),
    ],
  }

  function render(props: BestOfSchedulePdfProps) {
    return renderToBuffer(createElement(BestOfSchedulePdf, props) as ReactElement<DocumentProps>)
  }

  it("renders the Direktvergleich header and the decided head-to-head result", async () => {
    const text = extractPdfText(await render(baseProps))
    expect(text).toContain("Tabelle")
    expect(text).toContain("Direktvergleich")
    // Winner row shows its satz from its own perspective + opponent; loser the mirror.
    expect(text).toContain("2:1")
    expect(text).toContain("1:2")
    expect(text).toContain("Huber")
    expect(text).toContain("Schmidt")
  })

  it("renders the open annotation when the direct match is not played", async () => {
    const text = extractPdfText(
      await render({
        ...baseProps,
        standings: [
          mkRow({
            participantId: "A",
            lastName: "Huber",
            rank: 1,
            directComparison: { kind: "open", opponent: "Schmidt" },
          }),
          mkRow({
            participantId: "B",
            lastName: "Schmidt",
            rank: 2,
            directComparison: { kind: "open", opponent: "Huber" },
          }),
        ],
      })
    )
    expect(text).toContain("Direktvergleich")
    expect(text).toContain("offen")
  })
})
