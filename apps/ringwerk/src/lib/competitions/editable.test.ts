import { describe, expect, it } from "vitest"
import { offersEdit } from "./editable"

describe("offersEdit", () => {
  it.each(["DRAFT", "ACTIVE", "COMPLETED"] as const)(
    "bietet Bearbeiten an im Status %s",
    (status) => {
      expect(offersEdit(status)).toBe(true)
    }
  )

  it("bietet bei archivierten Wettbewerben kein Bearbeiten an", () => {
    expect(offersEdit("ARCHIVED")).toBe(false)
  })
})
