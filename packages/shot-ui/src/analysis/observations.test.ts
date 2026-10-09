import { scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import { LP_10M } from "@vereinsheim/shot-core/targets"
import { describe, expect, it } from "vitest"

import { analysisInput } from "./input"
import {
  firstSentence,
  keyObservations,
  observations,
  type Observation,
  type ObservationIcon,
} from "./observations"
import { fortyCard } from "./testCard"

const o = (icon: ObservationIcon, notable: boolean): Observation => ({
  icon,
  notable,
  text: `Satz ${icon}. Zweiter Satz ${icon}.`,
})

describe("erster Satz", () => {
  it("bis zum Punkt vor einem Großbuchstaben; ein Satz bleibt ganz", () => {
    expect(
      firstSentence("Schuss 27 fällt als Ausreißer aus der Gruppe. Er kostet 4,1 Ringe.")
    ).toBe("Schuss 27 fällt als Ausreißer aus der Gruppe.")
    expect(firstSentence("Probe: Ø 9,10 je Schuss gegen 9,13 in der Wertung.")).toBe(
      "Probe: Ø 9,10 je Schuss gegen 9,13 in der Wertung."
    )
    // ein Komma in einer Zahl oder „95 %“ trennt nicht
    expect(firstSentence("Mit 95 % kein Zufall, 0,07 je Schuss. Weiter.")).toBe(
      "Mit 95 % kein Zufall, 0,07 je Schuss."
    )
  })
})

describe("die wichtigsten Beobachtungen für den Kopf (U1, D4)", () => {
  it("die Lage zuerst, auch wenn sie nicht vorn steht; danach die auffälligen in ihrer Reihenfolge", () => {
    const key = keyObservations([o("outlier", true), o("position", false), o("trend", true)])
    expect(key.map((k) => k.icon)).toEqual(["position", "outlier", "trend"])
    expect(key.map((k) => k.text)).toEqual(["Satz position.", "Satz outlier.", "Satz trend."])
  })

  it("nur auffällige, höchstens drei", () => {
    const key = keyObservations([
      o("position", true),
      o("spread", false),
      o("outlier", true),
      o("trend", true),
      o("pause", false),
      o("clock", false),
      o("flag", true),
    ])
    expect(key.map((k) => k.icon)).toEqual(["position", "outlier", "trend"])
    expect(keyObservations([o("position", true), o("flag", true)], 1).map((k) => k.icon)).toEqual([
      "position",
    ])
  })

  it("ohne Lage nur die auffälligen; ohne alles nichts", () => {
    expect(keyObservations([o("spread", false), o("outlier", true)]).map((k) => k.icon)).toEqual([
      "outlier",
    ])
    expect(keyObservations([o("spread", false), o("clock", false)])).toEqual([])
    expect(keyObservations([])).toEqual([])
  })
})

describe("was auffällt, an echten Scheiben", () => {
  const CARD = fortyCard()
  const all = observations(analysisInput(CARD, "decimal", LP_10M))
  const notable = (icon: ObservationIcon, list = all) => list.find((x) => x.icon === icon)?.notable

  it("Beispielscheibe „40 Schuss mit Probe“: die Lage und der Ausreißer Schuss 27, sonst nichts", () => {
    expect(notable("position")).toBe(true)
    expect(notable("outlier")).toBe(true)
    // da, aber nicht auffällig: Präzision, Pause, Tempo immer; der Trend ist nicht klar, die Probe ohne Versatz
    for (const icon of ["spread", "pause", "clock", "trend", "flag"] as const)
      expect(notable(icon)).toBe(false)
    const key = keyObservations(all)
    expect(key.map((k) => k.icon)).toEqual(["position", "outlier"])
    expect(key[0].text).toMatch(/^Die Lage ist echt: .* mit 95 % kein Zufall\.$/)
    expect(key[1].text).toBe("Schuss 27 fällt als Ausreißer aus der Gruppe.")
  })

  it("ein klarer Trend und eine Probe echt neben der Mitte fallen auf", () => {
    let k = 0
    let p = 0
    const shifted = CARD.map((s) => {
      if (s.kind === "probe") {
        // die Probe eng beieinander, 6 mm rechts: echt neben der Mitte (Streuung in beide Richtungen, sonst ist
        // die Lage nicht zu schätzen)
        const x = 6000 + (p % 3) * 150
        const y = (((p++ * 7) % 5) - 2) * 120
        const score = scoreFromCoordinates(LP_10M, x, y)
        return { ...s, xUm: x, yUm: y, decimalTenths: score.decimalTenths, ring: score.ring }
      }
      // die Wertung wandert Schuss für Schuss nach außen: klar fallend
      const x = k * 400
      const y = (((k++ * 3) % 5) - 2) * 150
      const score = scoreFromCoordinates(LP_10M, x, y)
      return { ...s, xUm: x, yUm: y, decimalTenths: score.decimalTenths, ring: score.ring }
    })
    const list = observations(analysisInput(shifted, "decimal", LP_10M))
    expect(list.find((x) => x.icon === "trend")?.text).toMatch(/^Über die Scheibe klar fallend/)
    expect(notable("trend", list)).toBe(true)
    expect(list.find((x) => x.icon === "flag")?.text).toContain("lagen echt neben der Mitte")
    expect(notable("flag", list)).toBe(true)
    expect(keyObservations(list).length).toBeLessThanOrEqual(3)
    expect(keyObservations(list)[0].icon).toBe("position")
  })
})
