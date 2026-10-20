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
import { pairingWinner, SchedulePdf, type SchedulePdfProps } from "@/lib/pdf/SchedulePdf"

describe("SchedulePdf — Abgabefristen", () => {
  // Mitternacht Europe/Berlin am 16.06. ist 22:00 UTC am 15.06. Ohne
  // uebergebene Zeitzone formatierte der Renderer in der Zone des Containers
  // (UTC) und druckte den Vortag auf den Spielplan.
  const berlinMidnight = new Date("2026-06-15T22:00:00.000Z")

  const baseProps: SchedulePdfProps = {
    leagueName: "Bezirksliga 2026",
    disciplineName: "Luftgewehr",
    scoringType: "WHOLE",
    scoringMode: "RINGTEILER",
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
      createElement(SchedulePdf, {
        leagueName: "Bezirksliga 2026",
        disciplineName: "Luftgewehr",
        scoringType: "WHOLE",
        scoringMode: "RINGTEILER",
        standings: [],
        matchups: manyMatchups("FIRST_LEG") as unknown as SchedulePdfProps["matchups"],
        firstLegDeadline: null,
        secondLegDeadline: null,
        generatedAt: new Date("2026-10-03T10:00:00.000Z"),
        displayTimeZone: "Europe/Berlin",
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

describe("pairingWinner — markierter Sieger im Spielplan", () => {
  const result = (rings: number, teiler: number, ringteiler: number, correctedTeiler = teiler) => ({
    rings,
    teiler,
    correctedTeiler,
    ringteiler,
  })

  it("Wertung nach Ringen: mehr Ringe gewinnen, auch mit schlechterem Ringteiler", () => {
    expect(pairingWinner(result(97, 80, 83), result(96, 5, 9), "RINGS")).toBe("home")
  })

  it("Wertung nach Teiler, gemischt: der korrigierte Teiler gewinnt", () => {
    expect(pairingWinner(result(95, 90, 35, 30), result(95, 35, 40), "TEILER")).toBe("home")
  })

  it("Wertung nach Ringteiler: der kleinere Ringteiler, Gleichstand ohne Sieger", () => {
    expect(pairingWinner(result(97, 80, 83), result(96, 5, 9), "RINGTEILER")).toBe("away")
    expect(pairingWinner(result(95, 20, 25), result(95, 20, 25), "RINGTEILER")).toBeNull()
  })
})

describe("SchedulePdf — Spalte bei Gleichstand", () => {
  const standings = [
    {
      participantId: "p1",
      firstName: "Anna",
      lastName: "Schuetz",
      withdrawn: false,
      played: 2,
      wins: 2,
      draws: 0,
      losses: 0,
      byes: 0,
      points: 4,
      bestRingteiler: 9.5,
      bestRings: 97,
      rank: 1,
    },
  ]
  const props = (scoringMode: SchedulePdfProps["scoringMode"]): SchedulePdfProps => ({
    leagueName: "Bezirksliga 2026",
    disciplineName: "Luftgewehr",
    scoringType: "WHOLE",
    scoringMode,
    standings,
    matchups: [],
    firstLegDeadline: null,
    secondLegDeadline: null,
    generatedAt: new Date("2026-05-24T10:00:00.000Z"),
    displayTimeZone: "Europe/Berlin",
  })
  const text = async (scoringMode: SchedulePdfProps["scoringMode"]) =>
    extractPdfText(
      await renderToBuffer(
        createElement(SchedulePdf, props(scoringMode)) as ReactElement<DocumentProps>
      )
    )

  it("Wertung nach Ringen: „Best. Ringe“ mit den meisten Ringen", async () => {
    const pdf = await text("RINGS")
    expect(pdf).toContain("Best. Ringe")
    expect(pdf).not.toContain("Best. RT")
    expect(pdf).toContain("97")
    expect(pdf).not.toContain("9,5")
  })

  it("Wertung nach Ringteiler: „Best. RT“ mit dem besten Ringteiler", async () => {
    const pdf = await text("RINGTEILER")
    expect(pdf).toContain("Best. RT")
    expect(pdf).toContain("9,5")
  })
})
