import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { inScoring, metricByKey } from "@vereinsheim/shot-core/metrics"
import type { TargetId } from "@vereinsheim/shot-core/targets"
import { formatTimeOfDay, formatWeekdayDate } from "@vereinsheim/lib/format"
import type { OpenItem } from "@vereinsheim/shot-ui/start/OpenBox"
import { formatValue } from "@vereinsheim/shot-ui/format"

import type { OverviewCard, PendingFirstCard } from "@/lib/db/reads"

// „Offen“ (SP-1.7 a2, Plan `plans/2026-10-14-spiegel-erste-scheibe.md`, D3): was der Schütze bestätigen soll, in Worten.
// Reine Funktionen; gerechnet auf dem Server, an den Browser gehen nur die Texte.

export interface PendingItem {
  cardId: string
  sportpassId: string | null
  /** wie viele unter derselben SportpassID noch warten */
  more: number
  /** „Di 14.10.2026 · 19:12“ */
  when: string
  stand: string | null
  family: string | null
  shots: number
  /** Ergebnis in der Wertung der Scheibe, etwa „376 Ringe“ oder „382,4“; null ohne Wert */
  result: string | null
  targetId: TargetId | null
}

/** Tag und Uhrzeit einer Scheibe in Worten, „Di 14.10.2026 · 19:12“: in „Offen“, im Papierkorb und in den Dialogen */
export const cardWhen = (startedAtMs: number, timeZone: string) => {
  const started = new Date(startedAtMs)
  return `${formatWeekdayDate(started, timeZone)} · ${formatTimeOfDay(started, timeZone)}`
}

const SCORING_UNIT: Readonly<Record<Scoring, string>> = { rings: " Ringe", decimal: "" }

/** Ergebnis in der Wertung der Scheibe, etwa „376 Ringe“ oder „382,4“; null ohne Wert */
export function cardResultText(card: OverviewCard): string | null {
  const metric = inScoring(metricByKey("result.decimal")!, card.scoring)
  const value = card.projection.values[metric.key]?.value ?? null
  return value === null
    ? null
    : `${formatValue(value, metric.decimals)}${SCORING_UNIT[card.scoring]}`
}

export function pendingItems(
  pending: readonly PendingFirstCard[],
  timeZone: string
): PendingItem[] {
  return pending.map(({ card, sportpassId, more }) => ({
    cardId: card.id,
    sportpassId,
    more,
    when: cardWhen(card.startedAtMs, timeZone),
    stand: card.stand,
    family: card.family?.name ?? null,
    shots: card.projection.printedShots,
    result: cardResultText(card),
    targetId: card.targetId,
  }))
}

/** je SportpassID ein Eintrag in „Offen (n)“ auf Start; jeder führt nach „Offen“ */
export function openItems(items: readonly PendingItem[]): OpenItem[] {
  return items.map((item) => ({
    id: item.cardId,
    title: "Ist das deine Scheibe?",
    detail: [item.when, item.family].filter(Boolean).join(" · "),
    route: { page: "open" },
  }))
}
