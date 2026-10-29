import { describe, expect, it } from "vitest"

import type { PeriodComparison } from "@vereinsheim/shot-core/analysis"
import { forbiddenIn } from "@vereinsheim/lib/wording"

import { OLD_WORDS } from "@/lib/admin/consequences"

import { WELLBEING_ASPECTS } from "./influences"
import {
  ANALYSIS_HELP,
  ANALYSIS_TEXTS,
  ASPECT_WORDS,
  executionBasis,
  executionCount,
  executionPill,
  executionSentence,
  expectedBasis,
  expectedMean,
  factorDelta,
  factorRow,
  factorSubline,
  influenceBasis,
  influencePill,
  influenceSentence,
  pointLabel,
  signedDistance,
} from "./texts"

const COUNTS = [0, 1, 4, 27]
const DISTANCES = [-0.31, -0.002, 0, 0.004, 0.21, 1.5]

function comparison(
  verdict: PeriodComparison["verdict"],
  extra: Partial<PeriodComparison> = {}
): PeriodComparison {
  return {
    a: { n: 6, mean: -0.2 },
    b: { n: 6, mean: 0.2 },
    delta: verdict === "lower" ? -0.4 : 0.4,
    test: { p: verdict === "unclear" ? 0.4 : 0.01, exact: false },
    basis: "shots",
    verdict,
    meaningful: false,
    ...extra,
  }
}

const COMPARISONS = [
  null,
  comparison("unclear", { test: null }),
  comparison("unclear"),
  comparison("higher"),
  comparison("higher", { meaningful: true }),
  comparison("lower"),
  comparison("lower", { meaningful: true }),
]

/** jeder sichtbare Text der Auswertung, Funktionen mit Beispielwerten */
function allTexts(): string[] {
  const texts: string[] = []
  for (const value of Object.values(ANALYSIS_TEXTS)) {
    if (typeof value === "string") texts.push(value)
    else if (typeof value === "function")
      for (const n of COUNTS) texts.push((value as (x: number | string) => string)(n))
    else texts.push(...Object.values(value))
  }
  for (const words of Object.values(ASPECT_WORDS)) texts.push(...Object.values(words))
  for (const aspect of WELLBEING_ASPECTS) {
    for (const c of COMPARISONS) texts.push(influencePill(aspect, c).text)
    for (const high of COUNTS)
      for (const low of COUNTS)
        for (const mean of DISTANCES)
          texts.push(
            influenceSentence(aspect, {
              entered: high + low,
              high: { n: high, mean },
              low: { n: low, mean: -mean },
            })
          )
    for (const stage of [1, 5]) {
      texts.push(factorRow(false, aspect, stage), factorRow(true, aspect, stage))
      for (const d of DISTANCES) texts.push(pointLabel("Fr 13.03.", aspect, stage, d))
    }
  }
  for (const a of COUNTS)
    for (const b of COUNTS) texts.push(influenceBasis({ noCard: a, noForm: b }) ?? "")
  for (const n of COUNTS) {
    texts.push(factorSubline("Luftpistole", "Saison 26/27", n))
    texts.push(executionBasis(n) ?? "", expectedBasis(n) ?? "")
    for (const m of COUNTS) texts.push(executionCount(n, m))
    for (const d of DISTANCES) texts.push(expectedMean(d * 10, n))
  }
  for (const d of DISTANCES) texts.push(factorDelta(d), signedDistance(d))
  for (const c of COMPARISONS) {
    texts.push(executionPill(c).text)
    for (const high of COUNTS) texts.push(executionSentence({ high, low: 4, comparison: c }))
  }
  for (const help of Object.values(ANALYSIS_HELP)) texts.push(...Object.values(help))
  return texts.filter(Boolean)
}

describe("Texte der Auswertung", () => {
  it("halten die Schreibregeln: keine Semikolons, keine drei Punkte, keine alten Wörter", () => {
    const texts = allTexts()
    expect(texts.length).toBeGreaterThan(500)
    expect(forbiddenIn(texts)).toEqual([])
    expect(texts.filter((text) => OLD_WORDS.test(text))).toEqual([])
  })

  it("sagen das Urteil mit den Worten des Vergleichs zweier Zeiträume", () => {
    expect(influencePill("energy", comparison("higher"))).toEqual({
      text: "Viel Energie: besser",
      tone: "better",
    })
    expect(influencePill("sleep", comparison("higher", { meaningful: true })).text).toBe(
      "Guter Schlaf: deutlich besser"
    )
    expect(influencePill("stress", comparison("lower"))).toEqual({
      text: "Viel Stress: schwächer",
      tone: "worse",
    })
    expect(influencePill("motivation", comparison("unclear")).text).toBe("Kein klarer Unterschied")
    expect(influencePill("motivation", comparison("unclear", { test: null })).text).toBe(
      "Noch kein Urteil"
    )
    expect(influencePill("motivation", null).text).toBe("Noch kein Urteil")
  })

  it("sagt, wo die Gruppen zur Form liegen oder wie viele für ein Urteil fehlen", () => {
    expect(
      influenceSentence("energy", {
        entered: 17,
        high: { n: 8, mean: 0.21 },
        low: { n: 9, mean: -0.14 },
      })
    ).toBe("Viel Energie: 0,21 über deiner Form (8). Wenig: 0,14 unter (9).")
    expect(
      influenceSentence("sleep", {
        entered: 12,
        high: { n: 6, mean: -0.003 },
        low: { n: 6, mean: 0.1 },
      })
    ).toBe("Guter Schlaf: gleichauf mit deiner Form (6). Schlechter: 0,10 über (6).")
    expect(
      influenceSentence("energy", { entered: 9, high: { n: 6, mean: 0.2 }, low: { n: 3, mean: 0 } })
    ).toBe("Unter der Mitte liegen erst 3 Einträge. Für ein Urteil braucht es 5.")
    expect(
      influenceSentence("energy", { entered: 7, high: { n: 1, mean: 0.2 }, low: { n: 6, mean: 0 } })
    ).toBe("Über der Mitte liegt erst 1 Eintrag. Für ein Urteil braucht es 5.")
    expect(
      influenceSentence("energy", { entered: 6, high: { n: 3, mean: 0.2 }, low: { n: 2, mean: 0 } })
    ).toBe(
      "Über der Mitte liegen 3 Einträge, darunter 2. Für ein Urteil braucht es auf jeder Seite 5."
    )
    expect(
      influenceSentence("energy", {
        entered: 6,
        high: { n: 0, mean: null },
        low: { n: 0, mean: null },
      })
    ).toBe(ANALYSIS_TEXTS.allSame)
    expect(
      influenceSentence("energy", {
        entered: 1,
        high: { n: 0, mean: null },
        low: { n: 0, mean: null },
      })
    ).toBe(
      "Über der Mitte liegen 0 Einträge, darunter 0. Für ein Urteil braucht es auf jeder Seite 5."
    )
  })

  it("nennt die Grundlage nur, wenn etwas nicht zählt", () => {
    expect(influenceBasis({ noCard: 0, noForm: 0 })).toBeNull()
    expect(influenceBasis({ noCard: 3, noForm: 0 })).toBe(
      "3 Einträge ohne Scheibe zählen nicht mit."
    )
    expect(influenceBasis({ noCard: 0, noForm: 1 })).toBe(
      "1 Eintrag ohne fünf Scheiben davor zählt nicht mit."
    )
    expect(influenceBasis({ noCard: 2, noForm: 4 })).toBe(
      "2 Einträge ohne Scheibe und 4 ohne fünf Scheiben davor zählen nicht mit."
    )
  })

  it("sagt das Urteil der Ausführung als Antwort auf die Frage", () => {
    expect(executionPill(comparison("higher", { meaningful: true })).text).toBe("Ja, deutlich")
    expect(executionPill(comparison("higher")).text).toBe("Ja")
    expect(executionPill(comparison("lower")).text).toBe("Eher umgekehrt")
    expect(executionSentence({ high: 6, low: 6, comparison: comparison("higher") })).toBe(
      "Serien, die du besser bewertet hast, lagen 0,40 Ringe je Schuss über den schwächer bewerteten derselben Scheibe."
    )
    expect(executionSentence({ high: 3, low: 4, comparison: null })).toBe(
      "Erst 3 besser und 4 schwächer bewertete Serien. Für ein Urteil braucht es je 5."
    )
    expect(executionCount(24, 6)).toBe("24 Serien an 6 Abenden")
  })

  it("nennt das Mittel von erwartet und geschossen", () => {
    expect(expectedMean(-5, 3)).toBe(
      "Im Mittel 5,0 Ringe unter deiner Erwartung. 3 Einträge. Für mehr als die Zahl reicht das nicht."
    )
    expect(expectedMean(0.02, 1)).toBe(
      "Im Mittel genau wie erwartet. 1 Eintrag. Für mehr als die Zahl reicht das nicht."
    )
  })
})
