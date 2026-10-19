// Einheiten als Eingabe der Seite eines Zeitraums (`PeriodItem` aus `@vereinsheim/shot-ui`), wie Spiegels Scheiben.
// Gerechnet wird nur im Fachkern (`@vereinsheim/shot-core`): Mit Einzelschüssen wird die Einheit eine Scheibe ohne
// Lage und Zeit und läuft durch dieselbe Projektion wie in Spiegel; ohne Einzelschüsse tragen nur Ergebnis und
// Ø je Schuss aus den Serien. Probeserien zählen nie.

import type { PeriodCard } from "@vereinsheim/shot-core/analysis"
import {
  inScoring,
  metricByKey,
  type MetricDefinition,
  type MetricShot,
  type Scoring,
} from "@vereinsheim/shot-core/metrics"
import { cardProjection } from "@vereinsheim/shot-core/projection"
import type { PeriodItem } from "@vereinsheim/shot-ui/period/item"

import { parseShotsJson, parseShotValue } from "@/lib/sessions/shots"

export interface SessionForPeriod {
  id: string
  date: Date
  type: string
  discipline: { shotsPerSeries: number; scoringType: string } | null
  hitLocationHorizontalMm: number | null
  hitLocationHorizontalDirection: "LEFT" | "RIGHT" | null
  hitLocationVerticalMm: number | null
  hitLocationVerticalDirection: "HIGH" | "LOW" | null
  series: readonly {
    position: number
    isPractice: boolean
    scoreTotal: number | null
    /** Einzelschüsse wie gespeichert (JSON-Array von Strings) */
    shots: unknown
  }[]
}

export interface SessionItem extends PeriodItem {
  /** Wertung der Disziplin: Zehntel bei `TENTH`, sonst ganze Ringe (dort gibt es keine Zehntel) */
  scoring: Scoring
  /** jede Wertungsserie mit Einzelschüssen; ohne sie nur Ergebnis und Ø je Schuss aus den Serien */
  withShots: boolean
  /** Lage der Treffer aus dem Ausdruck in mm, rechts und hoch positiv; null ohne Angabe */
  location: { xMm: number; yMm: number } | null
}

/** Kennzahlen, die Einzelschüsse ohne Lage nicht hergeben: Innenzehner hängen an der Lage, nicht am Wert */
const WITHOUT_POSITION = ["result.innerTens"] as const

export const scoringOf = (scoringType: string): Scoring =>
  scoringType === "TENTH" ? "decimal" : "rings"

const keyIn = (key: string, scoring: Scoring) =>
  inScoring(metricByKey(key) as MetricDefinition, scoring).key

/** ein Wert auf das Raster der Wertung (Zehntel oder ganze Ringe), damit Summen aus Gleitkommazahlen exakt bleiben */
const onGrid = (value: number, scoring: Scoring) =>
  scoring === "decimal" ? Math.round(value * 10) / 10 : Math.round(value)

function locationOf(session: SessionForPeriod): SessionItem["location"] {
  const { hitLocationHorizontalMm: x, hitLocationVerticalMm: y } = session
  if (x === null || y === null) return null
  return {
    xMm: session.hitLocationHorizontalDirection === "LEFT" ? -x : x,
    yMm: session.hitLocationVerticalDirection === "LOW" ? -y : y,
  }
}

/** die Einzelschüsse der Wertung als Schüsse des Fachkerns, ohne Lage und Zeit; null, wenn einer Serie welche fehlen */
function matchShots(series: SessionForPeriod["series"], scoring: Scoring): MetricShot[] | null {
  const shots: MetricShot[] = []
  for (const [index, serie] of series.entries()) {
    const values = parseShotsJson(serie.shots).map(parseShotValue)
    if (!values.length || values.some((v) => v === null)) return null
    for (const value of values as number[])
      shots.push({
        seq: shots.length + 1,
        xUm: null,
        yUm: null,
        decimalTenths: scoring === "decimal" ? Math.round(value * 10) : null,
        ring: Math.floor(value),
        innerTen: false,
        firedAtMs: null,
        kind: "match",
        series: index + 1,
      })
  }
  return shots
}

/**
 * Eine Einheit als Eintrag: Training oder Wettkampf mit Disziplin und Ergebnis, sonst null. Wertungsserien sind die
 * ohne Probe mit Ergebnis (wie die Übersicht der Statistik). Mit Einzelschüssen in jeder Wertungsserie Werte und Rekord-Kandidaten aus `cardProjection` (in Zehntel-Disziplinen beide Wertungen, sonst nur
 * ganze Ringe), ohne Innenzehner. Ohne sie Ergebnis und Ø je Schuss in der Wertung der Disziplin aus den
 * Serienergebnissen, mit n = Serien × Schuss je Serie der Disziplin (die echte Zahl ist nicht gespeichert).
 */
export function periodItem(session: SessionForPeriod): SessionItem | null {
  const { discipline } = session
  if (!discipline || (session.type !== "TRAINING" && session.type !== "WETTKAMPF")) return null
  const scoring = scoringOf(discipline.scoringType)
  const series = [...session.series]
    .sort((a, b) => a.position - b.position)
    .filter((s) => !s.isPractice && s.scoreTotal !== null)
  if (!series.length) return null
  const base = {
    id: session.id,
    startedAtMs: session.date.getTime(),
    kind: session.type === "WETTKAMPF" ? ("competition" as const) : ("training" as const),
    probeOnly: false,
    flags: [],
    scoring,
    location: locationOf(session),
  }

  const shots = matchShots(series, scoring)
  if (shots) {
    const card: PeriodCard = { ...base, complete: true, official: scoring, shots }
    const projection = cardProjection(card)
    const metrics: Record<string, { value: number; n: number } | null> = {
      ...projection.values,
    }
    for (const key of WITHOUT_POSITION) delete metrics[key]
    return {
      ...base,
      shots: projection.printedShots,
      metrics,
      records: {
        decimal: scoring === "decimal" ? projection.records.decimal : null,
        rings: projection.records.rings,
      },
      withShots: true,
    }
  }

  const n = series.length * discipline.shotsPerSeries
  const total = onGrid(
    series.reduce((sum, s) => sum + (s.scoreTotal as number), 0),
    scoring
  )
  return {
    ...base,
    shots: n,
    metrics: {
      [keyIn("result.decimal", scoring)]: { value: total, n },
      [keyIn("result.decimalMean", scoring)]: { value: total / n, n },
    },
    records: { decimal: null, rings: null },
    withShots: false,
  }
}

/** die Einheiten, die als Eintrag taugen, in der Folge der Eingabe */
export const periodItems = (sessions: readonly SessionForPeriod[]): SessionItem[] =>
  sessions.flatMap((session) => periodItem(session) ?? [])
