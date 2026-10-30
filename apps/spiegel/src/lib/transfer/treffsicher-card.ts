// Eine Einheit aus Treffsicher als Scheibe ([[spiegel-account-transfer]]): welche Familie, welche Disziplin, welche
// Angaben. Rein; die Übernahme schreibt über `writeEnteredCardIn`.

import type { DetailsInput, EnteredShot } from "@/lib/entered/details"

export interface TreffsicherSessionForCard {
  id: string
  dateMs: number
  type: "TRAINING" | "WETTKAMPF" | "TROCKENTRAINING" | "MENTAL"
  location: string | null
  discipline: { name: string; scoringType: "WHOLE" | "TENTH"; shotsPerSeries: number } | null
  series: {
    position: number
    isPractice: boolean
    scoreTotal: number | null
    shots: string[] | null
  }[]
  /** Trefferlage in mm mit Richtung, wie Treffsicher sie speichert */
  hitLocation: {
    xMm: number
    yMm: number
    horizontal: "LEFT" | "RIGHT"
    vertical: "HIGH" | "LOW"
  } | null
}

const normalize = (name: string) => name.trim().toLowerCase()

/** die Familie zum Namen einer Treffsicher-Disziplin: Name gleich ohne Groß- und Kleinschreibung und Rand, genau eine */
export function familyForName(
  name: string,
  families: readonly { id: number; name: string }[]
): number | null {
  const hits = families.filter((family) => normalize(family.name) === normalize(name))
  return hits.length === 1 ? hits[0].id : null
}

/** Die Wahl unter gleich passenden Disziplinen: die vom Konto meistgenutzte, bei Gleichstand keine */
function mostUsed(
  fitting: readonly { id: number; ownCards: number }[]
): { id: number } | "tie" | null {
  if (fitting.length <= 1) return fitting[0] ? { id: fitting[0].id } : null
  const most = Math.max(...fitting.map((candidate) => candidate.ownCards))
  const top = fitting.filter((candidate) => candidate.ownCards === most)
  return top.length === 1 ? { id: top[0].id } : "tie"
}

/**
 * die Disziplin einer neuen Scheibe und die Stufe, auf der sie gefunden wurde: `exact` gleiche Schusszahl, `larger` die
 * kleinste größere (die Scheibe ist unvollständig), `largest` die größte der Familie, wenn keine so viele Schüsse hat
 * (die Scheibe hat mehr als geplant, `ueber-soll`)
 */
export type DisciplineChoice =
  | { kind: "found"; id: number; step: "exact" | "larger" | "largest" }
  /** keine Disziplin der Familie mit fester Schusszahl */
  | { kind: "none" }
  /** mehrere passen gleich gut, keine ist die meistgenutzte */
  | { kind: "tie"; plannedShots: number }

/**
 * Die Disziplin für eine Einheit mit dieser Schusszahl unter den Kandidaten einer Familie (eingeordnet, nicht ignoriert,
 * mit Scheibenbild, an der ersten Anlage), in drei Stufen: eine mit genau dieser Schusszahl; sonst die mit der kleinsten
 * Schusszahl darüber; sonst die mit der größten. Passen auf einer Stufe mehrere gleich, die vom Konto meistgenutzte, bei
 * Gleichstand keine (die nächste Stufe gilt dann nicht). Eine Disziplin ohne feste Schusszahl ist kein Kandidat.
 */
export function disciplineForShots(
  candidates: readonly { id: number; plannedShots: number | null; ownCards: number }[],
  shots: number
): DisciplineChoice {
  const counted = candidates.filter((candidate) => candidate.plannedShots !== null)
  const counts = counted.map((candidate) => candidate.plannedShots!)
  const above = counts.filter((n) => n > shots)
  const [step, wanted] = counts.includes(shots)
    ? (["exact", shots] as const)
    : above.length
      ? (["larger", Math.min(...above)] as const)
      : (["largest", Math.max(...counts)] as const)
  const choice = mostUsed(counted.filter((candidate) => candidate.plannedShots === wanted))
  if (choice === null) return { kind: "none" }
  if (choice === "tie") return { kind: "tie", plannedShots: wanted }
  return { kind: "found", id: choice.id, step }
}

/** ein Schuss aus Treffsicher („9“, „10,4“) als Zahl; null, wenn er keine ist */
function shotValue(text: string): number | null {
  const value = Number.parseFloat(text.trim().replace(",", "."))
  return Number.isFinite(value) ? value : null
}

/** die Schüsse einer Serie als Zahlen; null ohne Schüsse oder mit einem, der keine Zahl ist */
function seriesShots(shots: string[] | null): number[] | null {
  if (!shots?.length) return null
  const values = shots.map(shotValue)
  return values.some((v) => v === null) ? null : (values as number[])
}

const tenths = (value: number) => Math.round(value * 10)

/**
 * Die Angaben einer Scheibe aus einer Einheit, so viel Treffsicher hat: Wertungsserien (ohne Probe) mit Wert, neu
 * nummeriert. Haben alle Einzelschüsse, deren Summe zum Wert der Serie passt, die Schüsse samt Serien-Summen und
 * Gesamtergebnis (`shots`); sonst die Serien-Summen und, wenn jede Wertungsserie einen Wert hat, das Gesamtergebnis
 * (`series`). Probeserien mit Schüssen als Probe. Die Trefferlage mit Richtung (rechts und hoch positiv) über die
 * Wertungsschüsse. null ohne Disziplin oder ohne Wertungsserie mit Wert.
 */
export function treffsicherDetails(
  session: TreffsicherSessionForCard
): { details: DetailsInput; level: "shots" | "series"; shots: number } | null {
  const discipline = session.discipline
  if (!discipline) return null
  const whole = discipline.scoringType === "WHOLE"
  const ordered = [...session.series].sort((a, b) => a.position - b.position)
  const scored = ordered.filter((s) => !s.isPractice && s.scoreTotal !== null)
  if (!scored.length) return null
  const sumOf = (value: number) =>
    whole ? { rings: Math.round(value) } : { decimalTenths: tenths(value) }
  const withShots = scored.map((s) => seriesShots(s.shots))
  const shotsFit = withShots.every(
    (values, i) =>
      values !== null &&
      (whole
        ? values.reduce((sum, v) => sum + Math.floor(v), 0) === Math.round(scored[i].scoreTotal!)
        : values.reduce((sum, v) => sum + tenths(v), 0) === tenths(scored[i].scoreTotal!))
  )
  const counts = scored.map((_, i) =>
    shotsFit ? (withShots[i] as number[]).length : discipline.shotsPerSeries
  )
  const series = scored.map((s, i) => ({
    series: i + 1,
    shots: counts[i],
    ...sumOf(s.scoreTotal!),
  }))
  const shots = counts.reduce((sum, n) => sum + n, 0)
  const complete = ordered.every((s) => s.isPractice || s.scoreTotal !== null)
  const totalValue = scored.reduce((sum, s) => sum + s.scoreTotal!, 0)
  const enteredShots: EnteredShot[] = []
  for (const s of ordered.filter((s) => s.isPractice)) {
    for (const value of seriesShots(s.shots) ?? [])
      enteredShots.push({
        series: null,
        ring: Math.min(10, Math.floor(value)),
        decimalTenths: whole ? null : tenths(value),
        probe: true,
      })
  }
  if (shotsFit)
    withShots.forEach((values, i) => {
      for (const value of values as number[])
        enteredShots.push({
          series: i + 1,
          ring: Math.min(10, Math.floor(value)),
          decimalTenths: whole ? null : tenths(value),
        })
    })
  const location = session.hitLocation
  const details: DetailsInput = {
    series,
    total: complete ? { shots, ...sumOf(totalValue) } : null,
    center: location
      ? {
          xUm: Math.round((location.horizontal === "LEFT" ? -1 : 1) * location.xMm * 1000),
          yUm: Math.round((location.vertical === "LOW" ? -1 : 1) * location.yMm * 1000),
          shots,
        }
      : null,
  }
  if (enteredShots.length) details.shots = enteredShots
  return { details, level: shotsFit ? "shots" : "series", shots }
}
