# 1c-0 · Gegenprobe: Was ein Meyton-Ausdruck hergibt, gemessen an den eigenen Rohdaten

Teil 1c-0 aus [`2026-10-26-treffsicher-in-spiegel.md`](2026-10-26-treffsicher-in-spiegel.md) (Stufe 1 → 1c, Schritt 1
„Gegenprobe zuerst“). Branch `feat/tis-1c0-printout-check`, abgezweigt von `main`; diesen Plan als ersten Commit
übernehmen (`git show feat/treffsicher-in-spiegel:plans/2026-10-27-tis-1c0-printout-check.md`). **Autonom ausführbar:**
kein Schema, keine Migration, nichts unter `vault/decisions/`, `.claude/`, `scripts/`, `compose.yml`.

## Context

Ein Meyton-Ausdruck zeigt mehr als ID und Druckzeit: Ergebnis in Ringen und Zehnteln, Serien (Ringe und Zehntel), Wert
je Schuss mit Zehntel und Innenzehner (`*`), Zähler, Innenzehner, die drei besten und die drei weitesten Teiler mit
Schussnummer, je Serie die drei besten Teiler, Trefferkreis und Trefferlage, gesamt und je Serie, und das Trefferbild
mit jeder Schussnummer an ihrer Stelle (am Beispiel eines eigenen Ausdrucks, 27. Oktober 2026). Für Scheiben ohne Brücke
(fremde Anlagen, alte Ausdrucke) könnte das die Lücken füllen. Bevor 1c-1 einen Parser baut und entscheidet, was wofür
zählt, misst diese Gegenprobe an den eigenen Ausdrucken des Users, ob die Angaben mit den Rohdaten übereinstimmen
(Konvention §9 „Domänenentscheidungen am echten Datensatz gegenprüfen“).

Fragen, die der Bericht mit Zahlen beantwortet:

1. **Werte je Schuss:** Stimmen Ring, Zehntel und Innenzehner mit den Rohdaten überein (gleiche Reihenfolge der Schüsse,
   Probe und Wertung getrennt)? Stimmen Serien und Ergebnis?
2. **Teiler:** Stimmen die genannten Teiler (Wert und Schussnummer) mit `distanceTenthsUm` der Rohdaten (umgerechnet in
   die Einheit des Ausdrucks)? Welche Einheit nutzt der Ausdruck?
3. **Trefferlage:** Entspricht sie der Mitte der Wertungsschüsse (bzw. der Probeschüsse bei einem Ausdruck im Modus
   Probe), gesamt und je Serie? Abweichung in mm (Median, 95 %, Maximum). Vorzeichen und Richtung (links/rechts,
   hoch/tief) wie in Spiegels Koordinaten?
4. **Trefferkreis:** Welche Definition rechnet Meyton? Kandidaten: Durchmesser des kleinsten umschließenden Kreises der
   Trefferzentren (`group.enclosingDiameter`), derselbe plus Kaliber, größter Abstand zweier Zentren (Extreme Spread),
   doppelter größter Abstand zur Mitte. Abweichung je Kandidat, gesamt und je Serie.
5. **Trefferbild:** Wie genau sitzen die gezeichneten Schussnummern an der Lage der Rohdaten? Abweichung je Schuss in mm
   nach der Umrechnung aus Koordinaten des PDFs (Maßstab und Mitte aus den gezeichneten Ringen bzw. dem Rahmen der
   Scheibe), Median, 95 %, Maximum; dazu, wie oft sich Nummern überdecken oder fehlen (dichte Gruppen).
6. **Abdeckung:** Wie viele Ausdrucke ließen sich lesen, wie viele einer Scheibe mit Rohdaten zuordnen, welche
   Layouts/Disziplinen/Modi kamen vor, welche Felder fehlen manchmal.

## Approach

- **Quellen, nur lokal, nur lesend:**
  - Ausdrucke: die eigenen PDFs des Users in `~/Library/Mobile Documents/com~apple~CloudDocs/Schießen/` (73 am
    27. Oktober 2026). Ein paar tragen den Namen eines anderen Mitglieds oder keinen: diese überspringen und nur zählen.
  - Rohdaten 1: die Spiegel-Dev-Datenbank (Prod-Kopie), Scheiben des eigenen Kontos des Users mit Quelle (41 Scheiben,
    Oktober 2024 bis Oktober 2026). Zuordnung über die ID im Fuß (= ScheibenID) und den Abend der Druckzeit.
  - Rohdaten 2, wenn Rohdaten 1 zu wenige Paare ergibt: die private Kopie der SSMDB2 unter
    `~/ssmdb2-erkundung/2026-10-09_1857/privat`, eingespielt in einen Wegwerf-Container `mariadb:11` (siehe
    `tools/ssmdb2-erkunden/README.md`), nur die Scheiben mit der Sportpassnummer des Users. Container danach löschen.
- **Prototyp des Lesers** in `packages/meyton-pdf/src/values/` (neu, Export `./values`, noch von keiner App genutzt):
  liest mit pdf.js Text mit Position (`getTextContent`, Transform) und die Pfade des Trefferbilds
  (`getOperatorList`, nur soweit für Ringe/Rahmen nötig) und liefert ein `PrintoutValues` mit allen Feldern aus dem
  Context, jedes optional (`null` = nicht gefunden), dazu `layout` (welche Zeilen erkannt wurden). Es rät nichts: Steht
  ein Feld nicht da, ist es `null`. Grenzen wie `readPrintout` (`DEFAULT_LIMITS`). 1c-1 härtet ihn später.
- **Vergleich** als reine Funktionen in `apps/spiegel/tools/printout-check/compare.ts` (Ring/Zehntel je Schuss, Serien,
  Teiler, Mitte, Kandidaten des Trefferkreises über `shot-core`-Geometrie, Abweichung der gezeichneten Lagen nach
  bester Ausrichtung von Maßstab und Mitte), mit Tests an erfundenen Daten.
- **Werkzeug** `apps/spiegel/tools/printout-check.ts` (`pnpm --filter spiegel printout-check <ordner>`): liest die PDFs,
  ordnet zu, vergleicht, schreibt **nur Zahlen** nach `reports/tis-1c0/gegenprobe-<YYYY-MM-DD>.md` (Zählungen,
  Übereinstimmungen in %, Abweichungen Median/95 %/Maximum, je Frage oben) und eine Tabelle je Ausdruck mit laufender
  Nummer statt ID, Name oder Datum in `reports/tis-1c0/` (gitignored). Ausgabe über `process.stdout.write`.

## Files

### Task 1 · Prototyp des Lesers

- `packages/meyton-pdf/src/values/types.ts`: `PrintoutValues` (Kopf: Disziplin, Modus; `result { rings, tenths }`;
  `series: { rings, tenths }[]`; `shots: { series, value, innerTen }[]` in der Reihenfolge des Ausdrucks;
  `counts: number[]` (Zähler); `innerTens`; `bestTeiler: { value, shot }[]`; `widestTeiler`; je Serie
  `{ bestTeiler, hitCircleMm, centerMm: { x, y } }`; gesamt `hitCircleMm`, `centerMm`; `drawn: { shot, xPt, yPt }[]`
  samt `frame` des Trefferbilds in PDF-Koordinaten), alles nullable.
- `packages/meyton-pdf/src/values/read.ts`: `readPrintoutValues(bytes, options)` mit pdf.js wie `printout.ts`; erkennt
  die Zeilen über ihre Beschriftung („Ergebnis:“, „Serien:“, „Zähler:“, „Innenzehner:“, „Weiteste:“, „beste Teiler:“,
  „Trefferkreis:“, „Trefferlage:“, „Serie n:“), Zahlen mit Punkt als Dezimaltrenner, Richtungen „links/rechts“,
  „hoch/tief“ in Vorzeichen (rechts und hoch positiv, wie Spiegel; im Test belegen).
- `packages/meyton-pdf/src/values/read.test.ts`: erfundene Ausdrucke über `buildPdf` (Text an Positionen, wie das
  Beispiel aus dem Context), je Feld ein Fall, fehlende Felder `null`, ein Ausdruck ohne Trefferbild.
- `packages/meyton-pdf/package.json` exports `"./values"`; `packages/meyton-pdf/CLAUDE.md` ein Satz („Prototyp für die
  Gegenprobe 1c-0, noch nicht von Apps genutzt“).
- Commit: `feat(meyton-pdf): prototype reader for the values on a printout`

### Task 2 · Vergleich

- `apps/spiegel/tools/printout-check/compare.ts` (rein): `compareShots`, `compareSeries`, `compareTeiler`,
  `compareCenter`, `hitCircleCandidates` (die vier Kandidaten aus Frage 4 über `@vereinsheim/shot-core/geometry`),
  `fitDrawn` (beste Ausrichtung Maßstab+Verschiebung der gezeichneten Nummern auf die Rohlagen, kleinste Quadrate;
  Ausgabe Abweichung je Schuss in mm), `summarize` (Median, 95 %, Maximum, Anteil gleich).
- `apps/spiegel/tools/printout-check/compare.test.ts`: erfundene Rohdaten und Ausdruck-Werte, je Funktion ein richtiger
  und ein falscher Fall; Mutationsprobe (§9) an `fitDrawn` und an der Wahl des Kandidaten.
- Commit: `test(spiegel): compare printout values with raw shots`

### Task 3 · Werkzeug und Lauf

- `apps/spiegel/tools/printout-check.ts` und Script `"printout-check": "tsx tools/printout-check.ts"` in
  `apps/spiegel/package.json`; prüft wie `seed:own`, dass es gegen die lokale Dev-Datenbank läuft (`assertDevDatabase`).
- Zuordnung: ID im Fuß → `Card.scheibenId` an Quellen der ersten Anlage, Abend der Druckzeit (`eveningDay`), Konto des
  Users; Schüsse der aktuellen Revision; Modus Probe → Probeschüsse.
- Lauf gegen die eigenen PDFs; falls weniger als 20 Paare: Rohdaten 2 (SSMDB2-Kopie) zuschalten, wie im Approach.
- Bericht nach `reports/tis-1c0/`. Kein PDF, kein Name, keine ID, kein Datum im Repo oder in Nachrichten.
- `apps/spiegel/CLAUDE.md`, Befehlstabelle: Zeile `printout-check`.
- Commit: `feat(spiegel): tool for the printout check against raw data`

### Task 4 · Ergebnis festhalten

- `vault/meyton/meyton-printout.md`: neuer Abschnitt „Werte auf dem Ausdruck, gemessen (27. Oktober 2026)“ mit den
  Antworten auf die sechs Fragen, nur Zahlen und Definitionen (z. B. „Trefferkreis = Kandidat X, Abweichung höchstens
  … mm über n Ausdrucke“).
- Am Ende eine Empfehlung für 1c-1: welche Angaben der Parser übernimmt und wofür sie zählen (Werte je Schuss, Teiler,
  Trefferlage je Serie, Trefferkreis als Streukreis ja/nein), und ob 1c-2 (Lagen aus dem Trefferbild) sich lohnt
  (Schwelle: 95 % der Schüsse unter 0,5 mm Abweichung, sonst nein; die Schwelle im Bericht begründen oder anpassen).
- `vault/spiegel/spiegel-roadmap.md`, SP-2.6: Status „Gegenprobe gemacht, Ergebnis in [[meyton-printout]]“.
- Commit: `docs(vault): what a printout gives, measured against raw data`

## Required Docs

- Koordinationsplan (Grundsätze; Stufe 1 → 1c „Was der Ausdruck außerdem hergibt“)
- `vault/meyton/meyton-printout.md`, `vault/decisions/adr-028.md` (Nachträge), `vault/decisions/adr-029.md`
- `packages/meyton-pdf/CLAUDE.md`, `apps/spiegel/CLAUDE.md` („seed:own“, „Speicher“), `vault/conventions.md` §9
- `tools/ssmdb2-erkunden/README.md` (nur falls Rohdaten 2 nötig)

## Test steps

1. `pnpm --filter @vereinsheim/meyton-pdf test` und `pnpm --filter spiegel test -- printout-check` grün.
2. Mutationsproben aus Task 2 rot (Datei vorher per `cp` sichern).
3. `pnpm --filter spiegel printout-check "$HOME/Library/Mobile Documents/com~apple~CloudDocs/Schießen"` läuft durch,
   Bericht liegt unter `reports/tis-1c0/`.
4. `git status` zeigt nichts aus `reports/`; `git grep` nach der Sportpassnummer und dem Namen des Users findet nichts
   Neues.
5. `pnpm check` grün.

## Verification

Meldung an die koordinierende Session: Branch und Commits, die Antworten auf die sechs Fragen in Zahlen (wie im Vault),
die Empfehlung für 1c-1 und 1c-2, was nicht belegt ist (z. B. andere Layouts, fremde Anlagen, Disziplinen ohne
eigene Ausdrucke). Keine neue Brücke nötig.
