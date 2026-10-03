import { describe, expect, it } from "vitest"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import {
  extractPdfText,
  manyMatchups,
  occurrences,
  pageCount,
  TEST_PUBLIC_LINK,
} from "./pdfTestUtils"
import { BestOfSchedulePdf, type BestOfSchedulePdfProps } from "@/lib/pdf/BestOfSchedulePdf"
import type { BestOfStandingRow } from "@/lib/standings/queries"

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
    displayTimeZone: "Europe/Berlin",
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

  it("prints the public URL but never the access token when a public link is given", async () => {
    const token = "0b6f0f8e-4d3a-4c5b-9a1e-2f7d8c9b0a12"
    const displayUrl = "https://ringwerk.example.org/api/public/c/liga-2026/pdf"
    const text = extractPdfText(
      await render({ ...baseProps, publicLink: { displayUrl, qrUrl: `${displayUrl}?k=${token}` } })
    )
    // printed in two lines (see splitDisplayUrl); react-pdf emits the leading "/" as its own run
    expect(text).toContain("https://ringwerk.example.org")
    expect(text).toContain("api/public/c/liga-2026/pdf")
    expect(text).not.toContain(token)
  })

  it("prints no public URL without a public link", async () => {
    const text = extractPdfText(await render(baseProps))
    expect(text).not.toContain("/api/public/c/")
  })
})

describe("header on every page", () => {
  // Printouts are hung up page by page — every page needs title, date, QR code and URL.
  it("repeats the header with the public link on every page", async () => {
    const buffer = await renderToBuffer(
      createElement(BestOfSchedulePdf, {
        leagueName: "Bezirksliga 2026",
        disciplineName: "Luftgewehr",
        displayTimeZone: "Europe/Berlin",
        scoringMode: "RINGTEILER",
        disciplineId: "disc-1",
        groupBestOf: 3,
        groupPlayAllDuels: true,
        groupTiebreaker1: null,
        groupTiebreaker2: null,
        standings: [],
        matchups: manyMatchups("FIRST_LEG") as unknown as BestOfSchedulePdfProps["matchups"],
        generatedAt: new Date("2026-10-03T10:00:00.000Z"),
        publicLink: TEST_PUBLIC_LINK,
      }) as ReactElement<DocumentProps>
    )
    const pages = pageCount(buffer)
    const text = extractPdfText(buffer)
    expect(pages).toBeGreaterThanOrEqual(2)
    expect(occurrences(text, "Erstellt:")).toBe(pages)
    expect(occurrences(text, "api/public/c/liga-2026/pdf")).toBe(pages)
  })
})
