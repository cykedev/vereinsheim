import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { ShotValues, shotText } from "./ShotValues"

describe("shotText", () => {
  it("Zehntel mit Komma, ganze Ringe unverändert", () => {
    expect(shotText("10.5")).toBe("10,5")
    expect(shotText("9.0")).toBe("9,0")
    expect(shotText("9")).toBe("9")
  })

  it("lässt Unbekanntes stehen", () => {
    expect(shotText("X")).toBe("X")
  })
})

describe("ShotValues", () => {
  it("zeigt Zehntel nie mit Punkt", () => {
    const html = renderToStaticMarkup(createElement(ShotValues, { shots: ["10.5", "8.9", "10"] }))
    expect(html).toContain("10,5")
    expect(html).toContain("8,9")
    // nur der sichtbare Text: Klassen wie gap-x-2.5 tragen einen Punkt
    expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(/\d\.\d/)
  })
})
