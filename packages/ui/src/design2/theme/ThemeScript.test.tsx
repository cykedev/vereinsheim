import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { themeScript } from "./theme"
import { ThemeScript } from "./ThemeScript"

describe("ThemeScript", () => {
  it("puts the theme script into the server HTML", () => {
    expect(renderToStaticMarkup(createElement(ThemeScript, { storageKey: "spiegel-theme" }))).toBe(
      `<script>${themeScript("spiegel-theme")}</script>`
    )
  })

  it("reads the choice under the key of its app", () => {
    const html = renderToStaticMarkup(
      createElement(ThemeScript, { storageKey: "treffsicher-theme" })
    )
    expect(html).toContain(`localStorage.getItem("treffsicher-theme")`)
    expect(html).not.toContain("spiegel-theme")
  })
})
