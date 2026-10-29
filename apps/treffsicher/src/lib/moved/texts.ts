// Texte für ein Konto, das nach Spiegel umgezogen ist ([[adr-033]], Stufe 3): Hinweis, Ablehnung des Servers und die
// Seiten statt der Formulare. Eine Quelle für Seiten, Actions und Tests; die Komponenten erfinden keine Texte.
//
// Der Wortlaut steht im Textbuch (vault/_attachments/textbuch-ringwerk-treffsicher.md, „Treffsicher: Nur noch lesend“)
// und folgt den Schreibregeln ([[conventions]] §10). `texts.test.ts` hält jeden Satz wörtlich.

export const MOVED_TEXTS = {
  bannerTitle: "Dein Tagebuch ist jetzt in Spiegel.",
  bannerText:
    "Alle deine Einheiten, Ziele und Abläufe sind dorthin umgezogen. Hier kannst du noch alles nachlesen, aber nichts mehr ändern.",
  signIn: "Anmelden mit deinem Konto von Spiegel",
  bannerShort: "Dein Tagebuch ist jetzt in Spiegel. Hier kannst du nur noch lesen.",
  toSpiegel: "Zu Spiegel",
  toSpiegelShort: "Spiegel",
  refusal: "Dein Tagebuch ist jetzt in Spiegel. Hier kannst du nichts mehr ändern.",
  pageTitle: "Das geht jetzt in Spiegel.",
  emptyHint: "Neues legst du jetzt in Spiegel an.",
  password:
    "Dein Passwort änderst du jetzt in Spiegel, im Profil. In Treffsicher meldest du dich weiter mit deinem bisherigen Passwort an.",
  newSystemDiscipline: "Neue System-Disziplin",
} as const

/** die alten Adressen zum Anlegen oder Bearbeiten, die für ein umgezogenes Konto eine Seite statt eines Formulars zeigen */
export type MovedPageKind =
  | "sessionNew"
  | "sessionEdit"
  | "goalNew"
  | "routineNew"
  | "routineEdit"
  | "disciplineNew"
  | "disciplineEdit"

/** Titel (der bisherige der Seite) und Satz je Seite */
export const MOVED_PAGES: Readonly<Record<MovedPageKind, { title: string; text: string }>> = {
  sessionNew: {
    title: "Neue Einheit",
    text: "Dein Tagebuch ist umgezogen. Neue Einträge legst du in Spiegel unter „Tagebuch“ an.",
  },
  sessionEdit: {
    title: "Einheit bearbeiten",
    text: "Dein Tagebuch ist umgezogen. Deine Einträge änderst du in Spiegel unter „Tagebuch“.",
  },
  goalNew: {
    title: "Neues Ziel",
    text: "Deine Ziele sind mit umgezogen. Neue Ziele legst du in Spiegel unter „Tagebuch“ an, im Reiter „Ziele“.",
  },
  routineNew: {
    title: "Neuer Schuss-Ablauf",
    text: "Deine Abläufe sind mit umgezogen. Neue legst du in Spiegel unter „Tagebuch“ an, im Reiter „Abläufe“.",
  },
  routineEdit: {
    title: "Schuss-Ablauf bearbeiten",
    text: "Deine Abläufe sind mit umgezogen. Du änderst sie in Spiegel unter „Tagebuch“, im Reiter „Abläufe“.",
  },
  disciplineNew: {
    title: "Neue Disziplin",
    text: "Dein Tagebuch ist mit deinen eigenen Disziplinen umgezogen. Hier legst du keine neue mehr an.",
  },
  disciplineEdit: {
    title: "Disziplin bearbeiten",
    text: "Dein Tagebuch ist mit deinen eigenen Disziplinen umgezogen. Hier änderst du sie nicht mehr.",
  },
}
