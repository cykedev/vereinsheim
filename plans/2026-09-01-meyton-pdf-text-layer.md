# Plan: Meyton-PDF-Import auf eine echte PDF-Text-Layer umstellen

## Context (warum)

Der Meyton-Import in treffsicher bricht seit einem Meyton-Update mit
„Keine Meyton-Serien im PDF gefunden." ab. Ursache ist **gemessen**, nicht vermutet:

- Die neuen PDFs (`20260828_Training.PDF`, Creator „Meyton Elektronik GmbH", **Producer Qt 5.12.8**)
  zeichnen Text mit **Type0/Identity-H**-Fonts (subsettetes Roboto): **1274 `Tj`-Operatoren, davon
  1274 mit Hex-String (`<0001> Tj`, ein Glyph pro Operator), 0 Literal-Strings, 0 `TJ`-Arrays**.
- Der handgeschriebene Extractor in `pdfText.ts` kennt nur `(...) Tj` und `[...] TJ`
  ([pdfText.ts:90](../apps/treffsicher/src/lib/sessions/meyton-import/pdfText.ts:90) /
  [:95](../apps/treffsicher/src/lib/sessions/meyton-import/pdfText.ts:95)) → 0 Tokens → `""`.
- Verifiziert durch Ausführen des echten App-Codes gegen das PDF:
  `textLength: 0`, `series: { serien: [] }`, `date: null`, `hit: null`.
  → `parseMeytonSeriesFromText("")` liefert 0 Serien → Fehler in
  [meytonActions.ts:87](../apps/treffsicher/src/lib/sessions/actions/meytonActions.ts:87).

Die alten PDFs stammen aus einer **völlig anderen Toolchain**: `print_a6270d90-…pdf` ist von
**GPL Ghostscript 9.55.0** erzeugt und nutzt **Type1**-Fonts mit Literal-Strings. Es ist also kein
Versionssprung innerhalb eines Generators, sondern ein Wechsel des Druckpfads — ein weiterer Wechsel
ist jederzeit möglich. Beide Formate müssen künftig funktionieren (User-Vorgabe).

Den Extractor um einen Hex-Zweig zu erweitern reicht **nicht**. Am echten PDF nachgewiesen:

1. Die Bytes sind **Glyph-IDs, kein Text** — `<0001>` ist in `/F9` ein `S`, in `/F8` ein `L`, in `/F7`
   ein `i`. Es braucht die **ToUnicode-CMap des jeweils aktiven Fonts** (Objekte 17/23/29).
2. **Ein Glyph pro `Tj`** — das heutige `tokens.join("\n")` erzeugte eine Zeile pro Zeichen.
3. Positionen stecken in `Tm`/`Td` **plus** einem `q`/`Q`/`cm`-Matrix-Stack. Ohne Matrix-Nachführung
   landen alle Serienblöcke auf derselben y-Koordinate und verschmelzen (im Prototyp reproduziert).
4. **Die Schussnummern der Scheiben-Grafik liegen auf derselben Zeilenhöhe wie die Schusswerte.**
   Ohne Spaltentrennung über x liest der Parser z.B. die Zeile `63:8 | 77:9 | 114:9 | 128:8` als
   Schüsse `8, 9, 9, 8`. Das ist das eigentliche Risiko: **stille Falschdaten statt eines Fehlers.**

## Approach

`extractTextFromPdfBuffer` wird durch eine echte PDF-Text-Layer ersetzt: **unpdf 1.8.1**
(unjs, bündelt einen serverless-tauglichen pdf.js-Build). **Keine Runtime-Dependencies**, 2,5 MB,
pure ESM, kein Worker, kein `canvas`, keine nativen Module.

Der entscheidende Punkt: pdf.js dekodiert Identity-H **und** Literal-Strings — beide Formate laufen
über **einen** Codepfad, es gibt keine Formatunterscheidung im Code. „Beides können" heißt hier
nicht zwei Parser, sondern einer, der die Frage nicht mehr stellen muss.

Aus `page.getTextContent()` kommen Textitems mit `str` + `transform`; daraus wird der Text räumlich
rekonstruiert:

1. Items nach **y absteigend, x aufsteigend** sortieren (Lesereihenfolge).
2. Zu Zeilen gruppieren: neue Zeile, wenn `|y − ankerY| > 3`. **Anker ist die y des ersten
   Zeilenitems, kein laufender Mittelwert** — ein Mittelwert driftet über die vielen Grafik-Items und
   verschmilzt Folgezeilen (im Prototyp passiert: `Innenzehner:` + `Weiteste:` landeten in einer Zeile).
3. **Spaltenfilter:** die x-Position der `Serie n:`-Beschriftung ist die linke Kante der Datenspalte.
   Ab dem ersten `Serie n:`-Anker werden Items mit `x < ankerX − 8` verworfen; leer gewordene Zeilen
   entfallen ganz (nicht als Leerzeile emittieren — sonst bricht der Parser den Schussblock ab).

Das Ergebnis ist an **beiden** PDFs verifiziert. Neu:

```
Serie 1: 96.3 (92)
10.0 10.0 8.5 10.2 9.7
9.7 9.9 8.9 9.3 10.1
beste Teiler: 589.7 (4.), 663.4 (10.), 753.2 (2.)
```

Alt (identische Schusswerte wie der heutige Extractor liefert):

```
Serie 1: 90 (95.6)
8.7 9.8 9.7 9.4 9.4
10.8* 9.3 9.4 8.3 10.8*
```

`parseMeytonSeriesFromText`, `extractMeytonDateTime` und `extractMeytonHitLocation` bleiben
**unverändert** — sie bekommen weiter einen `string`. Die Umstellung ist damit auf die Extraktion
begrenzt, und die bestehenden Parser-Tests bleiben gültig.

**Verhaltensgleichheit am Alt-PDF ist geprüft:** Serien identisch, `date: null` (das Alt-PDF enthält
keinen Zeitstempel), `hitLocation: {1.39 LEFT, 2.44 HIGH}` — in beiden Reihenfolgen ist die erste
`Trefferlage:` die Gesamt-Trefferlage, nicht die einer Einzelserie.

### Verworfen: eigenen Extractor erweitern

Hätte ToUnicode-CMap-Parser, Content-Stream-Tokenizer und `q`/`Q`/`cm`-Matrix-Stack bedeutet
(~400–600 Zeilen, mehrere Module wegen der 220-Zeilen-Regel) — ein Mini-PDF-Interpreter als
Dauerwartungsfall, der beim nächsten Druckpfad-Wechsel erneut bricht. Vom User verworfen.

## Files to change

| Datei | Task | Änderung |
|-------|------|----------|
| [`apps/treffsicher/package.json`](../apps/treffsicher/package.json) | 1 | `"unpdf": "1.8.1"` als Dependency |
| `meyton-import/__fixtures__/` | 2 | zwei echte PDFs einchecken |
| [`meyton-import/constants.ts`](../apps/treffsicher/src/lib/sessions/meyton-import/constants.ts) | 3, 4 | `STOP_KEYWORDS` härten; DoS-Limits umstellen |
| `meyton-import/textLayout.ts` | 4 | **neu** — reine Zeilen-/Spaltenrekonstruktion |
| [`meyton-import/pdfText.ts`](../apps/treffsicher/src/lib/sessions/meyton-import/pdfText.ts) | 4 | Inhalt ersetzen: unpdf statt Eigenbau |
| [`meyton-import/pdfText.test.ts`](../apps/treffsicher/src/lib/sessions/meyton-import/pdfText.test.ts) | 4 | auf Fixtures umschreiben (synthetische PDFs entfallen) |
| [`meytonImport.test.ts`](../apps/treffsicher/src/lib/sessions/meytonImport.test.ts) | 4 | `extractTextFromPdfBuffer`-Block (Z. 226–246) + Helper ersetzen |
| [`actions/meytonActions.ts`](../apps/treffsicher/src/lib/sessions/actions/meytonActions.ts) | 5 | Fehlermeldung differenzieren |
| [`actions/meytonActions.test.ts`](../apps/treffsicher/src/lib/sessions/actions/meytonActions.test.ts) | 5 | Test für den neuen „kein Text"-Zweig |
| `meyton-import/textLayout.test.ts` | 6 | **neu** — Unit-Tests der Rekonstruktion |
| `meyton-import/meytonFixtures.test.ts` | 6 | **neu** — Integrationstest über beide PDFs |
| [`vault/apps/treffsicher/treffsicher-meyton-import.md`](../vault/apps/treffsicher/treffsicher-meyton-import.md) | 7 | Engine + neue Limits |
| `vault/incidents/meyton-pdf-format-change.md` | 7 | **neu** — Incident-Note |

Nicht angefasst: `importGuards.ts` (10-MB-Cap, `%PDF-`/`%%EOF`-Prüfung, SSRF-Guard bleiben wie sie
sind), `meytonPdfLoaders.ts`, `series.ts`, `dateTime.ts`, `hitLocation.ts`, `types.ts`, die UI.

**Task-Reihenfolge ist bindend** — sie ist so geschnitten, dass **jede** Task die fünf Gates grün
verlässt. Insbesondere müssen die Konstanten-Umstellung, der `pdfText.ts`-Rewrite und die beiden
Test-Umschreibungen in **einer** Task (4) liegen: die alten Tests prüfen genau den Mechanismus, der
dabei entfällt, und die alten Konstanten werden bis dahin noch importiert.

## Required Docs (vor Implementierung lesen)

- Vault: `treffsicher-meyton-import`, `treffsicher-dos-protection`, `treffsicher-modularity-rules`
  (220-Zeilen-Split-Regel), `treffsicher-server-actions`.
- `treffsicher-requirements#Meyton-PDF Import (Training/Wettkampf)` — insbesondere „nur textbasierte
  PDFs (kein OCR)", „harter Abbruch statt Teilimport", „Dekompressions- und Token-Limits gegen
  komprimierte Bomben-PDFs" (dieser Punkt wird durch Task 4 inhaltlich neu erfüllt).
- [`vault/conventions.md`](../vault/conventions.md) §8 — die fünf Gates, `next build` ist Pflicht.

---

## Tasks

### Task 1 — unpdf als Dependency aufnehmen

In `apps/treffsicher/package.json` unter `dependencies` ergänzen (alphabetisch nach `sonner`,
vor `zod`):

```json
"unpdf": "1.8.1",
```

**Exakt gepinnt, kein `^`** — abweichend von den anderen app-spezifischen Deps in dieser Datei.
Begründung: unpdf parst untrusted User-Input; ein stiller Minor-Bump innerhalb einer Caret-Range soll
nicht ohne sichtbaren Diff passieren (dieselbe Logik, die laut
[`pnpm-workspace.yaml`](../pnpm-workspace.yaml) für den Catalog gilt). **Nicht** in den Catalog —
der ist laut derselben Datei für Deps in *beiden* Apps; ringwerk braucht unpdf nicht.

Dann `pnpm install` (Lockfile-Sync mit committen).

**Verifikation:** `pnpm --filter treffsicher check-types` ist grün. Der Import type-checkt trotz der
`@napi-rs/canvas`-Typreferenz in unpdfs `.d.mts`, weil die geteilte tsconfig `skipLibCheck: true`
setzt — vorab geprüft.

### Task 2 — Echte PDFs als Fixtures einchecken

```bash
mkdir -p apps/treffsicher/src/lib/sessions/meyton-import/__fixtures__
cp /Users/christian/Downloads/20260828_Training.PDF \
   apps/treffsicher/src/lib/sessions/meyton-import/__fixtures__/meyton-qt-identity-h.pdf
cp /Users/christian/Downloads/print_a6270d90-4c35-41e1-9639-cbe1aa0e34ee.pdf \
   apps/treffsicher/src/lib/sessions/meyton-import/__fixtures__/meyton-ghostscript-type1.pdf
```

Die Namen benennen das **Format**, nicht das Datum — darum geht es beim Regressionsschutz.

**Datenschutz vorab geprüft:** beide PDFs enthalten keine Personennamen, nur `StandNr`, Klasse und
Ergebnisse; auch die XMP-/Info-Metadaten führen keinen Autor (`Title()` leer,
`CreatorTool: UnknownApplication`). Einchecken ist unbedenklich. Größen 39 KB + 29 KB, kein LFS nötig.

### Task 3 — `STOP_KEYWORDS` härten (zwei echte Latenz-Bugs)

In `constants.ts` die Liste ergänzen:

```ts
export const STOP_KEYWORDS = [
  "trefferlage",
  "trefferkreis",
  "streuwert",
  "ergebnis",
  "serien:",
  "zähler",
  "zaehler",
  "innenzehner",
  "weiteste",
  "teiler",
  "gedruckt am",
  "id:",
  "seite:",
]
```

Zwei belegte Lücken:

- **`"zaehler"` trifft nie.** Beide PDFs schreiben `Zähler:` mit Umlaut; der Vergleich läuft über
  `lower.includes(keyword)`. Die Zeile `Zähler: 18 16 6 0 0 0 0 0 0 0 0` besteht ausschließlich aus
  Werten im gültigen Schussbereich — landet sie je in einer Serien-Sektion, liest der Parser elf
  Phantom-Schüsse ein. Heute rettet nur die Reihenfolge im Dokument.
- **`"trefferkreis"` fehlt** — das Feld existiert nur im neuen Format.

Reine Ergänzung, kein bestehender Test hängt daran. `pnpm --filter treffsicher test` bleibt grün.

### Task 4 — Extraktion auf unpdf umstellen

Eine Task, vier Dateien — sie hängen zusammen (siehe Hinweis oben).

**4a — neue Datei `meyton-import/textLayout.ts`** (rein, ohne PDF-Kenntnis → gut testbar):

```ts
import { LINE_Y_TOLERANCE, SERIES_HEADER_REGEX } from "@/lib/sessions/meyton-import/constants"

export interface PdfTextItem {
  str: string
  x: number
  y: number
}

/**
 * Rekonstruiert Textzeilen aus positionierten PDF-Textitems.
 *
 * Meyton-PDFs setzen die Nummern der Scheiben-Grafik auf dieselbe Zeilenhoehe wie
 * die Schusswerte. Ohne Spaltenschnitt liest der Parser sie als Schuesse ein.
 * Als linke Kante der Datenspalte dient die x-Position der "Serie n:"-Beschriftung.
 */
export function buildTextLinesFromItems(items: PdfTextItem[], columnTolerance = 8): string[] {
  const sorted = items
    .map((item) => ({ ...item, str: item.str.trim() }))
    .filter((item) => item.str.length > 0)
    .sort((a, b) => b.y - a.y || a.x - b.x)

  const lines: { anchorY: number; items: PdfTextItem[] }[] = []
  for (const item of sorted) {
    const current = lines[lines.length - 1]
    // Anker ist die y des ersten Zeilenitems - ein laufender Mittelwert wuerde ueber
    // die vielen Grafik-Items driften und Folgezeilen verschlucken.
    if (current && Math.abs(current.anchorY - item.y) <= LINE_Y_TOLERANCE) {
      current.items.push(item)
    } else {
      lines.push({ anchorY: item.y, items: [item] })
    }
  }

  const result: string[] = []
  let columnX: number | null = null
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x)
    const anchor = line.items.find((item) => SERIES_HEADER_REGEX.test(item.str))
    if (anchor) columnX = anchor.x

    const edge = columnX
    const kept = edge === null ? line.items : line.items.filter((item) => item.x >= edge - columnTolerance)
    if (kept.length === 0) continue
    result.push(kept.map((item) => item.str).join(" "))
  }

  return result
}
```

`SERIES_HEADER_REGEX` ist nicht global (kein `/g`) → `.test()` ist zustandslos, Wiederverwendung ist
sicher. `edge` als lokale Konstante, damit TypeScript den Narrowing-Zustand in die Closure trägt
(kein `!`).

**4b — `constants.ts`: DoS-Limits umstellen.** Entfernen (beziehen sich auf die entfallene
Flate-Schleife):

```ts
export const MAX_INFLATED_STREAM_BYTES = 2 * 1024 * 1024
export const MAX_TOTAL_INFLATED_BYTES = 8 * 1024 * 1024
export const MAX_EXTRACTED_TEXT_TOKENS = 25_000
```

Ersetzen durch:

```ts
// Grenzen gegen praeparierte PDFs. Die Dekompressions-Caps von frueher sind mit
// pdf.js gegenstandslos - stattdessen begrenzen wir Seiten, Textmenge und Laufzeit.
export const MAX_PDF_PAGES = 20
export const MAX_EXTRACTED_TEXT_CHARS = 200_000
export const MAX_PDF_PARSE_MS = 15_000
export const LINE_Y_TOLERANCE = 3
```

Unverändert: `MAX_MEYTON_PDF_SIZE_BYTES` (10 MB), URL-Timeout (15 s), Redirect-Verbot, SSRF-Guard,
`validatePdfBuffer`.

**4c — `pdfText.ts` komplett ersetzen** (der gesamte bisherige Inhalt — Oktal-Decoder,
Literal-String-Regexes, Flate-Schleife — entfällt):

```ts
import { getDocumentProxy } from "unpdf"
import {
  MAX_EXTRACTED_TEXT_CHARS,
  MAX_PDF_PAGES,
  MAX_PDF_PARSE_MS,
} from "@/lib/sessions/meyton-import/constants"
import { buildTextLinesFromItems, type PdfTextItem } from "@/lib/sessions/meyton-import/textLayout"

async function extractItems(buffer: Buffer): Promise<PdfTextItem[]> {
  // Eigene Kopie: pdf.js uebernimmt das Uint8Array und kann es beim Parsen leeren.
  const pdf = await getDocumentProxy(new Uint8Array(buffer), {
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: false,
    maxImageSize: 1024 * 1024,
  })

  try {
    const items: PdfTextItem[] = []
    let totalChars = 0
    const pageCount = Math.min(pdf.numPages, MAX_PDF_PAGES)

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()

      for (const item of textContent.items) {
        if (!("str" in item) || typeof item.str !== "string") continue
        totalChars += item.str.length
        if (totalChars > MAX_EXTRACTED_TEXT_CHARS) return items
        items.push({ str: item.str, x: item.transform[4], y: item.transform[5] })
      }
    }

    return items
  } finally {
    await pdf.destroy()
  }
}

/**
 * Extrahiert den Text eines Meyton-PDFs in Lesereihenfolge.
 *
 * Deckt beide Meyton-Druckpfade ab: Ghostscript/Type1 (Literal-Strings) und
 * Qt/Type0-Identity-H (Hex-Glyph-IDs). pdf.js dekodiert beides, daher gibt es
 * hier bewusst keine Formatunterscheidung.
 */
export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  let timeoutHandle: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error("Zeitueberschreitung beim Lesen der PDF.")),
      MAX_PDF_PARSE_MS
    )
  })

  try {
    const items = await Promise.race([extractItems(buffer), timeout])
    return buildTextLinesFromItems(items).join("\n")
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  }
}
```

Signatur und Modulpfad bleiben gleich → das Barrel `meytonImport.ts` und `meytonActions.ts` brauchen
keine Änderung.

**4d — `pdfText.test.ts` ersetzen.** Die bisherigen Tests bauen PDFs aus einem einzelnen
Flate-Stream ohne `/Root` und ohne xref. pdf.js **weist die zurück** (vorab geprüft:
`InvalidPDFException - Invalid PDF structure.`) — sie sind mit der neuen Engine nicht mehr haltbar:

```ts
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { extractTextFromPdfBuffer } from "@/lib/sessions/meyton-import/pdfText"

const FIXTURES = join(__dirname, "__fixtures__")

describe("extractTextFromPdfBuffer", () => {
  it("liest das Qt/Identity-H-Format (Hex-Glyph-IDs)", async () => {
    const text = await extractTextFromPdfBuffer(readFileSync(join(FIXTURES, "meyton-qt-identity-h.pdf")))

    expect(text).toContain("Serie 1: 96.3 (92)")
    expect(text).toContain("10.0 10.0 8.5 10.2 9.7")
    expect(text).toContain("Trefferlage: 2.47 mm links, 2.11 mm hoch")
  })

  it("liest das Ghostscript/Type1-Format (Literal-Strings)", async () => {
    const text = await extractTextFromPdfBuffer(
      readFileSync(join(FIXTURES, "meyton-ghostscript-type1.pdf"))
    )

    expect(text).toContain("Serie 1: 90 (95.6)")
    expect(text).toContain("8.7 9.8 9.7 9.4 9.4")
  })

  it("wirft bei kaputter PDF-Struktur", async () => {
    await expect(
      extractTextFromPdfBuffer(Buffer.from("%PDF-1.4\nkein echtes PDF\n%%EOF", "latin1"))
    ).rejects.toThrow()
  })

  it("begrenzt die extrahierte Textmenge", async () => {
    // Ersetzt den frueheren Dekompressions-Cap-Test: die Bomben-Abwehr sitzt jetzt
    // auf Zeichen/Seiten/Laufzeit statt auf inflate-Groessen.
    const text = await extractTextFromPdfBuffer(readFileSync(join(FIXTURES, "meyton-qt-identity-h.pdf")))

    expect(text.length).toBeLessThan(200_000)
  })
})
```

Der Werfen-Fall ist eine **Verhaltensänderung**: bisher lieferte ein unlesbares PDF `""`. Das ist
korrekt so — `meytonActions.ts` fängt den Wurf bereits ab
([:77](../apps/treffsicher/src/lib/sessions/actions/meytonActions.ts:77)) und gibt die
Extraktionsfehlermeldung zurück. Task 5 deckt zusätzlich „gültiges PDF, aber kein Text" ab.

**4e — `meytonImport.test.ts` anpassen.** Diese Datei hat einen **zweiten** Block mit synthetischen
PDFs (Z. 226–246, `describe("extractTextFromPdfBuffer")`), inkl. des Tests
„ignoriert Streams mit uebermaessiger Dekompression" — der prüft exakt den entfallenden Mechanismus.

Zu tun: den kompletten `describe("extractTextFromPdfBuffer")`-Block **löschen** (er ist durch
`pdfText.test.ts` abgedeckt), dazu den nun ungenutzten Helper `buildPdfWithFlateStream` (Z. 10–27)
und den `deflateSync`-Import (Z. 2). Die Blöcke `parseMeytonSeriesFromText`, `extractMeytonDateTime`
und `extractMeytonHitLocation` bleiben unverändert — sie arbeiten auf Strings.

**Verifikation dieser Task:**

```bash
grep -rn "MAX_INFLATED_STREAM_BYTES\|MAX_TOTAL_INFLATED_BYTES\|MAX_EXTRACTED_TEXT_TOKENS\|deflateSync" apps/treffsicher/src
```

darf nichts mehr liefern.

### Task 5 — Fehlermeldung differenzieren

In `meytonActions.ts` nach der Extraktion (aktuell Zeile ~85) einfügen, **vor** dem
`parsedSeries`-Block:

```ts
  if (extractedText.trim().length === 0) {
    return {
      error:
        "Aus der PDF konnte kein Text gelesen werden (gescanntes Bild-PDF oder unbekanntes Format).",
    }
  }
```

Und die bestehende Meldung schärfen:

```ts
  if (parsedSeries.serien.length === 0) {
    return { error: 'Im PDF-Text wurden keine Meyton-Serien ("Serie 1:") gefunden.' }
  }
```

Genau diese Verwechslung — „kein Text" sah aus wie „keine Serien" — hat die Diagnose des jetzigen
Fehlers verschleiert.

**Test in `actions/meytonActions.test.ts`** ergänzen — direkt nach dem bestehenden Test
„liefert Fehler wenn keine Serien gefunden werden" (Z. 171–190) und exakt nach dessen Muster
gebaut (Helper `buildBaseFormData`, gestubbter `fetch`, beide Mocks sind vorhanden):

```ts
  it("meldet leeren PDF-Text getrennt von fehlenden Serien", async () => {
    getAuthSessionMock.mockResolvedValue({ user: { id: "user-1" } })
    findFirstMock.mockResolvedValue({ id: "disc-1", scoringType: "TENTH" })
    assertPublicImportTargetMock.mockResolvedValue(undefined)
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(Uint8Array.from([0x25, 0x50, 0x44, 0x46]), {
          status: 200,
          headers: { "content-type": "application/pdf", "content-length": "4" },
        })
      )
    )
    extractTextFromPdfBufferMock.mockResolvedValue("   ")

    const formData = buildBaseFormData("URL")
    formData.set("pdfUrl", "https://example.com/file.pdf")
    const result = await previewMeytonImportAction(formData)

    expect(result).toEqual({
      error:
        "Aus der PDF konnte kein Text gelesen werden (gescanntes Bild-PDF oder unbekanntes Format).",
    })
  })
```

Der Test darf `parseMeytonSeriesFromTextMock` bewusst **nicht** setzen — der neue Zweig muss vor dem
Parsen greifen. Zusätzlich die Erwartung im bestehenden Test bei Z. 189 auf den neuen Wortlaut
`'Im PDF-Text wurden keine Meyton-Serien ("Serie 1:") gefunden.'` ziehen.

### Task 6 — Regressionstests

**6a — `meyton-import/textLayout.test.ts` neu.** Ohne PDF, mit handgesetzten Items:

```ts
import { describe, expect, it } from "vitest"
import { buildTextLinesFromItems } from "@/lib/sessions/meyton-import/textLayout"

describe("buildTextLinesFromItems", () => {
  it("gruppiert nach y und sortiert Zeilen von oben nach unten", () => {
    const lines = buildTextLinesFromItems([
      { str: "unten", x: 10, y: 100 },
      { str: "b", x: 50, y: 200 },
      { str: "a", x: 10, y: 201 },
    ])

    expect(lines).toEqual(["a b", "unten"])
  })

  it("verwirft Grafik-Nummern links der Serie-Spalte", () => {
    const lines = buildTextLinesFromItems([
      { str: "Serie 1:", x: 154, y: 584 },
      { str: "96.3", x: 191, y: 584 },
      { str: "8", x: 95, y: 584 },
      { str: "10.0", x: 199, y: 572 },
      { str: "9.7", x: 512, y: 572 },
      { str: "9", x: 63, y: 552 },
      { str: "8", x: 128, y: 552 },
    ])

    // Die reine Grafik-Zeile (y=552) entfaellt komplett - sie darf nicht als
    // Leerzeile erscheinen, sonst bricht der Serien-Parser den Schussblock ab.
    expect(lines).toEqual(["Serie 1: 96.3", "10.0 9.7"])
  })

  it("filtert vor dem ersten Serie-Anker nicht", () => {
    const lines = buildTextLinesFromItems([{ str: "StandNr: 8", x: 57, y: 764 }])

    expect(lines).toEqual(["StandNr: 8"])
  })
})
```

**6b — `meyton-import/meytonFixtures.test.ts` neu.** Der eigentliche Regressionsschutz: die volle
Pipeline über beide Formate, mit den **exakt** erwarteten Werten (an beiden PDFs verifiziert):

```ts
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  extractMeytonDateTime,
  extractMeytonHitLocation,
  extractTextFromPdfBuffer,
  parseMeytonSeriesFromText,
} from "@/lib/sessions/meytonImport"

const FIXTURES = join(__dirname, "__fixtures__")

describe("Meyton-Import ueber beide PDF-Formate", () => {
  it("Qt/Identity-H: Serien, Datum und Trefferlage", async () => {
    const text = await extractTextFromPdfBuffer(readFileSync(join(FIXTURES, "meyton-qt-identity-h.pdf")))

    expect(parseMeytonSeriesFromText(text)).toEqual({
      serien: [
        { nr: 1, shots: [10, 10, 8.5, 10.2, 9.7, 9.7, 9.9, 8.9, 9.3, 10.1] },
        { nr: 2, shots: [9.4, 10.4, 10.1, 10.1, 10, 8.8, 9.4, 9.1, 10, 9.3] },
        { nr: 3, shots: [10.1, 9.7, 8.4, 9.6, 10.3, 9.8, 8.8, 10.5, 9.1, 9.4] },
        { nr: 4, shots: [10.1, 9.9, 10.6, 10.1, 10.4, 10.3, 9.8, 8.9, 10, 9.8] },
      ],
    })
    expect(extractMeytonDateTime(text)).toBe("2026-08-28T18:09")
    expect(extractMeytonHitLocation(text)).toEqual({
      horizontalMm: 2.47,
      horizontalDirection: "LEFT",
      verticalMm: 2.11,
      verticalDirection: "HIGH",
    })
  })

  it("Ghostscript/Type1: unveraendert gegenueber dem alten Extractor", async () => {
    const text = await extractTextFromPdfBuffer(
      readFileSync(join(FIXTURES, "meyton-ghostscript-type1.pdf"))
    )

    expect(parseMeytonSeriesFromText(text)).toEqual({
      serien: [
        { nr: 1, shots: [8.7, 9.8, 9.7, 9.4, 9.4, 10.8, 9.3, 9.4, 8.3, 10.8] },
        { nr: 2, shots: [7.1, 7.6, 10.5, 10.4, 8.9, 8.8, 8, 8.4, 10.6, 9.6] },
        { nr: 3, shots: [9.2, 10.2, 9.4, 10.3, 9.2, 7.5, 9.8, 10.4, 6.6, 10.5] },
        { nr: 4, shots: [6.7, 7.5, 7.3, 10.4, 9.3, 9, 9.6, 8.6, 9.6, 9.7] },
      ],
    })
    // Das Alt-PDF traegt keinen Zeitstempel.
    expect(extractMeytonDateTime(text)).toBeNull()
    expect(extractMeytonHitLocation(text)).toEqual({
      horizontalMm: 1.39,
      horizontalDirection: "LEFT",
      verticalMm: 2.44,
      verticalDirection: "HIGH",
    })
  })
})
```

Die Serien-Erwartung des Alt-PDFs ist **wörtlich die Ausgabe des heutigen Extractors** — damit ist
der Test der Beweis, dass die Umstellung am alten Format nichts verändert.

### Task 7 — Vault nachziehen

**7a** — `vault/apps/treffsicher/treffsicher-meyton-import.md`: TL;DR und Body auf die neue Engine
und die neuen Limits umstellen (unpdf/pdf.js; 10 MB/15 s URL, 20 Seiten, 200k Zeichen, 15 s
Parse-Timeout statt der Stream-/Token-Caps). `keywords:` um `pdf.js`, `unpdf`, `Identity-H`,
`Textextraktion` ergänzen.

**7b** — neue Incident-Note `vault/incidents/meyton-pdf-format-change.md`, Frontmatter nach
[`vault/SCHEMA.md`](../vault/SCHEMA.md), `relates_to: ["[[treffsicher-meyton-import]]"]`. Inhalt:
Meyton hat den Druckpfad von Ghostscript/Type1 auf Qt/Type0-Identity-H gewechselt; der
selbstgeschriebene Extractor kannte nur Literal-Strings; **die Lehre**: die Tests bauten ihre PDFs
selbst und konnten einen Formatwechsel der realen Quelle strukturell nicht bemerken — bei
Fremdformat-Importen gehören **echte** Beispieldateien als Fixture ins Repo.

> Diese Task berührt `vault/`, aber **nicht** `vault/decisions/` — sie läuft im autonomen
> `/implement` durch. Zur ADR-Frage siehe „Offen" unten.

---

## Test steps

```bash
pnpm --filter treffsicher test
pnpm --filter treffsicher lint
pnpm --filter treffsicher check-types
pnpm --filter treffsicher format:check
pnpm --filter treffsicher build
```

Danach manuell gegen die laufende App (Dev auf Port 3001):

1. `docker compose -f docker-compose.dev.yml up -d && pnpm dev`
2. Neue Einheit → Typ Training, Disziplin mit **Zehntelwertung** → Meyton-Import → Upload
   `20260828_Training.PDF` → Vorschau muss 4 Serien à 10 Schuss zeigen, Serie 1 beginnend
   `10.0 10.0 8.5 10.2 9.7`, Datum `28.08.2026 18:09` vorbelegt, Trefferlage `2.47 mm links /
   2.11 mm hoch`.
3. Gleiches PDF auf eine Disziplin mit **Ganzringwertung** → Werte per Floor ganzzahlig
   (`10 10 8 10 9 …`).
4. Upload `print_a6270d90-…pdf` → 4 Serien, Serie 1 `8.7 9.8 9.7 9.4 9.4 10.8 9.3 9.4 8.3 10.8`,
   **kein** Datum vorbelegt, Trefferlage `1.39 mm links / 2.44 mm hoch`.
5. Beliebiges Nicht-Meyton-PDF (z.B. eine ringwerk-Startliste) hochladen → die **neue**,
   differenzierte Meldung erscheint.

## Verification

- [ ] Alle fünf Gates grün.
- [ ] `meytonFixtures.test.ts` grün — beide Formate, exakte Werte.
- [ ] Alt-Format liefert **bit-identische** Serienwerte wie vor der Umstellung (Task 6b).
- [ ] Keine Referenzen mehr auf die entfernten Konstanten / `deflateSync` (grep aus Task 4).
- [ ] `pnpm --filter treffsicher build` erzeugt einen lauffähigen Standalone-Output **inklusive**
      unpdf — nach dem Build prüfen:
      `ls apps/treffsicher/.next/standalone/node_modules/.pnpm | grep unpdf`
      (Next tract die Dependency über `outputFileTracingRoot`; fehlt sie, muss `unpdf` in
      `packages/config/next/index.mjs` unter `serverExternalPackages` — dann aber bewusst, weil die
      Datei von **beiden** Apps geteilt wird).
- [ ] Manuelle Schritte 2–5 bestätigt.

## Offen (nach dem Merge, mit dem User)

**ADR?** Das Ersetzen eines selbstgeschriebenen Parsers durch eine externe Bibliothek ist
architekturrelevant. `vault/decisions/` ist ein vom `autopilot-guard` geschützter Pfad — eine ADR
kann im autonomen `/implement` nicht geschrieben werden (siehe Vault-Note
`autopilot-guard-blocks-contract-only-plans`). Deshalb bewusst **nicht** als Task eingeplant: nach dem
Merge klären, ob eine kurze ADR („Fremdformat-Parsing nicht selbst bauen") gerechtfertigt ist oder ob
die Incident-Note aus Task 7b reicht.
