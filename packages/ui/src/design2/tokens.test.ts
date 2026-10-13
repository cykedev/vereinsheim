import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const css = readFileSync(fileURLToPath(new URL("../../design2.css", import.meta.url)), "utf8")

/** die Custom Properties eines Blocks, der mit `selector {` beginnt */
function block(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`)
  if (start < 0) throw new Error(`Block ${selector} fehlt`)
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start))
  const props = new Map<string, string>()
  for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) props.set(match[1], match[2].trim())
  return props
}

const root = block(":root")
const dark = block(".dark")

// Farben, die zwischen hell und dunkel wechseln: in beiden Blöcken
const THEMED = [
  "background",
  "foreground",
  "foreground-2",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "surface-2",
  "muted",
  "muted-foreground",
  "border",
  "line-strong",
  "input",
  "ring",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "accent",
  "accent-foreground",
  "accent-wash",
  "success",
  "success-wash",
  "destructive",
  "destructive-wash",
  "warning",
  "warning-wash",
  "gold",
  "info",
]

describe("Design-2-Tokens", () => {
  it("jede wechselnde Farbe steht hell und dunkel", () => {
    for (const name of THEMED) {
      expect(root.has(name), `:root --${name}`).toBe(true)
      expect(dark.has(name), `.dark --${name}`).toBe(true)
    }
  })

  it("kein Token nur im dunklen Block", () => {
    for (const name of dark.keys()) expect(root.has(name), `--${name}`).toBe(true)
  })

  it("die Scheibe ist ein Gegenstand: Papier, Spiegel und Ringwert-Farben sind in beiden Themes gleich", () => {
    for (const name of [
      "paper",
      "paper-line",
      "spiegel",
      "spiegel-line",
      "shot-edge",
      "shot-faded",
      "overlay",
      "overlay-halo",
      "shot-number",
      "shot-number-halo",
      "mpi-light",
      "mpi-dark",
      "mpi-halo",
      "scrim",
    ]) {
      expect(root.has(name), `--${name}`).toBe(true)
      expect(dark.has(name), `--${name}`).toBe(false)
    }
    // farbenblind geprüft (spiegel-ui-design): nur mit neuer Prüfung ändern
    expect(root.get("score-10")).toBe("#e5484d")
    expect(root.get("score-9")).toBe("#e9b10c")
    expect(root.get("score-8")).toBe("#1fa3c8")
    expect(root.get("score-7")).toBe("#7c5cd6")
  })

  it("jede Tailwind-Farbe zeigt auf ein vorhandenes Token", () => {
    const theme = css.slice(
      css.indexOf("@theme inline {"),
      css.indexOf("}", css.indexOf("@theme inline {"))
    )
    const refs = [...theme.matchAll(/--color-([\w-]+):\s*var\(--([\w-]+)\)/g)]
    expect(refs.length).toBeGreaterThan(30)
    for (const [, color, token] of refs) {
      expect(color).toBe(token)
      expect(root.has(token), `--${token}`).toBe(true)
    }
  })

  it("hell und dunkel setzen das Farbschema für Formulare und Bildlaufleisten", () => {
    expect(css).toMatch(/:root \{[^}]*color-scheme: light;/)
    expect(css).toMatch(/\.dark \{[^}]*color-scheme: dark;/)
  })
})
