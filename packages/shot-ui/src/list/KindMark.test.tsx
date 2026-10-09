import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { KindMark } from "./KindMark"

const visible = (html: string) =>
  html
    .replace(/<span class="sr-only">[^<]*<\/span>/g, "")
    .replace(/<[^>]+>/g, "")
    .trim()

describe("Art in den Listen (U3, D7)", () => {
  it("Wettkampf als Pokal, der Name für den Screenreader", () => {
    const html = renderToStaticMarkup(h(KindMark, { kind: "competition" }))
    expect(html).toContain("lucide-trophy")
    expect(html).toContain('<span class="sr-only">Wettkampf</span>')
    expect(visible(html)).toBe("")
  })

  it("Training ohne Zeichen, nur für den Screenreader", () => {
    const html = renderToStaticMarkup(h(KindMark, { kind: "training" }))
    expect(html).not.toContain("<svg")
    expect(html).toBe('<span class="sr-only">Training</span>')
  })

  it("Training nur aus Probe als Wort „Probe“", () => {
    const html = renderToStaticMarkup(h(KindMark, { kind: "probe" }))
    expect(visible(html)).toBe("Probe")
    expect(html).toContain('<span class="sr-only">Training nur Probe</span>')
  })
})
