import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

vi.mock("next/link", () => ({
  default: ({ href, ...props }: { href: string } & Record<string, unknown>) =>
    h("a", { href, ...props }),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({}) }))
vi.mock("@/lib/users/actions", () => ({ changeOwnPassword: vi.fn() }))

const { ProfileScreen } = await import("./ProfileScreen")

const render = (role: string) =>
  renderToStaticMarkup(h(ProfileScreen, { name: "Erika", email: "erika@example.test", role }))

/** die Ziele der Links unter „Weitere Bereiche“ */
const more = (html: string) => {
  const begin = html.indexOf('aria-label="Weitere Bereiche"')
  if (begin < 0) return []
  const end = html.indexOf("</nav>", begin)
  return [...html.slice(begin, end).matchAll(/href="([^"]+)"/g)].map((m) => m[1])
}

describe("ProfileScreen", () => {
  it("Weitere Bereiche nur unter 1024 px: Disziplinen für die Sportleitung, Admin nur für Admins", () => {
    const html = render("ADMIN")
    expect(html).toMatch(/<nav aria-label="Weitere Bereiche" class="[^"]*lg:hidden/)
    expect(more(html)).toEqual(["/disciplines", "/admin/users"])
    expect(more(render("MANAGER"))).toEqual(["/disciplines"])
  })

  it("Mitglied ohne weitere Bereiche", () => {
    expect(render("USER")).not.toContain("Weitere Bereiche")
  })

  it("Darstellung, Passwort und Abmelden", () => {
    const html = render("USER")
    expect(html).toContain("data-theme-switch")
    expect(html).toContain("Passwort ändern")
    expect(html).toContain("Abmelden")
    expect(html).toContain("Erika · erika@example.test")
  })
})
