import { describe, expect, it } from "vitest"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import { extractPdfText } from "./pdfTestUtils"
import { EventStarterListPdf, type EventStarterListPdfProps } from "@/lib/pdf/EventStarterListPdf"

describe("EventStarterListPdf", () => {
  const baseProps = {
    competitionName: "Kranzlschiessen 2026",
    eventDate: new Date("2026-06-15T08:00:00.000Z"),
    participants: [
      { nr: 1, firstName: "Anna", lastName: "Schuetz", disciplineName: "Luftpistole" },
      { nr: 2, firstName: "Bert", lastName: "Mueller", disciplineName: "Luftgewehr" },
    ],
    generatedAt: new Date("2026-05-24T10:00:00.000Z"),
    displayTimeZone: "Europe/Berlin",
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

  it("formats the event date in the passed display timezone, not the process one", async () => {
    // 22:30 UTC ist in Europe/Berlin schon der Folgetag. Vorher formatierten die
    // Renderer ohne Zeitzone, also in der Zone des Containers (UTC) — der Termin
    // erschien einen Tag zu früh.
    const crossesMidnight = { ...baseProps, eventDate: new Date("2026-06-15T22:30:00.000Z") }

    const berlin = extractPdfText(
      await render({ ...crossesMidnight, displayTimeZone: "Europe/Berlin" })
    )
    const utc = extractPdfText(await render({ ...crossesMidnight, displayTimeZone: "UTC" }))

    expect(berlin).toContain("16.06.2026")
    expect(utc).toContain("15.06.2026")
  })
})
