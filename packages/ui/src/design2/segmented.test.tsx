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

describe("Segmented mit scroll", () => {
  const render = (scroll?: boolean) =>
    renderToStaticMarkup(
      createElement(Segmented, {
        label: "Kennzahl",
        value: "a",
        options: [
          { value: "a", label: "Ø je Schuss" },
          { value: "b", label: "Streuung" },
        ],
        onChange: () => {},
        scroll,
      })
    )

  it("ohne Umbruch in einer Zeile, zu breit scrollt er in sich, ohne Leiste", () => {
    // das Markup maskiert „&“ und „>“ im Attribut
    const bar = (render(true).match(/role="radiogroup"[^>]*class="([^"]+)"/)?.[1] ?? "")
      .replaceAll("&amp;", "&")
      .replaceAll("&gt;", ">")
    for (const cls of [
      "max-w-full",
      "min-w-0",
      "overflow-x-auto",
      "[&>button]:shrink-0",
      "[&>button]:whitespace-nowrap",
    ])
      expect(bar.split(" ")).toContain(cls)
    expect(render()).not.toContain("whitespace-nowrap")
  })
})

describe("Segmented mit wrap", () => {
  const html = renderToStaticMarkup(
    createElement(Segmented, {
      label: "Liste",
      value: "b",
      options: [
        { value: "a", label: "Alle" },
        { value: "b", label: "Jahrespreis" },
        { value: "c", label: "LP Vereinsmeisterschaft" },
      ],
      onChange: () => {},
      wrap: true,
    })
  )
  const bar = (html.match(/role="radiogroup"[^>]*class="([^"]+)"/)?.[1] ?? "")
    .replaceAll("&amp;", "&")
    .replaceAll("&gt;", ">")
    .split(" ")

  it("bricht um statt seitlich zu scrollen, ein langer Name bricht im Knopf", () => {
    for (const cls of ["flex", "flex-wrap", "rounded-2xl", "[&>button]:max-w-full"])
      expect(bar).toContain(cls)
    expect(bar).toContain("[&>button]:[overflow-wrap:anywhere]")
    for (const cls of ["inline-flex", "rounded-full", "overflow-x-auto"])
      expect(bar).not.toContain(cls)
  })

  it("bleibt eine Radiogruppe: Tab nur auf der Wahl", () => {
    expect(
      [...html.matchAll(/tabindex="(-?\d)"[^>]*>([^<]+)</g)].map((m) => `${m[2]}:${m[1]}`)
    ).toEqual(["Alle:-1", "Jahrespreis:0", "LP Vereinsmeisterschaft:-1"])
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

  it("auf dem Telefon dieselbe Optik wie am Desktop", () => {
    for (const button of html.match(/<button[^>]*>/g)!) expect(button).not.toContain("min-h-11")
  })

  it("verweist auf den Bereich, den sie steuert (aria-controls)", () => {
    const html = renderToStaticMarkup(
      createElement(Segmented, {
        label: "Thema",
        value: "a",
        options: [{ value: "a", label: "A" }],
        onChange: () => {},
        controls: "karten",
      })
    )
    expect(html).toMatch(/role="radiogroup"[^>]*aria-controls="karten"/)
  })

  it("eine Klasse von außen reicht bis an die Leiste, etwa zum Umbrechen", () => {
    const wrapped = renderToStaticMarkup(
      createElement(Segmented, {
        label: "Thema",
        value: "a",
        options: [{ value: "a", label: "A" }],
        onChange: () => {},
        className: "overflow-x-auto",
      })
    )
    expect(wrapped).toMatch(/role="radiogroup"[^>]*class="[^"]*overflow-x-auto/)
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
    // auf dem Telefon dieselbe Optik wie am Desktop
    expect(off).not.toContain("min-h-11")
  })
})
