import { existsSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { isAdminPath } from "@/lib/admin-path"

import { ADMIN_SECTIONS } from "./sections"

const APP = join(__dirname, "../../app/(app)")

describe("Bereiche des Admins", () => {
  it("jeder Bereich einmal, in der Reihenfolge der Reiter", () => {
    expect(ADMIN_SECTIONS.map((s) => s.key)).toEqual([
      "overview",
      "users",
      "disciplines",
      "lists",
      "site",
    ])
    expect(new Set(ADMIN_SECTIONS.map((s) => s.href)).size).toBe(ADMIN_SECTIONS.length)
  })

  it("jede Adresse gehört zu Admin und hat eine Seite", () => {
    for (const { href } of ADMIN_SECTIONS) {
      expect(isAdminPath(href)).toBe(true)
      expect(existsSync(join(APP, href, "page.tsx")), href).toBe(true)
    }
  })
})
