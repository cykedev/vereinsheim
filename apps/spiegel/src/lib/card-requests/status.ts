import type { CardRequestStatus } from "@/generated/prisma/client"

// Zustände eines Auftrags per ID, wie die Seite einer Scheibe sie zeigt: reine Regeln für Text, Sichtbarkeit und
// Entfernen. „Gefüllt“ heißt, die Scheibe des Auftrags hat eine Quelle (die Brücke hat Rohdaten geliefert).

/** der Zustand eines Auftrags in Worten (Zeile „Von der Anlage“ im Kasten „Diese Scheibe“) */
export const REQUEST_STATUS_TEXT: Readonly<Record<CardRequestStatus, string>> = {
  open: "wartet auf die Anlage",
  done: "geholt",
  missing: "nicht gefunden",
  held: "lässt sich nicht holen",
  mismatch: "an diesem Tag nicht gefunden",
  taken: "gehört zu einem anderen Konto",
  withdrawn: "zurückgezogen",
  expired: "keine Antwort von der Anlage",
  printMismatch: "passt nicht zum Ausdruck",
}

/** ein Satz unter dem Zustand; ohne Eintrag kein Satz */
export const REQUEST_STATUS_NOTE: Readonly<Partial<Record<CardRequestStatus, string>>> = {
  open: "Spiegel holt die Werte, sobald die Anlage läuft.",
  missing: "Die Anlage hat keine Scheibe mit dieser ID.",
  mismatch: "Die Scheibe mit dieser ID lief an einem anderen Tag.",
  printMismatch:
    "Die Scheibe der Anlage begann nach dem Druck oder hat andere Werte. Spiegel hat nichts übernommen.",
  held: "Die Scheibe bleibt an der Anlage.",
  taken: "Diese Scheibe bekommt ein anderes Konto über die Sportpassnummer.",
  expired: "Die Anlage hat sich 30 Tage nicht gemeldet.",
}

/** der Zustand in Worten; offen und gefüllt: Die Scheibe ist geholt, weitere Schüsse kommen noch nach */
export const requestStateText = (status: CardRequestStatus, filled: boolean): string =>
  status === "open" && filled ? "geholt, wird noch ergänzt" : REQUEST_STATUS_TEXT[status]

/** der Satz unter „wartet auf die Anlage“, wenn die Scheibe schon Werte vom Ausdruck hat */
export const OPEN_WITH_PRINTOUT_VALUES =
  "Die Werte sind vom Ausdruck. Spiegel holt die Messwerte und Zeiten, sobald die Anlage läuft."

/**
 * der Satz unter dem Zustand; offen und gefüllt ohne Satz. `printoutValues`: Die Scheibe hat schon Werte vom Ausdruck,
 * die Anlage bringt nur noch Messwerte und Zeiten
 */
export const requestStateNote = (
  status: CardRequestStatus,
  filled: boolean,
  printoutValues = false
): string | null => {
  if (filled) return null
  if (status === "open" && printoutValues) return OPEN_WITH_PRINTOUT_VALUES
  return REQUEST_STATUS_NOTE[status] ?? null
}

/**
 * ob die Seite der Scheibe den Auftrag zeigt: ungefüllt, solange er nicht zurückgezogen oder geholt ist, gefüllt nur,
 * solange er offen ist (die Scheibe wird noch ergänzt)
 */
export const requestShown = (status: CardRequestStatus, filled: boolean): boolean =>
  filled ? status === "open" : status !== "withdrawn" && status !== "done"

/**
 * ob der Schütze den Auftrag entfernen kann: ungefüllt und nicht zurückgezogen oder geholt. Offen heißt das „Nicht mehr
 * holen“, beendet „Entfernen“; beides setzt ihn auf zurückgezogen, Scheibe und Ausdruck bleiben.
 */
export const requestRemovable = (status: CardRequestStatus, filled: boolean): boolean =>
  !filled && status !== "withdrawn" && status !== "done"
