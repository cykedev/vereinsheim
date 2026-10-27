import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CameraScan } from "./CameraScan"

// Die Bedienung (Kamera, Foto) prüft ein Mensch: headless gibt es keine Kamera. Lesen der Codes deckt `qr.test.ts`.
describe("QR-Code scannen (Markup)", () => {
  it("ein Knopf „QR-Code scannen“, das Foto als verstecktes Feld dahinter, kein zweiter Knopf", () => {
    const html = renderToStaticMarkup(
      createElement(CameraScan, { onLink: () => {}, disabled: false })
    )
    expect(html).toMatch(/<button[^>]*data-camera-start="true"[^>]*>QR-Code scannen<\/button>/)
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).not.toContain("<label")
    expect(html).toMatch(
      /<input id="fetch-photo" type="file" accept="image\/\*" capture="environment" tabindex="-1" aria-hidden="true"/
    )
    expect(html).toMatch(/<video[^>]*class="hidden"/)
    expect(html).not.toContain("Kamera beenden")
    expect(html).not.toContain("data-camera-fallback")
  })

  it("während Spiegel liest, ist der Knopf gesperrt", () => {
    const html = renderToStaticMarkup(
      createElement(CameraScan, { onLink: () => {}, disabled: true })
    )
    expect(html).toMatch(/<button[^>]*data-camera-start="true"[^>]*disabled=""/)
    expect(html).toMatch(/<input id="fetch-photo"[^>]*disabled=""/)
  })
})
