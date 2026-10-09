import { createElement as h, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { RouteLink, RouteLinkProvider, shouldIntercept } from "./RouteLink"
import { DEFAULT_LIST, type Route } from "./routes"

const LIST: Route = {
  page: "cards",
  query: { ...DEFAULT_LIST, family: "lp-freihand" },
  evening: null,
}

describe("Links mit Adressen (Plan N3, D3)", () => {
  it("ohne Provider ein <a> mit der Adresse aus urlFromRoute; Attribute gehen durch", () => {
    const html = renderToStaticMarkup(
      h(
        RouteLink,
        { route: LIST, className: "x", "aria-label": "Scheiben", "data-area": "cards" },
        "Scheiben"
      )
    )
    expect(html).toBe(
      '<a href="/cards?family=lp-freihand" class="x" aria-label="Scheiben" data-area="cards">Scheiben</a>'
    )
  })

  it("mit Provider dessen Adresse und Komponente (für next/link in N7)", () => {
    const Custom = ({ href, children }: { href: string; children: ReactNode }) =>
      h("span", { "data-href": href }, children)
    const html = renderToStaticMarkup(
      h(
        RouteLinkProvider,
        { value: { href: (route: Route) => `/app${route.page}`, component: Custom } },
        h(RouteLink, { route: LIST }, "Scheiben")
      )
    )
    expect(html).toBe('<span data-href="/appcards">Scheiben</span>')
  })

  it("der Klick: mit navigate abgefangen; ein eigener onClick mit preventDefault, ein Ziel außer _self und ohne Provider nicht", () => {
    // die Komponente des Providers fängt die Props ab, ohne DOM
    let onClick: ((event: unknown) => void) | undefined
    const Capture = (props: { onClick: (event: unknown) => void; children?: ReactNode }) => {
      onClick = props.onClick
      return h("a", null, props.children)
    }
    const event = () => {
      const e = {
        button: 0,
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        defaultPrevented: false,
        preventDefault: vi.fn(() => {
          e.defaultPrevented = true
        }),
      }
      return e
    }
    const run = (
      value: { navigate?: (route: Route) => void },
      props: Record<string, unknown> = {}
    ) => {
      renderToStaticMarkup(
        h(
          RouteLinkProvider,
          { value: { ...value, component: Capture } },
          h(RouteLink, { route: LIST, ...props }, "Scheiben")
        )
      )
      const e = event()
      onClick?.(e)
      return e
    }
    const navigate = vi.fn()
    const plain = run({ navigate })
    expect(navigate).toHaveBeenCalledWith(LIST)
    expect(plain.preventDefault).toHaveBeenCalledOnce()

    navigate.mockClear()
    run({ navigate }, { onClick: (e: { preventDefault: () => void }) => e.preventDefault() })
    expect(navigate).not.toHaveBeenCalled()

    navigate.mockClear()
    const blank = run({ navigate }, { target: "_blank" })
    expect(navigate).not.toHaveBeenCalled()
    expect(blank.preventDefault).not.toHaveBeenCalled()

    const none = run({})
    expect(none.preventDefault).not.toHaveBeenCalled()
  })

  it("abgefangen wird nur ein einfacher Klick mit der linken Taste", () => {
    const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }
    expect(shouldIntercept(click)).toBe(true)
    expect(shouldIntercept({ ...click, metaKey: true })).toBe(false)
    expect(shouldIntercept({ ...click, ctrlKey: true })).toBe(false)
    expect(shouldIntercept({ ...click, shiftKey: true })).toBe(false)
    expect(shouldIntercept({ ...click, altKey: true })).toBe(false)
    expect(shouldIntercept({ ...click, button: 1 })).toBe(false)
  })
})
