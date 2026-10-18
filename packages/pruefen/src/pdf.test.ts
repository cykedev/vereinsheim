import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { pdfPages, pdfText } from "./pdf"

/** ein kleinstes PDF mit einer Zeile Text je Seite, die Querverweise richtig gezählt */
function tinyPdf(lines: string[]): Uint8Array {
  const kids = lines.map((_, i) => `${4 + i * 2} 0 R`).join(" ")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${kids}] /Count ${lines.length} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  for (const [i, line] of lines.entries()) {
    const stream = `BT /F1 24 Tf 72 720 Td (${line}) Tj ET`
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    )
  }
  let body = "%PDF-1.4\n"
  const offsets = objects.map((object, i) => {
    const at = body.length
    body += `${i + 1} 0 obj\n${object}\nendobj\n`
    return at
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const at of offsets) body += `${String(at).padStart(10, "0")} 00000 n \n`
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(body)
}

const poppler = !spawnSync("pdftotext", ["-v"]).error
const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe.skipIf(!poppler)("PDF über Poppler", () => {
  const pdf = tinyPdf(["Hallo Vereinsheim", "Zweite Seite"])

  it("liest den Text jeder Seite in ihrer Reihenfolge", () => {
    const text = pdfText(pdf)
    expect(text.indexOf("Hallo Vereinsheim")).toBeGreaterThanOrEqual(0)
    expect(text.indexOf("Zweite Seite")).toBeGreaterThan(text.indexOf("Hallo Vereinsheim"))
  })

  it("legt je Seite ein Bild ab, in der Reihenfolge der Seiten", () => {
    const dir = mkdtempSync(join(tmpdir(), "pruefen-test-"))
    dirs.push(dir)
    const pages = pdfPages(pdf, dir, "probe")
    expect(pages.map((p) => p.slice(dir.length + 1))).toEqual(["probe-1.png", "probe-2.png"])
    for (const page of pages) expect(statSync(page).size).toBeGreaterThan(0)
  })
})

describe("ohne Poppler", () => {
  it("sagt in einem Satz, wie es zu installieren ist", () => {
    const path = process.env.PATH
    process.env.PATH = ""
    try {
      expect(() => pdfText(tinyPdf(["x"]))).toThrow(
        /pdftotext nicht gefunden.*brew install poppler/
      )
    } finally {
      process.env.PATH = path
    }
  })
})
