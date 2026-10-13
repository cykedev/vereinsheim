import { VIEW_HELP } from "@vereinsheim/shot-help/guide"
import { helpForMetric } from "@vereinsheim/shot-help/lookup"
import { renderTopic } from "@vereinsheim/shot-help/markdown"
import { HELP_TOPICS } from "@vereinsheim/shot-help/topics"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { HelpBody, HELP_FIELDS } from "./HelpBody"
import { HelpButton } from "./HelpButton"
import { HelpDetails } from "./HelpDetails"
import { HelpSheet } from "./HelpSheet"

/** so, wie React Text ins Markup schreibt */
const esc = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const render = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(element)

describe("HelpBody", () => {
  const topic = helpForMetric("group.sigma")!
  const html = render(createElement(HelpBody, { topic }))

  it("die Felder des Pakets in seiner Reihenfolge, Texte unverändert aus shot-help", () => {
    const present = HELP_FIELDS.filter(([field]) => topic[field])
    expect(present.length).toBeGreaterThanOrEqual(3)
    let at = -1
    for (const [field, label] of present) {
      const next = html.indexOf(`<b>${label}:</b> ${esc(topic[field] as string)}`)
      expect(next, field).toBeGreaterThan(at)
      at = next
    }
  })

  it("die Beschriftungen sind die des Leitfadens im Vault", () => {
    for (const t of HELP_TOPICS) {
      const markdown = renderTopic(t)
      for (const [field, label] of HELP_FIELDS) {
        if (t[field]) expect(markdown, `${t.id} ${field}`).toContain(`*${label}:*`)
      }
    }
  })

  it("die Formel zugeklappt, nach den Worten", () => {
    const withFormula = HELP_TOPICS.find((t) => t.formula)!
    const body = render(createElement(HelpBody, { topic: withFormula }))
    expect(body).toMatch(
      /<details><summary[^>]*>Formel für Profis<\/summary><code[^>]*>[^<]+<\/code><\/details><\/div>$/
    )
    expect(body).toContain(esc(withFormula.formula!))
  })
})

describe("HelpDetails", () => {
  it("„Was heißt das?“ zugeklappt, mit dem Schalter „Erklärungen“ offen", () => {
    const closed = render(createElement(HelpDetails, { id: "praezision-sigma", open: false }))
    expect(closed).toMatch(/^<details data-help="praezision-sigma"(?! open)[^>]*><summary/)
    expect(closed).toContain("Was heißt das?")
    const open = render(createElement(HelpDetails, { id: "praezision-sigma", open: true }))
    expect(open).toMatch(/^<details data-help="praezision-sigma" open=""/)
  })

  it("auch Erklärungen zur Oberfläche (Trefferbild)", () => {
    const html = render(createElement(HelpDetails, { id: "trefferbild", open: true }))
    expect(html).toContain(esc(VIEW_HELP.find((v) => v.id === "trefferbild")!.what))
  })

  it("eine unbekannte Erklärung ist ein Fehler, keine leere Stelle", () => {
    expect(() => render(createElement(HelpDetails, { id: "gibt-es-nicht", open: true }))).toThrow(
      /Keine Hilfe zu gibt-es-nicht/
    )
  })
})

describe("HelpButton und HelpSheet", () => {
  it("„?“ als Knopf mit Namen, groß genug zum Tippen (40 px)", () => {
    const html = render(createElement(HelpButton, { label: "Streukreis", onClick: () => {} }))
    expect(html).toMatch(/^<button type="button" aria-label="Erklärung: Streukreis"/)
    expect(html).toContain('aria-hidden="true"')
    expect(html).toMatch(/class="[^"]*\bsize-10\b/)
  })

  it("das Blatt zeigt eine Erklärung unter ihrem Titel: Thema einer Kennzahl, einer Karte oder der Oberfläche", () => {
    const topic = helpForMetric("group.r50")!
    const html = render(createElement(HelpSheet, { helpId: topic.id, onClose: () => {} }))
    expect(html).toMatch(new RegExp(`<h2[^>]*>${topic.title}</h2>`))
    expect(html).toContain(esc(topic.what))
    const view = VIEW_HELP.find((v) => v.id === "trefferbild")!
    const viewHtml = render(createElement(HelpSheet, { helpId: "trefferbild", onClose: () => {} }))
    expect(viewHtml).toMatch(new RegExp(`<h2[^>]*>${view.title}</h2>`))
  })

  it("ohne Erklärung ein leeres, geschlossenes Blatt", () => {
    const html = render(createElement(HelpSheet, { helpId: null, onClose: () => {} }))
    expect(html).toMatch(/^<dialog(?![^>]*\bopen)/)
    expect(html).not.toContain("<b>")
  })
})
