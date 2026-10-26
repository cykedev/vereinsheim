import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ActionRow } from "./ActionRow"

describe("Zeile im Kasten „Diese Scheibe“", () => {
  it("Titel als Überschrift, Zustand, Aktion rechts, darunter der Rest", () => {
    const html = renderToStaticMarkup(
      createElement(
        ActionRow,
        {
          title: "Teilen",
          state: "Nur du siehst diese Scheibe.",
          action: createElement("button", { type: "button" }, "Teilen"),
          "data-share-card": true,
        },
        createElement("p", null, "darunter")
      )
    )
    expect(html).toMatch(/^<div data-share-card="true"/)
    expect(html).toMatch(
      /<h3[^>]*>Teilen<\/h3>[\s\S]*Nur du siehst diese Scheibe\.[\s\S]*<button[^>]*>Teilen<\/button>[\s\S]*darunter/
    )
  })

  it("ohne Aktion nur Titel und Zustand", () => {
    const html = renderToStaticMarkup(
      createElement(ActionRow, { title: "Disziplin", state: "LP 40" })
    )
    expect(html).toContain(">Disziplin</h3>")
    expect(html).not.toContain("<button")
  })
})
