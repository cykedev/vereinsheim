import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { RoundToggle } from "./round-toggle"

const render = (tone?: "default" | "gold") =>
  renderToStaticMarkup(
    createElement(RoundToggle, {
      label: "Art: Training, auf Wettkampf umstellen",
      title: "Training",
      tone,
      onClick: () => {},
      "data-kind": "training",
      children: "P",
    })
  )

describe("RoundToggle: weicher Kreis (Design 2)", () => {
  it("ein Knopf mit Namen und Titel, 32 px rund, ohne Rand, in der Flächenfarbe", () => {
    const html = render()
    expect(html).toMatch(/^<button type="button"/)
    expect(html).toContain('aria-label="Art: Training, auf Wettkampf umstellen"')
    expect(html).toContain('title="Training"')
    expect(html).toContain('data-kind="training"')
    expect(html).toMatch(/class="[^"]*\bsize-8\b[^"]*\brounded-full\b/)
    expect(html).toMatch(/class="[^"]*\bbg-surface-2\b[^"]*\btext-muted-foreground\b/)
    expect(html).not.toMatch(/\bborder\b/)
    expect(html).toContain(">P</button>")
  })

  it("Gold: goldene Tönung und Schrift aus den Tokens", () => {
    const html = render("gold")
    expect(html).toMatch(/class="[^"]*\bbg-warning-wash\b[^"]*\btext-warning\b/)
    expect(html).not.toContain("bg-surface-2")
  })
})
