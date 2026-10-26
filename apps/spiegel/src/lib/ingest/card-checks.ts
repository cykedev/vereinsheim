// Gegenprobe und Merkmale, die an der Zuordnung der Disziplin hängen: als reine Funktionen, damit der Adapter (aus den
// Rohdaten) und das Nachrechnen nach einer Änderung der Zuordnung (aus `Shot`) dasselbe Ergebnis haben.

import { classifyCompleteness } from "@vereinsheim/shot-core/discipline"
import {
  FLAG_MISS,
  FLAG_OVER_TARGET,
  FLAG_SUSPICIOUS,
  sumsShots,
  type CardFlag,
  type CardSums,
} from "@vereinsheim/shot-core/metrics"
import { TARGETS, type TargetId } from "@vereinsheim/shot-core/targets"
import { checkShot } from "@vereinsheim/shot-core/verify"

import type { CardOrigin } from "@/generated/prisma/client"

/** ohne Scheibenbild (SF-70) */
export const FLAG_UNKNOWN_DISCIPLINE = "disziplin-unbekannt" satisfies CardFlag
/** fast alle Schüsse passen nicht zum Scheibenbild (Gegenprobe, SF-16) */
export const FLAG_TARGET_MISMATCH = "scheibe-passt-nicht" satisfies CardFlag

/** Merkmale, mit denen eine Scheibe nie vollständig ist; dieselbe Regel steht in SQL in `advanceCardStates` */
export const INCOMPLETE_FLAGS = ["unvollstaendig", "leer"] as const satisfies readonly CardFlag[]

/** endgültig und ohne fehlende Wertungsschüsse: erst dann zählt die Scheibe für Rekorde (SF-66) */
export const isComplete = (state: "open" | "resting" | "final", flags: readonly string[]) =>
  state === "final" && !INCOMPLETE_FLAGS.some((flag) => flags.includes(flag))

/** Merkmale der Scheibe, die an der Zuordnung der Disziplin hängen; das Nachrechnen ersetzt genau diese */
export const MAPPING_FLAGS = [
  "leer",
  "nur-probe",
  "unvollstaendig",
  "ueber-soll",
  FLAG_UNKNOWN_DISCIPLINE,
  FLAG_TARGET_MISMATCH,
] as const satisfies readonly CardFlag[]

/** Merkmale der Vollständigkeit: nur für Scheiben mit Werten (`detailFlags`) */
export const COMPLETENESS_FLAGS = [
  "leer",
  "nur-probe",
  "unvollstaendig",
  "ueber-soll",
] as const satisfies readonly CardFlag[]

/** alle Merkmale, die ein Schuss aus seinen Werten und der Gegenprobe bekommt; das Nachrechnen ersetzt genau diese */
export const DERIVED_SHOT_FLAGS: readonly string[] = [FLAG_OVER_TARGET, FLAG_SUSPICIOUS, FLAG_MISS]

/** Abstand unter 1 µm (`Teiler001` in 0,1 µm): Meyton schreibt dann `Teiler01` 0 */
const ZERO_DISTANCE_TENTHS_UM = 10
/** 10,9: der beste Zehntel; mit Lage 0/0 und Abstand 0 kein Platzhalter, sondern ein Treffer genau in der Mitte */
const BEST_DECIMAL_TENTHS = 109

/**
 * Merkmale eines Schusses aus seinen Werten (SF-08, SF-14, SF-15), nur aus Feldern, die auch `Shot` speichert: über Soll
 * (Platzhalter-Teiler), Platzhalter mit Lage 0/0 und Abstand 0, Fehlschuss. Adapter und Nachrechnen rufen dieselbe
 * Funktion.
 */
export function baseShotFlags(shot: {
  xUm: number | null
  yUm: number | null
  distanceTenthsUm: number | null
  decimalTenths: number | null
  overTarget: boolean
}): string[] {
  if (shot.overTarget) return [FLAG_OVER_TARGET]
  if (
    shot.xUm === 0 &&
    shot.yUm === 0 &&
    shot.distanceTenthsUm !== null &&
    shot.distanceTenthsUm < ZERO_DISTANCE_TENTHS_UM &&
    shot.decimalTenths !== BEST_DECIMAL_TENTHS
  )
    return [FLAG_SUSPICIOUS]
  if (shot.decimalTenths === 0) return [FLAG_MISS]
  return []
}

/** ein Schuss, wie die Gegenprobe ihn braucht; aus den Rohdaten (Adapter) oder aus `Shot` (Nachrechnen) */
export interface CheckableShot {
  xUm: number | null
  yUm: number | null
  /** Abstand zur Mitte in 0,1 µm (`Teiler001`) */
  distanceTenthsUm: number | null
  decimalTenths: number | null
  ring: number | null
  innerTen: boolean | null
  /** Merkmale aus den Werten (`baseShotFlags`), ohne die der Gegenprobe */
  flags: readonly string[]
}

/**
 * Gegenprobe jedes Schusses gegen das Scheibenbild. Fast alle daneben: das Scheibenbild passt nicht (SF-16), dann ist
 * kein Schuss verdächtig; sonst sind die einzelnen verdächtig (SF-15). Ohne Scheibenbild wird nichts geprüft.
 */
export function verifyShots(
  targetId: TargetId | null,
  shots: readonly CheckableShot[]
): { suspicious: boolean[]; targetMismatch: boolean } {
  const target = targetId ? TARGETS[targetId] : null
  const checks = shots.map((s) =>
    target && s.flags.length === 0 && s.decimalTenths !== null
      ? checkShot(target, {
          distance:
            s.distanceTenthsUm !== null ? { um: s.distanceTenthsUm / 10, resolutionUm: 0.1 } : null,
          position:
            s.xUm !== null && s.yUm !== null ? { xUm: s.xUm, yUm: s.yUm, resolutionUm: 10 } : null,
          officialDecimalTenths: s.decimalTenths,
          officialRing: s.ring,
          officialInnerTen: s.innerTen,
        })
      : "unchecked"
  )
  const checked = checks.filter((c) => c !== "unchecked").length
  const mismatches = checks.filter((c) => c === "mismatch").length
  const targetMismatch = checked >= 3 && mismatches * 2 > checked
  return { suspicious: checks.map((c) => !targetMismatch && c === "mismatch"), targetMismatch }
}

/** die Merkmale der Scheibe aus `MAPPING_FLAGS`, in fester Reihenfolge */
export function mappingFlags(input: {
  sighterShots: number
  matchShots: number
  plannedShots: number | null
  targetId: TargetId | null
  targetMismatch: boolean
}): CardFlag[] {
  const completeness = classifyCompleteness(input)
  const flags: CardFlag[] = []
  if (
    completeness === "nur-probe" ||
    completeness === "unvollstaendig" ||
    completeness === "ueber-soll" ||
    completeness === "leer"
  )
    flags.push(completeness)
  if (!input.targetId) flags.push(FLAG_UNKNOWN_DISCIPLINE)
  if (input.targetMismatch) flags.push(FLAG_TARGET_MISMATCH)
  return flags
}

/**
 * Schusszahlen einer Revision für die Merkmale ([[adr-033]]): die Wertungsschüsse aus den Zeilen, ohne sie die Schusszahl
 * der Summen; `valued`, ob die Revision überhaupt Werte hat (Schüsse oder Summen)
 */
export function revisionCounts(
  shots: readonly { stellung: number }[],
  sums: CardSums | undefined
): { sighterShots: number; matchShots: number; valued: boolean } {
  const fromRows = shots.filter((shot) => shot.stellung !== 0).length
  return {
    sighterShots: shots.length - fromRows,
    matchShots: fromRows || sumsShots(sums),
    valued: shots.length > 0 || sumsShots(sums) > 0,
  }
}

/**
 * die Merkmale der Disziplin (`mappingFlags`) für eine Scheibe jeder Herkunft. Eine Scheibe ohne Werte (vom Ausdruck,
 * wartet auf die Brücke) ist weder leer noch nur Probe: Ihr fehlen die Merkmale der Vollständigkeit. Scheiben der Brücke
 * rechnen wie bisher
 */
export function detailFlags(
  input: Parameters<typeof mappingFlags>[0] & { origin: CardOrigin; valued: boolean }
): CardFlag[] {
  const flags = mappingFlags(input)
  if (input.valued || input.origin === "raw") return flags
  const completeness: readonly string[] = COMPLETENESS_FLAGS
  return flags.filter((flag) => !completeness.includes(flag))
}
