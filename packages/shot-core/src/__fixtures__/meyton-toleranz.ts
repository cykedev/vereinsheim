import type { TargetId } from "../targets"

/**
 * Abstände, die Meytons Toleranz eingrenzen (aus `Teiler001` der Vereinsanlage, ohne jede Kennung): LG verlangt
 * 9,3 µm < T ≤ 10 µm, LP 7,6 µm < T ≤ 11,9 µm.
 */
export const BOUNDARY_DISTANCES: readonly { target: TargetId; um: number; tenths: number }[] = [
  { target: "lg-10m", um: 6509.3, tenths: 84 },
  { target: "lg-10m", um: 1510, tenths: 103 },
  { target: "lp-10m", um: 11207.6, tenths: 96 },
  { target: "lp-10m", um: 1611.9, tenths: 107 },
]
