// Grundlage einer Zahl über mehrere Scheiben: wie viele zählen und warum die übrigen nicht. Rein, ohne React; steht nur,
// wenn nicht alle zählen. Die Gründe kommen aus der Grundlage je Scheibe (`CardDetail`, `detailReason`).

import type { MetricDefinition } from "@vereinsheim/shot-core/metrics"

import { DETAIL_REASONS, REASON_TEXT, detailReason, type DetailReason } from "../detail"
import type { PeriodItem } from "./item"
import { CARD_WORDS, countOf, type PeriodWords } from "./words"

export interface Basis {
  /** Scheiben mit Wert */
  counted: number
  /** alle Scheiben, über die die Zahl rechnen könnte */
  of: number
  /** die übrigen nach Grund, die häufigsten zuerst */
  missing: { reason: DetailReason; count: number }[]
}

/**
 * die Grundlage einer Zahl über `items`, von denen `valued` einen Wert haben: null, wenn alle zählen oder kein Eintrag
 * eine Grundlage trägt (Treffsicher, Projektionen vor Version 6); sonst jeder fehlende Eintrag nach dem, was die
 * Kennzahl braucht
 */
export function periodBasis(
  items: readonly PeriodItem[],
  valued: ReadonlySet<string>,
  metric: Pick<MetricDefinition, "needs" | "minShots">
): Basis | null {
  if (!items.some((item) => item.detail)) return null
  const missing = items.filter((item) => !valued.has(item.id))
  if (!missing.length) return null
  const counts = new Map<DetailReason, number>()
  for (const item of missing) {
    const reason = detailReason(
      { detail: item.detail, shots: item.shots, provenance: item.provenance },
      metric
    )
    counts.set(reason, (counts.get(reason) ?? 0) + 1)
  }
  return {
    counted: items.length - missing.length,
    of: items.length,
    missing: [...counts]
      .map(([reason, count]) => ({ reason, count }))
      .sort(
        (a, b) =>
          b.count - a.count || DETAIL_REASONS.indexOf(a.reason) - DETAIL_REASONS.indexOf(b.reason)
      ),
  }
}

/** „über 12 von 20 Scheiben · 6 ohne Lage je Schuss“; ohne einen Wert „keine Scheibe mit Wert · 3 ohne Lage je Schuss“ */
export function basisLine(basis: Basis, words: PeriodWords = CARD_WORDS): string {
  const head =
    basis.counted === 0
      ? `keine ${words.one} mit Wert`
      : `über ${basis.counted} von ${countOf(basis.of, words)}`
  return [head, ...basis.missing.map((m) => `${m.count} ${REASON_TEXT[m.reason]}`)].join(" · ")
}
