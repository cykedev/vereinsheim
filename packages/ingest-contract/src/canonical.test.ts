import { describe, expect, it } from "vitest"

import { canonicalize, compareUtf16 } from "./canonical"

// Sonderzeichen werden aus Codeeinheiten gebaut, damit der Quelltext reines ASCII bleibt.
const u = (...units: number[]) => String.fromCharCode(...units)
const BS = u(0x5c) // Backslash
const EURO = u(0x20ac)
const EMOJI = u(0xd83d, 0xde00) // U+1F600
const DALET = u(0xfb33)
const CTRL_80 = u(0x80)
const O_UML = u(0xf6)
const LS = u(0x2028)

describe("canonicalize (RFC 8785)", () => {
  it("serialisiert das Beispiel aus RFC 8785 Abschnitt 3.2.2", () => {
    const input = {
      numbers: [333333333.33333329, 1e30, 4.5, 2e-3, 0.000000000000000000000000001],
      // RFC: "€$\u000F\u000aA'B"\\\\"\/"
      string: `${EURO}$${u(0x0f, 0x0a)}A'B"${BS}${BS}"/`,
      literals: [null, true, false],
    }
    const expectedString = `"${EURO}$${BS}u000f${BS}nA'B${BS}"${BS}${BS}${BS}${BS}${BS}"/"`
    expect(canonicalize(input)).toBe(
      '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],' +
        `"string":${expectedString}}`
    )
  })

  it("sortiert Schlüssel nach UTF-16-Codeeinheiten wie RFC 8785 Abschnitt 3.2.3", () => {
    const input = {
      [EURO]: "Euro Sign",
      "\r": "Carriage Return",
      [DALET]: "Hebrew Letter Dalet With Dagesh",
      "1": "One",
      [EMOJI]: "Emoji: Grinning Face",
      [CTRL_80]: "Control",
      [O_UML]: "Latin Small Letter O With Diaeresis",
    }
    expect(canonicalize(input)).toBe(
      `{"${BS}r":"Carriage Return","1":"One","${CTRL_80}":"Control",` +
        `"${O_UML}":"Latin Small Letter O With Diaeresis","${EURO}":"Euro Sign",` +
        `"${EMOJI}":"Emoji: Grinning Face","${DALET}":"Hebrew Letter Dalet With Dagesh"}`
    )
  })

  it('lässt Nicht-ASCII, / und U+2028 roh und escapet nur Steuerzeichen, " und Backslash', () => {
    const input = `${O_UML}/${LS}${u(0x1f)}\n"${BS}`
    expect(canonicalize(input)).toBe(`"${O_UML}/${LS}${BS}u001f${BS}n${BS}"${BS}${BS}"`)
  })

  it("schreibt Arrays in ihrer Reihenfolge und ohne Leerzeichen", () => {
    expect(canonicalize([3, "a", [null], {}])).toBe('[3,"a",[null],{}]')
  })

  it("schreibt -0 als 0", () => {
    expect(canonicalize(-0)).toBe("0")
  })

  it.each([
    ["einzelnes hohes Surrogat im Wert", u(0xd83d)],
    ["einzelnes tiefes Surrogat im Wert", `a${u(0xde00)}b`],
    ["einzelnes Surrogat im Schlüssel", { [u(0xd83d)]: "x" }],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["undefined", undefined],
    ["undefined im Objekt", { a: undefined }],
    ["Funktion", () => 1],
    ["BigInt", BigInt(1)],
    ["Date", new Date(0)],
    ["Map", new Map()],
  ])("lehnt %s ab", (_name, value) => {
    expect(() => canonicalize(value)).toThrow(TypeError)
  })
})

describe("compareUtf16", () => {
  it("ordnet nach Codeeinheiten, nicht nach Codepoints", () => {
    // U+1F600 beginnt mit dem Surrogat 0xD83D und liegt in UTF-16 vor U+FB33, als Codepoint dahinter.
    expect(compareUtf16(EMOJI, DALET)).toBeLessThan(0)
    expect(compareUtf16(DALET, EMOJI)).toBeGreaterThan(0)
    expect(compareUtf16("a", "a")).toBe(0)
    expect(compareUtf16("a", "ab")).toBeLessThan(0)
  })
})
