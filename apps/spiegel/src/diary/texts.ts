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
} as const

/** Fehler, die jede Action des Tagebuchs geben kann */
export const ERRORS = {
  session: "Das geht gerade nicht. Lade die Seite neu.",
  failed: "Das ließ sich nicht speichern. Bitte noch einmal versuchen.",
  missing: "Diesen Eintrag gibt es nicht mehr.",
  off: "Das Tagebuch ist ausgeschaltet. Im Profil lässt es sich einschalten.",
} as const
