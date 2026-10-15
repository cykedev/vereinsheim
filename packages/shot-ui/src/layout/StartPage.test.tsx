import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { StartPage } from "./StartPage"

describe("Rahmen von Start (Breite wie die übrigen Seiten)", () => {
  const html = renderToStaticMarkup(
    h(StartPage, {
      open: h("p", null, "OFFEN"),
      evenings: h("p", null, "ABEND"),
      form: h("p", null, "FORM"),
    })
  )

  it("das Raster der Seite eines Zeitraums: links der Abend, rechts Offen und Form", () => {
    expect(html).toMatch(
      /data-start-layout="true" class="[^"]*md:grid-cols-\[minmax\(0,1\.1fr\)_minmax\(0,0\.9fr\)\]/
    )
    expect(html).toMatch(/md:grid-rows-\[auto_1fr\]/)
    expect(html).toMatch(/class="[^"]*md:col-start-2 md:row-start-1[^"]*"><p>OFFEN/)
    expect(html).toMatch(/class="[^"]*md:col-start-1 md:row-span-2 md:row-start-1[^"]*"><p>ABEND/)
    expect(html).toMatch(/class="[^"]*md:col-start-2 md:row-start-2[^"]*"><p>FORM/)
  })

  it("auf dem Telefon Offen, Abend, Form untereinander (Reihenfolge im DOM)", () => {
    expect(html.indexOf("OFFEN")).toBeLessThan(html.indexOf("ABEND"))
    expect(html.indexOf("ABEND")).toBeLessThan(html.indexOf("FORM"))
  })

  it("ohne Offen und ohne Form nur der Abend", () => {
    const bare = renderToStaticMarkup(h(StartPage, { evenings: h("p", null, "ABEND") }))
    expect(bare).not.toContain("OFFEN")
    expect(bare).toContain("ABEND")
  })
})
