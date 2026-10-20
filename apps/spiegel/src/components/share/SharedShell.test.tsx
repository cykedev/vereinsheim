import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import SharedCardNotFound from "../../app/share/[shareId]/not-found"
import { SharedShell } from "./SharedShell"

describe("geteilte Scheibe", () => {
  it("der Rahmen hat keine Links und keine Navigation, nur die Kopfzeile als Text", () => {
    const html = renderToStaticMarkup(
      createElement(SharedShell, null, createElement("p", null, "Inhalt"))
    )
    expect(html).toContain("Geteilte Scheibe · Spiegel")
    expect(html).toContain("<p>Inhalt</p>")
    expect(html).not.toContain("<a")
    expect(html).not.toContain("<nav")
  })

  it("der Hinweis, wenn der Link nicht mehr geht, ohne Weg in die App", () => {
    const html = renderToStaticMarkup(createElement(SharedCardNotFound))
    expect(html).toContain("Diese Scheibe ist nicht mehr geteilt")
    expect(html).toContain("Das Teilen wurde beendet oder die Scheibe gelöscht.")
    expect(html).not.toContain("<a")
  })
})
