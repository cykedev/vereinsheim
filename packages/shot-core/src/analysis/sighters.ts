// Probe und Wertung: Umfang der Probe, Probe gegen Wertung und „eingeschossen?“ (Katalog S1–S4). Die
// Probe zählt bis zum ersten Wertungsschuss. Eine Visierverstellung fragt Spiegel nicht ab (User, 8. Oktober
// 2026): „Probe gegen Wertung“ nimmt die ganze Probe, „eingeschossen?“ ihre letzten fünf Schüsse (SF-63).

import { centroid, r50, type Point } from "../geometry"
import { inShotOrder, selectShots, timesInOrder, type MetricShot, type Scoring } from "../metrics"
import { tempo } from "../time"
import { mpiConfidence, type MpiConfidence } from "./position"
import { sigmaEstimate } from "./precision"
import { valueNeed, valueTenths } from "./values"

/**
 * Probeschüsse vor dem ersten Wertungsschuss, in Abgabefolge; was nach Beginn der Wertung als Probe
 * kommt, zählt nicht zur Probe. Auch für das Probe-Diagramm der Oberfläche.
 */
export function sightersBeforeMatch(shots: readonly MetricShot[]): MetricShot[] {
  const ordered = inShotOrder(shots)
  const first = ordered.findIndex((shot) => shot.kind === "match")
  return (first < 0 ? ordered : ordered.slice(0, first)).filter((shot) => shot.kind === "probe")
}

/**
 * Zeit des ersten Schusses mit gültiger Zeit in Schüssen, die schon in Abgabefolge stehen; Platzhalter
 * bringen keine mit (SF-15)
 */
const firstTime = (ordered: readonly MetricShot[]) => {
  const timed = selectShots(ordered, { need: "time" })
  return timed.length ? (timed[0].firedAtMs as number) : null
}

/**
 * Umfang der Probe (S2): Zahl, Blöcke à zehn, Dauer und Zeit bis zum ersten Wertungsschuss. Gezählt
 * wird die Probe bis zum ersten Wertungsschuss; Zeiten nur gültige, ohne Platzhalter: Ist der erste
 * Wertungsschuss ein Platzhalter, misst `untilMatchMs` bis zum ersten mit gültiger Zeit. Springt die Uhr
 * zurück, gibt es keine Dauer (SF-30), und ein negativer Abstand zur Wertung ist keiner.
 */
export function sighterSummary(shots: readonly MetricShot[]): {
  count: number
  blocks: number
  durationMs: number | null
  untilMatchMs: number | null
} | null {
  const sighters = sightersBeforeMatch(shots)
  if (sighters.length === 0) return null
  const timed = selectShots(sighters, { need: "time" })
  const start = firstTime(sighters)
  const match = firstTime(inShotOrder(shots).filter((shot) => shot.kind === "match"))
  const until = start !== null && match !== null ? match - start : null
  return {
    count: sighters.length,
    blocks: Math.ceil(sighters.length / 10),
    durationMs: timed.length ? tempo(timesInOrder(timed)).durationMs : null,
    untilMatchMs: until !== null && until >= 0 ? until : null,
  }
}

export interface GroupSide {
  /** alle Schüsse der Seite */
  n: number
  /** davon mit Wert in der gewählten Wertung (Platzhalter zählen mit ihrem Wert) */
  valued: number
  /** davon mit gültiger Lage (ohne Platzhalter) */
  positioned: number
  /** Ø je Schuss in Ringen der gewählten Wertung */
  meanRings: number | null
  /** R50 ohne Fehlschüsse, ab fünf Schuss; hängt von n ab */
  r50Um: number | null
  /** σ̂ ab drei Schuss; hängt kaum von n ab und taugt für Probe gegen Wertung */
  sigmaUm: number | null
}

function side(shots: readonly MetricShot[], scoring: Scoring): GroupSide {
  const values = selectShots(shots, { need: valueNeed(scoring) }).map((s) =>
    valueTenths(s, scoring)
  )
  const positioned = selectShots(shots, { need: "position" })
  const points: Point[] = selectShots(shots, { need: "position", excludeMisses: true }).map(
    (s) => ({ xUm: s.xUm as number, yUm: s.yUm as number })
  )
  return {
    n: shots.length,
    valued: values.length,
    positioned: positioned.length,
    meanRings: values.length ? values.reduce((s, v) => s + v, 0) / values.length / 10 : null,
    r50Um: points.length >= 5 ? r50(points) : null,
    sigmaUm: sigmaEstimate(shots)?.sigma ?? null,
  }
}

/** Probe gegen Wertung (S3): Ø je Schuss, R50 und σ̂ der ganzen Probe vor der Wertung gegen die Wertung */
export function sighterComparison(
  shots: readonly MetricShot[],
  scoring: Scoring
): { probe: GroupSide; match: GroupSide } | null {
  const probe = sightersBeforeMatch(shots)
  const match = shots.filter((shot) => shot.kind === "match")
  if (probe.length === 0 || match.length === 0) return null
  return { probe: side(probe, scoring), match: side(match, scoring) }
}

/**
 * Eingeschossen? (S4): Lage der letzten fünf Probeschüsse mit Lage vor der Wertung, mit Vertrauensbereich.
 * `real: false` heißt „kein Versatz nachweisbar“, nicht „eingeschossen“: Fünf Schuss erkennen nur einen
 * deutlichen Versatz. Dazu der Versatz Probe → Wertung (S1): Abstand zwischen dem Schwerpunkt dieser
 * Probeschüsse und dem der Wertung, ab drei Wertungsschüssen mit Lage; er zählt dieselben Probeschüsse wie
 * der Test.
 */
export function sighterZeroed(shots: readonly MetricShot[]): {
  n: number
  real: boolean
  center: Point
  offsetUm: number
  ellipse: MpiConfidence["ellipse"]
  matchOffsetUm: number | null
} | null {
  const positioned = selectShots(sightersBeforeMatch(shots), { need: "position" })
  const confidence = mpiConfidence(positioned.slice(-5))
  if (!confidence) return null
  const match = selectShots(
    shots.filter((shot) => shot.kind === "match"),
    { need: "position" }
  ).map((shot) => ({ xUm: shot.xUm as number, yUm: shot.yUm as number }))
  const matchCenter = match.length >= 3 ? (centroid(match) as Point) : null
  return {
    n: confidence.n,
    real: confidence.real,
    center: confidence.center,
    offsetUm: Math.hypot(confidence.center.xUm, confidence.center.yUm),
    ellipse: confidence.ellipse,
    matchOffsetUm: matchCenter
      ? Math.hypot(confidence.center.xUm - matchCenter.xUm, confidence.center.yUm - matchCenter.yUm)
      : null,
  }
}
