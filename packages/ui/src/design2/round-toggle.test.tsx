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
  it("ein Knopf mit Namen und Titel, 32 px rund, leichter Rahmen, in der Flächenfarbe, das Zeichen leise", () => {
    const html = render()
    expect(html).toMatch(/^<button type="button"/)
    expect(html).toContain('aria-label="Art: Training, auf Wettkampf umstellen"')
    expect(html).toContain('title="Training"')
    expect(html).toContain('data-kind="training"')
    expect(html).toMatch(/class="[^"]*\bsize-8\b[^"]*\brounded-full\b/)
    // leise (Token `quiet`, 3 : 1 auf der Fläche): eine Randinformation
    // innen die Kartenfläche, kräftiger Rahmen: auf der grauen Seite ein Knopf, auf der Karte ein Ring
    expect(html).toMatch(/class="[^"]*\bborder-line-strong bg-card text-quiet\b/)
    expect(html).not.toContain("bg-surface-2")
    expect(html).toContain("[&amp;_svg]:stroke-[1.75]")
    // tailwind-merge lässt nur einen Rahmen stehen
    expect(html).toMatch(/class="[^"]*\brounded-full border\b/)
    expect(html).not.toContain("border-border")
    expect(html).toContain(">P</button>")
  })

  it("Gold: goldene Tönung und das Gold-Token (goldener als das Text-Token `warning`)", () => {
    const html = render("gold")
    // deckend auf der Kartenfläche getönt: auf Seite und Karte gleich
    expect(html).toMatch(/class="[^"]*\bborder-gold-line bg-gold-wash text-gold\b/)
    expect(html).not.toContain("border-line-strong")
    expect(html).not.toContain("bg-card")
  })
})
