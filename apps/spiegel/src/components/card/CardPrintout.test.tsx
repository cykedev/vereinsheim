import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { CardPrintout } from "./CardPrintout"

const render = (props: Parameters<typeof CardPrintout>[0]) =>
  renderToStaticMarkup(createElement(CardPrintout, props))
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

describe("Zeile „Ausdruck“", () => {
  it("die ID klein in acht Zeichen, Druckzeit und das PDF über die eigene Route", () => {
    const html = render({
      hex: "ff914420",
      printouts: [
        {
          id: "cprint0000000000000000001",
          printedAtMs: Date.UTC(2026, 9, 27, 18, 52),
          unreadable: false,
        },
      ],
      timeZone: "Europe/Berlin",
    })
    expect(html).toContain('data-printed-id="ff914420"')
    expect(text(html)).toContain("ID ff914420 · gedruckt Di 27.10.2026 um 19:52")
    expect(html).toMatch(
      /<a data-printout-file="true" href="\/api\/printouts\/cprint0000000000000000001" target="_blank" rel="noopener"/
    )
    expect(text(html)).toContain("PDF öffnen")
  })

  it("ein zweiter Ausdruck steht darunter", () => {
    const html = render({
      hex: "ff914420",
      printouts: [
        {
          id: "cprint0000000000000000001",
          printedAtMs: Date.UTC(2026, 9, 27, 18, 52),
          unreadable: false,
        },
        {
          id: "cprint0000000000000000002",
          printedAtMs: Date.UTC(2026, 9, 27, 19, 31),
          unreadable: false,
        },
      ],
      timeZone: "Europe/Berlin",
    })
    expect(html.match(/data-printout-file/g)).toHaveLength(2)
    expect(text(html)).toContain("Weiterer Ausdruck, gedruckt Di 27.10.2026 um 20:31")
  })

  it("ohne PDF: nur die ID und wie das PDF an die Scheibe kommt", () => {
    const html = render({ hex: "7fff0a02", printouts: [], timeZone: "Europe/Berlin" })
    expect(html).not.toContain("data-printout-file")
    expect(text(html)).toBe(
      "Ausdruck ID 7fff0a02 Das PDF hängt an, wenn du den QR-Code unter „Scheibe holen“ scannst."
    )
  })

  it("Werte nicht lesbar: leise neben dem Ausdruck, auch beim weiteren", () => {
    const html = render({
      hex: "ff914420",
      printouts: [
        {
          id: "cprint0000000000000000001",
          printedAtMs: Date.UTC(2026, 9, 27, 18, 52),
          unreadable: true,
        },
        {
          id: "cprint0000000000000000002",
          printedAtMs: Date.UTC(2026, 9, 27, 19, 31),
          unreadable: true,
        },
      ],
      timeZone: "Europe/Berlin",
    })
    expect(text(html)).toContain(
      "ID ff914420 · gedruckt Di 27.10.2026 um 19:52 · Werte nicht lesbar"
    )
    expect(text(html)).toContain(
      "Weiterer Ausdruck, gedruckt Di 27.10.2026 um 20:31 · Werte nicht lesbar"
    )
    expect(html.match(/data-printout-unreadable/g)).toHaveLength(2)
  })

  it("lesbar: kein Zusatz", () => {
    const html = render({
      hex: "ff914420",
      printouts: [{ id: "cprint0000000000000000001", printedAtMs: null, unreadable: false }],
      timeZone: "Europe/Berlin",
    })
    expect(html).not.toContain("data-printout-unreadable")
    expect(text(html)).not.toContain("Werte nicht lesbar")
  })
})
