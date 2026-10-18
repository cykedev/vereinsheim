import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, ...props }: { href: string } & Record<string, unknown>) =>
    h("a", { href, ...props }),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({}) }))
vi.mock("@/lib/account/actions", () => ({ changeOwnPassword: vi.fn() }))

const { ProfileScreen } = await import("./ProfileScreen")

const render = (isAdmin: boolean) =>
  renderToStaticMarkup(h(ProfileScreen, { name: "Erika", email: "erika@example.test", isAdmin }))

/** die Ziele der Links unter „Weitere Bereiche“ */
const more = (html: string) => {
  const begin = html.indexOf('aria-label="Weitere Bereiche"')
  const end = html.indexOf("</nav>", begin)
  return [...html.slice(begin, end).matchAll(/href="([^"]+)"/g)].map((m) => m[1])
}

describe("ProfileScreen", () => {
  it("Weitere Bereiche nur unter 1024 px, Admin nur für Admins", () => {
    const html = render(true)
    expect(html).toMatch(/<nav aria-label="Weitere Bereiche" class="[^"]*lg:hidden/)
    expect(more(html)).toEqual(["/goals", "/shot-routines", "/disciplines", "/admin"])
    expect(more(render(false))).toEqual(["/goals", "/shot-routines", "/disciplines"])
  })

  it("Darstellung, Passwort und Abmelden", () => {
    const html = render(false)
    expect(html).toContain("data-theme-switch")
    expect(html).toContain("Passwort ändern")
    expect(html).toContain("Abmelden")
    expect(html).toContain("Erika · erika@example.test")
  })
})
