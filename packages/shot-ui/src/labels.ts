// Anzeigenamen der Kennzahlen auf Ebene 1 und 2 (Plan U3, D4): das Alltagswort statt des Namens aus dem Fachkern. Der
// Fachbegriff (σ, Median) steht im Blatt „?“; der Fachkern bleibt unverändert.

import type { MetricDefinition } from "@vereinsheim/shot-core/metrics"

const LABELS: Readonly<Record<string, string>> = {
  "group.sigma": "Streuung",
  "group.sdX": "Streuung waagrecht",
  "group.sdY": "Streuung senkrecht",
  "time.intervalMedian": "Tempo",
}

/** Name einer Kennzahl auf der Seite: das Alltagswort, sonst der Name aus dem Fachkern */
export function metricLabel(metric: Pick<MetricDefinition, "key" | "label">): string {
  return LABELS[metric.key] ?? metric.label
}
