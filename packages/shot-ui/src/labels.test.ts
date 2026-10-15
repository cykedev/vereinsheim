import { inScoring, metricByKey } from "@vereinsheim/shot-core/metrics"
import { describe, expect, it } from "vitest"

import { metricLabel } from "./labels"
import { PERIOD_CHART_METRICS, PERIOD_TILE_KEYS } from "./period/model"

const label = (key: string) => metricLabel(metricByKey(key)!)

describe("Anzeigenamen der Kennzahlen", () => {
  it("Alltagswort statt Fachbegriff", () => {
    expect(label("group.sigma")).toBe("Streuung")
    expect(label("group.sdX")).toBe("Streuung waagrecht")
    expect(label("group.sdY")).toBe("Streuung senkrecht")
    expect(label("time.intervalMedian")).toBe("Tempo")
  })

  it("sonst der Name aus dem Fachkern, auch in ganzen Ringen", () => {
    expect(label("result.decimalMean")).toBe("Ø je Schuss")
    expect(label("result.tensRate")).toBe(metricByKey("result.tensRate")!.label)
    const whole = inScoring(metricByKey("result.decimalMean")!, "rings")
    expect(metricLabel(whole)).toBe(whole.label)
  })

  it("Zahlen und Umschalter des Fortschritts ohne σ, R50 und „Median“", () => {
    const names = [...PERIOD_TILE_KEYS.map(label), ...PERIOD_CHART_METRICS.map((m) => m.label)]
    for (const name of names) expect(name).not.toMatch(/σ|R50|Median/)
    expect(PERIOD_CHART_METRICS.find((m) => m.key === "group.sigma")?.label).toBe("Streuung")
  })
})
