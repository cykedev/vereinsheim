// Zufallspunkte für Tests mit festem Seed: mulberry32 mit Box-Muller wie `shot-help/scripts/simulate.ts`, ganze µm.

import type { Point } from "../geometry"

/** gleichverteilte Zahlen in [0, 1), bei gleichem Seed immer dieselben */
export function uniformFrom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** n Punkte um `center` mit Streuung σx und σy je Achse */
export function normalPoints(
  n: number,
  sigmaUm: number,
  seed: number,
  { center = { xUm: 0, yUm: 0 }, sigmaYUm = sigmaUm }: { center?: Point; sigmaYUm?: number } = {}
): Point[] {
  const uniform = uniformFrom(seed)
  return Array.from({ length: n }, () => {
    const r = Math.sqrt(-2 * Math.log(1 - uniform()))
    const a = 2 * Math.PI * uniform()
    return {
      xUm: Math.round(center.xUm + r * Math.cos(a) * sigmaUm),
      yUm: Math.round(center.yUm + r * Math.sin(a) * sigmaYUm),
    }
  })
}
