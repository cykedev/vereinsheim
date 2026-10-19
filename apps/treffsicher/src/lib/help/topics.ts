import type { HelpText } from "@vereinsheim/ui/design2/help"

// Erklärungen der App, je Thema ein Schlüssel; das Blatt der Hilfe im Rahmen zeigt sie. Der Wortlaut ist im Textbuch
// freigegeben (vault/_attachments/textbuch-ringwerk-treffsicher.md) und folgt den Schreibregeln ([[conventions]] §10).

export const HELP_TOPICS = {
  "prognosis-feedback": {
    title: "Prognose und Feedback",
    short: "Wie du dich vor der Einheit eingeschätzt hast und wie es danach war.",
    what: "Vor der Einheit schätzt du dich in sieben Bereichen ein, von 0 bis 100. Das ist die Prognose. Nach der Einheit schätzt du dieselben Bereiche noch einmal ein. Das ist das Feedback.",
    read: "„Differenz“ ist Feedback minus Prognose. Grün heißt: besser als gedacht. Rot heißt: schlechter als gedacht. 0 heißt: wie gedacht.",
    act: "Ist ein Bereich oft rot, schätzt du ihn vorher zu gut ein. Diesen Bereich lohnt es sich im Training anzusehen.",
    caution:
      "Beide Werte sind deine eigene Einschätzung. Sie messen nichts. Eine einzelne Einheit sagt wenig. Erst mehrere Einheiten zeigen ein Muster.",
  },
  wellbeing: {
    title: "Befinden",
    short: "Wie es dir vor der Einheit ging: Schlaf, Energie, Stress und Motivation.",
    what: "Vor der Einheit trägst du vier Werte ein, jeweils von 0 bis 100. Schlaf: wie gut du geschlafen hast. Energie: wie frisch du dich fühlst. Stress: wie angespannt du bist. Motivation: wie viel Lust du auf die Einheit hast.",
    read: "Bei Schlaf, Energie und Motivation ist ein hoher Wert gut. Bei Stress ist ein hoher Wert schlecht.",
    act: "Trägst du das Befinden oft ein, zeigt die Statistik, ob deine Ergebnisse damit zusammenhängen.",
    caution:
      "Trag die Werte vor der Einheit ein, nicht danach. Sonst färbt das Ergebnis die Einschätzung.",
  },
} as const satisfies Record<string, HelpText>

export type HelpTopicId = keyof typeof HELP_TOPICS

/** die Erklärung zu einem Thema; null: unbekannt */
export const helpTopic = (id: string | null): HelpText | null =>
  id !== null && id in HELP_TOPICS ? HELP_TOPICS[id as HelpTopicId] : null
