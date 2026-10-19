import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

// Klassen auf Tokens, die `design2.css` nicht kennt, erzeugen keine Regel: Die Farbe fällt still auf die Umgebung
// zurück (etwa dunkle Schrift auf dem Rot eines Löschknopfs).
const UNKNOWN = ["destructive-foreground", "sidebar-"]

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === "generated" ? [] : files(full)
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [full] : []
  })
}

describe("Ringwerk nutzt nur Tokens aus Design 2", () => {
  it("keine Klasse auf einem Token, das design2.css nicht definiert", () => {
    const src = path.resolve(import.meta.dirname, "..")
    const hits = files(src).flatMap((file) => {
      const text = readFileSync(file, "utf8")
      return UNKNOWN.filter((token) => text.includes(token)).map(
        (token) => `${path.relative(src, file)}: ${token}`
      )
    })
    expect(hits).toEqual([])
  })
})
