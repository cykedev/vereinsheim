import { describe, expect, it } from "vitest"

import { DEV_SPIEGEL_URL, disciplineWritable, spiegelUrl } from "./rules"

describe("disciplineWritable", () => {
  const cases: Array<[moved: boolean, isAdmin: boolean, isSystem: boolean, expected: boolean]> = [
    [false, false, false, true],
    [false, false, true, true],
    [false, true, false, true],
    [false, true, true, true],
    [true, false, false, false],
    [true, false, true, false],
    [true, true, false, false],
    [true, true, true, true],
  ]

  it.each(cases)("umgezogen %s, Admin %s, System %s → %s", (moved, isAdmin, isSystem, expected) => {
    expect(disciplineWritable({ moved, isAdmin }, { isSystem })).toBe(expected)
  })
})

describe("spiegelUrl", () => {
  it("nimmt die Wurzel einer gültigen Adresse", () => {
    expect(spiegelUrl("https://spiegel.example.com/x", true)).toBe("https://spiegel.example.com")
    expect(spiegelUrl("http://localhost:18082", true)).toBe("http://localhost:18082")
  })

  it.each([["ftp://a"], ["https://:8082"], [""], [undefined]])(
    "%s gilt als fehlend: Dev-Server außerhalb von Produktion, in Produktion kein Ziel",
    (value) => {
      expect(spiegelUrl(value, false)).toBe(DEV_SPIEGEL_URL)
      expect(spiegelUrl(value, true)).toBeNull()
    }
  )

  it("der Dev-Server ist Spiegel auf seinem Port", () => {
    expect(DEV_SPIEGEL_URL).toBe("http://localhost:3002")
  })
})
