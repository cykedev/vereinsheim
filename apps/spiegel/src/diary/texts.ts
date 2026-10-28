// Sichtbare Texte des Tagebuchs an einer Stelle (Textbuch Spiegel, „Tagebuch (2a)“). Rückfragen stehen in
// `consequences.ts`.

/** Kasten „Tagebuch“ im Profil */
export const PROFILE_TEXTS = {
  title: "Tagebuch",
  off: "Aus. Im Tagebuch hältst du fest, was du dir vornimmst, wie es lief und was du daraus lernst.",
  on: "An. In der unteren Leiste steht Tagebuch statt Scheiben. Alle Scheiben findest du oben und über Start.",
  turnOn: "Einschalten",
  turnOff: "Ausschalten",
  turnedOn: "Tagebuch eingeschaltet.",
  turnedOff: "Tagebuch ausgeschaltet.",
  allCards: "Alle Scheiben",
  /** der Satz oben im Papierkorb, wenn auch Einträge darin liegen können */
  trashLead:
    "Gelöschte Scheiben und Einträge liegen hier 30 Tage und zählen nirgends mit. Danach werden sie endgültig gelöscht.",
} as const

/** Fehler, die jede Action des Tagebuchs geben kann */
export const ERRORS = {
  session: "Das geht gerade nicht. Lade die Seite neu.",
  failed: "Das ließ sich nicht speichern. Bitte noch einmal versuchen.",
  missing: "Diesen Eintrag gibt es nicht mehr.",
  off: "Das Tagebuch ist ausgeschaltet. Im Profil lässt es sich einschalten.",
} as const

/** die Seite eines Eintrags */
export const ENTRY_TEXTS = {
  back: "Tagebuch",
  before: "Vorher",
  after: "Nachher",
  intention: "Vorhaben",
  intentionEmpty: "Was nimmst du dir vor?",
  intentionSaved: "Vorhaben gespeichert.",
  note: "Notiz",
  noteEmpty: "Was ist passiert? Gern in Stichpunkten.",
  noteSaved: "Notiz gespeichert.",
  learned: "Ich habe gelernt, dass …",
  learnedEmpty: "… den Satz zu Ende schreiben",
  question: "Wie schaffe ich es, …?",
  questionEmpty: "… deine Frage für das nächste Mal",
  saved: "Gespeichert.",
  disturbed: "Was hat gestört?",
  disturbedHint: "Stand, Licht, Griff, Nerven …",
  expected: "Erwartetes Ergebnis",
  rings: "Ringe",
  execution: "Ausführung je Serie",
  executionHint: "Wie gut war die Technik? Unabhängig vom Ergebnis.",
  cardGone: "Scheibe gelöscht",
  noCard:
    "Noch keine Scheibe. Sie kommt von selbst dazu, sobald Spiegel eine von diesem Abend hat.",
  changeCards: "Scheiben ändern",
  changeCardsLead: (day: string, family: string) =>
    `Alle Scheiben vom ${day} in ${family}. Ein Haken nimmt eine Scheibe in diesen Eintrag.`,
  inOtherEntry: (title: string) => `Steckt im Eintrag „${title}“.`,
  done: "Fertig",
  thisEntry: "Dieser Eintrag",
  basics: "Tag, Art und Disziplin",
  basicsFromCards: "Kommt von den Scheiben.",
  change: "Ändern",
  day: "Tag",
  kind: "Art",
  family: "Disziplin",
  noFamily: "ohne",
  basicsSaved: "Eintrag gespeichert.",
  remove: "Löschen",
  removeState: "Danach liegt der Eintrag 30 Tage im Papierkorb im Profil. Die Scheiben bleiben.",
} as const

/** die Arten eines Eintrags zur Wahl */
export const KIND_CHOICES = [
  { value: "shooting", label: "Mit Scheiben" },
  { value: "dry", label: "Trockentraining" },
  { value: "mental", label: "Mentaltraining" },
] as const

/** Liste, Faden und Hinweis beim ersten Öffnen */
export const LIST_TEXTS = {
  title: "Tagebuch",
  newEntry: "Neuer Eintrag",
  entries: "Einträge",
  thread: "Faden",
  emptyTitle: "Noch kein Eintrag",
  emptyText:
    "Ein Eintrag hält fest, was du dir vornimmst, wie es lief und was du daraus lernst. Er gehört zu einem Tag und trägt die Scheiben dieses Abends.",
  noticeTitle: "Nur du siehst dein Tagebuch",
  notice: [
    "Was du hier schreibst, sieht niemand sonst. Auch der Admin nicht, auch keine Zahlen daraus.",
    "Teilst du eine Scheibe, bleibt das Tagebuch privat.",
    "Ein Eintrag gehört zu einem Tag und einer Disziplin. Er kann die Scheiben dieses Abends tragen.",
  ],
  noticeOk: "Verstanden",
  threadLead: "Deine Fragen und was du gelernt hast, neueste oben.",
  threadEmpty: "Noch keine Frage. Im Eintrag unter Nachher steht „Wie schaffe ich es, …?“.",
  threadEntry: "Eintrag ›",
} as const

/** „Neuer Eintrag“ */
export const NEW_TEXTS = {
  title: "Neuer Eintrag",
  lead: "Leg einen Eintrag für heute an, etwa für Vorhaben und Prognose vor dem Training. Oder wähle einen Abend mit Scheiben.",
  today: "Heute",
  evenings: "Abende ohne Eintrag",
  none: "In den letzten 30 Tagen gibt es keine Scheibe ohne Eintrag.",
  create: "Anlegen",
  createFor: (day: string, family: string) => `Eintrag für ${day} · ${family} anlegen`,
  withCardsHint: "Die Scheiben dieses Tages kommen von selbst dazu, sobald Spiegel sie hat.",
  created: "Eintrag angelegt.",
} as const
