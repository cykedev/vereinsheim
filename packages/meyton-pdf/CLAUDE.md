# @vereinsheim/meyton-pdf — Claude Scope-Notiz

Liest Meyton-Ausdrucke (PDF) für Spiegel (SP-1.3, Oktober 2026). Für die Zuordnung per QR zählen nur
zwei Dinge, beide unabhängig vom Layout (ADR-028, Änderung vom 6. Oktober 2026): die **ID im Fuß**
(`ID: ff914420`, vermutlich die ScheibenID als vorzeichenbehaftete 32-Bit-Zahl) und die
**Erstellzeit** aus den Metadaten. Den vollständigen Parser für fremde Anlagen bringt erst SP-2.6;
dann ziehen auch die Parser aus Treffsicher und Ringwerk hierher. Noch nutzt keine App das Paket.
Fachwissen: `vault/meyton/meyton-printout.md`, Sonderfälle SF-41 bis SF-48 in
`vault/spiegel/spiegel-edge-cases.md`.

## Exporte

| Export                                | Datei               | Inhalt                                                       |
| ------------------------------------- | ------------------- | ------------------------------------------------------------ |
| `@vereinsheim/meyton-pdf/printout`    | `src/printout.ts`   | `readPrintout` (braucht pdf.js), `MeytonPdfError`, Grenzen   |
| `@vereinsheim/meyton-pdf/printout-id` | `src/printoutId.ts` | `findPrintoutId`, `decodePrintoutId` (rein, auch im Browser) |
| `@vereinsheim/meyton-pdf/pdf-date`    | `src/pdfDate.ts`    | `parsePdfDate`, `parseXmpDate` (rein, auch im Browser)       |

## Regeln

- **Kein Layout-Wissen.** Gesucht wird nur das Muster `ID:` plus acht Hex-Zeichen, auf allen Seiten;
  die Zeit kommt aus `CreationDate` im Info-Dict, sonst aus `xmp:CreateDate`. Keine Positionen,
  Spalten oder Beschriftungen auswerten (SF-46).
- **Nie raten.** Mehrere verschiedene IDs ergeben `conflict`, keine ID `missing`, ein Datum ohne
  Zeitzone keinen absoluten Zeitpunkt. Fehlende Angaben sind kein Fehler.
- **Grenzen während des Lesens** (`limits.ts`, SF-48): Größe, Seiten, Textstücke, Zeichen, Zeit.
  Text gestreamt, Zeit gegen eine Uhr geprüft (ein präpariertes PDF blockiert den Event-Loop), am
  Ende `loadingTask.destroy()`. pdf.js bekommt eine **Kopie** des Puffers, es leert ihn sonst.
- **Fehler nach außen** nur als `MeytonPdfError` mit zeigbarer Meldung, nie pdf.js-Interna.
- **Keine echten Ausdrucke im Paket** (Namen, #Nummer; ADR-029). Tests bauen ihre PDFs mit
  `src/__fixtures__/buildPdf.ts` (Ghostscript-Weg: Type1 mit Literal-Strings; Qt-Weg: Type0/Identity-H
  mit ToUnicode und einem Glyph je `Tj`). Echte PDFs nur lokal in der Validierung.
- `unpdf` in derselben festen Version wie Treffsicher (`1.8.1`); ein Katalog-Eintrag folgt, wenn
  Treffsicher das Paket nutzt (SP-2.6).
- Muster, Dekodierung oder Datumsformate nur mit Test ändern; `toBeCloseTo` nimmt null als 0
  (`vault/conventions.md` §9).
- Nach Änderungen: `pnpm check`; `format:check` prüft auch diese Datei.
