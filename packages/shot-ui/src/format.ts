// Zahlen für die Bausteine: feste Nachkommastellen, Komma, echtes Minus, kein
// Tausenderpunkt (wie auf dem Meyton-Ausdruck). Ohne `Intl`, damit Server und Browser gleich formatieren.

const MINUS = "−"

/**
 * Der Betrag auf `decimals` Stellen, die Hälfte kaufmännisch von der Null weg. Erst auf zwölf gültige Stellen, damit
 * das Rauschen der Gleitkommazahl nicht entscheidet: 362,6 Ringe auf 40 Schuss sind genau 9,065, gerechnet einmal
 * 9,06500…1, einmal 9,06499…5; `toFixed` allein zeigte dann 9,07 oder 9,06.
 */
function roundedText(abs: number, decimals: number): string {
  const factor = 10 ** decimals
  // ab 10^12 trüge die Rundung auf zwölf Stellen Ziffern ab; so große Werte gibt es hier nicht, `toFixed` bleibt richtig
  if (!(abs * factor < 1e12)) return abs.toFixed(decimals)
  return (Math.round(Number((abs * factor).toPrecision(12))) / factor).toFixed(decimals)
}

/** feste Nachkommastellen; eine auf 0 gerundete Zahl ohne Minus */
export function formatValue(value: number, decimals: number): string {
  const text = roundedText(Math.abs(value), decimals)
  const zero = Number(text) === 0
  return `${value < 0 && !zero ? MINUS : ""}${text.replace(".", ",")}`
}

/** mit Vorzeichen für Abweichungen („+1,5“, „−1,5“); eine gerundete Null ohne Vorzeichen */
export function formatSigned(value: number, decimals: number): string {
  const text = formatValue(value, decimals)
  return value > 0 && Number(roundedText(value, decimals)) !== 0 ? `+${text}` : text
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

/** Ringe mit Vorzeichen wie `formatSigned`: „−1 Ring“, „+2 Ringe“ */
export function ringsSigned(value: number, decimals: number): string {
  const text = formatSigned(value, decimals)
  return `${text} ${text.replace(/^[+−]/, "") === "1" ? "Ring" : "Ringe"}`
}

/** Einheit einer Kennzahl zum Anzeigen; der Teiler steht ohne Einheit */
export function unitText(unit: string): string {
  return unit === "Teiler" ? "" : unit
}

/** Dauer: „42 s“, ab einer Minute „3:05 min“, ab einer Stunde „1:02 h“ */
export function durationText(ms: number): string {
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} s`
  const pad = (n: number) => String(n).padStart(2, "0")
  if (seconds < 3600) return `${Math.floor(seconds / 60)}:${pad(seconds % 60)} min`
  return `${Math.floor(seconds / 3600)}:${pad(Math.floor((seconds % 3600) / 60))} h`
}

/** Anteil (0 bis 1) in ganzen Prozent: „23 %“ */
export const percentText = (rate: number) => `${formatValue(rate * 100, 0)} %`

/**
 * Richtung ohne Zahl, für „rechts, 0,47 mm“ (eine Rundung statt zwei): acht Richtungen, schräg
 * erst, wenn die kleinere Achse mindestens tan 22,5° der größeren ausmacht; unter 0,05 mm je Richtung „mittig“
 */
export function directionName(point: { xUm: number; yUm: number }): string {
  const x = Math.abs(point.xUm) >= 50 ? point.xUm : 0
  const y = Math.abs(point.yUm) >= 50 ? point.yUm : 0
  const big = Math.max(Math.abs(x), Math.abs(y))
  if (big === 0) return "mittig"
  const share = Math.tan(Math.PI / 8) * big
  const across = Math.abs(x) >= share ? (x > 0 ? "rechts" : "links") : ""
  const up = Math.abs(y) >= share ? (y > 0 ? "oben" : "unten") : ""
  return [across, up].filter(Boolean).join(" ")
}

/** Zahl in Worten für kleine Schusszahlen in Sätzen („die letzten drei“), darüber als Ziffer */
export const countWord = (n: number) =>
  ["null", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn"][n] ??
  String(n)

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
