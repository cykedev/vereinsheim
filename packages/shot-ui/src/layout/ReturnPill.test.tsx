import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { isOutOfView, shouldDismiss } from "./jump"
import { ReturnPill } from "./ReturnPill"

describe("Scheibe außer Sicht? (D6)", () => {
  const rect = (top: number, height = 340) => ({ top, bottom: top + height })

  it("im Bild, wenn genug von ihr unter der Leiste und über dem unteren Rand liegt", () => {
    expect(isOutOfView(rect(60), 812, 56)).toBe(false)
    expect(isOutOfView(rect(-150), 812, 56)).toBe(false)
    expect(isOutOfView(rect(600), 812, 56)).toBe(false)
  })

  it("außer Sicht, wenn sie fast ganz unter der Leiste oder unter dem Rand liegt", () => {
    expect(isOutOfView(rect(-2400), 812, 56)).toBe(true)
    expect(isOutOfView(rect(-240), 812, 56)).toBe(true)
    expect(isOutOfView(rect(720), 812, 56)).toBe(true)
  })
})

describe("Pille verschwindet, wenn man selbst zurückscrollt", () => {
  it("erst nachdem man weg war, nicht schon beim Losscrollen", () => {
    expect(shouldDismiss({ origin: 2000, away: false }, 1900)).toEqual({
      dismiss: false,
      away: false,
    })
    expect(shouldDismiss({ origin: 2000, away: false }, 600)).toEqual({
      dismiss: false,
      away: true,
    })
    expect(shouldDismiss({ origin: 2000, away: true }, 1900)).toEqual({ dismiss: true, away: true })
  })
})

describe("Rücksprung-Pille", () => {
  const html = renderToStaticMarkup(
    createElement(ReturnPill, { label: "Lage", onReturn: () => {}, onDismiss: () => {} })
  )

  it("unten mittig, über dem sicheren Rand, mit Text und Schließen in 40 px", () => {
    expect(html).toMatch(/class="[^"]*fixed inset-x-0 bottom-0[^"]*"/)
    expect(html).toContain("env(safe-area-inset-bottom)")
    expect(html).toMatch(/<button type="button"[^>]*>Zurück zu „Lage“<\/button>/)
    expect(html).toMatch(/<button type="button" aria-label="Schließen"[^>]*class="[^"]*size-10/)
  })

  it("ein Bereich für Screenreader ist immer da und sagt den Sprung an", () => {
    const quiet = renderToStaticMarkup(
      createElement(ReturnPill, { label: null, onReturn: () => {}, onDismiss: () => {} })
    )
    expect(quiet).toMatch(/^<div role="status" aria-live="polite" class="sr-only"><\/div>$/)
    expect(html).toMatch(
      /<div role="status" aria-live="polite" class="sr-only">Zur Scheibe gesprungen\. „Zurück zu „Lage““ steht unten\.<\/div>/
    )
  })
})
