import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { THEME_SCRIPT } from "./theme"
import { ThemeScript } from "./ThemeScript"

describe("ThemeScript", () => {
  it("puts the theme script into the server HTML", () => {
    expect(renderToStaticMarkup(createElement(ThemeScript))).toBe(
      `<script>${THEME_SCRIPT}</script>`
    )
  })
})
