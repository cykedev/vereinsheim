import { describe, expect, it } from "vitest"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import { extractPdfText, occurrences, pageCount } from "./pdfTestUtils"
import { PlayoffsPdf, type PlayoffsPdfProps } from "@/lib/pdf/PlayoffsPdf"
import type { PlayoffMatchItem } from "@/lib/playoffs/types"
import { splitDisplayUrl, URL_LINE_MAX_CHARS } from "@/lib/pdf/HeaderMeta"

function mkMatch(i: number): PlayoffMatchItem {
  return {
    id: `af-${i}`,
    round: "EIGHTH_FINAL",
    participantA: { id: `a${i}`, firstName: "Anna", lastName: `Huber-${i}` },
    participantB: { id: `b${i}`, firstName: "Bert", lastName: `Schmidt-${i}` },
    winsA: 0,
    winsB: 0,
    status: "PENDING",
    duels: [],
    canCorrect: false,
  }
}

/** A decided match: A wins 3 duels — fills the detail pages with result rows. */
function playedMatch(round: PlayoffMatchItem["round"], i: number): PlayoffMatchItem {
  const duels = [1, 2, 3].map((duelNumber) => ({
    id: `${round}-${i}-d${duelNumber}`,
    duelNumber,
    isSuddenDeath: false,
    isCompleted: true,
    resultA: { totalRings: 96, teiler: 120.5, ringteiler: 124.5 },
    resultB: { totalRings: 94, teiler: 230.1, ringteiler: 236.1 },
    winnerId: `a${i}`,
  }))
  return { ...mkMatch(i), id: `${round}-${i}`, round, winsA: 3, status: "COMPLETED", duels }
}

describe("PlayoffsPdf — header with QR code", () => {
  // The 16-player bracket (Achtelfinale) is the tallest one and fills the landscape page almost
  // completely. A taller header must not push it onto a page of its own.
  const baseProps: PlayoffsPdfProps = {
    leagueName: "Kreisliga",
    disciplineName: "Luftgewehr",
    scoringType: "WHOLE",
    bracket: {
      competitionId: "c1",
      eighthFinals: Array.from({ length: 8 }, (_, i) => mkMatch(i)),
      quarterFinals: [],
      semiFinals: [],
      final: null,
    },
    generatedAt: new Date("2026-10-03T10:00:00.000Z"),
    displayTimeZone: "Europe/Berlin",
  }

  function render(props: PlayoffsPdfProps) {
    return renderToBuffer(createElement(PlayoffsPdf, props) as ReactElement<DocumentProps>)
  }

  it("keeps the page count of a 16-player bracket when the QR code is shown", async () => {
    const displayUrl = "https://ringwerk.schuetzenverein-example.de/api/public/c/kreisliga-2026/pdf"
    const withoutQr = pageCount(await render(baseProps))
    const withQr = pageCount(
      await render({ ...baseProps, publicLink: { displayUrl, qrUrl: displayUrl } })
    )
    expect(withQr).toBe(withoutQr)
  })

  it("repeats the header with the public link on every page, detail pages included", async () => {
    // Printouts are hung up page by page. A fully played bracket overflows the detail page, so
    // only a repeated (fixed) header puts title, date and QR code on the overflow pages too.
    const displayUrl = "https://ringwerk.example.org/api/public/c/kreisliga-2026/pdf"
    const buffer = await render({
      ...baseProps,
      bracket: {
        competitionId: "c1",
        eighthFinals: Array.from({ length: 8 }, (_, i) => playedMatch("EIGHTH_FINAL", i)),
        quarterFinals: Array.from({ length: 4 }, (_, i) => playedMatch("QUARTER_FINAL", i)),
        semiFinals: Array.from({ length: 2 }, (_, i) => playedMatch("SEMI_FINAL", i)),
        final: playedMatch("FINAL", 0),
      },
      publicLink: { displayUrl, qrUrl: displayUrl },
    })
    const pages = pageCount(buffer)
    const text = extractPdfText(buffer)
    // more pages than <Page> elements (2) — otherwise the test could not see a missing `fixed`
    expect(pages).toBeGreaterThanOrEqual(3)
    expect(occurrences(text, "Erstellt:")).toBe(pages)
    expect(occurrences(text, "api/public/c/kreisliga-2026/pdf")).toBe(pages)
  })
})

describe("splitDisplayUrl", () => {
  it("splits origin and path into separate lines", () => {
    expect(splitDisplayUrl("https://ringwerk.example.org/api/public/c/liga/pdf")).toEqual([
      "https://ringwerk.example.org",
      "/api/public/c/liga/pdf",
    ])
  })

  it("breaks a long slug after a separator and keeps every line within the limit", () => {
    const slug = "kreismeisterschaft-luftgewehr-auflage-senioren-2026-final"
    const url = `https://ringwerk.schuetzenverein-example.de/api/public/c/${slug}/pdf`
    const lines = splitDisplayUrl(url)
    expect(lines.join("")).toBe(url)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(URL_LINE_MAX_CHARS)
    // the path lines break after a separator, never inside a word
    const pathLines = lines.slice(
      lines.findIndex((l) => l.startsWith("/api/")),
      -1
    )
    for (const line of pathLines) expect(line).toMatch(/[/.-]$/)
  })

  it("cuts hard when a line has no separator", () => {
    const lines = splitDisplayUrl(`https://${"a".repeat(50)}`)
    expect(lines.join("")).toBe(`https://${"a".repeat(50)}`)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(URL_LINE_MAX_CHARS)
  })
})
