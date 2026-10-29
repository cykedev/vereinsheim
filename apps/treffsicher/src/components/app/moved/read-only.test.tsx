import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { MOVED_TEXTS } from "@/lib/moved/texts"

const nav = vi.hoisted(() => ({ pathname: "/dashboard" }))
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }))

const { MovedBanner, MovedBannerHost } = await import("./MovedBanner")

const URL = "http://localhost:3002"
const banner = (full: boolean, spiegelUrl: string | null = URL) =>
  renderToStaticMarkup(h(MovedBanner, { full, spiegelUrl }))

/** Farbe nur aus Tokens: keine Klasse aus der Palette von Tailwind und kein `dark:` ([[conventions]] §4) */
const PALETTE =
  /\b(?:text|bg|border|ring)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d/

describe("Hinweis für ein umgezogenes Konto", () => {
  it("voll auf Start: Titel, Satz, Knopf zu Spiegel und leise Zeile", () => {
    const html = banner(true)
    expect(html).toContain('data-moved-banner="full"')
    expect(html).toContain(MOVED_TEXTS.bannerTitle)
    expect(html).toContain(MOVED_TEXTS.bannerText)
    expect(html).toMatch(
      /<a [^>]*href="http:\/\/localhost:3002"[^>]*data-moved-link[^>]*>Zu Spiegel<\/a>/
    )
    expect(html).toContain(MOVED_TEXTS.signIn)
    expect(html).not.toContain("target=")
  })

  it("kurz auf allen anderen Seiten: der eine Satz und der Knopf", () => {
    const html = banner(false)
    expect(html).toContain('data-moved-banner="short"')
    expect(html).toContain(MOVED_TEXTS.bannerShort)
    expect(html).not.toContain(MOVED_TEXTS.bannerText)
    expect(html).toContain('href="http://localhost:3002"')
  })

  it("ohne Adresse kein Knopf", () => {
    expect(banner(true, null)).not.toContain("<a")
    expect(banner(false, null)).not.toContain("<a")
  })

  it("Farbe nur aus Tokens", () => {
    // ohne den Knopf: das shadcn-Primitive bringt seine Varianten aus dem Generator mit (im Drift-Gate ausgenommen)
    const own = (html: string) => html.replace(/<a [^>]*data-moved-link[^>]*>/g, "<a>")
    for (const html of [own(banner(true)), own(banner(false))]) {
      expect(html).not.toMatch(PALETTE)
      expect(html).not.toContain("dark:")
    }
  })

  it("voll nur auf Start", () => {
    nav.pathname = "/dashboard"
    expect(renderToStaticMarkup(h(MovedBannerHost, { spiegelUrl: URL }))).toContain(
      'data-moved-banner="full"'
    )
    nav.pathname = "/sessions"
    expect(renderToStaticMarkup(h(MovedBannerHost, { spiegelUrl: URL }))).toContain(
      'data-moved-banner="short"'
    )
  })
})
