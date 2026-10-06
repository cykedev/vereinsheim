// Datenlage (Katalog Q1): Auf welcher Grundlage stehen die Zahlen? Wertung und Probe, Schüsse ohne Lage,
// ohne Zeit oder ohne Wert und die Merkmale. Als dezente Zeile unter jeder Ansicht.

import type { MetricShot } from "../metrics"

export interface DataCoverage {
  match: number
  probe: number
  withoutPosition: number
  withoutTime: number
  /** weder Ring noch Zehntel bekannt */
  withoutValue: number
  /** Zahl der Schüsse je Merkmal */
  flags: Record<string, number>
}

export function dataCoverage(shots: readonly MetricShot[]): DataCoverage {
  const coverage: DataCoverage = {
    match: 0,
    probe: 0,
    withoutPosition: 0,
    withoutTime: 0,
    withoutValue: 0,
    flags: {},
  }
  for (const shot of shots) {
    if (shot.kind === "match") coverage.match++
    else coverage.probe++
    if (!(Number.isFinite(shot.xUm) && Number.isFinite(shot.yUm))) coverage.withoutPosition++
    if (!Number.isFinite(shot.firedAtMs)) coverage.withoutTime++
    if (!Number.isFinite(shot.ring) && !Number.isFinite(shot.decimalTenths)) coverage.withoutValue++
    for (const flag of shot.flags ?? []) coverage.flags[flag] = (coverage.flags[flag] ?? 0) + 1
  }
  return coverage
}
