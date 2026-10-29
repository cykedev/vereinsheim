import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { revealOffset, TabBar, type TabBarItem } from "./tab-bar"

interface Item extends TabBarItem {
  href: string
}

const ITEMS: Item[] = [
  { key: "a", label: "Übersicht", href: "/a" },
  { key: "b", label: "Konten", href: "/b" },
  { key: "c", label: "Anlage und Brücke", href: "/c" },
]

const render = (props: { current: string | null; detail?: boolean; className?: string }) =>
  renderToStaticMarkup(
    createElement(TabBar<Item>, {
      label: "Admin",
      items: ITEMS,
      renderLink: (item, linkProps) => createElement("a", { href: item.href, ...linkProps }),
      ...props,
    })
  )

/** Klassen aus dem Markup; es maskiert „&“ und „>“ im Attribut */
const classesOf = (html: string, pattern: RegExp) =>
  (html.match(pattern)?.[1] ?? "").replaceAll("&amp;", "&").replaceAll("&gt;", ">").split(" ")

describe("TabBar", () => {
  it("eine Zeile, die wischt: die Leiste scrollt in sich, kein Reiter bricht oder schrumpft", () => {
    const html = render({ current: "a" })
    const bar = classesOf(html, /data-tab-bar="[^"]*" class="([^"]+)"/)
    for (const cls of [
      "overflow-x-auto",
      "max-w-full",
      "min-w-0",
      "[scrollbar-width:none]",
      "[&::-webkit-scrollbar]:hidden",
    ])
      expect(bar).toContain(cls)
    expect(bar).not.toContain("flex-wrap")
    const links = [...html.matchAll(/<a [^>]*class="([^"]+)"/g)].map((m) => m[1].split(" "))
    expect(links).toHaveLength(3)
    for (const link of links) {
      expect(link).toContain("shrink-0")
      expect(link).toContain("whitespace-nowrap")
    }
    expect(html).not.toContain("flex-wrap")
  })

  it("nav mit Namen und min-w-0, className landet am nav", () => {
    const html = render({ current: "a", className: "h-14" })
    const nav = classesOf(html, /<nav aria-label="Admin" class="([^"]+)"/)
    expect(nav).toContain("min-w-0")
    expect(nav).toContain("h-14")
  })

  it("markiert genau den gezeigten Reiter, auf einer Unterseite als true, ohne current keinen", () => {
    const page = render({ current: "b" })
    expect(page.match(/aria-current="page"/g)).toHaveLength(1)
    expect(page).toMatch(/href="\/b" aria-current="page"/)
    const detail = render({ current: "c", detail: true })
    expect(detail.match(/aria-current="true"/g)).toHaveLength(1)
    expect(detail).not.toContain('aria-current="page"')
    expect(detail).toMatch(/href="\/c" aria-current="true"/)
    expect(render({ current: null })).not.toContain("aria-current")
  })

  it("Reihenfolge, Text und Ziel aus den Einträgen", () => {
    const html = render({ current: null })
    const links = [...html.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => [
      m[1],
      m[2],
    ])
    expect(links).toEqual([
      ["/a", "Übersicht"],
      ["/b", "Konten"],
      ["/c", "Anlage und Brücke"],
    ])
  })

  it("Farben nur aus Tokens: gewählt in der Farbe der App, keine weiße Pille, keine Palette", () => {
    const html = render({ current: "a" })
    expect(html).toContain("aria-[current=page]:bg-primary")
    expect(html).not.toContain("bg-card")
    expect(html).not.toMatch(
      /\b(?:bg|text|border)-(?:slate|gray|zinc|neutral|stone|red|blue|white|black)\b/
    )
  })
})

describe("revealOffset", () => {
  const bar = { left: 20, right: 200 }
  it("links außerhalb: nach links mit 8 px Luft", () => {
    expect(revealOffset({ left: 10, right: 60 }, bar)).toBe(-18)
  })
  it("rechts außerhalb: nach rechts mit 8 px Luft", () => {
    expect(revealOffset({ left: 180, right: 230 }, bar)).toBe(38)
  })
  it("im Bild: bleibt stehen", () => {
    expect(revealOffset({ left: 40, right: 120 }, bar)).toBe(0)
  })
})
