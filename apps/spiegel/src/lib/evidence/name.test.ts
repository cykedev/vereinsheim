import { describe, expect, it } from "vitest"

import { EVIDENCE_NAME_MAX, evidenceFileName, shortName } from "./name"

const length = (text: string) => [...text].length

describe("Name eines Belegs", () => {
  it("nimmt nur den letzten Teil eines Pfads", () => {
    expect(evidenceFileName("C:\\Users\\x\\IMG.jpg")).toBe("IMG.jpg")
    expect(evidenceFileName("a/b/c.pdf")).toBe("c.pdf")
  })

  it("entfernt Steuer- und Richtungszeichen", () => {
    expect(evidenceFileName("Liste\u0000\u0007.pdf")).toBe("Liste.pdf")
    expect(evidenceFileName("rechnung\u202Efdp.exe")).toBe("rechnungfdp.exe")
    expect(evidenceFileName("a\u200Bb.png")).toBe("ab.png")
  })

  it("setzt Unicode in NFC", () => {
    const nfd = "Ergebnisliste Mu\u0308nchen.pdf"
    expect(evidenceFileName(nfd)).toBe("Ergebnisliste M\u00fcnchen.pdf")
  })

  it("fasst Leerraum zu einem Leerzeichen und trimmt außen", () => {
    expect(evidenceFileName("  Seite \t 1\n von 2.png  ")).toBe("Seite 1 von 2.png")
  })

  it("leer oder nur Leerraum ergibt null", () => {
    expect(evidenceFileName("")).toBeNull()
    expect(evidenceFileName("   \t")).toBeNull()
    expect(evidenceFileName("ordner/")).toBeNull()
    expect(evidenceFileName("\u202E")).toBeNull()
  })

  it("kürzt einen langen Namen am Stamm, die Endung bleibt", () => {
    const name = evidenceFileName(`${"a".repeat(200)}.jpeg`)!
    expect(length(name)).toBe(EVIDENCE_NAME_MAX)
    expect(name.endsWith("….jpeg")).toBe(true)
  })

  it("kürzt einen langen Namen ohne Endung am Ende", () => {
    const name = evidenceFileName("b".repeat(200))!
    expect(length(name)).toBe(EVIDENCE_NAME_MAX)
    expect(name.endsWith("b…")).toBe(true)
  })

  it("lässt einen Namen bis zur Grenze, wie er ist", () => {
    const name = `${"c".repeat(EVIDENCE_NAME_MAX - 4)}.pdf`
    expect(evidenceFileName(name)).toBe(name)
  })

  it("„…“ ist U+2026, nie drei Punkte", () => {
    expect(evidenceFileName(`${"d".repeat(200)}.png`)).toContain("\u2026")
    expect(evidenceFileName(`${"d".repeat(200)}.png`)).not.toContain("...")
  })
})

describe("Name in einem Bericht", () => {
  it("lässt kurze Namen stehen", () => {
    expect(shortName("IMG_2041.jpg")).toBe("IMG_2041.jpg")
  })

  it("kürzt in der Mitte und lässt die Endung stehen", () => {
    const name = shortName("print_7f3a9b2c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f7c2.pdf")
    expect(length(name)).toBe(40)
    expect(name.startsWith("print_7f3a")).toBe(true)
    expect(name.endsWith("c2.pdf")).toBe(true)
    expect(name).toContain("\u2026")
  })

  it("kürzt einen Namen ohne Endung in der Mitte", () => {
    const name = shortName("x".repeat(30) + "y".repeat(30), 21)
    expect(name).toBe(`${"x".repeat(10)}…${"y".repeat(10)}`)
  })
})
