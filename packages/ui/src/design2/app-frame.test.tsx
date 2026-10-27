import { BookOpen, ChartLine, CircleUser, House, Plus, Shield, Target } from "lucide-react"
import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { AppFrame, type AppFrameProps, type FrameItem } from "./app-frame"

const start: FrameItem = {
  key: "start",
  label: "Start",
  short: "Start",
  Icon: House,
  badge: 3,
  badgeLabel: "Start, 3 offen",
}
const diary: FrameItem = { key: "diary", label: "Tagebuch", short: "Tagebuch", Icon: BookOpen }
const stats: FrameItem = { key: "stats", label: "Statistik", short: "Statistik", Icon: ChartLine }
const goals: FrameItem = { key: "goals", label: "Ziele", short: "Ziele", Icon: Target }
const profile: FrameItem = { key: "profile", label: "Profil", short: "Profil", Icon: CircleUser }
const admin: FrameItem = { key: "admin", label: "Admin", short: "Admin", Icon: Shield }
const create: FrameItem = { key: "new", label: "Neue Einheit", short: "Neu", Icon: Plus }

const render = (patch: Partial<AppFrameProps> = {}) =>
  renderToStaticMarkup(
    h(
      AppFrame,
      {
        brand: "Treffsicher",
        primary: [start, diary, stats, goals],
        secondary: [profile, admin],
        action: create,
        bar: ["start", "diary", "new", "stats", "profile"],
        current: "diary",
        renderLink: (item, props) => h("a", { href: `/${item.key}`, ...props }),
        ...patch,
      },
      h("div", { "data-page": true }, "Seite")
    )
  )

/** die Einträge einer Leiste in ihrer Reihenfolge */
const keysIn = (html: string, marker: string) => {
  const begin = html.indexOf(marker)
  const end = html.indexOf("</nav>", begin)
  return [...html.slice(begin, end).matchAll(/data-area="([a-z]+)"/g)].map((m) => m[1])
}

describe("AppFrame", () => {
  const html = render()

  it("Seitenleiste: Name der App, oben die Bereiche, die Aktion als Pille, nach dem Trenner Profil und Admin", () => {
    expect(html).toContain(">Treffsicher</p>")
    expect(keysIn(html, "data-app-sidebar")).toEqual([
      "start",
      "diary",
      "stats",
      "goals",
      "new",
      "profile",
      "admin",
    ])
    expect(html).toMatch(/data-area="new"[^>]*rounded-full bg-primary[^>]*>.*?Neue Einheit<\/a>/)
  })

  it("die Leisten zeigen nur die Schlüssel aus bar, die Aktion in der Mitte", () => {
    expect(keysIn(html, "data-app-bar")).toEqual(["start", "diary", "new", "stats", "profile"])
    expect(keysIn(html, "data-app-rail")).toEqual(["start", "diary", "new", "stats", "profile"])
    expect(html).toContain("grid-cols-5")
    const bar = html.slice(html.indexOf("data-app-bar"))
    expect(bar).toMatch(/<div class="flex justify-center"><a href="\/new" data-area="new"/)
  })

  it("mit vier Feldern ohne Aktion vier Spalten", () => {
    const four = render({ action: undefined, bar: ["start", "diary", "stats", "profile"] })
    expect(four).toContain("grid-cols-4")
    expect(four).not.toContain("grid-cols-5")
    expect(four).not.toContain('data-area="new"')
  })

  it("mit drei Feldern drei Spalten, ohne leere vierte", () => {
    const three = render({ action: undefined, bar: ["start", "diary", "profile"] })
    expect(three).toContain("grid-cols-3")
    expect(three).not.toContain("grid-cols-4")
  })

  it("aria-current am Eintrag der Seite; die Leisten folgen barCurrent", () => {
    expect(html.match(/aria-current="page"/g)).toHaveLength(3)
    const moved = render({ current: "admin", barCurrent: "profile" })
    expect(keysIn(moved, "data-app-sidebar")).toContain("admin")
    expect(moved).toMatch(/data-area="admin" aria-current="page"/)
    const bar = moved.slice(moved.indexOf("data-app-bar"))
    expect(bar).toMatch(/data-area="profile" aria-current="page"/)
    expect(bar).not.toContain('data-area="admin"')
  })

  it("Unterseiten nur in der Seitenleiste, eingerückt unter ihrem Bereich, mit eigenem aria-current", () => {
    const compare: FrameItem = {
      key: "compare",
      label: "Vergleichen",
      short: "Vergleichen",
      Icon: ChartLine,
    }
    const nested = render({
      primary: [start, diary, { ...stats, sub: [compare] }, goals],
      current: "compare",
      barCurrent: "stats",
    })
    expect(keysIn(nested, "data-app-sidebar")).toEqual([
      "start",
      "diary",
      "stats",
      "compare",
      "goals",
      "new",
      "profile",
      "admin",
    ])
    expect(nested).toMatch(
      /data-area="compare" aria-current="page"[^>]*><span data-sub-entry="true">Vergleichen/
    )
    const bar = nested.slice(nested.indexOf("data-app-bar"))
    expect(bar).not.toContain('data-area="compare"')
    expect(bar).toMatch(/data-area="stats" aria-current="page"/)
  })

  it("ein Zeichen mit Zahl trägt den Namen mit Zahl; ohne Zahl kein Zeichen", () => {
    expect(html).toMatch(/data-area="start" aria-label="Start, 3 offen"/)
    expect(html.match(/data-badge/g)).toHaveLength(3)
    const none = render({ primary: [{ ...start, badge: 0 }, diary, stats, goals] })
    expect(none).not.toContain("data-badge")
    expect(none).not.toContain("3 offen")
  })

  it("der Platz der Leisten kommt aus design2.css (--app-bar, --app-rail), nicht aus der Wurzel", () => {
    expect(html).toContain('<div data-app-frame="true">')
    expect(html).not.toContain("[--app-bar:")
    expect(html).toMatch(/data-app-rail="true" class="[^"]*w-\(--app-rail\)/)
    expect(html).toMatch(
      /<main data-app-content="true" class="[^"]*max-lg:\[@media\(max-height:499px\)\]:pl-\(--app-rail\)[^"]*pb-\[calc\(var\(--app-bar\)\+env\(safe-area-inset-bottom\)\)\]/
    )
  })

  it("die Fußzeile der Seitenleiste nur, wenn es eine gibt", () => {
    expect(html).not.toContain("data-sidebar-footer")
    expect(render({ sidebarFooter: h("span", null, "Darstellung") })).toContain(
      "data-sidebar-footer"
    )
  })
})
