// „–“ mit Grund statt 0, leer oder Strich ohne Erklärung. Die Gründe sind im Textbuch freigegeben
// (vault/_attachments/textbuch-ringwerk-treffsicher.md, TD3).

const MISSING_REASONS = {
  sessionResult: "noch kein Ergebnis eingetragen",
  seriesResult: "ohne Ergebnis",
  shots: "ohne Einzelschüsse",
  quality: "nicht bewertet",
  name: "ohne Namen",
  lastSessionEdit: "noch keine Einheit",
} as const

export type MissingKind = keyof typeof MISSING_REASONS

export const MISSING_KINDS = Object.keys(MISSING_REASONS) as MissingKind[]

/** der Grund, warum an dieser Stelle kein Wert steht */
export const missingReason = (kind: MissingKind): string => MISSING_REASONS[kind]
