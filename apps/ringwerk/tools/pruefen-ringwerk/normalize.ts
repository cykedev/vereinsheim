// Text einer Seite und eines PDFs für den Vergleich vorher und nachher. Herausgenommen wird, was je Lauf wechselt: das
// Erstelldatum im Kopf der PDFs und die Adresse des Servers in der gedruckten öffentlichen URL. Der Inhalt des QR-Codes
// (mit Zugangs-Token) steht nicht im Text; er ist ein Pfad im PDF und zählt nur im Bild.
//
// Aus dem Text einer Seite entsteht zusätzlich die Datenfolge: alle Zahlen, Namen und Wörter, die ein Ergebnis tragen
// (Freilos, Zurückgezogen, Verlängerung …), in Lesereihenfolge, ohne die Beschriftungen drumherum. Sie bleibt gleich, wenn die Oberfläche neu gestaltet wird, und ändert sich, sobald eine Zahl,
// ein Platz, eine Paarung oder die Reihenfolge anders ist.

/** Zeilen ohne doppelten Leerraum; Zellen einer Tabellenzeile (Tab in `innerText`) mit „ | “ getrennt. */
export function pageLines(innerText: string): string[] {
  return innerText
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) =>
      line
        .split("\t")
        .map((cell) => cell.replace(/\s+/g, " ").trim())
        .join(" | ")
        .replace(/^( \| )+|( \| )+$/g, "")
        .trim()
    )
    .filter((line) => line.length > 0 && line !== "|")
}

const CREATED = /Erstellt: \d{2}\.\d{2}\.\d{4}/g

/**
 * PDF-Text (`pdftotext -layout`) ohne Erstelldatum und ohne die Adresse des Servers, der aufnimmt (`origin`, etwa
 * `http://localhost:3010`); die gedruckte URL bricht nach ihr um. Jede andere Adresse bleibt stehen: Druckt ein PDF den
 * falschen Server, zeigt der Vergleich das. Zeilenenden ohne Leerraum.
 */
export function normalizePdfText(text: string, origin: string): string[] {
  return text
    .replace(CREATED, "Erstellt: <Datum>")
    .split(origin)
    .join("<Server>")
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "")
    .split("\n")
}

const STARTER_ROW = /^\s+(\d+)\s{2,}(\S.*)$/

/**
 * Starterliste: Ringwerk lost die Startnummern bei jedem Abruf neu aus. Die Nummer jeder Zeile wird deshalb zu „<Nr>“;
 * dass die Nummern genau 1 bis n sind, steht als eigene Zeile darunter (sonst „Startnummern: … statt 1 bis n“).
 */
export function normalizeStarterNumbers(lines: readonly string[]): string[] {
  const numbers: number[] = []
  const result = lines.map((line) => {
    const row = STARTER_ROW.exec(line)
    if (!row) return line
    numbers.push(Number(row[1]))
    return `<Nr>  ${row[2]}`
  })
  const sorted = [...numbers].sort((a, b) => a - b)
  const complete = sorted.every((n, i) => n === i + 1)
  result.push(
    complete
      ? `Startnummern: 1 bis ${numbers.length}`
      : `Startnummern: ${sorted.join(", ")} statt 1 bis ${numbers.length}`
  )
  return result
}

export interface KnownNames {
  /** Namen von Teilnehmern als Vor- und Nachname */
  people: { firstName: string; lastName: string }[]
  /** Namen der Wettbewerbe, Konten und Disziplinen */
  other: string[]
}

/**
 * Wörter, die ein Ergebnis tragen: Ein Freilos, das als leerer Gegner erscheint, oder ein verlorener Rückzug ist ein
 * Fehler, keine andere Beschriftung. Groß und klein zählen gleich (Rundennamen stehen per CSS in Großbuchstaben).
 */
export const DATA_WORDS = [
  "Freilos",
  "Kampflos",
  "Zurückgezogen",
  "Zur.",
  "Unentschieden",
  "Verlängerung",
  "Stechschuss",
  "n. St.",
  "Ausstehend",
  "Gast",
  "offen",
  "ausgeglichen",
  "Abgeschlossen",
  "Archiviert",
  "Achtelfinale",
  "Viertelfinale",
  "Halbfinale",
  "Finale",
]

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/**
 * Baut die Erkennung der Datenfolge: Ein Teilnehmer zählt in beiden Schreibweisen („Olga Esche“ und „Esche, Olga“) als
 * dasselbe Zeichen, längere Namen gehen vor kürzeren (sonst fände „Ann Lech“ in „Ann Lechner“ einen Treffer).
 */
export function dataTokenizer(names: KnownNames): (lines: readonly string[]) => string[] {
  const canonical = new Map<string, string>()
  for (const p of names.people) {
    const name = `${p.firstName} ${p.lastName}`
    canonical.set(name, name)
    canonical.set(`${p.lastName}, ${p.firstName}`, name)
  }
  for (const other of names.other) canonical.set(other, other)
  for (const word of DATA_WORDS) canonical.set(word, word)
  const lookup = new Map([...canonical].map(([key, value]) => [key.toLowerCase(), value]))
  const alternatives = [...lookup.keys()].sort((a, b) => b.length - a.length).map(escape)
  // Zahlen mit Vorzeichen, Dezimalkomma, Datum, Uhrzeit und Verhältnis („5:4“); minus auch als U+2212. Nicht direkt
  // hinter einem Buchstaben oder einer Ziffer: „Best-of-3“ ist eine Beschriftung, kein „-3“
  const number = String.raw`(?<![\p{L}\p{N}])[+\-−]?\d+(?:[.,:]\d+)*%?`
  const pattern = new RegExp(
    `(?<![\\p{L}])(${alternatives.join("|")})(?![\\p{L}])|(${number})`,
    "giu"
  )
  return (lines) => {
    const tokens: string[] = []
    for (const line of lines) {
      for (const match of line.matchAll(pattern)) {
        if (match[1] !== undefined) tokens.push(lookup.get(match[1].toLowerCase())!)
        else tokens.push(match[2].replace("−", "-"))
      }
    }
    return tokens
  }
}
