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

/**
 * Achse einer Gruppe in Worten, Uhrzeiten wie die Richtungsuhr (12 oben, gerundet auf die nächste Stunde): der
 * Winkel ab 3 Uhr gegen den Uhrzeigersinn auf ganze Grad modulo 180 (179,6° ist 0°), das obere Ende zuerst.
 */
export function axisText(angleRad: number): string {
  const deg = (((Math.round((angleRad * 180) / Math.PI) % 180) + 180) % 180) as number
  const hour = ((Math.round((90 - deg) / 30) % 12) + 12) % 12 || 12
  const opposite = ((hour + 5) % 12) + 1
  return `längs etwa ${hour} bis ${opposite} Uhr (${deg}°, gegen den Uhrzeigersinn ab 3 Uhr)`
}

/** Ringe mit Zahl: „1 Ring“ nur, wenn genau 1 dasteht (auch −1), sonst „Ringe“ („1,0 Ringe“, „0 Ringe“) */
export function ringsText(value: number, decimals: number): string {
  const text = formatValue(value, decimals)
  return `${text} ${text.replace(MINUS, "") === "1" ? "Ring" : "Ringe"}`
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

/** Dauer wie in der Spielwiese: „42 s“, ab einer Minute „3:05 min“, ab einer Stunde „1:02 h“ */
export function durationText(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} s`
  const pad = (n: number) => String(n).padStart(2, "0")
  if (seconds < 3600) return `${Math.floor(seconds / 60)}:${pad(seconds % 60)} min`
  return `${Math.floor(seconds / 3600)}:${pad(Math.floor((seconds % 3600) / 60))} h`
}

/** Anteil (0 bis 1) in ganzen Prozent: „23 %“ */
export const percentText = (rate: number) => `${formatValue(rate * 100, 0)} %`

/** Richtung in Worten für Sätze: „2,5 mm rechts und 1,2 mm tief“; unter 0,05 mm je Richtung „mittig“ */
export function directionWords(point: { xUm: number; yUm: number }): string {
  const parts: string[] = []
  if (Math.abs(point.xUm) >= 50) {
    parts.push(
      `${formatValue(Math.abs(point.xUm) / 1000, 1)} mm ${point.xUm > 0 ? "rechts" : "links"}`
    )
  }
  if (Math.abs(point.yUm) >= 50) {
    parts.push(
      `${formatValue(Math.abs(point.yUm) / 1000, 1)} mm ${point.yUm > 0 ? "hoch" : "tief"}`
    )
  }
  return parts.length ? parts.join(" und ") : "mittig"
}
