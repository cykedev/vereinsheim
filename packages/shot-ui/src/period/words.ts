// Wörter der Seite eines Zeitraums für einen Eintrag: Spiegel sagt „Scheibe“, Treffsicher „Einheit“. Beide sind
// weiblich, die Sätze der Bausteine bleiben damit gleich („Neueste Einheit“, „der Einheit davor“). Rein, ohne React,
// damit auch die Texte aus Modellen (`recordRows`, `verdictText`) sie nehmen.

export interface PeriodWords {
  /** ein Eintrag: „Scheibe“ */
  one: string
  /** mehrere: „Scheiben“ */
  many: string
  /** steht da, solange es keinen Rekord gibt: welche Einträge zählen */
  noRecords: string
}

/** die Wörter von Spiegel, die Vorgabe jedes Bausteins */
export const CARD_WORDS: PeriodWords = {
  one: "Scheibe",
  many: "Scheiben",
  noRecords: "Noch kein Rekord: Es zählen nur abgeschlossene, vollständige Scheiben.",
}

/** „1 Scheibe“, „3 Scheiben“ */
export const countOf = (n: number, words: PeriodWords) => `${n} ${n === 1 ? words.one : words.many}`
