import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const css = readFileSync(fileURLToPath(new URL("../../design2.css", import.meta.url)), "utf8")

/** die Custom Properties eines Blocks, dessen Zeile mit `selector {` beginnt */
function block(selector: string): Map<string, string> {
  const head = `\n${selector} {`
  const start = css.indexOf(head)
  if (start < 0) throw new Error(`Block ${selector} fehlt`)
  const body = css.slice(start + head.length, css.indexOf("}", start))
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
  "gold-line",
  "gold-wash",
  "quiet",
  "info",
  "rank-1",
  "rank-2",
  "rank-3",
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
]

// was der Akzent einer App setzt, hell wie dunkel
const ACCENT = ["ring", "primary", "primary-foreground", "accent", "accent-wash", "chart-1"]
const APPS = ["ringwerk", "treffsicher"] as const

/** relative Leuchtdichte nach WCAG 2.x aus `#rrggbb` */
function luminance(hex: string): number {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) throw new Error(`keine Farbe als #rrggbb: ${hex}`)
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(match[1].slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Kontrastverhältnis nach WCAG 2.x */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** die wirksamen Tokens einer App in einem Theme: Grundblock, dann `.dark`, dann der Akzent der App */
function tokens(app: (typeof APPS)[number] | null, theme: "light" | "dark"): Map<string, string> {
  const layers = [root]
  if (theme === "dark") layers.push(dark)
  if (app) layers.push(block(theme === "dark" ? `.dark[data-app="${app}"]` : `[data-app="${app}"]`))
  return new Map(layers.flatMap((layer) => [...layer]))
}

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
      "heat-0",
      "heat-1",
      "heat-2",
      "heat-3",
      "heat-4",
      "heat-5",
      "compare-a",
      "compare-b",
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

  it("der Akzent je App steht hell und dunkel vollständig", () => {
    for (const app of APPS)
      for (const selector of [`[data-app="${app}"]`, `.dark[data-app="${app}"]`]) {
        const accent = block(selector)
        for (const name of ACCENT) expect(accent.has(name), `${selector} --${name}`).toBe(true)
        expect(accent.get("chart-1")).toBe(accent.get("primary"))
      }
  })

  it("Akzent, Schrift auf dem Akzent, Plätze und Diagramm-Serien tragen auf der Kartenfläche", () => {
    for (const app of [null, ...APPS])
      for (const theme of ["light", "dark"] as const) {
        const t = tokens(app, theme)
        const at = (name: string) => t.get(name) ?? ""
        const where = `${app ?? "spiegel"} ${theme}`
        expect(
          contrast(at("primary-foreground"), at("primary")),
          `${where} Schrift auf primary`
        ).toBeGreaterThanOrEqual(4.5)
        expect(
          contrast(at("primary"), at("card")),
          `${where} primary auf card`
        ).toBeGreaterThanOrEqual(4.5)
        for (const rank of ["rank-1", "rank-2", "rank-3"])
          expect(contrast(at(rank), at("card")), `${where} ${rank}`).toBeGreaterThanOrEqual(4.5)
        for (const chart of ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"])
          expect(contrast(at(chart), at("card")), `${where} ${chart}`).toBeGreaterThanOrEqual(3)
      }
  })

  it("ohne data-app gilt Spiegels Blau", () => {
    expect(root.get("primary")).toBe("#1f5fd1")
    expect(dark.get("primary")).toBe("#9ccaff")
    expect(root.get("chart-1")).toBe(root.get("primary"))
    expect(dark.get("chart-1")).toBe(dark.get("primary"))
  })
})
