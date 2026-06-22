// src/lib/series/scoring-format.test.ts
import { describe, it, expect } from "vitest"
import {
  getEffectiveScoringType,
  getMaxRings,
  formatRings,
  formatDecimal1,
  getRingsInputProps,
} from "./scoring-format"

describe("getEffectiveScoringType", () => {
  it("RINGS → WHOLE unabhängig von Disziplin", () => {
    expect(getEffectiveScoringType("RINGS", { scoringType: "DECIMAL" })).toBe("WHOLE")
    expect(getEffectiveScoringType("RINGS", null)).toBe("WHOLE")
  })

  it("RINGS_DECIMAL → DECIMAL unabhängig von Disziplin", () => {
    expect(getEffectiveScoringType("RINGS_DECIMAL", { scoringType: "WHOLE" })).toBe("DECIMAL")
    expect(getEffectiveScoringType("RINGS_DECIMAL", null)).toBe("DECIMAL")
  })

  it("DECIMAL_REST → DECIMAL", () => {
    expect(getEffectiveScoringType("DECIMAL_REST", null)).toBe("DECIMAL")
  })

  it("RINGTEILER → folgt der Disziplin", () => {
    expect(getEffectiveScoringType("RINGTEILER", { scoringType: "WHOLE" })).toBe("WHOLE")
    expect(getEffectiveScoringType("RINGTEILER", { scoringType: "DECIMAL" })).toBe("DECIMAL")
  })

  it("TEILER → folgt der Disziplin", () => {
    expect(getEffectiveScoringType("TEILER", { scoringType: "DECIMAL" })).toBe("DECIMAL")
  })

  it("TARGET_ABSOLUTE ohne targetValueType → folgt der Disziplin", () => {
    expect(getEffectiveScoringType("TARGET_ABSOLUTE", { scoringType: "WHOLE" })).toBe("WHOLE")
  })

  it("TARGET_UNDER ohne targetValueType → folgt der Disziplin", () => {
    expect(getEffectiveScoringType("TARGET_UNDER", { scoringType: "DECIMAL" })).toBe("DECIMAL")
  })

  it("TARGET_OVER ohne targetValueType → folgt der Disziplin", () => {
    expect(getEffectiveScoringType("TARGET_OVER", { scoringType: "WHOLE" })).toBe("WHOLE")
  })

  it("TARGET_* mit targetValueType=RINGS_DECIMAL → DECIMAL (auch bei WHOLE-Disziplin)", () => {
    expect(
      getEffectiveScoringType("TARGET_ABSOLUTE", { scoringType: "WHOLE" }, "RINGS_DECIMAL")
    ).toBe("DECIMAL")
    expect(getEffectiveScoringType("TARGET_UNDER", { scoringType: "WHOLE" }, "RINGS_DECIMAL")).toBe(
      "DECIMAL"
    )
    expect(getEffectiveScoringType("TARGET_OVER", { scoringType: "WHOLE" }, "RINGS_DECIMAL")).toBe(
      "DECIMAL"
    )
    expect(getEffectiveScoringType("TARGET_UNDER", null, "RINGS_DECIMAL")).toBe("DECIMAL")
  })

  it("TARGET_* mit targetValueType=RINGS → WHOLE (auch bei DECIMAL-Disziplin)", () => {
    expect(getEffectiveScoringType("TARGET_ABSOLUTE", { scoringType: "DECIMAL" }, "RINGS")).toBe(
      "WHOLE"
    )
    expect(getEffectiveScoringType("TARGET_UNDER", { scoringType: "DECIMAL" }, "RINGS")).toBe(
      "WHOLE"
    )
  })

  it("TARGET_* mit targetValueType=TEILER → folgt der Disziplin", () => {
    expect(getEffectiveScoringType("TARGET_UNDER", { scoringType: "WHOLE" }, "TEILER")).toBe(
      "WHOLE"
    )
    expect(getEffectiveScoringType("TARGET_UNDER", { scoringType: "DECIMAL" }, "TEILER")).toBe(
      "DECIMAL"
    )
  })

  it("targetValueType wird bei nicht-TARGET-Modi ignoriert", () => {
    expect(getEffectiveScoringType("RINGS", { scoringType: "DECIMAL" }, "RINGS_DECIMAL")).toBe(
      "WHOLE"
    )
    expect(getEffectiveScoringType("RINGTEILER", { scoringType: "WHOLE" }, "RINGS_DECIMAL")).toBe(
      "WHOLE"
    )
  })

  it("RINGTEILER ohne Disziplin (gemischt) → WHOLE als Fallback", () => {
    expect(getEffectiveScoringType("RINGTEILER", null)).toBe("WHOLE")
  })
})

describe("getMaxRings", () => {
  it("WHOLE: 10 Schuss → 100", () => {
    expect(getMaxRings("WHOLE", 10)).toBe(100)
  })

  it("WHOLE: 30 Schuss → 300", () => {
    expect(getMaxRings("WHOLE", 30)).toBe(300)
  })

  it("DECIMAL: 10 Schuss → 109", () => {
    expect(getMaxRings("DECIMAL", 10)).toBe(109)
  })

  it("DECIMAL: 5 Schuss → 54.5", () => {
    expect(getMaxRings("DECIMAL", 5)).toBe(54.5)
  })

  it("DECIMAL: 30 Schuss → 327", () => {
    expect(getMaxRings("DECIMAL", 30)).toBe(327)
  })
})

describe("formatRings", () => {
  it("null → Gedankenstrich", () => {
    expect(formatRings(null, "WHOLE")).toBe("–")
    expect(formatRings(null, "DECIMAL")).toBe("–")
  })

  it("WHOLE: ganzzahlig ohne Komma", () => {
    expect(formatRings(96, "WHOLE")).toBe("96")
    expect(formatRings(100, "WHOLE")).toBe("100")
    expect(formatRings(0, "WHOLE")).toBe("0")
  })

  it("DECIMAL: mit deutschem Komma, 1 Stelle", () => {
    expect(formatRings(96.5, "DECIMAL")).toBe("96,5")
    expect(formatRings(109, "DECIMAL")).toBe("109,0")
    expect(formatRings(0, "DECIMAL")).toBe("0,0")
  })
})

describe("formatDecimal1", () => {
  it("null → Gedankenstrich", () => {
    expect(formatDecimal1(null)).toBe("–")
  })

  it("ganzzahlige Werte mit ,0", () => {
    expect(formatDecimal1(12)).toBe("12,0")
    expect(formatDecimal1(0)).toBe("0,0")
  })

  it("Dezimalwerte mit deutschem Komma", () => {
    expect(formatDecimal1(3.7)).toBe("3,7")
    expect(formatDecimal1(9999.9)).toBe("9999,9")
  })
})

describe("getRingsInputProps", () => {
  it("WHOLE: step=1, numeric inputMode", () => {
    const props = getRingsInputProps("WHOLE", 10)
    expect(props.inputMode).toBe("numeric")
    expect(props.step).toBe("1")
    expect(props.placeholder).toBe("z.B. 96")
    expect(props.min).toBe(0)
    expect(props.max).toBe(100)
  })

  it("DECIMAL: step=0.1, decimal inputMode", () => {
    const props = getRingsInputProps("DECIMAL", 10)
    expect(props.inputMode).toBe("decimal")
    expect(props.step).toBe("0.1")
    expect(props.placeholder).toBe("z.B. 96,5")
    expect(props.min).toBe(0)
    expect(props.max).toBe(109)
  })

  it("WHOLE: max skaliert mit Schusszahl", () => {
    expect(getRingsInputProps("WHOLE", 30).max).toBe(300)
  })

  it("DECIMAL: max skaliert mit Schusszahl", () => {
    expect(getRingsInputProps("DECIMAL", 30).max).toBe(327)
  })
})
