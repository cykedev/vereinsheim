import { helpForMetric, helpTopic as shotHelpTopic } from "@vereinsheim/shot-help/lookup"
import { shotHelp } from "@vereinsheim/shot-ui/help/HelpTexts"
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

/**
 * die Erklärung zu einem Thema; null: unbekannt. Eigene Themen gehen vor, sonst die von Spiegel (`shot-help`) mit
 * derselben Id: So öffnet jedes „?“ der Bausteine aus `shot-ui` ein Blatt.
 */
export const helpTopic = (id: string | null): HelpText | null => {
  if (id === null) return null
  if (id in HELP_TOPICS) return HELP_TOPICS[id as HelpTopicId]
  return shotHelpTopic(id) ?? null
}

/** Titel und Kurzsatz für die Karten der Bausteine (`HelpTextsProvider`), aus derselben Quelle wie das Blatt */
export const helpHeading = (id: string): { title: string; short?: string } => {
  const topic = helpTopic(id)
  return topic ? { title: topic.title, short: topic.short } : shotHelp(id)
}

/** das Thema einer Kennzahl (Kachel, Verlauf), wie in Spiegel */
export const metricHelpId = (key: string): string | null => helpForMetric(key)?.id ?? null
