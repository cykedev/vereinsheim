import type { BlockedCard, TrashCard } from "@/lib/db/reads"
import { cardResultText, cardWhen } from "@/lib/open"

// Papierkorb in Worten. Reine Funktionen; gerechnet auf dem
// Server, an den Browser gehen nur die Texte.

const DAY_MS = 86_400_000

export interface TrashItem {
  cardId: string
  /** „Di 14.10.2026 · 19:12“ */
  when: string
  family: string | null
  result: string | null
  /** „noch 29 Tage“, „noch 1 Tag“ */
  left: string
}

export interface BlockedItem {
  key: string
  when: string
  /** „endgültig gelöscht“ oder „als „nicht meine“ gemeldet“ */
  label: string
}

/** wie lange eine Scheibe noch wiederherstellbar ist, aufgerundet auf ganze Tage */
export function daysLeft(endsAtMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((endsAtMs - nowMs) / DAY_MS))
}

export function trashItems(
  trash: readonly TrashCard[],
  timeZone: string,
  nowMs: number
): TrashItem[] {
  return trash.map(({ card, endsAtMs }) => {
    const days = daysLeft(endsAtMs, nowMs)
    return {
      cardId: card.id,
      when: cardWhen(card.startedAtMs, timeZone, card.timeUnknown),
      family: card.family?.name ?? null,
      result: cardResultText(card),
      left: days === 1 ? "noch 1 Tag" : days === 0 ? "wird gleich gelöscht" : `noch ${days} Tage`,
    }
  })
}

const BLOCKED_LABEL: Readonly<Record<BlockedCard["kind"], string>> = {
  deleted: "endgültig gelöscht",
  "not-mine": "als „nicht meine“ zurückgewiesen",
}

export function blockedItems(blocked: readonly BlockedCard[], timeZone: string): BlockedItem[] {
  return blocked.map((b, i) => ({
    key: `${b.kind}-${b.startedAtMs}-${i}`,
    when: cardWhen(b.startedAtMs, timeZone),
    label: BLOCKED_LABEL[b.kind],
  }))
}
