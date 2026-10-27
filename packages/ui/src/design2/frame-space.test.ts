import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8")
const css = read("../../design2.css")
const frame = read("./app-frame.tsx")

const SELECTOR = ":root:has([data-app-frame])"

/** die Custom Properties der Blöcke mit `SELECTOR`, je Medienabfrage (`""` ohne) */
function frameBlocks(): Map<string, Map<string, string>> {
  const blocks = new Map<string, Map<string, string>>()
  let at = css.indexOf(SELECTOR)
  while (at >= 0) {
    const before = css.slice(0, at)
    const media = before.lastIndexOf("@media")
    const opened = media >= 0 && !before.slice(media).includes("}") ? media : -1
    const query =
      opened >= 0 ? css.slice(opened + "@media".length, css.indexOf("{", opened)).trim() : ""
    const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at))
    const props = new Map<string, string>()
    for (const match of body.matchAll(/--([\w-]+):\s*([^;]+);/g))
      props.set(match[1], match[2].trim())
    blocks.set(query, props)
    at = css.indexOf(SELECTOR, at + SELECTOR.length)
  }
  return blocks
}

describe("Platz des Rahmens (design2.css)", () => {
  const blocks = frameBlocks()

  it("nur auf Seiten mit Rahmen: untere Leiste 72 px, keine schmale", () => {
    expect(Object.fromEntries(blocks.get("") ?? [])).toEqual({
      "app-bar": "72px",
      "app-rail": "0px",
    })
  })

  it("ab 1024 px die Seitenleiste: kein Platz unten", () => {
    expect(Object.fromEntries(blocks.get("(width >= 64rem)") ?? [])).toEqual({ "app-bar": "0px" })
  })

  it("Telefon quer: schmale Leiste links samt sicherer Fläche, unten nichts", () => {
    expect(Object.fromEntries(blocks.get("(width < 64rem) and (max-height: 499px)") ?? [])).toEqual(
      {
        "app-bar": "0px",
        "app-rail": "calc(4rem + env(safe-area-inset-left))",
      }
    )
  })

  it("nur diese drei Blöcke", () => {
    expect([...blocks.keys()]).toHaveLength(3)
  })

  it("der Rahmen nimmt die Werte aus dem Token und hat dieselben Grenzen", () => {
    expect(frame).toContain("data-app-frame")
    expect(frame).not.toContain("[--app-bar:")
    expect(frame).not.toContain("4rem")
    expect(frame).toContain("max-lg:[@media(max-height:499px)]:")
    expect(frame).toContain("lg:hidden")
  })
})
