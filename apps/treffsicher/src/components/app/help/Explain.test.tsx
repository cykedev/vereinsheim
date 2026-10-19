import { createElement as h } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { Heart } from "lucide-react"
import { describe, expect, it } from "vitest"

import { SessionDetailSectionCard } from "@/components/app/sessions/detail/SessionDetailSectionCard"

describe("Hilfe an einer Karte", () => {
  it("„?“ im Kopf mit dem Namen des Themas, der Kurzsatz erst mit „Erklärungen“", () => {
    const html = renderToStaticMarkup(
      h(SessionDetailSectionCard, {
        title: "Befinden",
        icon: Heart,
        help: "wellbeing",
        children: "x",
      })
    )
    expect(html).toContain('aria-label="Erklärung: Befinden"')
    expect(html).toContain('data-help="wellbeing"')
    expect(html).not.toContain("data-help-short")
  })

  it("ohne Thema kein „?“", () => {
    const html = renderToStaticMarkup(
      h(SessionDetailSectionCard, { title: "Reflexion", icon: Heart, children: "x" })
    )
    expect(html).not.toContain("data-help")
  })
})
