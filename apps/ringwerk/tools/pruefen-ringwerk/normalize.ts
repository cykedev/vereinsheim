// Text einer Seite und eines PDFs für den Vergleich vorher und nachher. Herausgenommen wird, was je Lauf wechselt: das
// Erstelldatum im Kopf der PDFs und die Adresse des Servers in der gedruckten öffentlichen URL. Der Inhalt des QR-Codes
// (mit Zugangs-Token) steht nicht im Text; er ist ein Pfad im PDF und zählt nur im Bild.
//
// Aus dem Text einer Seite entsteht zusätzlich die Datenfolge: alle Zahlen und Namen in Lesereihenfolge, ohne die
// Beschriftungen drumherum. Sie bleibt gleich, wenn die Oberfläche neu gestaltet wird, und ändert sich, sobald eine Zahl,
// ein Platz, eine Paarung oder die Reihenfolge anders ist.

/** Zeilen ohne doppelten Leerraum; Zellen einer Tabellenzeile (Tab in `innerText`) mit „ | “ getrennt. */
export function pageLines(innerText: string): string[] {
  return innerText
    .replace(/ /g, " ")
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
// die gedruckte URL bricht das PDF nach dem Server um; der lokale Server steht dann allein in einer Zeile
const ORIGIN =
  /https?:\/\/(?:(?:localhost|127\.0\.0\.1)(?::\d{1,5})?|[a-z0-9.-]+(?::\d{1,5})?(?=\/api\/public\/c\/))/gi

/** PDF-Text (`pdftotext -layout`) ohne Erstelldatum und Server-Adresse; Zeilenenden ohne Leerraum. */
export function normalizePdfText(text: string): string[] {
  return text
    .replace(CREATED, "Erstellt: <Datum>")
    .replace(ORIGIN, "<Server>")
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
  /** Namen der Wettbewerbe und Teams */
  other: string[]
}

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
  const alternatives = [...canonical.keys()].sort((a, b) => b.length - a.length).map(escape)
  // Zahlen mit Vorzeichen, Dezimalkomma, Datum, Uhrzeit und Verhältnis („5:4“); minus auch als U+2212
  const number = String.raw`[+\-−]?\d+(?:[.,:]\d+)*%?`
  const pattern = new RegExp(
    alternatives.length > 0
      ? `(?<![\\p{L}])(${alternatives.join("|")})(?![\\p{L}])|(${number})`
      : `(${number})`,
    "gu"
  )
  return (lines) => {
    const tokens: string[] = []
    for (const line of lines) {
      for (const match of line.matchAll(pattern)) {
        if (alternatives.length > 0 && match[1] !== undefined) tokens.push(canonical.get(match[1])!)
        else tokens.push((match[2] ?? match[1]).replace("−", "-"))
      }
    }
    return tokens
  }
}
