import { describe, expect, it } from "vitest"

import { searchOf } from "./search"

describe("searchOf", () => {
  it("Schlüssel in ihrer Folge, mehrfache Werte, leere fallen weg", () => {
    expect(searchOf({})).toBe("")
    expect(searchOf({ family: "lp-freihand", kind: undefined })).toBe("?family=lp-freihand")
    expect(searchOf({ flag: ["a", "b"], range: "90d" })).toBe("?flag=a&flag=b&range=90d")
    expect(searchOf({ q: "ä ö" })).toBe("?q=%C3%A4+%C3%B6")
  })
})
