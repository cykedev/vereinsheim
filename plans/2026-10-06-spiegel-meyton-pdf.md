# Plan: SP-1.3 Meyton-PDF: ID und Druckzeit

- **Roadmap:** `vault/spiegel/spiegel-roadmap.md`, SP-1.3
- **Entscheidung:** ADR-028, Änderung vom 6. Oktober 2026 (QR-Weg ohne Layout-Abhängigkeit)
- **Branch:** `feat/spiegel-meyton-pdf`
- **Datum:** 2026-10-06

## 1. Context (warum)

Der QR-Code des Meyton-Ausdrucks führt auf ein PDF. Für die Zuordnung braucht Spiegel daraus nur
zwei Dinge: die **ID im Fuß** (`ID: ff914420`, vermutlich die ScheibenID als vorzeichenbehaftete
32-Bit-Zahl) und die **Erstellzeit** aus den Metadaten. Beides muss unabhängig vom Layout lesbar sein,
denn Meyton hat das Format schon einmal geändert (SF-46, `meyton-pdf-format-change`). Werte und
Identität kommen später aus der SSMDB2; ein Layout-Parser kommt erst mit SP-2.6 für fremde Anlagen.

Befund aus drei echten PDFs (zwei Treffsicher-Fixtures, ein Ausdruck vom 2. Oktober, nur lokal
geprüft):

| PDF | Fußzeile, wie pdf.js sie liefert | Info `CreationDate` | XMP `xmp:CreateDate` |
|---|---|---|---|
| Qt (Fixture) | ein Textstück `ID: 46a13c20 - Seite: 1` | `D:20260828181127+02'00'` | keins |
| Ghostscript (Fixture) | ein Textstück `ID: ed850812 − Seite: 1` (echtes Minus) | `D:20260811182954+02'00'` | `2026-08-11T18:29:54+02:00` |
| Ausdruck 2. Oktober (Qt) | ein Textstück `ID: ff914420 - Seite: 1` | `D:20261002195212+02'00'` | keins |

Dazu: pdf.js übernimmt den übergebenen Puffer und leert ihn (gemessen: danach 0 Bytes), deshalb
bekommt es eine Kopie. Echte Ausdrucke sind 29–43 KB groß.

## 2. Entscheidungen

- **E1 Paket** `packages/meyton-pdf` (`@vereinsheim/meyton-pdf`), Just-in-time wie `shot-core`, mit
  `unpdf` in derselben festen Version wie Treffsicher (`1.8.1`). Ein Katalog-Eintrag folgt mit
  SP-2.6, wenn Treffsicher das Paket nutzt; Treffsicher bleibt jetzt unberührt.
- **E2 Nur ID und Erstellzeit**, dazu Seitenzahl, `Producer` und `Creator` als Hinweis auf den
  Druckweg. Kein Wissen über Positionen, Spalten oder Beschriftungen außer dem Muster `ID:`.
- **E3 ID-Muster:** `ID:` ohne Buchstabe oder Ziffer davor (so trifft `DisziplinID:` nicht), dann
  genau acht Hex-Zeichen, danach kein Buchstabe und keine Ziffer. Zwischen den Zeichen ist je ein
  Leerzeichen erlaubt, weil Qt jedes Glyph einzeln setzt und pdf.js nicht immer zusammenfasst.
  Gesucht wird auf **allen Seiten** (SF-44). Ergebnis: `found` (mit Seiten), `missing` oder
  `conflict` (mehrere verschiedene IDs); es wird nie geraten. Dekodiert als vorzeichenbehaftete
  32-Bit-Zahl, Hex klein geschrieben.
- **E4 Erstellzeit:** zuerst `CreationDate` aus dem Info-Dict (PDF-Datumsformat
  `D:YYYYMMDDHHmmSSOHH'mm'`, Teile ab dem Monat optional), sonst `xmp:CreateDate` (ISO 8601).
  `ModDate` bleibt außen vor (beim Qt-Fixture später als die Erstellung). Ergebnis: Ortszeit als
  Text, Versatz in Minuten, absoluter Zeitpunkt; **ohne Zeitzone kein absoluter Zeitpunkt**, der
  Aufrufer entscheidet dann (etwa die Vereinszeitzone). Ungültige Daten (Monat 13, 30. Februar,
  Stunde 24, Versatz über 14 h) ergeben „keine Zeit“.
- **E5 Grenzen (SF-48)**, alle während des Parsens gegen eine Uhr geprüft wie in Treffsicher (ein
  präpariertes PDF blockiert den Event-Loop, Timer feuern dann nicht): 1 MiB, 10 Seiten, 20 000
  Textstücke, 100 000 Zeichen, 5 s. `%PDF-` muss in den ersten 1024 Bytes stehen. Text wird gestreamt
  (`streamTextContent`), nicht am Stück geholt. Grenzen und Uhr sind für Tests als Option setzbar.
- **E6 Fehler:** Grenzen, „kein PDF“ und „unlesbar“ werfen `MeytonPdfError` mit einer Meldung, die
  der Nutzer sehen darf; pdf.js-Interna gehen nie nach außen. Fehlende ID oder Zeit sind **kein**
  Fehler, sondern ein sauberes „nicht gefunden“ im Ergebnis.
- **E7 Tests nur mit synthetischen PDFs** aus einem Generator im Paket: Type1 mit Literal-Strings
  (wie Ghostscript), Type0/Identity-H mit ToUnicode und einem Glyph je `Tj` (wie Qt), Info-Dict und
  XMP, mehrere Seiten, frei positionierter Text. Keine Namen. Echte PDFs nur lokal in der Validierung
  (ADR-029). Der Generator nutzt `CompressionStream` statt `node:zlib`, damit das Paket ohne
  Node-Typen auskommt.
- **E8 Exporte:** `./printout` (liest PDF-Bytes, braucht pdf.js), `./printout-id` und `./pdf-date`
  (rein, ohne pdf.js, auch im Browser nutzbar).
- **E9 Nicht in SP-1.3:** Download, Prüfung der QR-Adresse (SF-47), Speichern des PDFs, Vorschau der
  Brücke. Das kommt mit dem QR-Weg (SP-1.7).

## 3. Dateien

Neu:

- `packages/meyton-pdf/package.json`, `tsconfig.json`, `vitest.config.ts`, `CLAUDE.md`
- `packages/meyton-pdf/src/errors.ts`: `MeytonPdfError`
- `packages/meyton-pdf/src/limits.ts`: `PrintoutLimits`, `DEFAULT_LIMITS`
- `packages/meyton-pdf/src/pdfDate.ts` + `pdfDate.test.ts`: `parsePdfDate`, `parseXmpDate`, `PdfDate`
- `packages/meyton-pdf/src/printoutId.ts` + `printoutId.test.ts`: `decodePrintoutId`,
  `findPrintoutId`, `PrintoutIdResult`
- `packages/meyton-pdf/src/__fixtures__/buildPdf.ts`: Generator für Test-PDFs
- `packages/meyton-pdf/src/printout.ts` + `printout.test.ts`: `readPrintout`, `Printout`

Geändert:

- `pnpm-lock.yaml` (neuer Importer, sonst nichts)
- `vault/meyton/meyton-printout.md` (Abschnitt „Lesen in Spiegel“), `vault/spiegel/spiegel-roadmap.md`
  (SP-1.3 erledigt), `vault/architecture/architecture.md` (Repo-Karte)

## Required Docs

- `vault/conventions.md` (§8 Gates, §9 Mutation und `toBeCloseTo`/null)
- `vault/decisions/adr-028.md` (Änderung vom 6. Oktober), `vault/decisions/adr-029.md` (keine echten
  PDFs im Repo)
- `vault/meyton/meyton-printout.md`, `vault/spiegel/spiegel-edge-cases.md` (SF-41 bis SF-48)
- `vault/apps/treffsicher/treffsicher-meyton-import.md` und
  `apps/treffsicher/src/lib/sessions/meyton-import/pdfText.ts` (Grenzen, Streaming, `destroy()`)
- `packages/shot-core/CLAUDE.md` (Vorbild für Paket und Scope-Notiz)

## 4. Tasks

### Task 1: Paket anlegen

- `package.json` wie `shot-core` (`private`, `type: module`, Skripte `check-types`, `test`,
  `format:check`, `format`; `prettier` aus `@vereinsheim/config/prettier`), Exporte:
  ```json
  "exports": {
    "./printout": "./src/printout.ts",
    "./printout-id": "./src/printoutId.ts",
    "./pdf-date": "./src/pdfDate.ts"
  },
  "dependencies": { "unpdf": "1.8.1" },
  "devDependencies": { "@vereinsheim/config": "workspace:*", "prettier": "catalog:",
                       "typescript": "catalog:", "vitest": "catalog:" }
  ```
  Bis die Dateien in Task 2–5 entstehen, zeigen die Exporte ins Leere; das prüft kein Gate.
- `tsconfig.json` und `vitest.config.ts` wie `shot-core` (`types: []`, `environment: "node"`,
  `passWithNoTests: true`).
- `src/errors.ts`:
  ```ts
  /** Fehler mit einer Meldung, die der Nutzer sehen darf; pdf.js-Interna bleiben drin. */
  export class MeytonPdfError extends Error { constructor(message: string) { super(message); this.name = "MeytonPdfError" } }
  ```
- `src/limits.ts`:
  ```ts
  export interface PrintoutLimits { maxBytes: number; maxPages: number; maxTextItems: number; maxChars: number; maxParseMs: number }
  export const DEFAULT_LIMITS: Readonly<PrintoutLimits> = Object.freeze({
    maxBytes: 1024 * 1024, maxPages: 10, maxTextItems: 20_000, maxChars: 100_000, maxParseMs: 5_000,
  })
  ```
- `pnpm install`, danach `pnpm install --frozen-lockfile` (conventions §9). Lockfile-Diff prüfen: nur
  der Importer `packages/meyton-pdf`.
- Gate: `pnpm check`. Commit `chore(meyton-pdf): add the package`.

### Task 2: Datum aus den Metadaten (`pdfDate.ts`, test-first)

```ts
export interface PdfDate {
  /** Ortszeit wie im PDF: "2026-10-02T19:52:12" */
  local: string
  /** Versatz zu UTC in Minuten (+120 für +02:00); null, wenn das PDF keinen nennt */
  offsetMinutes: number | null
  /** absoluter Zeitpunkt; null ohne Versatz */
  epochMs: number | null
}
export function parsePdfDate(raw: string): PdfDate | null
export function parseXmpDate(raw: string): PdfDate | null
```

- `parsePdfDate`: `^(?:D:)?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?(?:([Zz+-])(?:(\d{2})'?(?:(\d{2})'?)?)?)?$`
  nach `trim()`; fehlende Teile wie in der Norm (Monat und Tag 01, Uhrzeit 00). `Z` ist Versatz 0.
- `parseXmpDate`: `^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?)?)?(Z|[+-]\d{2}:\d{2})?$`;
  Sekundenbruchteile fallen weg; ohne Uhrzeit kein Versatz.
- Beide prüfen Bereiche (Monat 1–12, Tag bis Monatsende mit Schaltjahr, Stunde 0–23, Minute und
  Sekunde 0–59, Versatz −12:00 bis +14:00) und geben sonst `null`.
- `epochMs = Date.UTC(j, m − 1, t, h, min, s) − offsetMinutes · 60 000`.

Tests (`pdfDate.test.ts`), erst rot, dann grün:

| Eingabe | Erwartung |
|---|---|
| `D:20261002195212+02'00'` | `2026-10-02T19:52:12`, 120, `1790963532000` |
| `D:20261002195212+02'00` und `20261002195212+02'00'` | wie oben |
| `D:20261002195212Z` | Versatz 0, `Date.UTC(2026, 9, 2, 19, 52, 12)` |
| `D:20261002195212-05'30'` | Versatz −330, `1790990532000` |
| `D:20261002195212` | Versatz `null`, `epochMs` `null` |
| `D:2026` | `2026-01-01T00:00:00`, Versatz `null` |
| `D:20261302195212+02'00'`, `D:20260230120000Z`, `D:20261002245212Z`, `D:20261002195212+15'00'`, `Meyton`, `""` | `null` |
| `D:20240229120000Z` | gültig (Schaltjahr) |
| XMP `2026-08-11T18:29:54+02:00` | `2026-08-11T18:29:54`, 120, `1786465794000` |
| XMP `2026-08-11T18:29:54.123Z` | Versatz 0, Bruchteil weg |
| XMP `2026-08-11` | `2026-08-11T00:00:00`, Versatz `null` |
| XMP `2026-13-01T00:00:00Z` | `null` |

Commit `feat(meyton-pdf): parse PDF and XMP dates`.

### Task 3: ID im Fuß (`printoutId.ts`, test-first)

```ts
export type PrintoutIdResult =
  | { kind: "found"; hex: string; value: number; pages: number[] }
  | { kind: "missing" }
  | { kind: "conflict"; hexes: string[] }
/** acht Hex-Zeichen als vorzeichenbehaftete 32-Bit-Zahl; RangeError bei anderem Format */
export function decodePrintoutId(hex: string): number
/** sucht auf allen Seiten (Text je Seite, Seiten 1-basiert) */
export function findPrintoutId(pageTexts: readonly string[]): PrintoutIdResult
```

- Muster: `/(?<![0-9A-Za-z])I\s?D\s?:\s*((?:[0-9A-Fa-f]\s?){7}[0-9A-Fa-f])(?![0-9A-Za-z])/g`;
  Leerzeichen aus dem Treffer entfernen, klein schreiben.
- `decodePrintoutId`: `parseInt(hex, 16)`, ab `0x80000000` minus `2^32`.
- Mehrere Treffer derselben ID auf einer oder mehreren Seiten: `found` mit allen Seiten, aufsteigend;
  verschiedene IDs: `conflict` mit allen, sortiert.

Tests (`printoutId.test.ts`):

- Dekodieren: `ff914420` → −7257056, `46a13c20` → 1184971808, `ed850812` → −310048750,
  `80000000` → −2147483648, `7fffffff` → 2147483647, `00000000` → 0, `ffffffff` → −1,
  `FF914420` → −7257056; `ff91442`, `ff9144200`, `gg914420` → `RangeError`.
- Finden: `ID: ff914420 - Seite: 1` → found, Seiten `[1]`; `ID: ED850812 − Seite: 1` → `ed850812`;
  einzeln gesetzte Glyphen `I D :  f f 9 1 4 4 2 0` → `ff914420`; dieselbe ID auf drei Seiten →
  Seiten `[1, 2, 3]`; nur auf Seite 3 → `[3]` (SF-44); `DisziplinID: 19210040` → missing;
  `ID: ff9144201` (neun Zeichen) → missing; `ID: ff914420x` → missing; `Ausdruck-ID: 46a13c20` →
  found; zwei verschiedene IDs → conflict `["46a13c20", "ff914420"]`; leere Seiten → missing.

Commit `feat(meyton-pdf): find and decode the printout ID`.

### Task 4: Generator für Test-PDFs (`src/__fixtures__/buildPdf.ts`)

```ts
export interface TestText { str: string; x: number; y: number; size?: number }
export interface TestPdf {
  pages: TestText[][]
  /** "type1": Literal-Strings mit Helvetica (wie Ghostscript); "identity-h": Type0 mit ToUnicode, ein Glyph je Tj (wie Qt) */
  font?: "type1" | "identity-h"
  /** Abstand zwischen einzeln gesetzten Glyphen in Em (identity-h); 0,5 = lückenlos */
  glyphAdvance?: number
  /** Info-Dict, etwa { CreationDate: "D:20261002195212+02'00'", Producer: "Qt 5.12.8" }; null = keins */
  info?: Record<string, string> | null
  /** XMP-Strom mit <xmp:CreateDate> als Element */
  xmpCreateDate?: string
}
export async function buildPdf(spec: TestPdf): Promise<Uint8Array>
```

- Objekte: Catalog (mit `/Metadata`, wenn XMP), Pages, Font (Type1 Helvetica oder Type0
  `/Encoding/Identity-H` mit CIDFontType2-Nachfahre, FontDescriptor und ToUnicode-CMap mit
  `bfchar` je verwendetem Zeichen), je Seite Page und Contents (Deflate über
  `CompressionStream("deflate")`), Info-Dict im Trailer, xref mit echten Offsets.
- Text: `type1` setzt je Textstück `1 0 0 1 x y Tm (…) Tj` (Latin-1, Klammern und Backslash
  escaped); `identity-h` setzt jedes Zeichen einzeln als `<cid> Tj` mit eigenem `Tm`, Vorschub
  `glyphAdvance · size`.
- Rauchtest in `printout.test.ts` (Task 5) belegt, dass pdf.js beide Wege liest.

Commit mit Task 5.

### Task 5: PDF lesen (`printout.ts`, test-first)

```ts
export interface Printout {
  pages: number
  id: PrintoutIdResult
  /** Erstellzeit; null ohne lesbare Metadaten */
  createdAt: (PdfDate & { source: "info" | "xmp" }) | null
  producer: string | null
  creator: string | null
}
export interface ReadOptions { limits?: Partial<PrintoutLimits>; now?: () => number }
export async function readPrintout(bytes: Uint8Array, options?: ReadOptions): Promise<Printout>
```

Ablauf:

1. `bytes.length > maxBytes` → `MeytonPdfError("Die PDF-Datei ist größer als 1 MB.")` (Zahl aus
   der Grenze); `%PDF-` nicht in den ersten 1024 Bytes → `MeytonPdfError("Das ist keine PDF-Datei.")`.
2. `getDocumentProxy(new Uint8Array(bytes), { disableFontFace: true, useSystemFonts: false,
   stopAtErrors: false, maxImageSize: 1024 * 1024 })`; wirft es → `MeytonPdfError("Die PDF-Datei
   ist beschädigt oder nicht lesbar.")`.
3. Zeit prüfen; `numPages > maxPages` → `MeytonPdfError`.
4. `getMeta(pdf)`: `info.CreationDate` (nur Strings) → `parsePdfDate`; sonst, wenn
   `metadata.get` eine Funktion ist, `metadata.get("xmp:createdate")` → `parseXmpDate`.
   `Producer`/`Creator` als Text, auf 200 Zeichen gekürzt, sonst `null`.
5. Je Seite `streamTextContent()` lesen, Textstücke mit `" "` verbinden; vor jedem Lesen die Zeit,
   nach jedem Stück die Zahl der Stücke und Zeichen prüfen (Grenzen → `MeytonPdfError`).
6. `findPrintoutId(pageTexts)`.
7. `finally`: `pdf.loadingTask.destroy()`.

Tests (`printout.test.ts`), alle mit `buildPdf`:

| Fall | Erwartung |
|---|---|
| Qt-Weg: `identity-h`, Fuß `ID: ff914420 - Seite: 1` bei (258, 26), Info wie der Ausdruck (Qt 5.12.8, Meyton Elektronik GmbH, `D:20261002195212+02'00'`) | found `ff914420`/−7257056, Seiten `[1]`; `createdAt` 120 min, `1790963532000`, Quelle `info`; Producer `Qt 5.12.8` |
| Ghostscript-Weg: `type1`, `ID: ed850812 - Seite: 1`, Info `D:20260811182954+02'00'` und XMP | found `ed850812`/−310048750; Zeit aus `info` |
| nur XMP `2026-08-11T18:29:54+02:00` | Zeit aus `xmp`, `1786465794000` |
| abgewandeltes Layout: Fuß oben, Schrift 14, andere Texte, `DisziplinID: 19210040` und `Ausdruck-ID: 46a13c20` | found `46a13c20`/1184971808 |
| einzeln gesetzte Glyphen mit Lücke (`glyphAdvance: 1.2`) | found `ff914420` |
| drei Seiten, ID überall | Seiten `[1, 2, 3]`, `pages` 3 |
| ID nur auf Seite 3 (SF-44) | Seiten `[3]` |
| zwei verschiedene IDs | `conflict` |
| Probe-Ausdruck (Kopf „Probe“, nur Probeschüsse, Fuß mit ID) | found |
| ohne ID | `missing`, Zeit trotzdem da |
| ohne Info und XMP | `createdAt` `null`, `producer` `null`, ID trotzdem da |
| Info-Datum ohne Zeitzone | `offsetMinutes` `null`, `epochMs` `null` |
| 1 MiB + 1 Byte (beginnt mit `%PDF-`) | `MeytonPdfError` „größer als 1 MB“, ohne pdf.js |
| `Hallo` als Bytes | `MeytonPdfError` „keine PDF-Datei“ |
| 11 Seiten | `MeytonPdfError` „mehr als 10 Seiten“ |
| `maxTextItems: 50` und eine Seite mit 60 Stücken | `MeytonPdfError` „zu viel Text“ |
| `now` springt je Aufruf um 10 s | `MeytonPdfError` „Zeitüberschreitung“ |
| `%PDF-1.4` und Datenmüll | `MeytonPdfError` „beschädigt oder nicht lesbar“ |
| Eingabepuffer nach dem Lesen | unverändert (Länge und Inhalt) |

Gate, Commit `feat(meyton-pdf): read the printout ID and creation time`.

### Task 6: Dokumentation

- `packages/meyton-pdf/CLAUDE.md`: Zweck, Exporte, Regeln (nur ID und Erstellzeit, kein Layout;
  Grenzen während des Parsens; Kopie an pdf.js; keine echten PDFs im Paket; Muster und Dekodierung
  nur mit Test ändern).
- `vault/meyton/meyton-printout.md`: Abschnitt „Lesen in Spiegel“ (Befundtabelle aus 1., Muster,
  Datumsquellen, Grenzen, Ergebnisse `found`/`missing`/`conflict`); `keywords` ergänzen.
- `vault/spiegel/spiegel-roadmap.md`: SP-1.3 **Status:** erledigt (Oktober 2026, `packages/meyton-pdf`).
- `vault/architecture/architecture.md`: Zeile `packages/meyton-pdf/` in der Repo-Karte.
- `node .claude/vault-lint.mjs`, Gate, Commit `docs(spiegel): document reading the printout ID`.

## 5. Verification

1. `pnpm check` grün; Zahl der Tests im Bericht.
2. **Mutationsprobe** (conventions §9), je einspielen, rot beobachten, zurücknehmen: Vorzeichen nicht
   gewickelt; Lookbehind entfernt (`DisziplinID` trifft); nur Seite 1 durchsucht; erste ID gewinnt
   statt `conflict`; Versatz-Vorzeichen vertauscht; fehlende Zeitzone als UTC; XMP-Rückfall
   entfernt; 30. Februar erlaubt; Größengrenze entfernt; Seitengrenze entfernt; Zeitprüfung im
   Seitenlauf entfernt; Kopie des Puffers entfernt.
3. **Echte Formate, nur lokal:** `readPrintout` auf die beiden Treffsicher-Fixtures und den Ausdruck
   vom 2. Oktober (Scratchpad); ausgegeben werden nur ID, Zeit, Producer und Seitenzahl. Erwartet:
   `46a13c20`/1184971808 mit `1787933487000`; `ed850812`/−310048750 mit `1786465794000`;
   `ff914420`/−7257056 mit `1790963532000`.
4. Lockfile-Diff: nur der neue Importer; die Importer der Apps unverändert.
5. `git diff main --stat`: `packages/meyton-pdf`, `pnpm-lock.yaml`, der Plan, drei Vault-Notizen.
6. **Spielwiese:** Bereich „Meyton-PDF lesen“: eine PDF-Datei ablegen, Anzeige von ID, ScheibenID
   (dezimal), Druckzeit und Druckweg. Die Datei bleibt im Browser. Klappt das Bündeln von pdf.js ins
   Artifact nicht, steht das im Bericht.
