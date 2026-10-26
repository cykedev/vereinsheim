import { describe, expect, it } from "vitest"

import { hasPdfHeader, PDF_HEADER_WINDOW } from "./header"

const withJunk = (length: number) => {
  const head = new TextEncoder().encode("%PDF-1.4\n")
  const bytes = new Uint8Array(length + head.length)
  bytes.fill(0x20, 0, length)
  bytes.set(head, length)
  return bytes
}

describe("hasPdfHeader", () => {
  it("Kopf am Anfang", () => {
    expect(hasPdfHeader(withJunk(0))).toBe(true)
  })

  it("bis Byte 1019 geduldet wie in pdf.js, ab Byte 1020 nicht", () => {
    expect(PDF_HEADER_WINDOW).toBe(1024)
    expect(hasPdfHeader(withJunk(1019))).toBe(true)
    expect(hasPdfHeader(withJunk(1020))).toBe(false)
  })

  it("leerer Puffer und anderer Inhalt", () => {
    expect(hasPdfHeader(new Uint8Array(0))).toBe(false)
    expect(hasPdfHeader(new TextEncoder().encode("<html>"))).toBe(false)
    expect(hasPdfHeader(new TextEncoder().encode("%PDF"))).toBe(false)
  })
})
