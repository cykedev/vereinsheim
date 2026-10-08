// Baukasten für Auswertungen über viele Scheiben (period.test.ts, records.test.ts): Scheiben aus
// Zehntelwerten in Abgabefolge, Beginn an einem ganzen Tag.

import type { PeriodCard } from "../analysis/period"
import type { MetricShot } from "../metrics"

export const DAY = 86_400_000

/**
 * Eine Scheibe mit Zehntelwerten in Abgabefolge, 50 s Abstand, Lagen nebeneinander; `probe` macht alle
 * Schüsse zu Probe, `shot` ändert einzelne Schüsse (Index in der Abgabefolge).
 */
export function card(
  id: string,
  day: number,
  tenths: readonly number[],
  extra: Partial<PeriodCard> & {
    probe?: boolean
    shot?: (i: number) => Partial<MetricShot>
  } = {}
): PeriodCard {
  const { probe, shot, ...rest } = extra
  const shots: MetricShot[] = tenths.map((t, i) => ({
    seq: i + 1,
    xUm: 100 * i,
    yUm: 0,
    decimalTenths: t,
    ring: Math.floor(t / 10),
    innerTen: t >= 103,
    firedAtMs: day * DAY + i * 50_000,
    kind: probe ? "probe" : "match",
    series: probe ? null : Math.floor(i / 10) + 1,
    ...shot?.(i),
  }))
  return { id, startedAtMs: day * DAY, kind: "training", complete: true, shots, ...rest }
}
