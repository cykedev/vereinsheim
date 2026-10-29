import { describe, expect, it } from "vitest"

import { pooledValue, type CardValue } from "@vereinsheim/shot-core/analysis"
import { metricByKey, type MetricDefinition } from "@vereinsheim/shot-core/metrics"
import { DELTA_WINDOW, deltasBefore } from "@vereinsheim/shot-ui/period/model"

import type { FormCard } from "@/lib/results-read"

import { countedCards, entryValue, formBefore, formDistance } from "./form"

const DAY = 86_400_000
const START = Date.UTC(2026, 0, 5, 17)
const RINGS_MEAN = metricByKey("result.ringsMean") as MetricDefinition

const dayOf = (i: number) => new Date(START + i * DAY).toISOString().slice(0, 10)

/** eine Scheibe am Abend i (Tage ab dem 5. Januar 2026) */
function card(
  i: number,
  mean: number | null,
  extra: Partial<FormCard> & { n?: number; sd?: number | null } = {}
): FormCard {
  const { n = 40, ...rest } = extra
  const sd = "sd" in extra ? extra.sd : 0.8
  delete rest.sd
  return {
    id: `c${String(i).padStart(3, "0")}${rest.startedAtMs ? "b" : ""}`,
    day: dayOf(i),
    startedAtMs: START + i * DAY,
    kind: "training",
    probeOnly: false,
    mean: mean === null ? null : { value: mean, n, sd },
    series: null,
    ...rest,
  }
}

describe("countedCards", () => {
  it("zählt an einem Abend mit Wertung nur die Wertung, an einem ohne die Probe", () => {
    const block = card(0, 9.1, { probeOnly: true, n: 10 })
    const scored = card(0, 9.4, { startedAtMs: START + 3_600_000 })
    const training = card(1, 9.2, { probeOnly: true })
    expect(countedCards([block, scored, training])).toEqual([scored, training])
  })
})

describe("formBefore", () => {
  const cards = [9.0, 9.2, 9.4, 9.6, 9.8, 9.1].map((v, i) => card(i, v))

  it("ist unter fünf Scheiben davor null", () => {
    expect(formBefore(cards, dayOf(4), "rings")).toBeNull()
  })

  it("nimmt die letzten fünf vor dem Abend, über ihre Schüsse", () => {
    expect(formBefore(cards, dayOf(5), "rings")).toBeCloseTo(9.4, 9)
    expect(formBefore(cards, dayOf(9), "rings")).toBeCloseTo((9.2 + 9.4 + 9.6 + 9.8 + 9.1) / 5, 9)
  })

  it("zählt Scheiben desselben Abends nie mit", () => {
    const same = [...cards.slice(0, 5), card(4, 5, { startedAtMs: START + 4 * DAY + 3_600_000 })]
    // die zweite Scheibe am vierten Abend: davor liegen nur vier Abende
    expect(formBefore(same, dayOf(4), "rings")).toBeNull()
    expect(formBefore(same, dayOf(5), "rings")).not.toBeNull()
  })

  it("lässt Scheiben ohne Wert aus", () => {
    const gaps = [card(0, 9), card(1, null), ...[9.2, 9.4, 9.6, 9.8].map((v, i) => card(i + 2, v))]
    expect(formBefore(gaps, dayOf(6), "rings")).toBeCloseTo(9.4, 9)
  })

  it("Gegenprobe: je Abend eine Scheibe, derselbe Abstand wie in der Liste (deltasBefore)", () => {
    // ganze Ringe auf verschiedenen Schusszahlen: der Ø liegt auf dem Raster, wie aus der Projektion
    const series = [360, 372, 356, 380, 364, 388, 368, 352, 384, 376].map((rings, i) =>
      card(i, rings / (40 - i), { n: 40 - i })
    )
    const values: CardValue[] = series.map((c) => ({
      id: c.id,
      atMs: c.startedAtMs,
      value: c.mean!.value,
      n: c.mean!.n,
      sd: c.mean!.sd,
    }))
    const deltas = deltasBefore(
      values,
      null,
      DELTA_WINDOW,
      (before) => pooledValue(before, RINGS_MEAN) as number
    )
    for (const c of series.slice(DELTA_WINDOW)) {
      const form = formBefore(series, c.day, "rings")
      expect(form).not.toBeNull()
      const distance = formDistance(c, entryValue([c], "rings")!, form!)
      expect(Math.abs(distance.value - deltas.get(c.id)!.delta)).toBeLessThan(1e-9)
    }
  })
})

describe("entryValue", () => {
  it("mittelt über die Schüsse aller Scheiben eines Eintrags", () => {
    const value = entryValue([card(0, 9, { n: 10 }), card(0, 10, { n: 40 })], "rings")
    expect(value).not.toBeNull()
    expect(value!.value).toBeCloseTo(9.8, 9)
    expect(value!.n).toBe(50)
  })

  it("setzt die Streuung aus Streuung und Mittel je Scheibe zusammen, wie über die Einzelwerte", () => {
    const a = [9, 10, 8, 9, 10]
    const b = [10, 10, 9, 10]
    const stats = (xs: number[]) => {
      const m = xs.reduce((s, x) => s + x, 0) / xs.length
      return { m, sd: Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1)) }
    }
    const all = stats([...a, ...b])
    const value = entryValue(
      [
        card(0, stats(a).m, { n: a.length, sd: stats(a).sd }),
        card(0, stats(b).m, { n: b.length, sd: stats(b).sd }),
      ],
      "rings"
    )
    expect(value!.value).toBeCloseTo(all.m, 9)
    expect(value!.sd).toBeCloseTo(all.sd, 9)
  })

  it("ohne Streuung an einer Scheibe ohne Streuung, ohne Wert null", () => {
    expect(entryValue([card(0, 9), card(0, 9.5, { sd: undefined })], "rings")!.sd).toBeUndefined()
    expect(entryValue([card(0, null)], "rings")).toBeNull()
    expect(entryValue([], "rings")).toBeNull()
  })
})

describe("formDistance", () => {
  it("zieht die Form ab und behält Schüsse und Streuung", () => {
    const distance = formDistance({ id: "e1", startedAtMs: 5 }, { value: 9.5, n: 40, sd: 0.8 }, 9.2)
    expect(distance.value).toBeCloseTo(0.3, 9)
    expect(distance).toMatchObject({ id: "e1", atMs: 5, n: 40, sd: 0.8 })
    expect(formDistance({ id: "e2", startedAtMs: 5 }, { value: 9, n: 20 }, 9).sd).toBeUndefined()
  })
})
