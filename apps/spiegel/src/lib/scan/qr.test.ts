import { create } from "qrcode"
import { describe, expect, it } from "vitest"

import { MAX_URL_LENGTH } from "../printouts/fetch"
import { decodePixels, fitSize, MAX_LINK_LENGTH, qrLink } from "./qr"

describe("qrLink", () => {
  it("nur http und https, getrimmt, nicht zu lang", () => {
    expect(qrLink("  http://meyton.example/print_ff914420.pdf \n")).toBe(
      "http://meyton.example/print_ff914420.pdf"
    )
    expect(qrLink("https://example.com/a.pdf")).toBe("https://example.com/a.pdf")
    expect(qrLink("ftp://example.com/a.pdf")).toBeNull()
    expect(qrLink("javascript:alert(1)")).toBeNull()
    expect(qrLink("ff914420")).toBeNull()
    expect(qrLink("")).toBeNull()
    expect(qrLink(`http://example.com/${"a".repeat(MAX_LINK_LENGTH)}`)).toBeNull()
  })

  it("dieselbe Grenze wie beim Holen", () => {
    expect(MAX_LINK_LENGTH).toBe(MAX_URL_LENGTH)
  })
})

describe("fitSize", () => {
  it("verkleinert auf die längere Seite, vergrößert nie", () => {
    expect(fitSize(1920, 1080, 640)).toEqual({ width: 640, height: 360 })
    expect(fitSize(1080, 1920, 640)).toEqual({ width: 360, height: 640 })
    expect(fitSize(320, 240, 640)).toEqual({ width: 320, height: 240 })
    expect(fitSize(0, 0, 640)).toEqual({ width: 1, height: 1 })
  })
})

/** ein QR-Code als RGBA-Bild: `scale` Pixel je Modul, vier Module Rand */
function qrImage(text: string, scale = 4) {
  const { modules } = create(text, { errorCorrectionLevel: "M" })
  const margin = 4
  const size = (modules.size + 2 * margin) * scale
  const data = new Uint8ClampedArray(size * size * 4).fill(255)
  for (let row = 0; row < modules.size; row++)
    for (let col = 0; col < modules.size; col++) {
      if (!modules.get(row, col)) continue
      for (let y = 0; y < scale; y++)
        for (let x = 0; x < scale; x++) {
          const i = (((row + margin) * scale + y) * size + (col + margin) * scale + x) * 4
          data[i] = data[i + 1] = data[i + 2] = 0
        }
    }
  return { data, size }
}

describe("decodePixels", () => {
  it("liest die Adresse aus einem QR-Code", async () => {
    const url = "http://192.0.2.10/print_ff914420.pdf"
    const { data, size } = qrImage(url)
    expect(await decodePixels(data, size, size, { both: false })).toBe(url)
    expect(await decodePixels(data, size, size, { both: true })).toBe(url)
  })

  it("ein leeres Bild: null", async () => {
    const data = new Uint8ClampedArray(64 * 64 * 4).fill(255)
    expect(await decodePixels(data, 64, 64, { both: true })).toBeNull()
  })
})
