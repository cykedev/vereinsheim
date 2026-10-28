import { describe, expect, it } from "vitest"

import { dateOfDay, dayInput, dayOfDate, parseExpectedScore, textInput } from "./validation"

describe("textInput", () => {
  it("leer ist kein Wert, Rand ohne Leerraum, Zeilen und Striche bleiben", () => {
    expect(textInput.parse("")).toBeNull()
    expect(textInput.parse("  \n ")).toBeNull()
    expect(textInput.parse("  Griff locker  ")).toBe("Griff locker")
    expect(textInput.parse("- Griff\r\n- Atmung\n\n- Ruhe")).toBe("- Griff\n- Atmung\n\n- Ruhe")
  })

  it("höchstens 2.000 Zeichen", () => {
    expect(textInput.safeParse("x".repeat(2000)).success).toBe(true)
    expect(textInput.safeParse("x".repeat(2001)).success).toBe(false)
    expect(textInput.safeParse(` ${"x".repeat(2000)} `).success).toBe(true)
  })
})

describe("parseExpectedScore", () => {
  it("nimmt Komma oder Punkt und höchstens eine Nachkommastelle", () => {
    expect(parseExpectedScore("340")).toBe(340)
    expect(parseExpectedScore("340,5")).toBe(340.5)
    expect(parseExpectedScore(" 340.5 ")).toBe(340.5)
    expect(parseExpectedScore("")).toBeNull()
    expect(parseExpectedScore("340,55")).toBeUndefined()
    expect(parseExpectedScore("1000")).toBeUndefined()
    expect(parseExpectedScore("-3")).toBeUndefined()
    expect(parseExpectedScore("drei")).toBeUndefined()
  })
})

describe("Tag", () => {
  it("nimmt nur Tage, die es gibt", () => {
    expect(dayInput.safeParse("2026-10-28").success).toBe(true)
    expect(dayInput.safeParse("2026-02-30").success).toBe(false)
    expect(dayInput.safeParse("28.10.2026").success).toBe(false)
  })

  it("speichert den Tag als Datum und liest ihn gleich zurück", () => {
    expect(dayOfDate(dateOfDay("2026-03-13"))).toBe("2026-03-13")
  })
})
