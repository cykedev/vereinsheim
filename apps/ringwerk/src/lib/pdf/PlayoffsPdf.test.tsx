import { describe, expect, it } from "vitest"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
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

function pageCount(buffer: Buffer): number {
  return buffer.toString("latin1").match(/\/Type\s*\/Page(?!s)/g)?.length ?? 0
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
