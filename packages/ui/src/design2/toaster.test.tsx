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

  it("lets the app place it", () => {
    expect(propsOf({ position: "top-center" }).position).toBe("top-center")
  })
})
