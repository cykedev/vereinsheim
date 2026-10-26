import { existsSync, readdirSync, readFileSync } from "node:fs"
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

  it("jede Seite unter Admin trägt die Reiter, auch die Unterseiten", () => {
    const pages = readdirSync(join(APP, "admin"), { recursive: true, encoding: "utf8" }).filter(
      (file) => file.endsWith("page.tsx")
    )
    expect(pages.length).toBeGreaterThanOrEqual(9)
    for (const file of pages) {
      const page = readFileSync(join(APP, "admin", file), "utf8")
      expect(/<Admin(Header|Tabs)\s/.test(page), file).toBe(true)
    }
  })
})
