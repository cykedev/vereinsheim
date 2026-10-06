// Probe und Wertung: Umfang der Probe, Probe gegen Wertung und „eingeschossen?“ (Katalog S2–S4). Die
// Probe zählt bis zum ersten Wertungsschuss; nach einer Visierverstellung zählt nur der Teil danach
// (SF-63).

import { r50, segmentGroups, type Point } from "../geometry"
import { inShotOrder, selectShots, type MetricShot } from "../metrics"
import { mpiConfidence } from "./position"

/** Probeschüsse vor dem ersten Wertungsschuss, in Abgabefolge */
function sightersBeforeMatch(shots: readonly MetricShot[]): MetricShot[] {
  const ordered = inShotOrder(shots)
  const first = ordered.findIndex((shot) => shot.kind === "match")
  return (first < 0 ? ordered : ordered.slice(0, first)).filter((shot) => shot.kind === "probe")
}

const finiteTime = (shot: MetricShot | undefined) =>
  shot !== undefined && Number.isFinite(shot.firedAtMs) ? (shot.firedAtMs as number) : null

/** Umfang der Probe (S2): Zahl, Blöcke à zehn, Dauer, Zeit bis zum ersten Wertungsschuss */
export function sighterSummary(shots: readonly MetricShot[]): {
  count: number
  blocks: number
  durationMs: number | null
  untilMatchMs: number | null
} | null {
  const ordered = inShotOrder(shots)
  const probe = ordered.filter((shot) => shot.kind === "probe")
  if (probe.length === 0) return null
  const first = finiteTime(probe[0])
  const last = finiteTime(probe[probe.length - 1])
  const match = finiteTime(ordered.find((shot) => shot.kind === "match"))
  return {
    count: probe.length,
    blocks: Math.ceil(probe.length / 10),
    durationMs: first !== null && last !== null ? last - first : null,
    untilMatchMs: first !== null && match !== null ? match - first : null,
  }
}

export interface GroupSide {
  n: number
  meanRings: number | null
  /** R50 ohne Fehlschüsse, ab fünf Schuss */
  r50Um: number | null
}

function side(shots: readonly MetricShot[]): GroupSide {
  const values = selectShots(shots, { need: "decimal" }).map((s) => s.decimalTenths as number)
  const points: Point[] = selectShots(shots, { need: "position", excludeMisses: true }).map(
    (s) => ({ xUm: s.xUm as number, yUm: s.yUm as number })
  )
  return {
    n: shots.length,
    meanRings: values.length ? values.reduce((s, v) => s + v, 0) / values.length / 10 : null,
    r50Um: points.length >= 5 ? r50(points) : null,
  }
}

/**
 * Probe gegen Wertung (S3): Ø je Schuss und R50. `adjustAfter` nennt die Probeschüsse (ab 1), nach
 * denen das Visier verstellt wurde; dann zählt nur die Probe nach der letzten Verstellung.
 */
export function sighterComparison(
  shots: readonly MetricShot[],
  options: { adjustAfter?: readonly number[] } = {}
): { probe: GroupSide; match: GroupSide } | null {
  const sighters = sightersBeforeMatch(shots)
  const match = shots.filter((shot) => shot.kind === "match")
  if (sighters.length === 0 || match.length === 0) return null
  const groups = segmentGroups(sighters, options.adjustAfter ?? [])
  return { probe: side(groups[groups.length - 1]), match: side(match) }
}

/** Eingeschossen? (S4): Lage der letzten fünf Probeschüsse vor der Wertung mit Vertrauensbereich */
export function sighterZeroed(
  shots: readonly MetricShot[]
): { n: number; real: boolean; center: Point; offsetUm: number } | null {
  const confidence = mpiConfidence(sightersBeforeMatch(shots).slice(-5))
  if (!confidence) return null
  return {
    n: confidence.n,
    real: confidence.real,
    center: confidence.center,
    offsetUm: Math.hypot(confidence.center.xUm, confidence.center.yUm),
  }
}
