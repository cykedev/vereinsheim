import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { AdminTabs } from "./AdminTabs"

/** die Links der Reiter als [href, aria-current] */
const tabs = (html: string) =>
  [...html.matchAll(/<a [^>]*>/g)].map(([tag]) => [
    tag.match(/ href="([^"]+)"/)?.[1] ?? null,
    tag.match(/ aria-current="([^"]+)"/)?.[1] ?? null,
  ])

describe("Reiter des Admins (Markup)", () => {
  it("fünf Bereiche in fester Reihenfolge, Listen als eigener Reiter", () => {
    const html = renderToStaticMarkup(createElement(AdminTabs, { current: "overview" }))
    expect(tabs(html).map(([href]) => href)).toEqual([
      "/admin",
      "/admin/users",
      "/admin/disciplines",
      "/admin/lists",
      "/admin/site",
    ])
    expect(html).toContain(">Listen<")
    expect(html).toContain(">Anlage und Brücke<")
  })

  it("auf der Seite eines Bereichs ist sein Reiter die Seite", () => {
    const html = renderToStaticMarkup(createElement(AdminTabs, { current: "lists" }))
    expect(tabs(html).filter(([, current]) => current)).toEqual([["/admin/lists", "page"]])
  })

  it("auf einer Unterseite ist der Reiter ihres Bereichs markiert und führt zurück", () => {
    const html = renderToStaticMarkup(createElement(AdminTabs, { current: "users", detail: true }))
    expect(tabs(html).filter(([, current]) => current)).toEqual([["/admin/users", "true"]])
  })

  it("eine Zeile, die wischt: kein Umbruch, die Leiste scrollt in sich", () => {
    const html = renderToStaticMarkup(createElement(AdminTabs, { current: "site" }))
    expect(html).not.toContain("flex-wrap")
    expect(html).toContain("data-tab-bar")
    expect(html).toContain("overflow-x-auto")
  })
})
