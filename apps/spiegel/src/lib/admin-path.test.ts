import { describe, expect, it } from "vitest"

import { isAdminPath } from "./admin-path"

describe("isAdminPath", () => {
  it("/admin und alles darunter", () => {
    for (const path of ["/admin", "/admin/users", "/admin/site"])
      expect(isAdminPath(path), path).toBe(true)
  })

  it("keine andere Seite, auch nicht mit demselben Anfang", () => {
    for (const path of ["/", "/administration", "/cards", "/profile/admin"])
      expect(isAdminPath(path), path).toBe(false)
  })
})
