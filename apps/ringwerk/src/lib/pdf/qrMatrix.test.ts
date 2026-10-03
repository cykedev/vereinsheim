import { describe, expect, it } from "vitest"
import QRCode from "qrcode"
import { QR_QUIET_ZONE, qrPathData } from "./qrMatrix"

const URL_PLAIN = "https://ringwerk.example.org/api/public/c/liga-2026/pdf"
const URL_TOKEN = `${URL_PLAIN}?k=0b6f0f8e-4d3a-4c5b-9a1e-2f7d8c9b0a12`

/** Every module cell a path covers, as [x, y] — one entry per cell of each run. */
function cells(d: string): [number, number][] {
  return [...d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)].flatMap((m) =>
    Array.from({ length: Number(m[3]) }, (_, i): [number, number] => [
      Number(m[1]) + i,
      Number(m[2]),
    ])
  )
}

describe("qrPathData", () => {
  it("adds the quiet zone on both sides of a valid QR size", () => {
    const { size } = qrPathData(URL_PLAIN)
    const modules = size - 2 * QR_QUIET_ZONE
    expect(modules).toBe(QRCode.create(URL_PLAIN, { errorCorrectionLevel: "M" }).modules.size)
    // QR versions grow in steps of 4 modules, starting at 21
    expect((modules - 21) % 4).toBe(0)
  })

  it("covers exactly the dark modules, nothing more", () => {
    const { modules } = QRCode.create(URL_PLAIN, { errorCorrectionLevel: "M" })
    const dark: string[] = []
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (modules.get(row, col)) dark.push(`${col + QR_QUIET_ZONE},${row + QR_QUIET_ZONE}`)
      }
    }
    const { d } = qrPathData(URL_PLAIN)
    expect(
      cells(d)
        .map(([x, y]) => `${x},${y}`)
        .sort()
    ).toEqual(dark.sort())
    // nothing but run rectangles in the path
    expect(d.replace(/M\d+ \d+h(\d+)v1h-\1z/g, "")).toBe("")
  })

  it("merges horizontal runs instead of drawing single squares", () => {
    const { d } = qrPathData(URL_PLAIN)
    // finder patterns alone contain runs of 7 dark modules
    expect(d).toMatch(/h7v1h-7z/)
  })

  it("keeps every square out of the quiet zone", () => {
    const { size, d } = qrPathData(URL_PLAIN)
    for (const [x, y] of cells(d)) {
      expect(x).toBeGreaterThanOrEqual(QR_QUIET_ZONE)
      expect(y).toBeGreaterThanOrEqual(QR_QUIET_ZONE)
      expect(x).toBeLessThan(size - QR_QUIET_ZONE)
      expect(y).toBeLessThan(size - QR_QUIET_ZONE)
    }
  })

  it("grows (or stays) with a longer payload such as the access token", () => {
    expect(qrPathData(URL_TOKEN).size).toBeGreaterThanOrEqual(qrPathData(URL_PLAIN).size)
  })
})
