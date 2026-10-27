// Texte zu „Scheibe holen“: was nach dem Holen als Meldung kommt und warum es nicht ging. Rein, eine Quelle für Actions
// und Seite; die Schreibregeln hält `texts.test.ts`.

import type { FetchFailure } from "../printouts/fetch"
import type { StoreRejection } from "../printouts/store"

/** warum Spiegel eine Scheibe nicht holt, über das Laden und Lesen des Ausdrucks hinaus */
export type FetchRefusal =
  | "taken"
  | "blocked"
  | "tooMany"
  | "notAllowed"
  | "trashExpired"
  | "noSite"
  | "noSession"
  | "failed"

export type FetchProblem = FetchFailure | StoreRejection | FetchRefusal

const ERROR_TEXT: Readonly<Record<FetchProblem, string>> = {
  badUrl: "Das ist kein Link auf einen Ausdruck.",
  redirect:
    "Der Ausdruck ließ sich nicht laden. Ist der Link älter als eine Woche, hat Meyton ihn gelöscht.",
  httpStatus:
    "Der Ausdruck ließ sich nicht laden. Ist der Link älter als eine Woche, hat Meyton ihn gelöscht.",
  unreachable:
    "Der Ausdruck ließ sich nicht laden. Ist der Link älter als eine Woche, hat Meyton ihn gelöscht.",
  timeout: "Der Ausdruck kam nicht rechtzeitig. Versuche es noch einmal.",
  tooLarge: "Die Datei ist größer als 1 MB. Ein Ausdruck hat rund 40 KB.",
  notPdf: "Das ist kein PDF.",
  unreadable: "Spiegel kann dieses PDF nicht lesen.",
  noId: "Auf dem Ausdruck steht keine ID. Ohne sie findet Spiegel die Scheibe nicht.",
  idConflict: "Auf dem Ausdruck stehen verschiedene IDs.",
  noTime: "Im PDF fehlt die Druckzeit.",
  busy: "Spiegel liest gerade andere Ausdrucke. Versuche es gleich noch einmal.",
  nodeVersion: "Dieser Server kann keine Ausdrucke lesen. Er braucht eine neuere Version von Node.",
  taken: "Diese Scheibe gehört schon zu einem anderen Konto.",
  blocked: "Diese Scheibe lässt sich nicht holen.",
  tooMany: "Es warten schon zehn Scheiben auf die Anlage. Warte, bis die Anlage sie geliefert hat.",
  notAllowed: "Diese Disziplin steht nicht zur Wahl. Lade die Seite neu.",
  trashExpired: "Die 30 Tage sind um. Die Scheibe lässt sich nicht mehr wiederherstellen.",
  noSite: "Spiegel ist noch mit keiner Anlage verbunden.",
  noSession: "Das geht gerade nicht. Lade die Seite neu.",
  failed: "Die Scheibe ließ sich nicht holen.",
}

/** warum es nicht ging, in einem Satz unter dem Weg */
export const fetchErrorText = (problem: FetchProblem): string => ERROR_TEXT[problem]

/** was nach dem Holen geschah, für die Seite */
export type FetchOutcome =
  /** neu: erst Disziplin und Art wählen; `relifts`: Der Schütze hatte die Scheibe gelöscht */
  | { kind: "choose"; hex: string; day: string; relifts: boolean }
  | { kind: "created"; cardId: string }
  /** die eigene Scheibe; `attached`: mit einem Ausdruck */
  | { kind: "opened"; cardId: string; attached: boolean }
  | { kind: "restored"; cardId: string }
  | { kind: "pending" }

/** die Meldung nach dem Holen; beim Fragen keine */
export function fetchToast(outcome: FetchOutcome): string | null {
  switch (outcome.kind) {
    case "choose":
      return null
    case "created":
      return "Scheibe angelegt. Spiegel holt die Werte von der Anlage."
    case "opened":
      return outcome.attached
        ? "Ausdruck an die Scheibe gehängt."
        : "Die Scheibe liegt schon in Spiegel."
    case "restored":
      return "Scheibe aus dem Papierkorb geholt."
    case "pending":
      return "Die Scheibe wartet in „Offen“."
  }
}

/** alle Fehlertexte, für die Tests der Schreibregeln */
export const ALL_ERROR_TEXTS: readonly string[] = Object.values(ERROR_TEXT)
