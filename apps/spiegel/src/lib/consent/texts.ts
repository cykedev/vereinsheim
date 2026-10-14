// Hinweistexte zur Zustimmung (SP-1.7 a, Plan `plans/2026-10-14-spiegel-optin.md`, D3). Einen Text vom Vorstand gibt
// es nicht (SP-0.5 entfällt, [[spiegel-privacy]]); der Schütze bestätigt diesen im Profil, die Zeile speichert die
// Version. Ein Wortlaut ändert sich nie: Ein neuer ist eine neue Version (Tests halten v1 und v2 fest).

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
  // v2 (P2f, Textbuch, 14. Oktober 2026): Spiegel holt auch ältere Scheiben (P2d), ein Admin sieht die Zahl der Scheiben
  // je Konto (P2e); kürzere Sätze, „Sportpassnummer“
  v2: {
    title: "Deine Scheiben automatisch in Spiegel",
    paragraphs: [
      "Wenn du zustimmst, holt Spiegel jede Scheibe, die du unter dieser Sportpassnummer an der Meyton-Anlage schießt. Dazu gehören jeder Schuss mit Lage, Wert und Zeit, der Stand, die Disziplin und der Name, unter dem Meyton dich führt. Auch ältere Scheiben holt Spiegel, soweit die Anlage sie noch hat. Scheiben mit verdeckter Wertung (etwa beim Königsschießen) verlassen das Schützenhaus nie.",
      "Spiegel betreibt der Verein. Deine Scheiben siehst nur du. Ein Admin verwaltet Konten und Anlage, sieht aber deine Schüsse nicht. Damit Fehler auffallen, sieht ein Admin, wie viele Scheiben dein Konto hat und wann die letzte kam.",
      "Ein Admin prüft deine Sportpassnummer einmal. Danach zeigt dir Spiegel deine jüngste Scheibe, und du bestätigst, dass sie deine ist.",
      "Deine Scheiben bleiben, bis du sie löschst. Gelöschte liegen 30 Tage im Papierkorb und verschwinden danach. In den Sicherungen des Servers bleiben sie noch rund zwei Wochen länger.",
      "Die Zustimmung ist freiwillig. Du kannst sie hier jederzeit widerrufen. Danach kommen keine neuen Scheiben mehr. Was schon da ist, bleibt, bis du es löschst.",
    ],
  },
}

/** die Version, der ein Schütze heute zustimmt */
export const CURRENT_CONSENT_VERSION = "v2"

export function consentTextOf(version: string): ConsentText | null {
  return Object.hasOwn(CONSENT_TEXTS, version) ? CONSENT_TEXTS[version]! : null
}
