// „–“ mit dem Grund, warum kein Wert steht, nur auf dem Bildschirm (die PDFs zeigen ihren eigenen Strich). Die Gründe
// sind im Textbuch freigegeben (vault/_attachments/textbuch-ringwerk-treffsicher.md, „Ringwerk: ‚–‘ mit Grund (WD3)“).
// Sie enthalten keine Zahl und kein Wort, das der Abgleich (`tools/pruefen-ringwerk`, `DATA_WORDS`) als Daten liest: Die
// Datenfolge jeder Seite hängt so nicht an ihnen.

const MISSING_REASONS = {
  /** Rangliste einer Saison: Teilnehmer ohne Serie */
  noSeries: "noch keine Serie",
  /** Tabelle der Liga: „Best. RT“ ohne gespieltes Duell */
  noDuel: "noch kein Duell",
  /** Tabellen der Liga: Platz eines Zurückgezogenen */
  noPlace: "ohne Platz",
  /** Tabelle im Best-of: Direktvergleich, wenn die Spalten davor den Platz schon trennen */
  notNeeded: "nicht nötig",
  /** Spielplan: Gegner bei einem Freilos */
  noOpponent: "kein Gegner",
  /** Spielplan: Paarung mit einem Zurückgezogenen */
  notScored: "nicht gewertet",
  /** Spielplan: Paarung ohne Ergebnis */
  noResult: "noch kein Ergebnis",
  /** Liste der Wettbewerbe: Liga ohne Stichtag für Hin- oder Rückrunde */
  noDeadline: "kein Stichtag",
  /** Turnierbaum: leeres Feld der Vorschau */
  notYetKnown: "steht noch nicht fest",
} as const

export type MissingKind = keyof typeof MISSING_REASONS

export const MISSING_KINDS = Object.keys(MISSING_REASONS) as MissingKind[]

/** der Grund, warum an dieser Stelle kein Wert steht */
export const missingReason = (kind: MissingKind): string => MISSING_REASONS[kind]
