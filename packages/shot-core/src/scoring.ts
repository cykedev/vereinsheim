// Wertung wie Meyton: Zehntel = 10 + (R − d) ÷ W, abgeschnitten, höchstens 10,9; unter 1,0 ein
// Fehlschuss. R ist Zehnerradius plus halbes Kaliber, W der Ringabstand, d der Abstand der
// Schussmitte zur Scheibenmitte. Der ganze Ring ist der abgeschnittene Zehntelwert; bei gleichen
// Ringabständen ist das genau die Berührungsregel.
//
// Exakt statt Gleitkomma: Die Grenze für den Wert k (in Zehnteln) liegt bei
// b(k) = R − (k − 100) · W ÷ 10, laut defineTarget immer ein ganzes µm. Aus Koordinaten vergleicht
// die Wertung x² + y² mit b(k)², aus einem Abstand rundet sie ihn auf ein 0,01-µm-Raster; beides
// ganzzahlig. Die naive Formel floor((11 − d ÷ W) · 10) liegt an neun Grenzen je Scheibe einen
// Zehntel zu tief, etwa bei d = 63 200 µm auf der Luftpistole.

import { MAX_DECIMAL_TENTHS, type TargetImage } from "./targets"

export interface Score {
  /** amtliche Form: 94 = 9,4; 0 bei Fehlschuss */
  decimalTenths: number
  ring: number
  innerTen: boolean
  miss: boolean
}

export function distanceUm(xUm: number, yUm: number): number {
  return Math.hypot(xUm, yUm)
}

/** Teiler in 1/100 mm: 3318 µm → 331,8 */
export function teilerFromDistanceUm(distanceUm: number): number {
  return distanceUm / 10
}

function boundaryUm(target: TargetImage, tenths: number): number {
  return target.scoringRadiusUm - ((tenths - 100) * target.ringWidthUm) / 10
}

function scoreWith(
  target: TargetImage,
  approxDistanceUm: number,
  within: (limitUm: number) => boolean
): Score {
  // Startwert zwischen 9 (sicher Fehlschuss) und 10,9: Bei absurd großen Abständen bleibt k sonst
  // jenseits von 2^53 stehen, und die Schleifen enden nie.
  let k = Math.max(
    9,
    Math.min(
      MAX_DECIMAL_TENTHS,
      100 + Math.floor(((target.scoringRadiusUm - approxDistanceUm) * 10) / target.ringWidthUm)
    )
  )
  // Der Gleitkomma-Startwert darf um eins danebenliegen; exakt nachziehen.
  while (k < MAX_DECIMAL_TENTHS && within(boundaryUm(target, k + 1))) k++
  while (k >= 10 && !within(boundaryUm(target, k))) k--
  if (k < 10) return { decimalTenths: 0, ring: 0, innerTen: false, miss: true }
  return {
    decimalTenths: k,
    ring: Math.floor(k / 10),
    innerTen: within(target.innerTenMaxDistanceUm),
    miss: false,
  }
}

/** Wertung aus der Lage in ganzen µm (SSMDB2: 1/100 mm × 10). */
export function scoreFromCoordinates(target: TargetImage, xUm: number, yUm: number): Score {
  if (!Number.isSafeInteger(xUm) || !Number.isSafeInteger(yUm)) {
    throw new RangeError(`Koordinaten in ganzen µm erwartet, nicht (${xUm}, ${yUm})`)
  }
  const squared = xUm * xUm + yUm * yUm
  return scoreWith(target, Math.sqrt(squared), (limit) => limit >= 0 && squared <= limit * limit)
}

/** Wertung aus dem Abstand zur Mitte in µm, etwa aus dem Teiler. */
export function scoreFromDistance(target: TargetImage, distanceUm: number): Score {
  if (!Number.isFinite(distanceUm) || distanceUm < 0) {
    throw new RangeError(`Abstand muss eine Zahl ≥ 0 sein, ist ${distanceUm}`)
  }
  const hundredths = Math.round(distanceUm * 100)
  return scoreWith(target, distanceUm, (limit) => limit >= 0 && hundredths <= limit * 100)
}
