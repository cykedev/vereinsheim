import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ParticipantResult, StatusBadge } from "./ParticipantResult"

const participant = {
  id: "p1",
  firstName: "Erika",
  lastName: "Ahorn",
  withdrawn: false,
  scoringType: null,
  teilerFaktor: null,
}
const result = {
  participantId: "p1",
  rings: 88,
  teiler: 98.2,
  ringteiler: 110.2,
  duelNumber: null,
  isTiebreak: false,
}

describe("ParticipantResult", () => {
  it("Ergebniszeile bricht nur zwischen den Werten um, der Text bleibt derselbe", () => {
    const html = renderToStaticMarkup(
      h(ParticipantResult, { participant, result, scoringType: "WHOLE" })
    )
    const text = html.replace(/<[^>]+>/g, "")
    expect(text).toContain("88 R · 98,2 T · RT 110,2")
    expect(html.match(/class="whitespace-nowrap"/g)).toHaveLength(3)
    expect(html).toContain('<span class="whitespace-nowrap">RT 110,2</span>')
  })
})

describe("StatusBadge — Paarung ohne Ergebnis", () => {
  it("die Uhr nennt den Grund als Tooltip und für Screenreader", () => {
    const html = renderToStaticMarkup(h(StatusBadge, { status: "PENDING" }))
    expect(html).toContain('title="noch kein Ergebnis"')
    expect(html).toContain('<span class="sr-only">noch kein Ergebnis</span>')
  })
})
