// Werte eines Schusses, wie Meyton sie in `Treffer` ablegt (Skalen in `vault/meyton/meyton-ssmdb2.md`): `Ring` und
// `Ring01` in Zehnteln (der ganze Ring mal zehn), `Teiler01` der Abstand in µm, `Teiler001` in 0,1 µm. Gewertet wird
// über den Fachkern mit Meytons Toleranz (SF-75); `Text` je Anzeigeart wie in der Kopie vom 9. Oktober 2026.

import { distanceUm, scoreFromCoordinates } from "@vereinsheim/shot-core/scoring"
import type { TargetImage } from "@vereinsheim/shot-core/targets"

/** Platzhalter-Teiler über der Soll-Zahl und als bester Teiler ohne Wertungsschuss */
export const PLACEHOLDER_TEILER = 2147483647

/**
 * Anzeigeart am Monitor (`Treffer.Wertung`): 1 Zehntel, 2 ganze Ringe, 5 komplett verdeckt, 7 Zehntel und Teiler,
 * 8 Ringe und Teiler, 10 verdeckt mit Lage; 0 unbekannt (in zwei Jahren nie beobachtet)
 */
export type Display = 0 | 1 | 2 | 5 | 7 | 8 | 10

export interface ShotValues {
  Ring: number
  Ring01: number
  Innenzehner: 0 | 1
  Teiler01: number
  Teiler001: number
}

/** Werte eines Schusses aus der Lage in 1/100 mm (wie `Treffer.x`, `Treffer.y`) */
export function shotValues(target: TargetImage, x: number, y: number): ShotValues {
  const score = scoreFromCoordinates(target, x * 10, y * 10)
  const distance = distanceUm(x * 10, y * 10)
  return {
    Ring: score.ring * 10,
    Ring01: score.decimalTenths,
    Innenzehner: score.innerTen ? 1 : 0,
    Teiler01: Math.round(distance),
    Teiler001: Math.round(distance * 10),
  }
}

/** ein Schuss über der Soll-Zahl (SF-08): echte Lage, aber Wert 0 und Platzhalter-Teiler */
export function overTargetValues(): ShotValues {
  return {
    Ring: 0,
    Ring01: 0,
    Innenzehner: 0,
    Teiler01: PLACEHOLDER_TEILER,
    Teiler001: PLACEHOLDER_TEILER,
  }
}

/** verdeckt (Anzeigeart 5, SF-19) ohne Wert: Ring und Zehntel 0, Lage und Teiler bleiben (10 von 25 Königsscheiben der Kopie) */
export function hiddenValues(values: ShotValues): ShotValues {
  return { ...values, Ring: 0, Ring01: 0, Innenzehner: 0 }
}

const decimal = (values: ShotValues) => `${Math.floor(values.Ring01 / 10)}.${values.Ring01 % 10}`
/** Teiler in 1/100 mm, abgeschnitten („1767T“ bei 17675 µm) */
const teiler = (values: ShotValues) => `${Math.floor(values.Teiler01 / 10)}T`

/**
 * `Text` je Anzeigeart: „10.1“ (1), „9“ und „10*“ (2), „9.9 851T“ (7), „9 995T“ (8), „***“ (5, 10), über der Soll-Zahl
 * „0F“ (beobachtet auch „inv“). Annahmen: leer bei 0, „***“ bei 10, „0.0“ und „0“ beim Fehlschuss.
 */
export function displayText(display: Display, values: ShotValues, overTarget = false): string {
  if (overTarget) return "0F"
  const ring = values.Ring / 10
  switch (display) {
    case 0:
      return ""
    case 1:
      return decimal(values)
    case 2:
      return `${ring}${values.Innenzehner ? "*" : ""}`
    case 5:
    case 10:
      return "***"
    case 7:
      return `${decimal(values)} ${teiler(values)}`
    case 8:
      return `${ring} ${teiler(values)}`
  }
}
