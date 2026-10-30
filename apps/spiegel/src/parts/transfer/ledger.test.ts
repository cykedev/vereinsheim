import { describe, expect, it } from "vitest"

import {
  cardState,
  cardUnchanged,
  diaryRowUnchanged,
  ledgerKey,
  linksUnchanged,
  sourceOfKey,
} from "./ledger"

describe("ledgerKey", () => {
  it("eine Einheit mit Scheibe, Eintrag, Verknüpfungen und einem Ausdruck, der eine Scheibe anlegt: kein Schlüssel doppelt je Art", () => {
    const pieces = [
      ["card", ledgerKey.session("s1")],
      ["card", ledgerKey.attachment("a1")],
      ["entry", ledgerKey.session("s1")],
      ["link", ledgerKey.link("s1", "c1")],
      ["link", ledgerKey.link("s1", "c2")],
      ["printout", ledgerKey.attachment("a1")],
      ["evidence", ledgerKey.attachment("a2")],
      ["goal", ledgerKey.goal("s1")],
      ["routine", ledgerKey.routine("s1")],
    ]
    const keys = pieces.map(([kind, key]) => `${kind}|${key}`)
    expect(new Set(keys).size).toBe(keys.length)
    // dieselbe Kennung aus Treffsicher als Einheit und als Anhang ergibt zwei Scheiben, keine
    expect(ledgerKey.session("x")).not.toBe(ledgerKey.attachment("x"))
  })

  it("liest Einheit, Ziel und Ablauf aus dem Schlüssel, auch aus dem einer Verknüpfung; Anhänge nicht", () => {
    expect(sourceOfKey(ledgerKey.session("s1"))).toEqual({ kind: "session", id: "s1" })
    expect(sourceOfKey(ledgerKey.link("s1", "c1"))).toEqual({ kind: "session", id: "s1" })
    expect(sourceOfKey(ledgerKey.goal("g1"))).toEqual({ kind: "goal", id: "g1" })
    expect(sourceOfKey(ledgerKey.routine("r1"))).toEqual({ kind: "routine", id: "r1" })
    expect(sourceOfKey(ledgerKey.attachment("a1"))).toBeNull()
  })
})

describe("cardUnchanged", () => {
  const card = {
    origin: "treffsicher",
    deletedAt: null,
    currentRevisionId: BigInt(7),
    shareId: null,
    disciplineId: 3,
    kind: "training",
    kindChoice: "training",
    scoringChoice: null,
    standDisciplineId: null,
    place: "Schützenhaus",
  }
  const item = { revisionId: BigInt(7), cardState: cardState(card) }

  it("wie verzeichnet: unverändert", () => {
    expect(cardUnchanged(item, card, 0)).toBe(true)
  })

  it.each([
    ["andere Herkunft (von Hand)", { origin: "manual" }],
    ["vom Ausdruck", { origin: "pdf" }],
    ["Papierkorb", { deletedAt: new Date() }],
    ["neue Revision", { currentRevisionId: BigInt(8) }],
    ["andere Disziplin", { disciplineId: 4 }],
    ["eigene Art", { kindChoice: "competition" }],
    ["eigene Wertung", { scoringChoice: "decimal" }],
    ["eigener Stand", { standDisciplineId: 4 }],
    ["anderer Ort", { place: "Halle" }],
    ["geteilt", { shareId: "x" }],
  ])("%s: geändert", (_, change) => {
    expect(cardUnchanged(item, { ...card, ...change }, 0)).toBe(false)
  })

  it("ein eigener Beleg ist eine Änderung", () => {
    expect(cardUnchanged(item, card, 1)).toBe(false)
  })
})

describe("diaryRowUnchanged und linksUnchanged", () => {
  const at = new Date("2026-10-30T06:00:00.123Z")

  it("gleiche Zeit auf die Millisekunde, nicht im Papierkorb: unverändert", () => {
    expect(diaryRowUnchanged({ writtenAt: at }, { updatedAt: new Date(at), deletedAt: null })).toBe(
      true
    )
    expect(
      diaryRowUnchanged(
        { writtenAt: at },
        { updatedAt: new Date(at.getTime() + 1), deletedAt: null }
      )
    ).toBe(false)
    expect(diaryRowUnchanged({ writtenAt: at }, { updatedAt: new Date(at), deletedAt: at })).toBe(
      false
    )
    expect(diaryRowUnchanged({ writtenAt: null }, { updatedAt: at, deletedAt: null })).toBe(false)
  })

  it("Verknüpfungen: genau die verzeichneten, fest und mit ihrer Zeit", () => {
    const recorded = new Map([["c1", at.getTime()]])
    const row = { cardId: "c1", link: "linked", updatedAt: new Date(at) }
    expect(linksUnchanged(recorded, [row])).toBe(true)
    expect(linksUnchanged(recorded, [{ ...row, link: "released" }])).toBe(false)
    expect(linksUnchanged(recorded, [row, { ...row, cardId: "c2" }])).toBe(false)
    expect(linksUnchanged(recorded, [])).toBe(false)
    expect(linksUnchanged(recorded, [{ ...row, updatedAt: new Date(at.getTime() + 5) }])).toBe(
      false
    )
    expect(linksUnchanged(new Map(), [])).toBe(true)
  })
})
