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

describe("die wichtigsten Beobachtungen für den Kopf", () => {
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
    ])
    expect(key.map((k) => k.icon)).toEqual(["position", "outlier", "trend"])
    expect(keyObservations([o("position", true), o("trend", true)], 1).map((k) => k.icon)).toEqual([
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

  it("Beispielscheibe „40 Schuss“: die Lage und der Ausreißer Schuss 27, sonst nichts", () => {
    expect(notable("position")).toBe(true)
    expect(notable("outlier")).toBe(true)
    // da, aber nicht auffällig: Präzision, Pause, Tempo immer; der Trend ist nicht klar
    for (const icon of ["spread", "pause", "clock", "trend"] as const)
      expect(notable(icon)).toBe(false)
    const key = keyObservations(all)
    expect(key.map((k) => k.icon)).toEqual(["position", "outlier"])
    expect(key[0].text).toMatch(
      /^Deine Gruppe liegt .* neben der Mitte; das ist sicher kein Zufall\.$/
    )
    expect(key[1].text).toBe("Schuss 27 fällt als Ausreißer aus der Gruppe.")
  })

  it("ein klarer Trend fällt auf", () => {
    let k = 0
    const shifted = CARD.filter((s) => s.kind === "match").map((s) => {
      // die Wertung wandert Schuss für Schuss nach außen: klar fallend
      const x = k * 400
      const y = (((k++ * 3) % 5) - 2) * 150
      const score = scoreFromCoordinates(LP_10M, x, y)
      return { ...s, xUm: x, yUm: y, decimalTenths: score.decimalTenths, ring: score.ring }
    })
    const list = observations(analysisInput(shifted, "decimal", LP_10M))
    expect(list.find((x) => x.icon === "trend")?.text).toMatch(/^Über die Scheibe klar fallend/)
    expect(notable("trend", list)).toBe(true)
    expect(keyObservations(list, 6).map((k) => k.icon)).toEqual(["position", "trend"])
  })
})

describe("Sätze in Alltagsworten", () => {
  it("keine Fachbegriffe: kein σ, R50, „95 %“, Median, Schwerpunkt", () => {
    const texts = observations(analysisInput(fortyCard(), "decimal", LP_10M)).map((o) => o.text)
    for (const text of texts)
      for (const term of ["σ", "R50", "95 %", "Median", "Schwerpunkt", "mittlere Hälfte"])
        expect(text, term).not.toContain(term)
    const spread = texts.find((t) => t.startsWith("Streuung "))
    expect(spread).toMatch(
      /^Streuung \d+,\d{2} mm, sicher zwischen \d+,\d{2} und \d+,\d{2} mm\. Die Hälfte der Treffer liegt innerhalb von \d+,\d{2} Ringbreiten um die Mitte der Gruppe\.$/
    )
    // Ermüdung: die Gruppe weiter oder enger statt R50
    expect(texts.find((t) => t.includes("Die letzten zehn Schuss"))).toMatch(
      /, die Gruppe \d+,\d{2} mm (weiter|enger)\./
    )
  })
})
