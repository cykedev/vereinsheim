import { formatSigned } from "@vereinsheim/shot-ui/format"

import { ANALYSIS_TEXTS } from "../analysis/texts"

/** die kleinste Spanne des Strichs je Seite, in Ringen je Schuss */
const MIN_SPAN = 0.3

/** die Spanne je Seite: mindestens 0,3, sonst aufgerundet auf 0,1 über dem größten Mittel */
export function stripSpan(means: readonly (number | null)[]): number {
  const largest = Math.max(0, ...means.map((m) => (m === null ? 0 : Math.abs(m))))
  return Math.max(MIN_SPAN, Math.ceil(largest * 10 - 1e-9) / 10)
}

/**
 * Eine Spanne für alle Striche einer Seite: aus den Mitteln aller Gruppen, damit Zeilen untereinander dieselbe Skala
 * haben und ein kleiner Abstand nicht groß wirkt
 */
export function sharedStripSpan(
  rows: readonly { high: { mean: number | null }; low: { mean: number | null } }[]
): number {
  return stripSpan(rows.flatMap((row) => [row.high.mean, row.low.mean]))
}

/** Lage auf dem Strich in Prozent, mit Rand für die Beschriftung */
const at = (value: number, span: number) => `${8 + ((value + span) / (2 * span)) * 84}%`

/**
 * Der Strich eines Merkmals: Achse, die Form gestrichelt in der Mitte, die hohe Gruppe als gefüllter Punkt, die
 * niedrige als hohler, verbunden. Eine leere Gruppe hat keinen Punkt. Auf einer Seite mit mehreren Strichen gibt der
 * Aufrufer allen dieselbe Spanne (`sharedStripSpan`).
 */
export function InfluenceStrip({
  high,
  low,
  span = stripSpan([high, low]),
}: {
  high: number | null
  low: number | null
  /** die Spanne je Seite; ohne die eigene aus beiden Gruppen */
  span?: number
}) {
  return (
    <svg
      data-influence-strip
      aria-hidden
      width="100%"
      height="44"
      className="block overflow-visible select-none"
    >
      <line x1="8%" x2="92%" y1="14" y2="14" className="stroke-line-strong" strokeWidth="1" />
      <line
        x1="50%"
        x2="50%"
        y1="4"
        y2="24"
        className="stroke-quiet"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
      {high !== null && low !== null && (
        <line
          x1={at(low, span)}
          x2={at(high, span)}
          y1="14"
          y2="14"
          className="stroke-primary"
          strokeWidth="2"
        />
      )}
      {low !== null && (
        <circle
          data-strip-low
          cx={at(low, span)}
          cy="14"
          r="5"
          className="fill-card stroke-primary"
          strokeWidth="2"
        />
      )}
      {high !== null && (
        <circle data-strip-high cx={at(high, span)} cy="14" r="5.5" className="fill-primary" />
      )}
      <g className="fill-muted-foreground text-[12px] tabular-nums">
        <text x="8%" y="40" textAnchor="start">
          {formatSigned(-span, 1)}
        </text>
        <text x="50%" y="40" textAnchor="middle">
          {ANALYSIS_TEXTS.stripForm}
        </text>
        <text x="92%" y="40" textAnchor="end">
          {formatSigned(span, 1)}
        </text>
      </g>
    </svg>
  )
}

/** die Legende unter den Einflüssen: hoher Wert gefüllt, niedriger hohl, die Form gestrichelt */
export function InfluenceLegend({ high, low, form }: { high: string; low: string; form: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-3 rounded-full bg-primary" />
        {high}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-3 rounded-full border-2 border-primary bg-card" />
        {low}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="h-3 w-0 border-l-2 border-dashed border-quiet" />
        {form}
      </span>
    </p>
  )
}
