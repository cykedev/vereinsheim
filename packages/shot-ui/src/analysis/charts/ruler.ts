// Reine Hilfen des Diagramm-Lineals: welcher Wert einer x-Position am nächsten liegt, Schritte mit
// der Tastatur und die Umrechnung vom Bildschirm ins SVG. Das Lineal selbst steht in `ChartRuler.tsx`.

/** so nah stehen Werte waagrecht, dass sich ihre Punkte überdecken (ein Punkt ist 9 px breit) */
export const SAME_X_PX = 4

/**
 * Index des nächsten Werts zu einer x-Position (Pixel im SVG); bei Gleichstand der frühere; leer: null. Mit Höhen
 * (`ys`, `y`): Unter dem nach x nächsten und allen, die höchstens `SAME_X_PX` weiter weg stehen, gewinnt der nach y
 * nächste. So wählt ein Tipp in einem Stapel (Scheiben eines Abends) den getroffenen Punkt, und waagrecht bleibt das
 * Lineal ein senkrechter Strich.
 */
export function nearestIndex(
  xs: readonly number[],
  x: number,
  ys?: readonly number[],
  y?: number
): number | null {
  if (!xs.length) return null
  let best = 0
  for (let i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i
  if (!ys || y === undefined) return best
  const reach = Math.abs(xs[best] - x) + SAME_X_PX
  let pick = best
  for (let i = 0; i < xs.length; i++) {
    if (Math.abs(xs[i] - x) > reach) continue
    const d = Math.abs(ys[i] - y)
    const dPick = Math.abs(ys[pick] - y)
    if (d < dPick || (d === dPick && i < pick)) pick = i
  }
  return pick
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

/** y im SVG aus clientY, mit demselben Maßstab wie x: Das SVG skaliert gleichmäßig (`h-auto w-full`) */
export function toSvgY(
  clientY: number,
  rect: { top: number; width: number },
  width: number
): number {
  const scale = rect.width > 0 ? width / rect.width : 1
  return (clientY - rect.top) * scale
}
