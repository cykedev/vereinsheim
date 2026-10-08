// Reine Hilfen des Diagramm-Lineals (Plan L1): welcher Wert einer x-Position am nächsten liegt, Schritte mit
// der Tastatur und die Umrechnung vom Bildschirm ins SVG. Das Lineal selbst steht in `ChartRuler.tsx`.

/** Index des nächsten Werts zu einer x-Position (Pixel im SVG); bei Gleichstand der frühere; leer: null */
export function nearestIndex(xs: readonly number[], x: number): number | null {
  let best: number | null = null
  xs.forEach((value, i) => {
    if (best === null || Math.abs(value - x) < Math.abs(xs[best] - x)) best = i
  })
  return best
}

/**
 * Einen Schritt weiter (−1, +1) oder an den Rand (−Infinity, +Infinity), in den Grenzen 0 … n − 1. Ohne Wahl
 * beginnt „rechts“ beim ersten, „links“ beim letzten Wert; ohne Werte null.
 */
export function stepIndex(index: number | null, delta: number, n: number): number | null {
  if (n <= 0) return null
  if (index === null) return delta > 0 ? 0 : n - 1
  return Math.min(n - 1, Math.max(0, index + delta))
}

/**
 * x im SVG aus clientX: Das SVG ist `width` Pixel breit, auf dem Schirm aber `rect.width` (`h-auto w-full`).
 * Ohne gemessene Breite (0) gilt es als nicht skaliert.
 */
export function toSvgX(
  clientX: number,
  rect: { left: number; width: number },
  width: number
): number {
  const scale = rect.width > 0 ? width / rect.width : 1
  return (clientX - rect.left) * scale
}
