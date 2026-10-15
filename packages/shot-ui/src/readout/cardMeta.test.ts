import { describe, expect, it } from "vitest"

import { periodCard, TZ } from "../period/testSeason"
import { cardMeta } from "./cardMeta"

// Samstag, 26. September 2026, 10:30 MESZ (08:30 UTC)
const AT = Date.UTC(2026, 8, 26, 8, 30)

describe("Metazeile im Kopf einer Scheibe", () => {
  it("Art, Wochentag mit Datum und Uhrzeit in der Anzeige-Zeitzone, wie die Liste", () => {
    expect(
      cardMeta(periodCard("w", 0, [100], { kind: "competition", startedAtMs: AT }), TZ)
    ).toEqual(["Wettkampf", "Sa 26.09.2026", "10:30"])
  })

  it("nach Mitternacht das Datum des Kalendertags, nicht des Abends", () => {
    // 00:30 MESZ am 27. September: in der Liste unter dem Abend des 26., hier der echte Tag
    expect(
      cardMeta(periodCard("t", 0, [100], { startedAtMs: Date.UTC(2026, 8, 26, 22, 30) }), TZ)
    ).toEqual(["Training", "So 27.09.2026", "00:30"])
  })

  it("Training nur aus Probe heißt so", () => {
    expect(cardMeta(periodCard("p", 0, [100], { probe: true, startedAtMs: AT }), TZ)[0]).toBe(
      "Training nur Probe"
    )
  })
  it("die Liste aus Meyton nach der Art, ohne Liste nichts (Rückmeldung 1)", () => {
    const card = periodCard("w", 0, [100], { kind: "competition", startedAtMs: AT })
    expect(cardMeta(card, TZ, { name: "RWK_LP" })).toEqual([
      "Wettkampf",
      "Liste RWK_LP",
      "Sa 26.09.2026",
      "10:30",
    ])
    expect(cardMeta(card, TZ, null)).toEqual(["Wettkampf", "Sa 26.09.2026", "10:30"])
  })
})
