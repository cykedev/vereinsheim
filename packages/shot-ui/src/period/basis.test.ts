import { forbiddenIn } from "@vereinsheim/lib/wording"
import { metricByKey, type MetricDefinition } from "@vereinsheim/shot-core/metrics"
import type { CardDetail } from "@vereinsheim/shot-core/projection"
import { describe, expect, it } from "vitest"

import { DETAIL_REASONS, type CardProvenance } from "../detail"
import { basisLine, periodBasis, type Basis } from "./basis"
import type { PeriodItem } from "./item"

const SIGMA = metricByKey("group.sigma") as MetricDefinition
const MEAN = metricByKey("result.decimalMean") as MetricDefinition

const SHOTS: CardDetail = {
  rings: "shots",
  tenths: "shots",
  positions: 40,
  times: 40,
  center: { xUm: 0, yUm: 0, n: 40, from: "shots" },
}
const SERIES: CardDetail = {
  ...SHOTS,
  rings: "series",
  tenths: "series",
  positions: 0,
  times: 0,
  center: null,
}
const WAITING: CardDetail = { ...SERIES, rings: null, tenths: null }

const entry = (
  id: string,
  detail: CardDetail | undefined,
  provenance?: CardProvenance,
  shots = 40
): PeriodItem => ({
  id,
  startedAtMs: Number(id.slice(1)) * 1000,
  kind: "training",
  probeOnly: false,
  shots,
  metrics: {},
  records: { decimal: null, rings: null },
  flags: [],
  ...(detail ? { detail } : {}),
  ...(provenance ? { provenance } : {}),
})

/** 20 Scheiben: 14 gemessen, 6 aus Serien-Summen */
const TWENTY = Array.from({ length: 20 }, (_, i) =>
  i < 14 ? entry(`m${i}`, SHOTS) : entry(`s${i}`, SERIES, "entered")
)
const ids = (items: readonly PeriodItem[]) => new Set(items.map((item) => item.id))

describe("Grundlage über einen Zeitraum", () => {
  it("Streuung über die Scheiben mit Lage je Schuss, die übrigen mit Grund", () => {
    const basis = periodBasis(TWENTY, ids(TWENTY.slice(0, 14)), SIGMA)
    expect(basis).toEqual({ counted: 14, of: 20, missing: [{ reason: "noPositions", count: 6 }] })
    expect(basisLine(basis!)).toBe("über 14 von 20 Scheiben · 6 ohne Lage je Schuss")
  })

  it("zählen alle, steht keine Grundlage", () => {
    expect(periodBasis(TWENTY, ids(TWENTY), MEAN)).toBeNull()
  })

  it("eine Scheibe vom Ausdruck wartet auf die Anlage", () => {
    const items = [...TWENTY.slice(0, 19), entry("w99", WAITING, "printout", 0)]
    const basis = periodBasis(items, ids(items.slice(0, 19)), MEAN)
    expect(basisLine(basis!)).toBe("über 19 von 20 Scheiben · 1 wartet auf die Anlage")
  })

  it("ohne Grundlage an einem Eintrag (Treffsicher, alte Projektion) keine", () => {
    const old = TWENTY.map(({ detail: _detail, ...item }) => item)
    expect(periodBasis(old, ids(old.slice(0, 14)), SIGMA)).toBeNull()
  })

  it("ohne einen Wert, mehrere Gründe nach Zahl", () => {
    const items = [
      entry("s1", SERIES, "entered"),
      entry("s2", SERIES, "entered"),
      entry("s3", SERIES, "entered"),
      entry("w4", WAITING, "printout", 0),
    ]
    const basis = periodBasis(items, new Set(), SIGMA)
    expect(basisLine(basis!)).toBe(
      "keine Scheibe mit Wert · 3 ohne Lage je Schuss · 1 wartet auf die Anlage"
    )
  })

  it("gleich viele: in der Folge der Gründe", () => {
    const items = [
      entry("w1", WAITING, "printout", 0),
      entry("s2", SERIES, "entered"),
      entry("m3", SHOTS),
    ]
    const basis = periodBasis(items, ids([items[2]]), SIGMA)
    expect(basis?.missing.map((m) => m.reason)).toEqual(["waiting", "noPositions"])
  })

  it("in Treffsicher „Einheit“", () => {
    const basis: Basis = { counted: 0, of: 3, missing: [{ reason: "noPositions", count: 3 }] }
    const words = { one: "Einheit", many: "Einheiten", noRecords: "" }
    expect(basisLine(basis, words)).toBe("keine Einheit mit Wert · 3 ohne Lage je Schuss")
    expect(basisLine({ ...basis, counted: 1 }, words)).toBe(
      "über 1 von 3 Einheiten · 3 ohne Lage je Schuss"
    )
  })

  it("alle Texte nach den Schreibregeln", () => {
    const texts = DETAIL_REASONS.map((reason) =>
      basisLine({ counted: 2, of: 3, missing: [{ reason, count: 1 }] })
    )
    expect(forbiddenIn(texts)).toEqual([])
  })
})
