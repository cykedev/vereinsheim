import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { nextIndex, Segmented } from "./segmented"
import { ToggleChip } from "./toggle-chip"

describe("nextIndex: Pfeiltasten im Segment-Umschalter", () => {
  it("rechts und unten weiter, links und oben zurück, am Rand herum", () => {
    expect(nextIndex(0, "ArrowRight", 3)).toBe(1)
    expect(nextIndex(2, "ArrowRight", 3)).toBe(0)
    expect(nextIndex(0, "ArrowLeft", 3)).toBe(2)
    expect(nextIndex(1, "ArrowDown", 3)).toBe(2)
    expect(nextIndex(1, "ArrowUp", 3)).toBe(0)
  })

  it("Pos1 und Ende springen an den Rand, andere Tasten nicht", () => {
    expect(nextIndex(1, "Home", 3)).toBe(0)
    expect(nextIndex(1, "End", 3)).toBe(2)
    expect(nextIndex(1, "Enter", 3)).toBeNull()
  })
})

describe("Segmented", () => {
  const segmented = (value: string) =>
    renderToStaticMarkup(
      createElement(Segmented, {
        label: "Ausschnitt",
        value,
        options: [
          { value: "target", label: "Scheibe" },
          { value: "group", label: "Gruppe" },
        ],
        onChange: () => {},
      })
    )
  const html = segmented("group")

  it("eine benannte Radiogruppe: Pfeiltasten wählen, darum radio statt Schalter", () => {
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('aria-label="Ausschnitt"')
    expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="false"[^>]*>Scheibe<\/button>/)
    expect(html).toMatch(/<button[^>]*role="radio"[^>]*aria-checked="true"[^>]*>Gruppe<\/button>/)
    expect(html).not.toContain("aria-pressed=")
  })

  it("nur der gewählte Knopf ist mit Tab erreichbar", () => {
    expect(html).toMatch(/<button[^>]*tabindex="-1"[^>]*>Scheibe/)
    expect(html).toMatch(/<button[^>]*tabindex="0"[^>]*>Gruppe/)
  })

  it("ohne passende Wahl bleibt der erste Knopf mit Tab erreichbar", () => {
    const none = segmented("other")
    expect(none).toMatch(/<button[^>]*tabindex="0"[^>]*>Scheibe/)
    expect(none).toMatch(/<button[^>]*tabindex="-1"[^>]*>Gruppe/)
  })

  it("auf dem Touchscreen mindestens 44 px hoch, die Optik bleibt", () => {
    for (const button of html.match(/<button[^>]*>/g)!) {
      expect(button).toContain("pointer-coarse:min-h-11")
    }
  })

  it("eine Klasse von außen reicht bis an die Leiste, etwa zum Umbrechen", () => {
    const wrapped = renderToStaticMarkup(
      createElement(Segmented, {
        label: "Thema",
        value: "a",
        options: [{ value: "a", label: "A" }],
        onChange: () => {},
        className: "max-sm:flex-wrap",
      })
    )
    expect(wrapped).toMatch(/role="radiogroup"[^>]*class="[^"]*max-sm:flex-wrap/)
  })

  it("Farben nur aus Tokens", () => {
    expect(html).toContain("aria-checked:bg-primary")
    expect(html).not.toMatch(/(?:bg|text)-(?:red|blue|gray|slate|zinc|emerald|amber)-\d/)
  })
})

describe("ToggleChip", () => {
  it("ein Schalter mit aria-pressed, Symbol vor dem Text", () => {
    const on = renderToStaticMarkup(
      createElement(ToggleChip, {
        pressed: true,
        onPressedChange: () => {},
        icon: createElement("svg"),
        children: "Nummern",
      })
    )
    expect(on).toMatch(/^<button[^>]*type="button"[^>]*aria-pressed="true"/)
    expect(on).toMatch(/<svg[^>]*><\/svg>Nummern/)
    const off = renderToStaticMarkup(
      createElement(ToggleChip, { pressed: false, onPressedChange: () => {}, children: "Nummern" })
    )
    expect(off).toContain('aria-pressed="false"')
    expect(off).toContain("pointer-coarse:min-h-11")
  })
})
