import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { Sheet } from "./sheet"

const html = renderToStaticMarkup(
  createElement(Sheet, {
    open: false,
    title: "Streuung",
    onClose: () => {},
    children: createElement("p", null, "Inhalt"),
  })
)

describe("Sheet: Blatt auf dem nativen <dialog>", () => {
  it("ein Dialog, benannt nach seiner Überschrift", () => {
    expect(html).toMatch(/^<dialog/)
    const id = /<h2 id="([^"]+)"[^>]*>Streuung<\/h2>/.exec(html)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`aria-labelledby="${id}"`)
    expect(html).toContain("<p>Inhalt</p>")
  })

  it("ein Knopf zum Schließen, groß genug zum Tippen", () => {
    expect(html).toMatch(
      /<button[^>]*type="button"[^>]*aria-label="Schließen"[^>]*class="[^"]*size-10/
    )
  })

  it("auf dem Handy ein Blatt von unten, ab 768 px eine Karte am rechten Rand", () => {
    const classes = /<dialog[^>]*class="([^"]+)"/.exec(html)?.[1] ?? ""
    expect(classes).toContain("max-md:mb-0")
    expect(classes).toContain("max-md:rounded-t-2xl")
    expect(classes).toContain("md:mr-4")
    expect(classes).toContain("backdrop:bg-scrim")
  })

  it("Farben nur aus Tokens", () => {
    expect(html).not.toMatch(
      /(?:bg|text|border)-(?:black|white|gray|slate|zinc|neutral)(?:\/|-|\s|")/
    )
  })
})
