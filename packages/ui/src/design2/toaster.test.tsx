import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import type { ToasterProps } from "sonner"
import { describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "./theme/ThemeProvider"
import { Toaster } from "./toaster"

// sonner zeichnet ohne Toast auf dem Server nichts außer einem leeren Bereich; geprüft wird, was es bekommt
const seen: ToasterProps[] = []
vi.mock("sonner", () => ({
  Toaster: (props: ToasterProps) => {
    seen.push(props)
    return null
  },
}))

function propsOf(props: ToasterProps = {}): ToasterProps {
  seen.length = 0
  renderToStaticMarkup(
    createElement(ThemeProvider, {
      storageKey: "test-theme",
      children: createElement(Toaster, props),
    })
  )
  return seen[0]
}

describe("Toaster", () => {
  it("takes the Design 2 surface, line and radius", () => {
    expect(propsOf().style).toMatchObject({
      "--normal-bg": "var(--card)",
      "--normal-text": "var(--card-foreground)",
      "--normal-border": "var(--line-strong)",
      "--border-radius": "calc(var(--radius) + 4px)",
    })
  })

  it("follows the resolved theme, light until the browser knows better", () => {
    expect(propsOf().theme).toBe("light")
  })

  it("stands above the bottom bar and the safe area, wherever sonner switches to its phone layout", () => {
    const { offset, mobileOffset } = propsOf()
    // über 600 px Breite nimmt sonner `offset`, darunter `mobileOffset`; die Leiste steht bis 1024 px
    for (const bottom of [
      (offset as Record<string, string>).bottom,
      (mobileOffset as Record<string, string>).bottom,
    ]) {
      expect(bottom).toContain("var(--app-bar, 0px)")
      expect(bottom).toContain("env(safe-area-inset-bottom)")
    }
    expect((offset as Record<string, string>).bottom).toBe(
      "calc(var(--app-bar, 0px) + env(safe-area-inset-bottom) + 24px)"
    )
    expect((mobileOffset as Record<string, string>).bottom).toBe(
      "calc(var(--app-bar, 0px) + env(safe-area-inset-bottom) + 16px)"
    )
  })

  it("keeps clear of the rail of a phone held sideways, other sides as sonner sets them", () => {
    const { offset, mobileOffset } = propsOf()
    expect((mobileOffset as Record<string, string>).left).toBe("calc(var(--app-rail, 0px) + 16px)")
    expect(Object.keys(offset as object)).toEqual(["bottom"])
    expect(Object.keys(mobileOffset as object).sort()).toEqual(["bottom", "left"])
  })

  it("lets the app place it", () => {
    expect(propsOf({ position: "top-center" }).position).toBe("top-center")
    expect(propsOf({ offset: 8 }).offset).toBe(8)
  })
})
