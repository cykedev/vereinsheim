// Spiegels Scheiben als Eingabe der Seite eines Zeitraums: eine Scheibe mit Projektion (ADR-031) als `PeriodItem`.

import { projectedEligible, type ProjectedCard } from "@vereinsheim/shot-core/projection"

import type { CardProvenance } from "../detail"

import type { PeriodItem } from "./item"

/**
 * Eine Scheibe mit Projektion als Eintrag: Werte und Rekord-Kandidaten aus der Projektion, „nur Probe“ wie
 * `isProbeOnly` (mit mindestens einem Schuss), die Schüsse wie am Ausdruck. Eine Scheibe, die für Rekorde nicht
 * zählt (`projectedEligible`), trägt keine Kandidaten. Einschießen (`warmup`), Grundlage und Herkunft gehen mit, die
 * Herkunft nur, wenn sie nicht gemessen ist.
 */
export function fromProjection(
  card: ProjectedCard & { provenance?: CardProvenance; waiting?: false }
): PeriodItem {
  const { projection } = card
  return {
    id: card.id,
    startedAtMs: card.startedAtMs,
    kind: card.kind,
    probeOnly: projection.probeOnly && projection.printedShots > 0,
    shots: projection.printedShots,
    metrics: projection.values,
    records: projectedEligible(card) ? projection.records : { decimal: null, rings: null },
    flags: card.flags,
    ...(card.warmup ? { warmup: true as const } : {}),
    ...(projection.detail ? { detail: projection.detail } : {}),
    ...(card.provenance && card.provenance !== "measured" ? { provenance: card.provenance } : {}),
    ...(card.waiting === false ? { waiting: false as const } : {}),
  }
}
