// Höhenlinien des Trefferbilds über einen Zeitraum: aus dem Raster des Fachkerns (`DensityGrid`, Zeile 0 oben) die
// Fläche über einer Stufe als SVG-Pfad in mm, wie `MiniTarget` zeichnet (x = µm/1000, y = −µm/1000). Rein, ohne React.

/** das Raster, wie es vom Server kommt */
export interface ContourGrid {
  size: number
  cells: readonly number[]
}

/** Kante eines Quadrats: oben, rechts, unten, links */
type Edge = 0 | 1 | 2 | 3

/**
 * Welche Kanten je Fall verbunden werden; Bits: oben links 8, oben rechts 4, unten rechts 2, unten links 1. Die
 * Sattelfälle 5 und 10 entscheidet die Mitte des Quadrats (`saddle`).
 */
const CASES: Readonly<Record<number, readonly (readonly [Edge, Edge])[]>> = {
  1: [[3, 2]],
  2: [[2, 1]],
  3: [[3, 1]],
  4: [[0, 1]],
  6: [[0, 2]],
  7: [[3, 0]],
  8: [[3, 0]],
  9: [[0, 2]],
  11: [[0, 1]],
  12: [[3, 1]],
  13: [[2, 1]],
  14: [[3, 2]],
}

/** Sattel: Ist die Mitte innen, hängen die inneren Ecken zusammen, und die äußeren werden abgeschnitten */
function saddle(index: 5 | 10, centerInside: boolean): readonly (readonly [Edge, Edge])[] {
  // 5: oben rechts und unten links innen; 10: oben links und unten rechts innen
  const cutTopLeftAndBottomRight: [Edge, Edge][] = [
    [3, 0],
    [2, 1],
  ]
  const cutTopRightAndBottomLeft: [Edge, Edge][] = [
    [0, 1],
    [3, 2],
  ]
  if (index === 5) return centerInside ? cutTopLeftAndBottomRight : cutTopRightAndBottomLeft
  return centerInside ? cutTopRightAndBottomLeft : cutTopLeftAndBottomRight
}

const round = (value: number) => Math.round(value * 1000) / 1000

/**
 * Die Fläche, in der das Raster mindestens `level` erreicht, als geschlossener Pfad (mehrere Teile, Löcher über
 * `fill-rule="evenodd"`). Marching Squares über die Mitten der Zellen mit linearer Interpolation; außerhalb des Rasters
 * gilt 0, damit jede Fläche geschlossen ist. `halfUm` ist die halbe Kantenlänge des Rasters um die Mitte der Scheibe.
 * Ohne Fläche ein leerer Pfad.
 */
export function contourPath(grid: ContourGrid, level: number, halfUm: number): string {
  const { size, cells } = grid
  const cell = (2 * halfUm) / size
  const value = (row: number, col: number) =>
    row < 0 || col < 0 || row >= size || col >= size ? 0 : cells[row * size + col]
  // Mitte einer Zelle in mm, y nach unten wie im SVG
  const xOf = (col: number) => (-halfUm + (col + 0.5) * cell) / 1000
  const yOf = (row: number) => -(halfUm - (row + 0.5) * cell) / 1000
  const points = new Map<string, readonly [number, number]>()
  const links = new Map<string, string[]>()
  const between = (r1: number, c1: number, r2: number, c2: number) => {
    const a = value(r1, c1)
    const b = value(r2, c2)
    const t = a === b ? 0.5 : (level - a) / (b - a)
    return [
      round(xOf(c1) + t * (xOf(c2) - xOf(c1))),
      round(yOf(r1) + t * (yOf(r2) - yOf(r1))),
    ] as const
  }
  // eine Kante als Schlüssel, geteilt von den beiden Quadraten daneben
  const edgeKey = (row: number, col: number, edge: Edge) => {
    if (edge === 0) return `h:${row}:${col}`
    if (edge === 2) return `h:${row + 1}:${col}`
    if (edge === 3) return `v:${row}:${col}`
    return `v:${row}:${col + 1}`
  }
  const edgePoint = (row: number, col: number, edge: Edge) => {
    const key = edgeKey(row, col, edge)
    if (!points.has(key)) {
      const point =
        edge === 0
          ? between(row, col, row, col + 1)
          : edge === 2
            ? between(row + 1, col, row + 1, col + 1)
            : edge === 3
              ? between(row, col, row + 1, col)
              : between(row, col + 1, row + 1, col + 1)
      points.set(key, point)
    }
    return key
  }
  const link = (a: string, b: string) => {
    links.set(a, [...(links.get(a) ?? []), b])
    links.set(b, [...(links.get(b) ?? []), a])
  }
  for (let row = -1; row < size; row++) {
    for (let col = -1; col < size; col++) {
      const tl = value(row, col)
      const tr = value(row, col + 1)
      const br = value(row + 1, col + 1)
      const bl = value(row + 1, col)
      const index =
        (tl >= level ? 8 : 0) |
        (tr >= level ? 4 : 0) |
        (br >= level ? 2 : 0) |
        (bl >= level ? 1 : 0)
      if (index === 0 || index === 15) continue
      const pairs =
        index === 5 || index === 10 ? saddle(index, (tl + tr + br + bl) / 4 >= level) : CASES[index]
      for (const [a, b] of pairs) link(edgePoint(row, col, a), edgePoint(row, col, b))
    }
  }
  const seen = new Set<string>()
  const loops: string[] = []
  for (const start of links.keys()) {
    if (seen.has(start)) continue
    const loop: string[] = []
    let previous: string | null = null
    let current: string | undefined = start
    while (current && !seen.has(current)) {
      seen.add(current)
      loop.push(current)
      const next: string | undefined = (links.get(current) ?? []).find(
        (key) => key !== previous && !seen.has(key)
      )
      previous = current
      current = next
    }
    const [first, ...rest] = loop.map((key) => points.get(key) as readonly [number, number])
    loops.push(`M${first[0]} ${first[1]}${rest.map(([x, y]) => `L${x} ${y}`).join("")}Z`)
  }
  return loops.join("")
}
