import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { UndoBar, type UndoView } from "./UndoBar"

const render = (view: Partial<UndoView> = {}) =>
  renderToStaticMarkup(
    createElement(UndoBar, {
      view: { text: "Scheibe gelöscht", error: null, busy: false, onUndo: () => {}, ...view },
    })
  )

describe("Hinweis „Rückgängig“", () => {
  it("Text und Knopf als Status, über der unteren Leiste, Knopf mindestens 40 px; nur Tokens", () => {
    const html = render()
    expect(html).toContain('role="status"')
    expect(html).toContain("Scheibe gelöscht")
    expect(html).toMatch(/<button type="button" class="h-10 [^"]*">Rückgängig<\/button>/)
    expect(html).toContain("bottom-[calc(var(--app-bar,0px)+env(safe-area-inset-bottom)+0.75rem)]")
    expect(html).not.toMatch(/(?:text|bg|border)-(?:red|green|amber|gray|zinc|slate)-\d/)
    expect(html).not.toContain("dark:")
  })

  it("während des Rückgängigmachens gesperrt; ein Fehler ersetzt Text und Knopf", () => {
    expect(render({ busy: true })).toMatch(/<button[^>]*disabled=""[^>]*>Rückgängig…<\/button>/)
    const failed = render({ error: "Die 30 Tage sind um." })
    expect(failed).toContain("Die 30 Tage sind um.")
    expect(failed).toContain("text-destructive")
    expect(failed).not.toContain("<button")
  })

  it("ohne Hinweis steht die leere Live-Region schon da (Review)", () => {
    const html = renderToStaticMarkup(createElement(UndoBar, { view: null }))
    expect(html).toMatch(/^<div role="status" class="[^"]*fixed/)
    expect(html).not.toContain("data-undo-bar")
    expect(html).not.toContain("<button")
  })
})
