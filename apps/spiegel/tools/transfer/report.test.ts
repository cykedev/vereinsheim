import { describe, expect, it } from "vitest"

import { abortText } from "./report"

describe("abortText", () => {
  it("nennt bei einem nicht zurückgesetzten Merkmal ohne alten Wert die Zeile mit NULL", () => {
    expect(abortText({ kind: "markedNotSaved", previous: null })).toContain(
      `UPDATE "User" SET "movedToSpiegelAt" = NULL WHERE email = '<E-Mail in Treffsicher>';`
    )
  })

  it("nennt mit altem Wert die Zeit in UTC ohne T und Z", () => {
    expect(abortText({ kind: "markedNotSaved", previous: "2026-10-30T18:04:05.123Z" })).toContain(
      `UPDATE "User" SET "movedToSpiegelAt" = '2026-10-30 18:04:05.123' WHERE email = '<E-Mail in Treffsicher>';`
    )
  })
})
