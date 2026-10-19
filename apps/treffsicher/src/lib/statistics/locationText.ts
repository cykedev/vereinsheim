import { formatValue } from "@vereinsheim/shot-ui/format"

/** eine Achse der Trefferlage in Worten: „0,40 mm rechts“, „0,20 mm tief“, auf null „mittig“ */
export function sideText(mm: number, axis: "x" | "y"): string {
  const rounded = Math.round(mm * 100) / 100
  if (rounded === 0) return axis === "x" ? "waagrecht mittig" : "senkrecht mittig"
  const word = axis === "x" ? (rounded > 0 ? "rechts" : "links") : rounded > 0 ? "hoch" : "tief"
  return `${formatValue(Math.abs(rounded), 2)} mm ${word}`
}

/** eine Lage in Worten: „0,40 mm rechts und 0,20 mm hoch“ */
export const locationText = (point: { xMm: number; yMm: number }) =>
  `${sideText(point.xMm, "x")} und ${sideText(point.yMm, "y")}`

/** Nachkommastellen einer Achse mit dieser Stufe: so viele, dass jede Stufe genau dasteht (0,25 mit zwei) */
export function tickDecimals(step: number): number {
  for (let decimals = 0; decimals < 4; decimals++) {
    const scaled = step * 10 ** decimals
    if (Math.abs(scaled - Math.round(scaled)) < 1e-9) return decimals
  }
  return 4
}
