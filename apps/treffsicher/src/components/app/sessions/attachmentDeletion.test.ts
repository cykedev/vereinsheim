import { describe, expect, it } from "vitest"

import { attachmentToDelete } from "./attachmentDeletion"

const attachments = [{ id: "a1" }, { id: "a2" }, { id: "a3" }]

describe("attachmentToDelete", () => {
  it("der gewählte Anhang, nicht der erste oder letzte", () => {
    expect(attachmentToDelete({ id: "a2" }, attachments)).toBe("a2")
  })

  it("ohne Wahl nichts", () => {
    expect(attachmentToDelete(null, attachments)).toBeNull()
  })

  it("nicht mehr an der Einheit: nichts", () => {
    expect(attachmentToDelete({ id: "a9" }, attachments)).toBeNull()
  })
})
