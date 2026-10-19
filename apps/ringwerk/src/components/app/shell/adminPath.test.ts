import { describe, expect, it } from "vitest"

import { isAdminPath } from "./adminPath"

describe("isAdminPath", () => {
  it("Admin und alles darunter", () => {
    expect(isAdminPath("/admin")).toBe(true)
    expect(isAdminPath("/admin/users/new")).toBe(true)
    expect(isAdminPath("/admin/audit-log")).toBe(true)
  })

  it("nicht, was nur mit /admin beginnt, und nicht andere Bereiche", () => {
    expect(isAdminPath("/administration")).toBe(false)
    expect(isAdminPath("/competitions")).toBe(false)
    expect(isAdminPath("/")).toBe(false)
  })
})
