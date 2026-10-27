import { describe, expect, it } from "vitest"

import { forbiddenIn } from "@vereinsheim/lib/wording"

import { CardRequestStatus } from "@/generated/prisma/enums"
import { OLD_WORDS } from "@/lib/admin/consequences"

import {
  REQUEST_STATUS_NOTE,
  REQUEST_STATUS_TEXT,
  requestRemovable,
  requestShown,
  requestStateNote,
  requestStateText,
} from "./status"

const ALL = Object.values(CardRequestStatus)

describe("Zustand in Worten", () => {
  it("jeder Zustand hat einen Text, offen und gefüllt heißt „geholt, wird noch ergänzt“", () => {
    for (const status of ALL) expect(REQUEST_STATUS_TEXT[status]).toBeTruthy()
    expect(requestStateText("open", false)).toBe("wartet auf die Anlage")
    expect(requestStateText("open", true)).toBe("geholt, wird noch ergänzt")
    expect(requestStateText("printMismatch", false)).toBe("passt nicht zum Ausdruck")
    expect(requestStateText("done", true)).toBe("geholt")
  })

  it("Sätze: offen und gefüllt, geholt und zurückgezogen ohne", () => {
    expect(requestStateNote("open", false)).toBe("Spiegel holt die Werte, sobald die Anlage läuft.")
    expect(requestStateNote("open", true)).toBeNull()
    expect(requestStateNote("done", false)).toBeNull()
    expect(requestStateNote("withdrawn", false)).toBeNull()
    expect(requestStateNote("printMismatch", false)).toBe(
      "Die Scheibe der Anlage begann erst nach dem Druck. Spiegel hat nichts übernommen."
    )
  })

  it("keine Semikolons, keine alten Wörter", () => {
    const texts = [...Object.values(REQUEST_STATUS_TEXT), ...Object.values(REQUEST_STATUS_NOTE)]
    expect(forbiddenIn(texts)).toEqual([])
    for (const text of texts) expect(text).not.toMatch(OLD_WORDS)
  })
})

describe("gezeigt und entfernbar", () => {
  it("ungefüllt: alles außer zurückgezogen und geholt; ein neuer Zustand fällt auf", () => {
    expect(ALL.filter((status) => requestShown(status, false)).sort()).toEqual([
      "expired",
      "held",
      "mismatch",
      "missing",
      "open",
      "printMismatch",
      "taken",
    ])
    expect(ALL.filter((status) => requestRemovable(status, false)).sort()).toEqual(
      ALL.filter((status) => requestShown(status, false)).sort()
    )
  })

  it("gefüllt: gezeigt nur offen, entfernbar nie", () => {
    expect(ALL.filter((status) => requestShown(status, true))).toEqual(["open"])
    expect(ALL.filter((status) => requestRemovable(status, true))).toEqual([])
  })
})
