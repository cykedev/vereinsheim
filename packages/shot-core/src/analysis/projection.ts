// Projektion je Scheibe (SP-1.6 a, ADR-031): was die Seiten über viele Scheiben brauchen, einmal beim Schreiben
// einer Revision aus den Schüssen gerechnet. Die Übersichten (Liste, Fortschritt, Start) lesen dann eine Zeile je
// Scheibe statt aller Schüsse; die Seite einer Scheibe rechnet weiter live. Was hier zusammengeführt wird, ist
// gleich der Rechnung aus den Schüssen (`cardValues`, `periodRecords`); der Test hält das fest.

import {
  FLAG_SUSPICIOUS,
  METRICS,
  inScoring,
  inShotOrder,
  type MetricDefinition,
  type Scoring,
} from "../metrics"
import { byStart, cardShots } from "./card-shots"
import { cardValues, type CardValue, type PeriodCard } from "./period"
import {
  FLAG_COUNTED_AS_MATCH,
  RECORD_EXCLUDING_FLAGS,
  cardRecordCandidates,
  combineRecords,
  type PeriodRecords,
  type RecordCandidates,
} from "./records"

/**
 * Stand der Rechnung, die nicht in den Versionen der Kennzahlen steht: Form der Projektion und die Kandidaten der
 * Rekorde (`cardRecordCandidates`). Erhöhen, wenn sich eins davon ändert; dann werden alle Projektionen neu gerechnet.
 */
const PROJECTION_VERSION = 1

const CARD_METRICS = METRICS.filter((metric) => metric.scopes.includes("card"))

export interface CardProjection {
  /** `projectionVersion(METRICS)` beim Rechnen; weicht sie ab, ist die Projektion veraltet */
  version: string
  /** nur Probe: zählt nur mit `includeProbeOnly`, dann über die Probe wie Wertung (D8) */
  probeOnly: boolean
  /** ein verdächtiger Schuss unter denen, die zählen: keine Rekorde (SF-15) */
  suspicious: boolean
  /** Schüsse wie am Ausdruck (Wertung, bei nur Probe die Probe) */
  printedShots: number
  /** jede Kennzahl der Ebene Scheibe in beiden Wertungen, nach Schlüssel; fehlt ohne Wert */
  values: Record<string, { value: number; n: number }>
  /** Rekord-Kandidaten je Wertung; null ohne Schüsse */
  records: Record<Scoring, RecordCandidates | null>
}

/** eine Scheibe, wie sie die Übersichten aus der Datenbank lesen: ihre Merkmale und die Projektion, ohne Schüsse */
export interface ProjectedCard {
  id: string
  startedAtMs: number
  kind: PeriodCard["kind"]
  complete: boolean
  flags: readonly string[]
  projection: CardProjection
}

/** FNV-1a über 32 Bit, als acht Hex-Ziffern: kurz, stabil und ohne Abhängigkeit (Browser und Server) */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

/**
 * Version der Projektion: `PROJECTION_VERSION` und ein Fingerabdruck über Schlüssel und Version jeder Kennzahl. Steigt
 * eine Kennzahl-Version, ändert sie sich, und die gespeicherten Projektionen gelten als veraltet.
 */
export function projectionVersion(
  metrics: readonly Readonly<MetricDefinition>[] = METRICS
): string {
  const parts = metrics.map((metric) => `${metric.key}@${metric.version}`).sort()
  return `p${PROJECTION_VERSION}-${fnv1a(parts.join("|"))}`
}

/**
 * die Projektion einer Scheibe aus ihren Schüssen, für beide Wertungen und mit Probe (gefiltert wird beim Lesen). Die
 * Schüsse erst in Abgabefolge: Der Streukreis (Welzl) rechnet je nach Folge in der letzten Stelle anders, und die
 * gespeicherte Projektion soll nicht davon abhängen, in welcher Folge der Aufrufer sie liefert.
 */
export function cardProjection(input: PeriodCard): CardProjection {
  const card: PeriodCard = { ...input, shots: inShotOrder(input.shots) }
  const values: CardProjection["values"] = {}
  for (const metric of CARD_METRICS) {
    const [value] = cardValues([card], metric, metric.scoring ?? "decimal", {
      includeProbeOnly: true,
    })
    if (value) values[metric.key] = { value: value.value, n: value.n }
  }
  const counted = cardShots(card.shots, true)?.match ?? []
  return {
    version: projectionVersion(),
    probeOnly: !card.shots.some((shot) => shot.kind === "match"),
    suspicious: counted.some((shot) => (shot.flags ?? []).includes(FLAG_SUSPICIOUS)),
    printedShots: counted.length,
    values,
    records: {
      decimal: cardRecordCandidates(card, "decimal", true),
      rings: cardRecordCandidates(card, "rings", true),
    },
  }
}

/** wie `cardValues`, aus den Projektionen */
export function projectedValues(
  cards: readonly ProjectedCard[],
  metric: Readonly<MetricDefinition>,
  scoring: Scoring,
  options: { includeProbeOnly?: boolean } = {}
): CardValue[] {
  if (!metric.scopes.includes("card"))
    throw new RangeError(`${metric.key}: keine Kennzahl der Ebene Scheibe, nicht in der Projektion`)
  const key = inScoring(metric, scoring).key
  return byStart(cards).flatMap((card) => {
    if (card.projection.probeOnly && !options.includeProbeOnly) return []
    const entry = card.projection.values[key]
    return entry ? [{ id: card.id, atMs: card.startedAtMs, value: entry.value, n: entry.n }] : []
  })
}

/** zählt die Scheibe für Rekorde (wie `recordEligible`)? */
function projectedEligible(card: ProjectedCard): boolean {
  const excluding: readonly string[] = RECORD_EXCLUDING_FLAGS
  return (
    card.complete &&
    !card.flags.some((flag) => excluding.includes(flag)) &&
    !card.projection.suspicious
  )
}

/** wie `periodRecords`, aus den Projektionen */
export function projectedRecords(
  cards: readonly ProjectedCard[],
  scoring: Scoring,
  options: { kind?: PeriodCard["kind"]; includeProbeOnly?: boolean } = {}
): PeriodRecords {
  return combineRecords(
    byStart(cards).flatMap((card) => {
      if (!projectedEligible(card)) return []
      if (options.kind !== undefined && card.kind !== options.kind) return []
      if (!options.includeProbeOnly && card.flags.includes(FLAG_COUNTED_AS_MATCH)) return []
      if (card.projection.probeOnly && !options.includeProbeOnly) return []
      const candidates = card.projection.records[scoring]
      return candidates ? [{ id: card.id, atMs: card.startedAtMs, candidates }] : []
    })
  )
}
