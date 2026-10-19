// Folgen jeder Aktion in Alltagsworten: „Kein Knopf ohne Folge“. Eine Quelle für Dialoge und Tests; die Komponenten
// erfinden keine Texte. Ohne Pronomen für Personen. Reine Funktionen.
//
// Der Wortlaut ist im Textbuch freigegeben (vault/_attachments/textbuch-ringwerk-treffsicher.md) und folgt den
// Schreibregeln ([[conventions]] §10). Ein Test hält die alten Wörter fern (`consequences.test.ts`).

import { forbiddenWords } from "@vereinsheim/lib/wording"
import type { Decision } from "@vereinsheim/ui/design2/decision-dialog"

export type { Decision }

/** was in keinem Dialog mehr stehen darf: die Grundregel und die alten Wörter der Dialoge */
export const TREFFSICHER_OLD_WORDS = forbiddenWords(
  /\bAccount|\bNutzer|\bSession|kann nicht rückgängig gemacht werden|endgültig|dauerhaft entfernt|Verknüpfung/
)

export * from "./consequences/diary"
export * from "./consequences/disciplinesAndAccounts"
