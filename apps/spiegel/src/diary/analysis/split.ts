// Teilung am mittleren Wert (Median), wie die Einflüsse in Treffsicher: über und unter dem Median, die auf ihm zur
// kleineren Gruppe, bei gleich großen zu keiner. Rein, für Einflüsse und Ausführung.

import { median } from "@vereinsheim/shot-core/stats"

/**
 * Die Einträge über und unter dem Median ihrer Werte. Die auf dem Median kommen zur kleineren Gruppe: Werte bleiben
 * oft auf einer Stufe stehen, sonst fiele die Mehrheit weg. Sind beide Gruppen gleich groß, zählen sie nicht, damit
 * keine Seite bevorzugt ist. Alle gleich: beide leer.
 */
export function splitAtMedian<T>(
  items: readonly T[],
  valueOf: (item: T) => number
): { high: T[]; low: T[] } {
  if (!items.length) return { high: [], low: [] }
  const middle = median(items.map(valueOf)) as number
  const above = items.filter((item) => valueOf(item) > middle)
  const below = items.filter((item) => valueOf(item) < middle)
  const on = items.filter((item) => valueOf(item) === middle)
  return {
    high: above.length < below.length ? [...above, ...on] : above,
    low: below.length < above.length ? [...on, ...below] : below,
  }
}
