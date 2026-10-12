import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CardContextBar } from "./CardContextBar"
import { DEFAULT_LIST, type CardRoute, type Route } from "./routes"

const origin: CardRoute["origin"] = {
  from: "list",
  query: { ...DEFAULT_LIST, family: "lg-freihand", kind: "competition" },
}
const card = (id: string): CardRoute => ({
  page: "card",
  id,
  origin,
  selection: null,
  shot: null,
  scoring: null,
  anchor: null,
})
const back: Route = { page: "cards", query: origin.query, evening: null }

describe("Rückweg und Blättern über der Scheibe (Plan N3, D5)", () => {
  it("links der Rückweg mit Namen, rechts vorige und nächste mit ihren Adressen", () => {
    const html = renderToStaticMarkup(
      h(CardContextBar, { back, backText: "Scheiben", prev: card("w1"), next: card("w3") })
    )
    expect(html).toMatch(/<nav aria-label="Scheibe im Kontext" data-card-context="true"/)
    expect(html).toMatch(
      /<a href="\/cards\?family=lg-freihand&amp;kind=competition" aria-label="Zurück zu „Scheiben“"[^>]*>[\s\S]*?Scheiben<\/a>/
    )
    expect(html).toMatch(
      /<a href="\/cards\/w1\?from=list&amp;family=lg-freihand&amp;kind=competition" aria-label="Vorige Scheibe"[^>]*>[\s\S]*?vorige<\/a>/
    )
    expect(html).toMatch(
      /<a href="\/cards\/w3\?from=list&amp;family=lg-freihand&amp;kind=competition" aria-label="Nächste Scheibe"[^>]*>nächste<svg[\s\S]*?<\/svg><\/a>/
    )
  })

  it("am Ende ausgegraut, ohne Adresse", () => {
    const html = renderToStaticMarkup(
      h(CardContextBar, { back, backText: "Scheiben", prev: card("w2"), next: null })
    )
    expect(html).toMatch(
      /<a role="link" aria-disabled="true" aria-label="Nächste Scheibe" data-pager="next"[^>]*text-muted-foreground[^>]*>nächste<svg[\s\S]*?<\/svg><\/a>/
    )
    // ein gesperrter Link ohne Adresse, wie ihn Screenreader ansagen (Review N3)
    expect(html.match(/<a href=/g)).toHaveLength(2)
  })

  it("ohne Kontext (direkter Link) nur der Rückweg", () => {
    const html = renderToStaticMarkup(
      h(CardContextBar, { back, backText: "Scheiben", prev: null, next: null, paging: false })
    )
    expect(html).not.toContain("vorige")
    expect(html).not.toContain("nächste")
  })
})
