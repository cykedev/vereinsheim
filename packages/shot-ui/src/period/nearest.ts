// Antippen in einem Bild aus Punkten (Lage über Zeit): der nächste Punkt zum Zeiger. Rein, ohne React.

/**
 * Index des Punkts, der `at` am nächsten liegt (euklidisch, in den Einheiten der Punkte); bei Gleichstand der frühere.
 * Ohne Punkte null.
 */
export function nearestPoint(
  points: readonly { x: number; y: number }[],
  at: { x: number; y: number }
): number | null {
  let best: number | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  points.forEach((p, i) => {
    const distance = Math.hypot(p.x - at.x, p.y - at.y)
    if (distance < bestDistance) {
      best = i
      bestDistance = distance
    }
  })
  return best
}
