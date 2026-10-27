import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CameraScan } from "./CameraScan"

// Die Bedienung (Kamera, Foto) prüft ein Mensch: headless gibt es keine Kamera. Lesen der Codes deckt `qr.test.ts`.
describe("QR-Code scannen (Markup)", () => {
  it("Knöpfe mit Namen; das Video erst, wenn die Kamera läuft", () => {
    const html = renderToStaticMarkup(
      createElement(CameraScan, { onLink: () => {}, disabled: false })
    )
    expect(html).toMatch(/<button[^>]*data-camera-start="true"[^>]*>Kamera starten<\/button>/)
    expect(html).toMatch(
      /<input id="fetch-photo" type="file" accept="image\/\*" capture="environment"/
    )
    expect(html).toMatch(
      /<label for="fetch-photo" data-camera-photo="true"[^>]*>Foto aufnehmen<\/label>/
    )
    expect(html).toMatch(/<video[^>]*class="hidden"/)
    expect(html).not.toContain("Kamera beenden")
  })

  it("während Spiegel liest, sind beide Wege gesperrt", () => {
    const html = renderToStaticMarkup(
      createElement(CameraScan, { onLink: () => {}, disabled: true })
    )
    expect(html).toMatch(/<button[^>]*data-camera-start="true"[^>]*disabled=""/)
    expect(html).toMatch(/<input id="fetch-photo"[^>]*disabled=""/)
  })
})
