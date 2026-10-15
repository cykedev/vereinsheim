// Modell der Ablesung: welcher Schuss gezeigt wird und was zu ihm feststeht. Die Ablese-Karte (ShotReadout)
// und die Ablesezeile auf dem Telefon (ShotLine) zeigen dieselben Werte.

import type { MetricShot } from "@vereinsheim/shot-core/metrics"
import { teilerFromDistanceUm } from "@vereinsheim/shot-core/scoring"

import { formatShotValue, hasValidPosition, shotDistance, shotLabels } from "../shots"
import type { ViewState } from "../view-state"

export interface ReadoutModel {
  shot: MetricShot
  index: number
  /** angetippt statt letzter Schuss */
  chosen: boolean
  /** Nummer wie auf der Scheibe („23“) */
  label: string
  /** wie im Fachkern: gemessener Abstand vor der Lage; verdächtige Schüsse ohne Abstand und Lage (SF-15) */
  distanceUm: number | null
  teiler: number | null
  placed: boolean
}

/** der angetippte Schuss, sonst der letzte; ein Antippen, das nicht mehr passt, zählt nicht */
export function readoutModel(shots: readonly MetricShot[], state: ViewState): ReadoutModel | null {
  const chosenShot = state.chosen === null ? undefined : shots[state.chosen.index]
  const index = chosenShot ? state.chosen!.index : shots.length - 1
  if (index < 0) return null
  const shot = shots[index]
  const distanceUm = shotDistance(shot)
  return {
    shot,
    index,
    chosen: !!chosenShot,
    label: shotLabels(shots)[index],
    distanceUm,
    teiler: distanceUm === null ? null : teilerFromDistanceUm(distanceUm),
    placed: hasValidPosition(shot),
  }
}

/** Wert des Schusses, immer in Zehnteln (`formatShotValue`) */
export const readoutValue = (model: ReadoutModel) => formatShotValue(model.shot)

/** zweite Zeile der Karte: Fehlschuss oder der Ring, dazu der Innenzehner */
export function readoutDetail(shot: MetricShot): string {
  const ring = shot.ring === 0 ? "Fehlschuss" : `Ring ${shot.ring ?? "–"}`
  return `${ring}${shot.innerTen ? " · Innenzehner" : ""}`
}
