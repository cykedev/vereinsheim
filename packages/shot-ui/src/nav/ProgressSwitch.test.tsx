import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { compareFromProgress } from "./navigate"
import { ProgressSwitch } from "./ProgressSwitch"
import { DEFAULT_PROGRESS } from "./routes"

describe("ProgressSwitch", () => {
  const render = (current: "progress" | "compare") =>
    renderToStaticMarkup(
      h(ProgressSwitch, {
        current,
        progress: {
          page: "progress",
          query: { ...DEFAULT_PROGRESS, family: "lp-freihand" },
          section: null,
        },
        compare: compareFromProgress(DEFAULT_PROGRESS, "lp-freihand"),
      })
    )

  it("zwei Links, die gezeigte Seite mit aria-current", () => {
    const html = render("compare")
    expect(html).toMatch(/<nav aria-label="Fortschritt"/)
    expect(html).toMatch(/href="\/progress\?family=lp-freihand"[^>]*>Zeitraum</)
    expect(html).toMatch(
      /href="\/compare\?family=lp-freihand" aria-current="page"[^>]*>Vergleichen</
    )
    expect(render("progress")).toMatch(/aria-current="page"[^>]*>Zeitraum</)
  })

  it("Reiter in der Farbe der App, keine weiße Pille", () => {
    const html = render("progress")
    expect(html).toContain("aria-[current=page]:bg-primary")
    expect(html).not.toContain("bg-card")
  })
})
