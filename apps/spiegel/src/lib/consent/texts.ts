// Hinweistexte zur Zustimmung (SP-1.7 a, Plan `plans/2026-10-14-spiegel-optin.md`, D3). Einen Text vom Vorstand gibt
// es nicht (SP-0.5 entfällt, [[spiegel-privacy]]); der Schütze bestätigt diesen im Profil, die Zeile speichert die
// Version. Ein Wortlaut ändert sich nie: Ein neuer ist eine neue Version (Test hält v1 fest).

export interface ConsentText {
  title: string
  paragraphs: readonly string[]
}

export const CONSENT_TEXTS: Readonly<Record<string, ConsentText>> = {
  v1: {
    title: "Deine Scheiben automatisch in Spiegel",
    paragraphs: [
      "Wenn du zustimmst, schickt die Brücke im Schützenhaus jede Scheibe, die du unter dieser SportpassID an der Meyton-Anlage schießt, an Spiegel: jeden Schuss mit Lage, Wert und Zeit, dazu Stand, Disziplin und den Namen, unter dem Meyton dich führt. Scheiben mit verdeckter Wertung (etwa beim Königsschießen) verlassen das Schützenhaus nie.",
      "Spiegel betreibt der Verein. Deine Scheiben siehst nur du; ein Admin verwaltet Konten und Anlage, aber nicht deine Schüsse. Ein Admin bestätigt deine SportpassID einmal, danach legt dir Spiegel die erste Scheibe zur Bestätigung vor.",
      "Deine Scheiben bleiben, bis du sie löschst; gelöschte liegen 30 Tage im Papierkorb und verschwinden danach. In den Sicherungen des Servers stehen sie noch rund zwei Wochen länger.",
      "Die Zustimmung ist freiwillig, und du kannst sie hier jederzeit widerrufen. Danach kommen keine neuen Scheiben mehr; was schon da ist, bleibt, bis du es löschst.",
    ],
  },
}

/** die Version, der ein Schütze heute zustimmt */
export const CURRENT_CONSENT_VERSION = "v1"

export function consentTextOf(version: string): ConsentText | null {
  return Object.hasOwn(CONSENT_TEXTS, version) ? CONSENT_TEXTS[version]! : null
}
