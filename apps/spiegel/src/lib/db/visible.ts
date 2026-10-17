// Was eine Ansicht von Scheiben zeigt. Eigene Datei,
// weil `reads.ts` und `cards.ts` beide filtern und `reads.ts` schon aus `cards.ts` liest.

/**
 * Scheiben einer Disziplin, die der Admin nicht ignoriert (ohne sinnvolle Wertung, etwa Spiele oder ein Trainingsspiegel);
 * gilt beim Lesen, nichts wird gelöscht
 */
export const SHOWN_DISCIPLINE = { discipline: { ignoredAt: null } } as const

/**
 * Nicht gelöscht, nicht wartend, Disziplin nicht ignoriert. Eine wartende Scheibe (der Besitz wartet auf die Bestätigung
 * der ersten Scheibe) steht nur in „Offen“. Jede Abfrage über eigene Scheiben für eine Ansicht nimmt diesen Filter.
 */
export const VISIBLE_CARD = { deletedAt: null, ownerPending: false, ...SHOWN_DISCIPLINE } as const

/**
 * wartend und nicht gelöscht, auch ignorierte: Die Bestätigung der ersten Scheibe gibt alle wartenden frei, sonst blieben
 * ignorierte für immer wartend. Was „Offen“ zeigt, filtert zusätzlich `SHOWN_DISCIPLINE`.
 */
export const PENDING_CARD = { deletedAt: null, ownerPending: true } as const
