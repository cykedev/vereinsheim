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
