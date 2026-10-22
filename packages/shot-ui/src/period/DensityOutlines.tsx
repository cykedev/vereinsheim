import { contourPath, type ContourGrid } from "./contours"

const HAIR = { vectorEffect: "non-scaling-stroke" } as const
/** Stufen der Umrisse in `HEAT_SHARES`: 9 von 10 und die Hälfte der Schüsse */
const OUTER = 1
const INNER = 3
/** Saum unter den Linien, damit sie auf Papier, Spiegel und Ringen stehen */
const EDGE = "var(--shot-edge)"

/** ein Umriss mit dunklem Saum */
function Line({
  d,
  color,
  name,
  dashed,
}: {
  d: string
  color: string
  name: string
  dashed: boolean
}) {
  return (
    <g data-outline={name} data-dashed={dashed || undefined}>
      <path d={d} fill="none" stroke={EDGE} strokeWidth={5} fillRule="evenodd" {...HAIR} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeDasharray={dashed ? "6 4" : undefined}
        fillRule="evenodd"
        {...HAIR}
      />
    </g>
  )
}

/**
 * Die Umrisse einer Gruppe aus ihrem Dichteraster, in mm wie die Scheibe: gestrichelt die Fläche mit 9 von 10
 * Schüssen, durchgezogen die mit der Hälfte, mit `tint` diese getönt. Eine Zeichnung für das Trefferbild eines
 * Zeitraums und für beide Seiten beim Vergleichen, damit sie gleich aussehen.
 */
export function DensityOutlines({
  grid,
  halfUm,
  color,
  name,
  tint = false,
}: {
  grid: ContourGrid & { levels: readonly number[] }
  /** halbe Kantenlänge des Quadrats, auf dem das Raster liegt */
  halfUm: number
  color: string
  /** `data-outline` der Linien, etwa die Seite beim Vergleichen */
  name: string
  tint?: boolean
}) {
  const inner = contourPath(grid, grid.levels[INNER], halfUm)
  return (
    <g data-outlines={name}>
      {tint && <path d={inner} fill={color} fillOpacity={0.4} fillRule="evenodd" />}
      <Line d={contourPath(grid, grid.levels[OUTER], halfUm)} color={color} name={name} dashed />
      <Line d={inner} color={color} name={name} dashed={false} />
    </g>
  )
}
