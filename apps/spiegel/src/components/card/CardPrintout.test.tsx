import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { forbiddenIn } from "@vereinsheim/lib/wording"

import { OLD_WORDS } from "@/lib/admin/consequences"

import { CardPrintout, MISMATCHED_VALUES, UNREADABLE_VALUES } from "./CardPrintout"

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
          mismatch: false,
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
          mismatch: false,
        },
        {
          id: "cprint0000000000000000002",
          printedAtMs: Date.UTC(2026, 9, 27, 19, 31),
          unreadable: false,
          mismatch: false,
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
          mismatch: false,
        },
        {
          id: "cprint0000000000000000002",
          printedAtMs: Date.UTC(2026, 9, 27, 19, 31),
          unreadable: true,
          mismatch: false,
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

  it("passt nicht zur Disziplin: der andere leise Grund", () => {
    const html = render({
      hex: "ff914420",
      printouts: [
        {
          id: "cprint0000000000000000001",
          printedAtMs: Date.UTC(2026, 9, 27, 18, 52),
          unreadable: false,
          mismatch: true,
        },
      ],
      timeZone: "Europe/Berlin",
    })
    expect(text(html)).toContain(
      "gedruckt Di 27.10.2026 um 19:52 · Werte passen nicht zur Disziplin. Mit der passenden Disziplin übernimmt Spiegel sie."
    )
    expect(html).toContain("data-printout-mismatch")
    expect(html).not.toContain("data-printout-unreadable")
  })

  it("lesbar: kein Zusatz", () => {
    const html = render({
      hex: "ff914420",
      printouts: [
        { id: "cprint0000000000000000001", printedAtMs: null, unreadable: false, mismatch: false },
      ],
      timeZone: "Europe/Berlin",
    })
    expect(html).not.toContain("data-printout-unreadable")
    expect(html).not.toContain("data-printout-mismatch")
    expect(text(html)).not.toContain("Werte nicht lesbar")
  })

  it("keine Semikolons, keine alten Wörter", () => {
    expect(forbiddenIn([UNREADABLE_VALUES, MISMATCHED_VALUES])).toEqual([])
    for (const text of [UNREADABLE_VALUES, MISMATCHED_VALUES]) expect(text).not.toMatch(OLD_WORDS)
  })
})
