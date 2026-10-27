import { forbiddenIn } from "@vereinsheim/lib/wording"
import { metricByKey, type MetricDefinition } from "@vereinsheim/shot-core/metrics"
import type { CardDetail } from "@vereinsheim/shot-core/projection"
import { describe, expect, it } from "vitest"

import {
  analysisMissingText,
  CENTER_ONLY_NOTE,
  LEVEL_TEXT,
  PROVENANCE_LABELS,
  PROVENANCE_WORDS,
  REASON_TEXT,
  detailLevel,
  detailReason,
  levelReasons,
  seriesMissingText,
  shotsMissingText,
  isCardProvenance,
  missingSentence,
  quietProvenance,
  summaryReasons,
} from "./detail"

const metric = (key: string) => metricByKey(key) as MetricDefinition

const detail = (part: Partial<CardDetail> = {}): CardDetail => ({
  rings: "shots",
  tenths: "shots",
  positions: 40,
  times: 40,
  center: { xUm: 0, yUm: 0, n: 40, from: "shots" },
  ...part,
})
const NONE = detail({ rings: null, tenths: null, positions: 0, times: 0, center: null })
const SERIES = detail({ rings: "series", tenths: "series", positions: 0, times: 0, center: null })
const SERIES_RINGS = detail({ rings: "series", tenths: null, positions: 0, times: 0, center: null })
const TOTAL_TENTHS = detail({ rings: null, tenths: "total", positions: 0, times: 0, center: null })

describe("detailReason: warum eine Scheibe ohne Wert ist", () => {
  const sigma = metric("group.sigma")
  it("ohne Werte: vom Ausdruck wartet sie auf die Anlage, eingetragen fehlt die Eingabe", () => {
    expect(detailReason({ detail: NONE, shots: 0, provenance: "printout" }, sigma)).toBe("waiting")
    expect(detailReason({ detail: NONE, shots: 0, provenance: "entered" }, sigma)).toBe("noValues")
    // gemessen (auch ohne Angabe) fehlt der erste Schuss, wie auf der Seite „Noch kein Schuss“
    expect(detailReason({ detail: NONE, shots: 0, provenance: "measured" }, sigma)).toBe("noShot")
    expect(detailReason({ detail: NONE, shots: 0 }, sigma)).toBe("noShot")
  })

  it("vom Ausdruck ohne offenen Auftrag: ohne Werte; ohne Angabe oder wartend: wartet auf die Anlage", () => {
    const of = (waiting?: boolean) =>
      detailReason({ detail: NONE, shots: 0, provenance: "printout", waiting }, sigma)
    expect(of(undefined)).toBe("waiting")
    expect(of(true)).toBe("waiting")
    expect(of(false)).toBe("noValues")
    // nur vom Ausdruck: eine gemessene Scheibe wartet nie
    expect(detailReason({ detail: NONE, shots: 0, waiting: false }, sigma)).toBe("noShot")
  })

  it("Schüsse, aber kein Ergebnis: nicht jeder Schuss mit Wert", () => {
    expect(detailReason({ detail: NONE, shots: 40 }, metric("result.decimal"))).toBe("missingValue")
  })

  it("Lage: ohne und zu wenige", () => {
    expect(detailReason({ detail: SERIES, shots: 0 }, sigma)).toBe("noPositions")
    expect(detailReason({ detail: detail({ positions: 2 }), shots: 2 }, sigma)).toBe("fewPositions")
  })

  it("Zeit: ohne und zu wenige", () => {
    const tempo = metric("time.intervalMedian")
    expect(detailReason({ detail: SERIES, shots: 0 }, tempo)).toBe("noTimes")
    expect(detailReason({ detail: detail({ times: 1 }), shots: 40 }, tempo)).toBe("fewTimes")
  })

  it("Wertung: ohne Zehntel, nur in Zehnteln", () => {
    expect(detailReason({ detail: SERIES_RINGS, shots: 0 }, metric("result.decimalMean"))).toBe(
      "noTenths"
    )
    expect(detailReason({ detail: TOTAL_TENTHS, shots: 0 }, metric("result.ringsMean"))).toBe(
      "onlyTenths"
    )
  })

  it("Summen tragen keine Kennzahl über Einzelschüsse, ohne Grundlage „ohne Wert“", () => {
    expect(detailReason({ detail: SERIES, shots: 0 }, metric("result.tensRate"))).toBe("sumsOnly")
    expect(detailReason({ shots: 40 }, sigma)).toBe("noValue")
    expect(detailReason({ detail: detail(), shots: 40 }, sigma)).toBe("noValue")
  })
})

describe("Detailtiefe", () => {
  it("Schüsse auf der Seite, Serien-Summen, Gesamtergebnis, nichts", () => {
    expect(detailLevel(detail(), 40)).toBe("shots")
    expect(detailLevel(SERIES, 0)).toBe("series")
    expect(detailLevel(TOTAL_TENTHS, 0)).toBe("total")
    expect(detailLevel(NONE, 0)).toBe("none")
    // Serien gemischt (eine nur in Ringen, eine nur in Zehnteln): kein Ergebnis, aber Serien
    const mixed = {
      series: [
        { series: 1, shots: 10, rings: 90, decimalTenths: null },
        { series: 2, shots: 10, rings: null, decimalTenths: 950 },
      ],
    }
    expect(detailLevel(NONE, 0, mixed)).toBe("series")
    expect(detailLevel(NONE, 0, { series: [] })).toBe("none")
  })

  it("der Grund unter der großen Zahl nennt die fehlende Wertung", () => {
    expect(summaryReasons(SERIES, "series")).toEqual(["nur Serien-Summen"])
    expect(summaryReasons(SERIES_RINGS, "series")).toEqual(["nur Serien-Summen", "ohne Zehntel"])
    expect(summaryReasons(TOTAL_TENTHS, "total")).toEqual(["nur Gesamtergebnis", "nur in Zehnteln"])
  })

  it("was fehlt, in einem Satz; mit Trefferlage als Summe fehlt die Lage nicht", () => {
    expect(missingSentence(SERIES)).toBe("Für Streuung, Lage und Tempo braucht es Einzelschüsse.")
    expect(
      missingSentence({ ...TOTAL_TENTHS, center: { xUm: 1, yUm: 2, n: 40, from: "summary" } })
    ).toBe("Für Streuung und Tempo braucht es Einzelschüsse.")
  })
})

describe("ein Gerüst für jede Detailtiefe: die Sätze an den Stellen ohne Einzelschüsse", () => {
  it("der Grund unter der großen Zahl, ohne Werte nach der Herkunft", () => {
    expect(levelReasons(SERIES_RINGS, "series", "entered")).toEqual([
      "nur Serien-Summen",
      "ohne Zehntel",
    ])
    expect(levelReasons(NONE, "none", "printout")).toEqual(["wartet auf die Anlage"])
    expect(levelReasons(NONE, "none", "entered")).toEqual(["ohne Werte"])
    expect(levelReasons(NONE, "none", "measured")).toEqual(["noch kein Schuss"])
    expect(levelReasons(NONE, "none")).toEqual(["noch kein Schuss"])
    expect(levelReasons(NONE, "none", "printout", true)).toEqual(["wartet auf die Anlage"])
    expect(levelReasons(NONE, "none", "printout", false)).toEqual(["ohne Werte"])
  })

  it("Serien, Schüsse und Analyse sagen kurz, dass dort nichts steht, ohne den Grund noch einmal", () => {
    // mit Summen
    expect(shotsMissingText("series")).toBe("Keine Einzelschüsse.")
    expect(shotsMissingText("total")).toBe("Keine Einzelschüsse.")
    expect(seriesMissingText("total")).toBe("Keine Serien.")
    expect(seriesMissingText("shots")).toBe("Die Schüsse tragen keine Serie.")
    expect(analysisMissingText(SERIES, "series")).toBe(missingSentence(SERIES))
    // ohne Werte: „noch“, solange Werte kommen können
    for (const [provenance, waiting] of [
      ["printout", undefined],
      ["printout", true],
      ["measured", undefined],
      [undefined, undefined],
    ] as const) {
      expect(seriesMissingText("none", provenance, waiting)).toBe("Noch keine Serien.")
      expect(shotsMissingText("none", provenance, waiting)).toBe("Noch keine Schüsse.")
      expect(analysisMissingText(NONE, "none", provenance, waiting)).toBe("Noch keine Werte.")
    }
    for (const [provenance, waiting] of [
      ["printout", false],
      ["entered", undefined],
    ] as const) {
      expect(seriesMissingText("none", provenance, waiting)).toBe("Keine Serien.")
      expect(shotsMissingText("none", provenance, waiting)).toBe("Keine Schüsse.")
      expect(analysisMissingText(NONE, "none", provenance, waiting)).toBe("Keine Werte.")
    }
    // kein Satz nennt einen Grund aus der Ergebnis-Box
    const sentences = (["series", "total", "none"] as const).flatMap((level) => [
      seriesMissingText(level, "printout"),
      shotsMissingText(level, "printout"),
    ])
    for (const reason of Object.values(REASON_TEXT))
      for (const text of sentences) expect(text).not.toContain(reason)
  })
})

describe("Herkunft", () => {
  it("leise nur, wenn nicht gemessen", () => {
    expect(quietProvenance("measured")).toBeNull()
    expect(quietProvenance(undefined)).toBeNull()
    expect(quietProvenance("entered")).toBe("eingetragen")
    expect(quietProvenance("printout")).toBe("vom Ausdruck")
  })

  it("Schlüssel der Adresse", () => {
    expect(isCardProvenance("entered")).toBe(true)
    expect(isCardProvenance("raw")).toBe(false)
    expect(isCardProvenance(null)).toBe(false)
  })
})

it("alle Texte nach den Schreibregeln", () => {
  const texts = [
    ...Object.values(PROVENANCE_WORDS),
    ...Object.values(PROVENANCE_LABELS),
    ...Object.values(REASON_TEXT),
    ...Object.values(LEVEL_TEXT),
    CENTER_ONLY_NOTE,
    missingSentence(SERIES),
    missingSentence({ ...SERIES, center: { xUm: 0, yUm: 0, n: 1, from: "summary" } }),
    shotsMissingText("none"),
    shotsMissingText("none", "entered"),
    shotsMissingText("series"),
    seriesMissingText("none"),
    seriesMissingText("none", "entered"),
    seriesMissingText("total"),
    seriesMissingText("shots"),
    analysisMissingText(NONE, "none"),
    analysisMissingText(NONE, "none", "entered"),
  ]
  expect(forbiddenIn(texts)).toEqual([])
})
