import { describe, expect, it } from "vitest"
import { formatDirectComparison } from "./formatDirectComparison"

describe("formatDirectComparison", () => {
  it("null → Gedankenstrich, muted (nicht umkämpfter Gleichstand)", () => {
    expect(formatDirectComparison(null)).toEqual({ text: "—", tone: "muted" })
  })

  it("decided/win → Satz + Gegner, Ton win", () => {
    expect(
      formatDirectComparison({ kind: "decided", result: "win", satz: [2, 1], opponent: "Müller" })
    ).toEqual({ text: "2:1 · Müller", tone: "win" })
  })

  it("decided/loss → Satz aus eigener Sicht + Gegner, Ton loss", () => {
    expect(
      formatDirectComparison({
        kind: "decided",
        result: "loss",
        satz: [1, 2],
        opponent: "Schmidt",
      })
    ).toEqual({ text: "1:2 · Schmidt", tone: "loss" })
  })

  it("record mit positiver Bilanz → win", () => {
    expect(formatDirectComparison({ kind: "record", wins: 2, losses: 0 })).toEqual({
      text: "2:0",
      tone: "win",
    })
  })

  it("record mit nicht-positiver Bilanz → muted", () => {
    expect(formatDirectComparison({ kind: "record", wins: 0, losses: 2 })).toEqual({
      text: "0:2",
      tone: "muted",
    })
    expect(formatDirectComparison({ kind: "record", wins: 1, losses: 1 })).toEqual({
      text: "1:1",
      tone: "muted",
    })
  })

  it("open mit Gegner → 'offen · Gegner', pending", () => {
    expect(formatDirectComparison({ kind: "open", opponent: "Bauer" })).toEqual({
      text: "offen · Bauer",
      tone: "pending",
    })
  })

  it("open ohne Gegner (3er+) → 'offen', pending", () => {
    expect(formatDirectComparison({ kind: "open", opponent: null })).toEqual({
      text: "offen",
      tone: "pending",
    })
  })

  it("even → 'ausgeglichen', muted", () => {
    expect(formatDirectComparison({ kind: "even" })).toEqual({
      text: "ausgeglichen",
      tone: "muted",
    })
  })
})
