# @vereinsheim/meyton-pdf — Claude Scope-Notiz

Liest Meyton-Ausdrucke (PDF) für Spiegel. Für die Zuordnung per QR zählen nur
zwei Dinge, beide unabhängig vom Layout (ADR-028, Änderung vom 6. Oktober 2026): die **ID im Fuß**
(`ID: ff914420`, vermutlich die ScheibenID als vorzeichenbehaftete 32-Bit-Zahl) und die
**Erstellzeit** aus den Metadaten. Ein vollständiger Parser für fremde Anlagen, in den auch die Parser aus
Treffsicher und Ringwerk ziehen sollen, ist offen (`vault/spiegel/spiegel-roadmap.md`, SP-2.6). Spiegel nutzt `printout-id` und liest `printout` nur im Kindprozess
(`apps/spiegel/src/lib/printouts/reader.ts`).
Fachwissen: `vault/meyton/meyton-printout.md`, Sonderfälle SF-41 bis SF-48 in
`vault/spiegel/spiegel-edge-cases.md`.

## Exporte

| Export                                  | Datei                             | Inhalt                                                                                                       |
| --------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `@vereinsheim/meyton-pdf/printout`      | `src/printout.ts`                 | `readPrintout`, `preloadPdfjs` (brauchen pdf.js), `MeytonPdfError`, Grenzen                                  |
| `@vereinsheim/meyton-pdf/printout-id`   | `src/printoutId.ts`               | `findPrintoutId`, `decodePrintoutId` (rein, auch im Browser)                                                 |
| `@vereinsheim/meyton-pdf/pdf-date`      | `src/pdfDate.ts`                  | `parsePdfDate`, `parseXmpDate` (rein, auch im Browser)                                                       |
| `@vereinsheim/meyton-pdf/errors`        | `src/errors.ts`                   | `MeytonPdfError` mit festem `code`, `MEYTON_PDF_ERROR_CODES`                                                 |
| `@vereinsheim/meyton-pdf/header`        | `src/header.ts`                   | `hasPdfHeader` (rein, ohne pdf.js)                                                                           |
| `@vereinsheim/meyton-pdf/values`        | `src/values/read.ts`              | `readPrintoutValues`: Werte und Trefferbild (braucht pdf.js)                                                 |
| `@vereinsheim/meyton-pdf/reading`       | `src/values/reading.ts`           | `printoutReading` (Selbstprüfung, rein), `READER_VERSION`, `layoutOf`                                        |
| `@vereinsheim/meyton-pdf/test-pdf`      | `src/__fixtures__/buildPdf.ts`    | `buildPdf`, `bombContent`; nur für Tests und Werkzeuge                                                       |
| `@vereinsheim/meyton-pdf/test-printout` | `src/__fixtures__/printoutPdf.ts` | `printoutPdf`: erfundene Ausdrucke mit Werten und Trefferbild in beiden Layouts; nur für Tests und Werkzeuge |

`./values` liest das Layout (Beschriftungen, Serien, Kreise und Kreuze des Trefferbilds); `./reading` prüft die Werte in
sich und baut die Lesung ohne Name, Nummer, ID und Datum ([[meyton-printout]] „Werte lesen“). Spiegel liest beides nur
im Kindprozess. Die Regel „Kein Layout-Wissen“ unten gilt für ID und Erstellzeit; die Werte lesen das Layout mit
Selbstprüfung, bei jedem Widerspruch gibt es keine. Ändert sich das Verhalten des Lesers, steigt `READER_VERSION`
(Spiegel liest gespeicherte Ausdrucke dann neu).

## Regeln

- **Kein Layout-Wissen.** Gesucht wird nur das Muster `ID:` plus acht Hex-Zeichen, auf allen Seiten;
  die Zeit kommt aus `CreationDate` im Info-Dict, sonst aus `xmp:CreateDate`. Keine Positionen,
  Spalten oder Beschriftungen auswerten (SF-46).
- **Nie raten.** Mehrere verschiedene IDs ergeben `conflict`, keine ID `missing`, ein Datum ohne
  Zeitzone keinen absoluten Zeitpunkt. Fehlende Angaben sind kein Fehler.
- **Grenzen zwischen den Schritten** (`limits.ts`, SF-48): Größe, Seiten, Textstücke, Zeichen, Zeit.
  Text gestreamt, Zeit gegen eine monotone Uhr geprüft, am Ende `loadingTask.destroy()`. pdf.js
  bekommt eine **Kopie** des Puffers, es leert ihn sonst.
- **Kein Schutz gegen präparierte PDFs im selben Prozess.** Dekomprimieren, XMP und Glyphen laufen in
  pdf.js ohne Prüfung dazwischen (gemessen: 3-KB-PDF → 294 MB, 128-KB-XMP → 1,36 GB, Operatoren → 21 s).
  Ein Server liest fremde PDFs deshalb nur in einem **kurzlebigen Kindprozess** (`--max-old-space-size`,
  harter Abbruch nach `maxParseMs`, ein Lesevorgang zur Zeit); ein Worker-Thread reicht nicht.
- Kein `server-only`, kein `"use server"`; Just-in-time wie `packages/shot-core`. Eine Next-App, die das
  Paket nutzt, braucht es in `transpilePackages` (in ihrer `next.config.ts`). `./printout-id`,
  `./pdf-date`, `./limits` und `./errors` laufen ohne pdf.js, auch im Browser.
- **Fehler nach außen** nur als `MeytonPdfError` mit zeigbarer Meldung, nie pdf.js-Interna. Dazu ein
  fester `code` (`tooLarge`, `notPdf`, `tooManyPages`, `tooMuchText`, `timeout`, `unreadable`), den ein
  Kindprozess statt der Meldung weitergibt.
- **Keine echten Ausdrucke im Paket** (Namen, #Nummer; ADR-029). Tests bauen ihre PDFs mit
  `src/__fixtures__/buildPdf.ts` (Ghostscript-Weg: Type1 mit Literal-Strings; Qt-Weg: Type0/Identity-H
  mit ToUnicode und einem Glyph je `Tj`) bzw. `printoutPdf.ts`. Echte PDFs nur lokal: Die eigenen Ausdrucke liegen
  gitignored in `src/__fixtures__/private/printouts/` (`.prettierignore`), `src/values/private.test.ts` vergleicht jede
  Lesung mit einem Schnappschuss daneben und verlangt mindestens 90 % mit Werten; ohne Ordner läuft nichts. Nur dieser
  Test nutzt Node (`@types/node` per `/// <reference>`); `tsconfig` bleibt bei `types: []`.
- `unpdf` in derselben festen Version wie Treffsicher (`1.9.1`); in den Katalog kommt es, sobald
  Treffsicher das Paket nutzt.
- Muster, Dekodierung oder Datumsformate nur mit Test ändern; `toBeCloseTo` nimmt null als 0
  (`vault/conventions.md` §9).
- Nach Änderungen: `pnpm check`; `format:check` prüft auch diese Datei.
