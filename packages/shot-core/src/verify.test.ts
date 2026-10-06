import { describe, expect, it } from "vitest"

import { LG_10M, LP_10M } from "./targets"
import { checkShot, rescore, suggestTargets, verifyCard, type ShotEvidence } from "./verify"

// Ausdruck vom 2. Oktober 2026 (Luftpistole): Abstand aus dem Teiler (eine Nachkommastelle von
// 1/100 mm, also 1 µm Auflösung), amtlicher Wert und Stern für Innenzehner.
const PRINTOUT: ShotEvidence[] = (
  [
    [3318, 105, true],
    [3964, 105, true],
    [5474, 103, false],
    [26560, 76, false],
    [33690, 67, false],
    [38310, 62, false],
  ] as const
).map(([um, officialDecimalTenths, officialInnerTen]) => ({
  distance: { um, resolutionUm: 1 },
  officialDecimalTenths,
  officialInnerTen,
}))

// Luftgewehr, von Hand gerechnet mit 11 − d ÷ 2,5 mm. Mit der Luftpistolen-Scheibe ergäben
// dieselben Abstände 10,8 · 10,6 · 10,3 · 10,0; die Fixture unterscheidet also beide Scheiben.
const RIFLE: ShotEvidence[] = (
  [
    [1000, 106],
    [3000, 98],
    [5600, 87],
    [7400, 80],
  ] as const
).map(([um, officialDecimalTenths]) => ({
  distance: { um, resolutionUm: 1 },
  officialDecimalTenths,
}))

const at = (xUm: number, yUm: number, official: number | null): ShotEvidence => ({
  position: { xUm, yUm, resolutionUm: 10 },
  officialDecimalTenths: official,
})

describe("verifyCard", () => {
  it("der Ausdruck passt zur Luftpistole", () => {
    expect(verifyCard(LP_10M, PRINTOUT)).toMatchObject({ verdict: "ok", checked: 6, mismatches: 0 })
  })

  it("mit der Luftgewehr-Scheibe passt er nicht", () => {
    expect(verifyCard(LG_10M, PRINTOUT)).toMatchObject({
      verdict: "target-mismatch",
      checked: 6,
      mismatches: 6,
    })
  })

  it("ein einzelner Platzhalter macht den Schuss verdächtig, nicht die Scheibe (SF-15)", () => {
    const result = verifyCard(LP_10M, [...PRINTOUT, at(0, 0, 87)])
    expect(result).toMatchObject({ verdict: "suspicious-shots", checked: 7, mismatches: 1 })
    expect(result.checks.at(-1)).toBe("mismatch")
  })

  it("bei weniger als drei geprüften Schüssen gibt es kein Urteil über die Scheibe", () => {
    expect(verifyCard(LP_10M, [PRINTOUT[0], at(0, 0, 87)])).toMatchObject({
      verdict: "suspicious-shots",
      checked: 2,
      mismatches: 1,
    })
  })

  it("ohne amtliche Werte oder Lage ist nichts prüfbar", () => {
    const unknown: ShotEvidence[] = [at(0, 3000, null), { officialDecimalTenths: 95 }]
    expect(unknown.map((shot) => checkShot(LP_10M, shot))).toEqual(["unchecked", "unchecked"])
    expect(verifyCard(LP_10M, unknown)).toMatchObject({ verdict: "insufficient", checked: 0 })
  })
})

describe("suggestTargets (SF-17)", () => {
  it("schlägt für den Ausdruck nur die Luftpistole vor", () => {
    expect(suggestTargets(PRINTOUT)).toEqual(["lp-10m"])
  })

  it("schlägt für die Luftgewehr-Fixture nur das Luftgewehr vor", () => {
    expect(suggestTargets(RIFLE)).toEqual(["lg-10m"])
  })
})

describe("checkShot an der Messauflösung", () => {
  it("die Lage hat 1/100 mm: ein Nachbarwert an der Grenze ist ein Grenzfall", () => {
    // y = 3200 µm liegt genau auf der Grenze zu 10,6; der wahre Abstand kann bis etwa 3207 µm
    // betragen haben, Meytons 10,5 ist also erreichbar.
    expect(checkShot(LP_10M, at(0, 3200, 106))).toBe("match")
    expect(checkShot(LP_10M, at(0, 3200, 105))).toBe("boundary")
    expect(checkShot(LP_10M, at(0, 3200, 103))).toBe("mismatch")
  })

  it("auch der Innenzehner zählt als Grenzfall, wenn er innerhalb der Auflösung kippt", () => {
    const shot = (um: number, official: number): ShotEvidence => ({
      distance: { um, resolutionUm: 1 },
      officialDecimalTenths: official,
      officialInnerTen: false,
    })
    expect(checkShot(LP_10M, shot(4750, 104))).toBe("boundary")
    expect(checkShot(LP_10M, shot(4000, 105))).toBe("mismatch")
  })
})

describe("rescore (SF-16)", () => {
  it("die Gegenprobe findet eine falsch gewählte Disziplin nicht, die Neu-Wertung korrigiert sie", () => {
    // Ein Luftgewehr-Schütze auf einer Luftpistolen-Disziplin: Meyton wertet in sich stimmig.
    const shot = at(0, 3000, 106)
    expect(verifyCard(LP_10M, [shot]).verdict).toBe("ok")
    expect(rescore(LG_10M, shot)?.decimalTenths).toBe(98)
  })

  it("ohne Lage und Abstand gibt es nichts zu werten", () => {
    expect(rescore(LG_10M, { officialDecimalTenths: 98 })).toBeNull()
  })
})
