import { describe, expect, it } from "vitest"

import { utf16Text } from "./text"

// U+1F3AF als Surrogatpaar: ein Codepoint, zwei UTF-16-Codeeinheiten
const target = String.fromCharCode(0xd83c, 0xdfaf)

describe("utf16Text", () => {
  it("zählt Codeeinheiten, nicht Codepoints", () => {
    const schema = utf16Text(0, 4)
    expect(schema.safeParse(target.repeat(2)).success).toBe(true)
    const result = schema.safeParse(target.repeat(3))
    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.code)).toEqual(["too_big"])
  })

  it("nimmt die Grenze genau an", () => {
    expect(utf16Text(1, 3).safeParse("abc").success).toBe(true)
    expect(utf16Text(1, 3).safeParse("abcd").success).toBe(false)
  })

  it("verlangt die Mindestlänge", () => {
    expect(utf16Text(1, 3).safeParse("").success).toBe(false)
    expect(utf16Text(0, 3).safeParse("").success).toBe(true)
  })
})
