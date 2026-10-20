import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { HelpMark } from "./HelpMark"

describe("HelpMark", () => {
  it("ist ein Knopf mit dem Namen des Themas und seiner Id", () => {
    const html = renderToStaticMarkup(createElement(HelpMark, { id: "ringteiler" }))
    expect(html).toContain('aria-label="Erklärung: Ringteiler"')
    expect(html).toContain('data-help="ringteiler"')
    expect(html).toContain('type="button"')
  })
})
