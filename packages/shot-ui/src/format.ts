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
