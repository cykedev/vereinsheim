// Was eine Ansicht von Scheiben zeigt (SP-1.7 a2, Plan `plans/2026-10-14-spiegel-erste-scheibe.md`, D2). Eigene Datei,
// weil `reads.ts` und `cards.ts` beide filtern und `reads.ts` schon aus `cards.ts` liest.

/**
 * Nicht gelöscht und nicht wartend. Eine wartende Scheibe (der Besitz wartet auf die Bestätigung der ersten Scheibe) steht
 * nur in „Offen“. Jede Abfrage über eigene Scheiben für eine Ansicht nimmt diesen Filter.
 */
export const VISIBLE_CARD = { deletedAt: null, ownerPending: false } as const

/** wartend und nicht gelöscht: was „Offen“ zeigt */
export const PENDING_CARD = { deletedAt: null, ownerPending: true } as const
