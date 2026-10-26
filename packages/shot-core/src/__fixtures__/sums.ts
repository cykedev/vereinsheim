// Scheiben mit Angaben ohne oder neben Einzelschüssen ([[adr-033]]) für sums.test.ts und projection.test.ts:
// erfunden, je einen Tag auseinander, vollständig, wo nicht anders gesagt.

import type { PeriodCard } from "../analysis/period"
import type { MetricShot } from "../metrics"
import { DAY } from "./period"

export const sumsCard = (id: string, day: number, extra: Partial<PeriodCard> = {}): PeriodCard => ({
  id,
  startedAtMs: day * DAY,
  kind: "training",
  complete: true,
  shots: [],
  ...extra,
})

/** zehn Wertungsschüsse in ganzen Ringen, ohne Zehntel, ohne Lage, Innenzehner unbekannt: 94 Ringe, 5 Zehner */
export const RING_SHOTS: MetricShot[] = [10, 9, 10, 8, 9, 10, 10, 9, 9, 10].map((ring, i) => ({
  seq: i + 1,
  xUm: null,
  yUm: null,
  decimalTenths: null,
  ring,
  innerTen: null,
  firedAtMs: null,
  kind: "match",
  series: 1,
}))

export const TOTAL_RINGS = sumsCard("total-rings", 1, {
  sums: { series: [], total: { shots: 40, rings: 371, decimalTenths: null }, center: null },
})
export const SERIES_TENTHS = sumsCard("series-tenths", 2, {
  sums: {
    series: [984, 991, 977, 1002].map((tenths, i) => ({
      series: i + 1,
      shots: 10,
      rings: null,
      decimalTenths: tenths,
    })),
    total: null,
    center: null,
  },
})
export const SHOTS_RINGS = sumsCard("shots-rings", 3, { shots: RING_SHOTS })
export const CASCADE = sumsCard("cascade", 4, {
  shots: RING_SHOTS,
  sums: {
    series: [{ series: 1, shots: 10, rings: 94, decimalTenths: 978 }],
    total: null,
    center: null,
  },
})
export const CENTER_TOTAL = sumsCard("center-total", 5, {
  sums: {
    series: [],
    total: { shots: 40, rings: 380, decimalTenths: null },
    center: { xUm: 1200, yUm: -500, shots: 40 },
  },
})
export const TREFFSICHER = sumsCard("treffsicher", 6, {
  shots: RING_SHOTS,
  sums: { series: [], total: null, center: { xUm: 500, yUm: 1200, shots: 10 } },
})
export const INCOMPLETE = sumsCard("incomplete", 7, {
  complete: false,
  sums: { series: [], total: { shots: 30, rings: 280, decimalTenths: null }, center: null },
})
export const EMPTY = sumsCard("empty", 8)

/** drei Probeschüsse mit Wert und Lage, keine Wertung als Schuss */
const SIGHTERS: MetricShot[] = [98, 103, 92].map((decimalTenths, i) => ({
  seq: i + 1,
  xUm: 400 * (i - 1),
  yUm: 300,
  decimalTenths,
  ring: Math.floor(decimalTenths / 10),
  innerTen: false,
  firedAtMs: null,
  kind: "probe",
  series: null,
}))
/** Probe je Schuss, die Wertung nur als Gesamtergebnis (wie übernommen): die Probe zählt nicht */
export const SIGHTERS_TOTAL = sumsCard("sighters-total", 9, {
  shots: SIGHTERS,
  sums: { series: [], total: { shots: 40, rings: null, decimalTenths: 3900 }, center: null },
})
/** nur Probe und eine Trefferlage als Summe: eine Scheibe nur aus Probe */
export const SIGHTERS_CENTER = sumsCard("sighters-center", 10, {
  shots: SIGHTERS,
  sums: { series: [], total: null, center: { xUm: 600, yUm: 800, shots: 3 } },
})

/** alle Scheiben oben und eine ohne jede Angabe (Ausdruck, wartet auf die Anlage) */
export const SUMS: readonly PeriodCard[] = [
  TOTAL_RINGS,
  SERIES_TENTHS,
  SHOTS_RINGS,
  CASCADE,
  CENTER_TOTAL,
  TREFFSICHER,
  INCOMPLETE,
  EMPTY,
  SIGHTERS_TOTAL,
  SIGHTERS_CENTER,
]
