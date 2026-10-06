// Gegenprobe: passen die amtlichen Werte zur Lage und zum Scheibenbild?
//
// Gemessen wird über den Abstand (aus dem Teiler, genauer) oder über die Lage (SSMDB2: 1/100 mm).
// Weicht ein amtlicher Wert ab, ist er ein Grenzfall, wenn er innerhalb der Messauflösung erreichbar
// ist: Wert und Innenzehner treten zusammen an einem Rand von [d − ε, d + ε] auf, oder der Wert liegt
// zwischen beiden Rändern. Sonst ist er eine Abweichung. Ohne Zehntel (Ganzring-Wertung) wird der
// amtliche Ring geprüft (SF-18).
//
// Urteil über eine Scheibe: keine Abweichung → ok; mindestens drei geprüfte Schüsse und mehr als die
// Hälfte weicht ab → das Scheibenbild passt nicht; sonst sind einzelne Schüsse verdächtig, etwa ein
// Platzhalter (SF-15). Eine falsch gewählte Disziplin findet die Gegenprobe nicht, denn Meyton wertet
// in sich stimmig (SF-16); dafür gibt es die Neu-Wertung mit `rescore`.

import { scoreFromCoordinates, scoreFromDistance, type Score } from "./scoring"
import { TARGETS, type TargetId, type TargetImage } from "./targets"

export interface ShotEvidence {
  /** Lage in µm; aus der SSMDB2 mit Auflösung 10 µm */
  position?: { xUm: number; yUm: number; resolutionUm: number } | null
  /** Abstand in µm, etwa aus dem Teiler (Teiler01: Auflösung 1 µm) */
  distance?: { um: number; resolutionUm: number } | null
  officialDecimalTenths: number | null
  /** amtlicher ganzer Ring, wenn Meyton keine Zehntel liefert (Ganzring-Wertung) */
  officialRing?: number | null
  officialInnerTen?: boolean | null
}

export type ShotCheck = "match" | "boundary" | "mismatch" | "unchecked"
export type Verdict = "ok" | "target-mismatch" | "suspicious-shots" | "insufficient"

export interface CardCheck {
  verdict: Verdict
  checks: ShotCheck[]
  checked: number
  mismatches: number
}

interface Measurement {
  score: Score
  distanceUm: number
  toleranceUm: number
}

// Der Abstand aus dem Teiler ist genauer als die auf 1/100 mm gerundete Lage, also zuerst.
function measure(target: TargetImage, shot: ShotEvidence): Measurement | null {
  if (shot.distance) {
    const { um, resolutionUm } = shot.distance
    return { score: scoreFromDistance(target, um), distanceUm: um, toleranceUm: resolutionUm / 2 }
  }
  if (shot.position) {
    const { xUm, yUm, resolutionUm } = shot.position
    return {
      score: scoreFromCoordinates(target, xUm, yUm),
      distanceUm: Math.hypot(xUm, yUm),
      // Die Lage ist auf die Auflösung gerundet oder abgeschnitten; √2 · Auflösung deckt beides ab.
      toleranceUm: resolutionUm * Math.SQRT2,
    }
  }
  return null
}

export function checkShot(target: TargetImage, shot: ShotEvidence): ShotCheck {
  const officialTenths = shot.officialDecimalTenths
  const official = officialTenths ?? shot.officialRing ?? null
  if (official === null) return "unchecked"
  const measured = measure(target, shot)
  if (!measured) return "unchecked"

  const officialInnerTen = shot.officialInnerTen ?? null
  const value = (score: Score) => (officialTenths !== null ? score.decimalTenths : score.ring)
  const fits = (score: Score) =>
    value(score) === official && (officialInnerTen === null || score.innerTen === officialInnerTen)

  const { score, distanceUm, toleranceUm } = measured
  if (fits(score)) return "match"

  const near = scoreFromDistance(target, Math.max(0, distanceUm - toleranceUm))
  const far = scoreFromDistance(target, distanceUm + toleranceUm)
  const strictlyBetween =
    value(far) < official &&
    official < value(near) &&
    (officialInnerTen === null ||
      officialInnerTen === near.innerTen ||
      officialInnerTen === far.innerTen)
  return fits(near) || fits(far) || strictlyBetween ? "boundary" : "mismatch"
}

export function verifyCard(target: TargetImage, shots: readonly ShotEvidence[]): CardCheck {
  const checks = shots.map((shot) => checkShot(target, shot))
  const checked = checks.filter((check) => check !== "unchecked").length
  const mismatches = checks.filter((check) => check === "mismatch").length

  let verdict: Verdict
  if (checked === 0) verdict = "insufficient"
  else if (mismatches === 0) verdict = "ok"
  else if (checked >= 3 && mismatches * 2 > checked) verdict = "target-mismatch"
  else verdict = "suspicious-shots"

  return { verdict, checks, checked, mismatches }
}

/**
 * Scheibenbilder, die die amtlichen Werte erklären, einzelne verdächtige Schüsse wie Platzhalter
 * ausgenommen (SF-15), sortiert nach Abweichungen (SF-17). Der Admin bestätigt den Vorschlag.
 */
export function suggestTargets(
  shots: readonly ShotEvidence[],
  candidates: readonly TargetImage[] = Object.values(TARGETS)
): TargetId[] {
  return candidates
    .map((target) => ({ target, check: verifyCard(target, shots) }))
    .filter(({ check }) => check.verdict === "ok" || check.verdict === "suspicious-shots")
    .sort((a, b) => a.check.mismatches - b.check.mismatches)
    .map(({ target }) => target.id)
}

/** Neu-Wertung mit einem anderen Scheibenbild; das Ergebnis ist nicht amtlich (SF-16). */
export function rescore(target: TargetImage, shot: ShotEvidence): Score | null {
  return measure(target, shot)?.score ?? null
}
