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
      /^Deine Gruppe liegt .* neben der Mitte, und das ist sicher kein Zufall\.$/
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

describe("eine Scheibe sagt, was sie zeigt", () => {
  // die Wertungsschüsse der Beispielscheibe mit neuen Werten: zehn am Anfang, zwanzig dazwischen, zehn am Ende;
  // die Mitte hebt sich gegen beide Enden ab, damit der Trend über die ganze Scheibe nicht klar wird
  const withValues = (firstTen: number, middle: number, lastTen: number) => {
    let k = 0
    return fortyCard().map((s) => {
      if (s.kind !== "match") return s
      const tenths = k < 10 ? firstTen : k < 30 ? middle : lastTen
      k++
      return { ...s, decimalTenths: tenths, ring: Math.floor(tenths / 10) }
    })
  }
  const trendOf = (shots: ReturnType<typeof withValues>) =>
    observations(analysisInput(shots, "decimal", LP_10M)).find((x) => x.icon === "trend")

  it("klar nachgelassen fällt auf, auch ohne klaren Trend", () => {
    const trend = trendOf(withValues(100, 108, 92))
    expect(trend?.text).toMatch(/^Kein klarer Trend über die Scheibe/)
    expect(trend?.text).toMatch(/ Am Ende hast du klar nachgelassen\.$/)
    expect(trend?.notable).toBe(true)
  })

  it("im Kopf steht dann der Satz zur Ermüdung, nicht „Kein klarer Trend“", () => {
    const list = observations(analysisInput(withValues(100, 108, 92), "decimal", LP_10M))
    const head = keyObservations(list).find((k) => k.icon === "trend")
    expect(head?.text).toMatch(
      /^Die letzten zehn Schuss lagen im Schnitt 0,80 Ringe je Schuss unter den ersten zehn \(zusammen −8,0 Ringe\).* Am Ende hast du klar nachgelassen\.$/
    )
    // ohne klare Ermüdung bleibt es beim ersten Satz
    const plain = observations(analysisInput(fortyCard(), "decimal", LP_10M))
    expect(plain.find((x) => x.icon === "trend")?.headline).toBeUndefined()
  })

  it("klar stärker geworden", () => {
    const trend = trendOf(withValues(100, 92, 108))
    expect(trend?.text).toMatch(/^Kein klarer Trend über die Scheibe/)
    expect(trend?.text).toMatch(/ Am Ende bist du klar stärker geworden\.$/)
    expect(trend?.notable).toBe(true)
  })

  it("ohne Urteil: kann Zufall sein, und es fällt nicht auf", () => {
    const trend = trendOf(fortyCard())
    expect(trend?.text).toMatch(/ Der Unterschied kann Zufall sein\.$/)
    expect(trend?.notable).toBe(false)
  })

  it("genau im Schnitt der ersten zehn: kein Zusatz", () => {
    const trend = trendOf(withValues(100, 104, 100))
    expect(trend?.text).toContain("genau im Schnitt der ersten zehn")
    expect(trend?.text).not.toMatch(/Zufall|klar nachgelassen|klar stärker/)
  })

  it("kein Verweis auf andere Scheiben oder Abende", () => {
    const list = observations(analysisInput(fortyCard(), "decimal", LP_10M))
    for (const { text } of list)
      expect(text).not.toMatch(
        /mehrere(n)? (Scheiben|Abende)|über Abende|Drei Schuss sind zu wenig/
      )
  })
})

describe("was die Pause bewirkt hat", () => {
  // die übrigen Wertungsschüsse ein fester Kreis um 10,0 (im Schnitt genau 10,0), Schuss 21 bis 23 nach der Pause
  // der Beispielscheibe (240 s vor Schuss 21) mit `after`; `second`: eine zweite Pause vor Schuss 31
  const CYCLE = [100, 97, 103, 99, 101, 96, 104, 98, 102]
  const paused = (after: readonly number[], second = false) => {
    let k = 0
    let rest = 0
    return fortyCard().map((s) => {
      if (s.kind !== "match") return s
      const number = ++k
      const tenths =
        number >= 21 && number <= 23 ? after[number - 21] : CYCLE[rest++ % CYCLE.length]
      const firedAtMs = second && number >= 31 ? (s.firedAtMs as number) + 300_000 : s.firedAtMs
      return { ...s, decimalTenths: tenths, ring: Math.floor(tenths / 10), firedAtMs }
    })
  }
  const pauseOf = (shots: ReturnType<typeof paused>) =>
    observations(analysisInput(shots, "decimal", LP_10M)).find((x) => x.icon === "pause")

  it("klar schwächer: Urteil im Satz, fällt auf und steht im Kopf", () => {
    const shots = paused([70, 70, 70])
    const pause = pauseOf(shots)
    expect(pause?.text).toMatch(
      /^Nach der Pause vor Schuss 21 lagen die Schüsse danach \(bis zu drei\) im Schnitt 3,00 Ringe je Schuss unter deinen übrigen Schüssen\. Danach warst du klar schwächer\.$/
    )
    expect(pause?.notable).toBe(true)
    const head = keyObservations(observations(analysisInput(shots, "decimal", LP_10M)))
    expect(head.find((k) => k.icon === "pause")?.text).toBe(pause?.text)
  })

  it("klar stärker", () => {
    expect(pauseOf(paused([109, 109, 109]))?.text).toMatch(/ Danach warst du klar stärker\.$/)
  })

  it("nicht klar: kann Zufall sein, und es fällt nicht auf", () => {
    const pause = pauseOf(paused([99, 101, 102]))
    expect(pause?.text).toMatch(/ Das kann Zufall sein\.$/)
    expect(pause?.notable).toBe(false)
  })

  it("genau im Schnitt: kein Zusatz", () => {
    const pause = pauseOf(paused([99, 100, 101]))
    expect(pause?.text).toMatch(/genau im Schnitt deiner übrigen Schüsse\.$/)
  })

  it("zwei Pausen: zwei Sätze mit je ihrem Urteil", () => {
    const text = pauseOf(paused([99, 101, 102], true))?.text ?? ""
    expect(text.match(/Nach der Pause vor Schuss \d+/g)).toEqual([
      "Nach der Pause vor Schuss 21",
      "Nach der Pause vor Schuss 31",
    ])
    expect(text.match(/Das kann Zufall sein\./g)).toHaveLength(2)
  })
})
