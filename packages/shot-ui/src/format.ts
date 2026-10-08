// Zahlen für die Bausteine wie in der Spielwiese: feste Nachkommastellen, Komma, echtes Minus, kein
// Tausenderpunkt (wie auf dem Meyton-Ausdruck). Ohne `Intl`, damit Server und Browser gleich formatieren.

const MINUS = "−"

/** feste Nachkommastellen; eine auf 0 gerundete Zahl ohne Minus */
export function formatValue(value: number, decimals: number): string {
  const text = Math.abs(value).toFixed(decimals)
  const zero = Number(text) === 0
  return `${value < 0 && !zero ? MINUS : ""}${text.replace(".", ",")}`
}

/** mit Vorzeichen für Abweichungen („+1,5“, „−1,5“); eine gerundete Null ohne Vorzeichen */
export function formatSigned(value: number, decimals: number): string {
  const text = formatValue(value, decimals)
  return value > 0 && Number(Math.abs(value).toFixed(decimals)) !== 0 ? `+${text}` : text
}

/** Einheit einer Kennzahl zum Anzeigen; der Teiler steht ohne Einheit */
export function unitText(unit: string): string {
  return unit === "Teiler" ? "" : unit
}

/** Lage eines Punkts in Worten: „2,5 rechts · 1,2 tief (mm)“; unter 0,05 mm je Richtung „mittig“ */
export function directionText(point: { xUm: number; yUm: number }): string {
  const parts: string[] = []
  if (Math.abs(point.xUm) >= 50) {
    parts.push(
      `${formatValue(Math.abs(point.xUm) / 1000, 1)} ${point.xUm > 0 ? "rechts" : "links"}`
    )
  }
  if (Math.abs(point.yUm) >= 50) {
    parts.push(`${formatValue(Math.abs(point.yUm) / 1000, 1)} ${point.yUm > 0 ? "hoch" : "tief"}`)
  }
  return parts.length ? `${parts.join(" · ")} (mm)` : "mittig"
}
