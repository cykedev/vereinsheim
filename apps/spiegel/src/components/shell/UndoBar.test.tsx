import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { UndoBar } from "./UndoBar"

const render = (props: Partial<Parameters<typeof UndoBar>[0]> = {}) =>
  renderToStaticMarkup(
    createElement(UndoBar, {
      text: "Scheibe gelöscht",
      error: null,
      busy: false,
      onUndo: () => {},
      ...props,
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
})
