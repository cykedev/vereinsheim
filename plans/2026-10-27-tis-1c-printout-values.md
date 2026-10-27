# 1c · Werte und Lagen aus dem Ausdruck

Teil 1c aus [`2026-10-26-treffsicher-in-spiegel.md`](2026-10-26-treffsicher-in-spiegel.md) (Stufe 1 → 1c, SP-2.6; vereint
die früheren Teile 1c-1 „Parser und Modell“ und 1c-2 „Lagen aus dem Trefferbild“). Branch `feat/tis-1c-printout-values`,
abgezweigt vom **lokalen** `main` (Stufe 1 geht Teil für Teil nach `main`). Diesen Plan als ersten Commit übernehmen
(`git show feat/treffsicher-in-spiegel:plans/2026-10-27-tis-1c-printout-values.md`). **Interaktiv, nicht autonom:**
Schema und Migration, `vault/decisions/` und `.claude/` sind geschützte Pfade. Diese Tasks tragen **[geschützt]**, dort
holt die Kindsession die Freigabe über die koordinierende Session. Zur selben Zeit ändert keine andere Kindsession das
Schema von Spiegel. Die Dev-Datenbank ist eine Prod-Kopie: nie zurücksetzen, kein `migrate dev`, kein `db-reset`.

## Context

Seit 1b-2 legt ein Scan, ein Link oder ein hochgeladenes PDF eine Scheibe „vom Ausdruck“ an, deren einzige Angabe der
Ausdruck ist; Werte bringt erst die Brücke. Auswärts, bei alten Ausdrucken und wenn die Brücke die Scheibe nicht mehr hat,
bleibt sie ohne Werte. Die Gegenprobe 1c-0 ([[meyton-printout]], „Werte auf dem Ausdruck, gemessen“) zeigt an 12 Paaren
(480 Schüsse) und 67 eigenen Ausdrucken: Werte je Schuss mit Zehnteln und Innenzehner 480 von 480, Summen, Zähler und
Innenzehner 100 %, Standnummer 12 von 12, die gezeichneten Marken (Kreise und Kreuze) jede höchstens 0,01 mm neben der
Lage der Rohdaten (960 Marken), Trefferlage, Trefferkreis und Streuwert mit bekannter Definition, zwei Layouts
(Ghostscript bis 07/2026, Qt seit 09/2026), Selbstprüfung bei 65 von 67 widerspruchsfrei, Disziplin im Kopf 64 von 67
wörtlich einer Disziplin der Anlage.

Ziel: Ein Ausdruck (Scan, Link, Upload und ein Ordner alter Ausdrucke) gibt der Scheibe sofort ihre Werte und die Lage
jedes Schusses, ohne auf die Brücke zu warten. Gespeicherte Ausdrucke liest Spiegel neu, wenn die Version des Lesers
steigt.

Entschieden mit dem User (27. Oktober 2026, nicht wieder aufmachen):

- **Werte und Lagen vom Ausdruck zählen voll.** Die Lage aus den Marken ist eine Angabe der Scheibe wie eine gemessene
  (0,01 mm); die Herkunft bleibt `pdf` („vom Ausdruck“) und steht da. Zeiten fehlen. „Nie gleichgesetzt“ aus dem
  Koordinationsplan meinte grobe Lagen; das hält der Nachtrag zu ADR-033 fest.
- **Fehlertoleranz:** nie raten, jedes Feld da oder `null`. Selbstprüfung (Schüsse gegen Zähler, Innenzehner, Serien-
  und Gesamtsumme, Zahl der Marken gegen Schüsse): Bei jedem Widerspruch übernimmt Spiegel **keine** Werte, die Scheibe
  bleibt „nur Ausdruck“ (der Grund steht leise da, der Admin sieht Probleme nur als Zustand). PDF und Version des Lesers
  bleiben gespeichert, ein neuer Leser liest neu. Layouts erkennen (Producer, erkannte Zeilen). Tests aus den eigenen
  Ausdrucken über die Zeit ohne Name, Nummer, ID und Datum, dazu erfundene Ausdrucke über `buildPdf`.
- **Welche Schüsse:** Modus Probe → Probeschüsse (`stellung` 0), Wertung → Wertungsschüsse mit Serien. Ein
  Zwischenausdruck (weniger Schüsse) ist in Ordnung.
- **Trefferkreis, Streuwert und Trefferlage** (gesamt und je Serie) sind aus den Lagen ableitbar: nur Selbstprüfung,
  nichts zusätzlich gespeichert.
- **Disziplin vorbelegen** im Blatt „Neue Scheibe“ mit der Disziplin, deren Name dem Kopf wörtlich gleicht, sonst wie
  heute die letzte. Die Standnummer füllt `Card.stand`. Beginn bleibt die Druckzeit (nicht „initialisiert“).
- **Brücke gegen Ausdruck:** Kommen Rohdaten für eine Scheibe, die Werte vom Ausdruck hat, prüft Spiegel zusätzlich zur
  Druckzeit Schuss für Schuss (Ring und Zehntel des Ausdrucks gleich den ersten Schüssen der Rohdaten, selber Abend).
  Passt etwas nicht, speichert Spiegel nichts von der Brücke (`printMismatch`). Sonst werden die Rohdaten eine neue
  Revision (Zeiten dazu, Lagen und Werte aus den Rohdaten).
- **Ordner alter Ausdrucke** einlesen: Werkzeug `apps/spiegel/tools/printout-import.ts` (`--email`, `--dry-run`), derselbe
  Weg wie ein Upload, idempotent über sha256, Bericht nur mit Zahlen; gegen die Dev-Datenbank, für Prod beschrieben.
- **Robustheit:** `.npmrc` `engine-strict=true`; der Leser meldet ein zu altes Node klar und `storePrintout` gibt dafür
  einen eigenen Grund; `printout-check` ohne `--email` sagt, was fehlt; `.claude/launch.json` vom Basisbranch.
- **Oberfläche:** nichts Neues außer dem, was aus Werten folgt (1a-2 kann jede Detailtiefe), und dem leisen Grund
  „Werte nicht lesbar“ am Ausdruck auf der Seite der Scheibe.
- **Keine neue Brücke**, kein Vertrag ändert sich.

## Approach

**Drei Schichten, jede rein testbar:**

1. **Paket (`packages/meyton-pdf`), ohne Wissen über Scheibenbilder:** Der Leser `readPrintoutValues` (heute Prototyp)
   bleibt, dazu `values/reading.ts` (rein, ohne pdf.js, Export `./reading`): `printoutReading(values, meta)` erkennt das
   Layout, den Modus und prüft alles, was ohne Maßstab geht. Ergebnis: eine `PrintoutReading` ohne Name und Nummer, oder
   `rejected` mit festem Grund. `READER_VERSION` steht hier.
2. **Kindprozess:** liest nach ID und Druckzeit auch die Werte (Restzeit der 5 s), gibt die Lesung als JSON zurück
   (geprüft mit zod, mit Grenzen). Scheitern die Werte, bleiben ID und Druckzeit gültig.
3. **App:** `detailsFromReading(reading, targetId)` (rein) rechnet Maßstab und Mitte aus den Ringen gegen das Scheibenbild
   der Disziplin, die Lagen in µm, prüft Trefferlage, Trefferkreis, Streuwert und Teiler gegen die Lagen und baut die
   Angaben für `writeEnteredCardIn`. `applyPrintoutValues(tx, cardId)` wählt den Ausdruck und schreibt. Fetch, Import und
   Neulesen nutzen beides.

### Entschieden in diesem Plan (technisch)

- **Teiler je Schuss: aus der Lage gerechnet, nicht gespeichert** (`Shot.distanceTenthsUm` bleibt `null`, Spiegel nimmt
  dann `hypot(x, y)`, `shotDistanceUm` im Fachkern). Gründe: (1) eine Regel für jeden Schuss statt sechs gedruckter
  Werte mit zwei Genauigkeiten (beste auf 0,1, weiteste auf ganze 1/100 mm abgeschnitten): kein Mittel über eine
  Teilmenge; (2) aus den Marken liegt jeder Teiler höchstens 1,0 · 1/100 mm daneben (1c-0, 95 % unter 0,66); (3) ein
  abgeschnittener Teiler als Abstand mit Auflösung 0,1 µm ließe die Gegenprobe `verifyShots` an Zehntelgrenzen
  fälschlich „verdächtig“ melden; die Lage prüft sie mit 10 µm Spielraum. Die gedruckten Teiler werden Selbstprüfung
  (beste ±1,5, weiteste ±2,0 · 1/100 mm, Schussnummer muss passen). Folge: Der beste Teiler auf der Seite kann in der
  letzten Stelle vom Papier abweichen (≤ 0,01 mm); in [[meyton-printout]] festgehalten.
- **Lage je Schuss** aus dem Bild der Serie (eigener Maßstab, kleinerer Ausschnitt), gegengeprüft am Bild der ganzen
  Scheibe (≤ 0,05 mm); ohne Bilder je Serie aus dem Bild der ganzen Scheibe. Gerundet auf 10 µm (Raster der Rohdaten).
  Kreuze tragen die Lage wie Kreise. Eine Marke außerhalb ihres Bilds fehlt der Zählung: Widerspruch, keine Werte.
- **Ring** = min(10, ⌊Wert/10⌋) wie bei Meyton (480 von 480).
- **Modus:** „Probe“ und „Vorbereitung/Probe“ → Probe, „Wertung“ → Wertung; jeder andere (etwa „Training“, nicht
  belegt) → keine Werte (`mode`). Im Modus Probe keine Summen (Spiegels Summen gelten der Wertung).
- **Welcher Ausdruck die Werte gibt:** unter den Ausdrucken der Scheibe mit Status `ok` der zuletzt gedruckte (ein
  späterer Ausdruck derselben Scheibe hat mindestens so viele Schüsse). Passt er nicht zur Disziplin der Scheibe, der
  nächste. Passt keiner, schreibt Spiegel eine Revision ohne Werte, falls die Scheibe noch Werte hatte.
- **Layout** nur aus dem Producer: `ghostscript` (`/^GPL Ghostscript\b/`), `qt` (`/^Qt \d/`), sonst `unknown`. Ein
  unbekanntes liest der Leser trotzdem, die Selbstprüfung entscheidet (Fehlertoleranz (d)).
- **Status je Ausdruck** (`Printout.valuesStatus`): `ok`, `empty` (keine Werte je Schuss), `inconsistent` (Widerspruch,
  auch gegen das Scheibenbild der Disziplin), `unreadable` (Leser scheiterte). „Werte nicht lesbar“ zeigt die Seite bei
  `inconsistent` und `unreadable` an einer Scheibe vom Ausdruck ohne Brücke; `empty` sagt die Ergebnis-Box schon
  („ohne Werte“).
- **Gespeichert am Ausdruck:** die Lesung als JSON (`Printout.reading`, nur bei `ok`), damit Wählen und Anwenden ohne
  Kindprozess in der Transaktion gehen. Neu gelesen wird, wenn `readerVersion` ≠ `READER_VERSION` (beim Start und
  stündlich, nur Scheiben vom Ausdruck ohne Brücke, nicht im Papierkorb, höchstens 50 je Lauf).
- **Standnummer** nur zusammen mit übernommenen Werten (aus derselben Lesung).
- **Schuss für Schuss beim Einlesen** vor `storeSnapshot`, wie die Druckzeit (`passes` in `ingestBatch`): Ein Auftrag
  passt nur, wenn ein Stand des Stapels am Abend vor dem Druck begann **und** seine Schüsse derselben Art (Probe oder
  Wertung, je in Nummernfolge) mit den Schüssen der Scheibe vom Ausdruck beginnen (Zehntel gleich, ohne Zehntel der
  Ring). Hat die Scheibe keine Werte, gilt nur die Druckzeit. Eine Zustimmung per Sportpass geht wie heute vor: Ihr Stand
  wird gespeichert, füllt die Scheibe vom Ausdruck aber nicht.
- **Ordner einlesen** ohne Auftrag an die Brücke (alte Abende, höchstens zehn offene Aufträge): eigene Scheibe des
  Abends → anhängen und Werte anwenden; sonst neue Scheibe mit der Disziplin aus dem Kopf (genau ein wörtlicher Treffer
  unter den wählbaren), Art Training, ohne Ort; ohne Disziplin übersprungen und gezählt. `--dry-run` läuft in einer
  Transaktion, die am Ende zurückrollt, und schreibt keine Datei.
- **Node zu alt:** `readPrintoutIsolated` prüft vor dem Start `process.versions.node` (der Kindprozess läuft mit
  `process.execPath`) gegen `READER_MIN_NODE = 26` (wie `engines` und `.nvmrc`), schreibt eine klare Zeile ins Log und
  liefert `nodeVersion`; `storePrintout` gibt `nodeVersion` weiter.

### Entschieden von der koordinierenden Session (der User will Ergebnisse sehen)

- Testdaten aus den eigenen Ausdrucken nur lokal in `__fixtures__/private/` (gitignored), im Repo nur erfundene
  Ausdrucke (Task 6).
- Teiler aus der Lage; die gedruckten dienen der Selbstprüfung. Der beste Teiler auf der Seite kann in der letzten
  Stelle vom Papier abweichen (≤ 0,01 mm), festgehalten in [[meyton-printout]].
- Der Ordner-Import legt keine Aufträge an die Brücke an.
- „Vorbereitung/Probe“ als Probe, „Training“ ohne Werte; ein späterer Leser liest über die Version neu.
- Den Weg des Imports in Prod beschreibt die Doku nur; der User führt ihn nach dem Deploy aus.

### Bewusst offen

- Luftgewehr, fremde Anlagen, Modus Training, Zwischenausdrucke und Treffer außerhalb des Bilds sind an echten Ausdrucken
  nicht belegt (1c-0). Sie fallen über die Selbstprüfung auf „keine Werte“ und bekommen mit einem neuen Leser eine
  Chance (Neulesen).
- Die Trefferlage als Summe (`CardRevision.center*`) für Ausdrucke ohne Trefferbild: nicht gesehen, nicht gebaut.

### Neue Texte

Vorlage für den Code; Tests halten Wortlaut, Semikolons und `OLD_WORDS` fern.

| Ort | Text |
| --- | --- |
| Kasten „Diese Scheibe“, Zeile Ausdruck, Zusatz bei `inconsistent`/`unreadable` | Werte nicht lesbar |
| Meldung nach dem Holen, neue Scheibe mit Werten | Scheibe mit den Werten vom Ausdruck angelegt. |
| Meldung nach dem Holen, neue Scheibe ohne Werte (bisher) | Scheibe angelegt. Spiegel holt die Werte von der Anlage. |
| Fehler am Weg, `nodeVersion` | Dieser Server kann keine Ausdrucke lesen. Er braucht eine neuere Version von Node. |
| Auftrag `printMismatch`, Satz (ersetzt den bisherigen) | Die Scheibe der Anlage begann nach dem Druck oder hat andere Werte. Spiegel hat nichts übernommen. |
| Admin-Übersicht, Station Anlage, Zusatz (n = 1) | 1 Ausdruck ohne lesbare Werte. Spiegel liest ihn noch einmal, sobald eine neue Version es kann. |
| dto. (n > 1) | {n} Ausdrucke ohne lesbare Werte. Spiegel liest sie noch einmal, sobald eine neue Version es kann. |
| dto., Anhang bei m > 0 | Davon {m} in einer Form, die Spiegel noch nicht kennt. |
| Log (kein UI) | Ausdrucke lesen braucht Node 26 oder neuer, der Server läuft mit {version}. Den Server mit der Version aus .nvmrc starten. |

## Files

### Task 0 · Branch und Plan

- Die App kann den Worktree von `origin/main` schneiden, das weit zurückliegt. Vor dem ersten Commit:
  `git rev-parse HEAD` gegen `git rev-parse main` (lokaler Branch, nicht `origin/main`). Weichen sie ab und gibt es noch
  keinen eigenen Commit: `git status` sauber, dann `git reset --hard main`. Danach `git merge-base --is-ancestor 028234b0
  HEAD` muss gelingen.
- `git switch -c feat/tis-1c-printout-values` (falls der Branch noch nicht besteht).
- `git show feat/treffsicher-in-spiegel:plans/2026-10-27-tis-1c-printout-values.md > plans/2026-10-27-tis-1c-printout-values.md`
- Commit: `docs(plans): plan values and positions from the printout (1c)`

### Task 1 · `.npmrc`: falsche Node-Version abweisen

- `.npmrc`: am Ende
  ```
  # Falsche Node-Version: pnpm bricht mit einer klaren Meldung ab (engines in package.json, .nvmrc)
  engine-strict=true
  ```
- Prüfen und im Bericht festhalten:
  1. `pnpm install --frozen-lockfile` unter Node 26 grün.
  2. Mit einer älteren installierten Node (etwa `nvm ls`; nichts nachinstallieren): `nvm exec <alt> pnpm install
     --frozen-lockfile` bricht mit `ERR_PNPM_UNSUPPORTED_ENGINE` ab; ob `nvm exec <alt> pnpm --filter spiegel dev`
     ebenfalls abbricht, festhalten (wenn nicht, schützt Task 3 den Leser). Ohne ältere Node: „nicht belegt“.
  3. `pnpm exec turbo prune spiegel --docker --out-dir <scratchpad>/prune` enthält `json/.npmrc`; der Docker-Build
     (`node:26-alpine`) läuft in Task 17 über `tools/stack-e2e/run.sh`.
  4. `grep -n "pnpm install" scripts/bootstrap-dev.sh`: Läuft es ohne `nvm use`, nur melden (`scripts/` ist geschützt),
     nicht ändern.
- Commit: `build: refuse installs on a Node version outside the engines range`

### Task 2 · Vorschau mit der Node aus `.nvmrc` **[geschützt: `.claude/`]**

- `git checkout feat/treffsicher-in-spiegel -- .claude/launch.json` (derselbe Inhalt wie auf dem Basisbranch, Commit
  `9613cb47`; beim späteren `git rebase main` des Basisbranchs fällt dieser Commit dort leer weg).
- Commit: `chore(claude): start dev previews with the repo's Node version from .nvmrc`

### Task 3 · Leser auf zu altem Node, `printout-check` ohne Konto

- `apps/spiegel/src/lib/printouts/reader.ts`: `export const READER_MIN_NODE = 26`; `ReadFailure` um `"nodeVersion"`;
  `nodeTooOld(version = process.versions.node)` (rein, Hauptversion < 26). In `readPrintoutIsolated` vor der Schlange:
  bei zu alter Node `console.error` mit dem Log-Text aus „Neue Texte“ (nur die Versionsnummer, kein Pfad), Ergebnis
  `failed("nodeVersion")`.
- `apps/spiegel/src/lib/printouts/store.ts`: `StoreRejection` um `"nodeVersion"`, `rejectionOf` reicht ihn durch.
- `apps/spiegel/src/lib/fetch-card/texts.ts`: `ERROR_TEXT.nodeVersion` aus „Neue Texte“.
- Tests: `reader.test.ts` (`nodeTooOld("20.19.0")` wahr, `"26.0.0"` falsch; `readPrintoutIsolated` mit gestubbter Version
  über einen optionalen Parameter `nodeVersion` in `IsolatedReadOptions` → `nodeVersion`, kein Kindprozess gestartet),
  `store.test.ts` (Grund weitergereicht), `texts.test.ts` (Schreibregeln).
- `apps/spiegel/tools/printout-check.ts`: Ist `email` leer, vor dem Lesen abbrechen mit
  `printout-check braucht ein Konto: --email <adresse> oder SEED_ADMIN_EMAIL in apps/spiegel/.env.
  Aufruf: pnpm --filter spiegel printout-check <ordner> --email <adresse>`; fehlt der Ordner, derselbe Aufruf in der
  Meldung.
- Commits: `fix(spiegel): say clearly when the printout reader runs on an old Node` und
  `fix(spiegel): printout check explains which account it needs`

### Task 4 · Erfundene Ausdrucke mit Werten (Paket)

- `packages/meyton-pdf/src/__fixtures__/printoutPdf.ts` (neu): die Bausteine aus `values/read.test.ts` (`text`,
  `circle`, `square`, `cross`, `picture`, `TestPicture`, Qt- und Ghostscript-Kopf) als `printoutPdf(spec: TestPrintout)`
  mit `layout: "qt" | "ghostscript"`, `discipline`, `stand`, `mode`, Kopfzeilen als Text (`result`, `seriesLine`,
  `counts`, `innerTens`, `widest`, `best`, `circle`, `center`, `spread`, je Serie `sum`, `values`, `best`, `circle`,
  `center`, `spread`), `pictures: TestPicture[]`, `id`, `printed` (Erstellzeit), Producer je Layout
  (`GPL Ghostscript 9.55.0` bzw. `Qt 5.12.8` mit Creator `Meyton Elektronik GmbH`). Fehlt ein Feld, fehlt die Zeile.
  Name nur erfunden (`Muster, Max`, `#12345678`).
- `packages/meyton-pdf/package.json` exports `"./test-printout": "./src/__fixtures__/printoutPdf.ts"`.
- `values/read.test.ts` nutzt `printoutPdf`; alle bisherigen Fälle unverändert grün.
- Commit: `test(meyton-pdf): shared builder for printouts with values`

### Task 5 · Lesung mit Selbstprüfung (Paket, rein)

- `packages/meyton-pdf/src/values/reading.ts` (neu, ohne Import von `read.ts` oder `unpdf`):
  - `export const READER_VERSION = "meyton-values@1"`
  - `type PrintoutLayout = "ghostscript" | "qt" | "unknown"`; `layoutOf({ producer })` nach den Regeln im Approach.
  - `type ReadingProblem = "empty" | "mode" | "shotValue" | "series" | "sums" | "innerTens" | "counts" | "marks" |
    "teilerRefs"`
  - `interface PrintoutReading { layout; discipline: string | null; stand: string | null; probe: boolean;
    shots: { series: number | null; decimalTenths: number; innerTen: boolean }[]; series: { number; shots; rings;
    decimalTenths; centerMm; hitCircleMm; spread; bestTeiler }[]; total: { rings; decimalTenths } | null; centerMm;
    hitCircleMm; spread; bestTeiler; widestTeiler; pictures: { centerPt; ringDiametersPt; holesPt: PointPt[] }[] }`.
    `pictures[0]` ist die ganze Scheibe, danach je Serie eins; leer ohne Trefferbild. **Kein Name, keine Nummer,
    keine ID, kein Datum.**
  - `type ReadingResult = { kind: "ok"; reading } | { kind: "rejected"; layout; problem; discipline: string | null }`
  - `printoutReading(values: PrintoutValues, meta: { producer: string | null }): ReadingResult`, Prüfungen in dieser
    Folge: keine Schüsse → `empty`; Modus nach Approach → sonst `mode`; jeder Wert ≤ 109 und Innenzehner nur ab 100 →
    `shotValue`; Wertung: jeder Schuss in einer Serie, Serien 1…n lückenlos → `series`; Summe je Serie (Ringe =
    Σ min(10, ⌊v/10⌋), Zehntel = Σ v), Zeile „Serien“, Ergebnis → `sums`; Innenzehner → `innerTens`; Zähler genau 11
    Felder (10 bis 0) und jedes gleich → `counts` (12 Felder der Trainingsscheibe ebenso); Trefferbild: keine Bilder
    erlaubt, sonst `pictures[0].holes.length` = Schusszahl und entweder ein Bild oder 1 + Serienzahl mit je der
    Schusszahl der Serie → `marks`; jede genannte Schussnummer der Teiler zwischen 1 und Schusszahl → `teilerRefs`.
    Gedruckte Felder, die fehlen, prüft es nicht (nie raten, fehlende Angaben sind kein Fehler).
- `packages/meyton-pdf/package.json` exports `"./reading": "./src/values/reading.ts"`; `read.ts` exportiert weiter
  `./values`.
- `packages/meyton-pdf/src/values/reading.test.ts`: erfundene Ausdrucke aus Task 4 (beide Layouts, Probe und Wertung,
  Kreise und Kreuze, Zwischenausdruck mit halber letzter Serie, ohne Trefferbild) → `ok`; je Grund ein Fall mit genau
  einem Widerspruch → `rejected` mit diesem Grund; „Training“ → `mode`; die Lesung als JSON enthält weder `Muster` noch
  `12345678` noch `ff914420`. Mutationsprobe (§9): den Zählervergleich auf `true` stellen → ein Test rot; die Prüfung der
  Marken entfernen → ein Test rot.
- Commit: `feat(meyton-pdf): self-checked reading of a printout's values`

### Task 6 · Eigene Ausdrucke als lokale Regression (Paket)

- `packages/meyton-pdf/src/values/private.test.ts`: liest jede PDF aus `src/__fixtures__/private/printouts/`
  (gitignored über `**/__fixtures__/private/`); ohne Ordner `describe.skip` mit Hinweis. Je Datei
  `printoutReading(await readPrintoutValues(bytes), { producer })` (`producer` über `readPrintout`) gegen
  `toMatchFileSnapshot("../__fixtures__/private/printouts/<datei>.reading.json")`. Der erste Lauf legt die Dateien an.
  Dazu die Zusicherung: mindestens 90 % `ok`.
- Befüllen nur lokal: die eigenen Ausdrucke des Users (Ordner aus 1c-0, nur die mit dem eigenen Namen, wie
  `printout-check` zählt) in den privaten Ordner kopieren. Nichts davon in Commits, Nachrichten oder Bericht außer
  Zahlen ([[adr-029]], Nachtrag Oktober 2026).
- Commit: `test(meyton-pdf): own printouts as local regression fixtures`

### Task 7 · Werte im Kindprozess lesen

- `apps/spiegel/src/lib/printouts/protocol.ts`: `readingSchema` (zod, alle Zahlen endlich, Grenzen: höchstens 200
  Schüsse, 20 Serien, 21 Bilder, 200 Marken je Bild, 20 Ringe, Disziplin 80 Zeichen, Stand 8 Zeichen) und `valuesSchema`
  = `{ kind: "ok", reading } | { kind: "rejected", layout, problem, discipline } | { kind: "failed", code }`. In
  `childResultSchema` (`ok: true`) neues Feld `values: valuesSchema` und `producer: string | null` (80 Zeichen).
- `reader-child.ts`: nach `readPrintout` die Werte: Restzeit `maxParseMs − verstrichen`, ≤ 0 → `{ kind: "failed",
  code: "timeout" }`; sonst `await import("@vereinsheim/meyton-pdf/values")`, `readPrintoutValues(bytes, { limits:
  { maxParseMs: rest } })`, dann `printoutReading(values, { producer })`. `MeytonPdfError` → `failed` mit `code`. Ist das
  JSON der Antwort größer als 48 KiB, `values` durch `{ kind: "failed", code: "tooMuchText" }` ersetzen (die Grenze von
  64 KiB bleibt für ID und Zeit).
- `reader.ts`: `IsolatedRead` (`read`) bekommt `values` und `producer`.
- `store.ts`: `StoredPrintout.values: PrintoutValuesRead` mit `{ readerVersion: string; layout: PrintoutLayout | null;
  status: "ok" | "empty" | "inconsistent" | "unreadable"; reading: PrintoutReading | null; discipline: string | null }`
  (Abbildung: `ok` → `ok`, `rejected`/`empty` → `empty`, übrige `rejected` → `inconsistent`, `failed` → `unreadable`).
  Option `{ write?: boolean }` (Vorgabe `true`, `false` für `--dry-run`), Ergebnis `stored` trägt `maxRssKb`.
- Typen aus `@vereinsheim/meyton-pdf/reading` (rein); `reader.ts` und `store.ts` importieren nie `./values` oder
  `./printout`.
- `apps/spiegel/test/printout.ts` (neu): `valuedPrintout({ layout, mode, targetId, shotsMm, perSeries, cross, id,
  printed, omit })` baut einen in sich stimmigen Ausdruck über `printoutPdf`: Werte aus der Lage
  (`scoreFromCoordinates`), Summen, Zähler, Innenzehner, Teiler (abgeschnitten), Trefferlage (Schwerpunkt, abgeschnitten),
  Trefferkreis (`smallestEnclosingCircle` + Kaliber) bzw. Streuwert (`standardDeviation`, n − 1), Bilder mit Ringen des
  Scheibenbilds. `omit` lässt einzelne Zeilen weg, `tamper` verfälscht genau eine Zahl (für die Widerspruchsfälle).
- Tests: `reader.test.ts` mit `valuedPrintout` durch den echten Kindprozess (tsx): `values.kind === "ok"`, ID und Zeit wie
  bisher; ein Ausdruck, dessen Werte scheitern (Bombe aus `bombContent` nach der ID), liefert ID und `values.failed`;
  `protocol` lehnt eine Lesung mit 201 Schüssen ab. `store.test.ts`: Status je Fall, `write: false` legt keine Datei an.
  `reader-bundle.test.ts` grün (Bündel enthält die Werte).
- Commit: `feat(spiegel): read the values of a printout in the reader child`

### Task 8 · Schema und Migration **[geschützt]**

- `apps/spiegel/prisma/schema.prisma`:
  - `enum PrintoutValuesStatus { ok empty inconsistent unreadable }` mit Kommentar „Werte eines Ausdrucks: gelesen und in
    sich stimmig, keine Werte darauf, Widerspruch (auch zum Scheibenbild der Disziplin), nicht lesbar“.
  - `model Printout`: `readerVersion String?` („Version des Lesers der Werte; null: noch nie gelesen, wird neu
    gelesen“), `layout String?` („ghostscript, qt oder unknown, nach dem Producer“), `reading Json?` („die Lesung ohne
    Name, Nummer, ID und Datum; nur bei ok“), `valuesStatus PrintoutValuesStatus?`.
  - `model Shot`, Kommentar an `xUm`/`yUm`: „Lage in µm, x nach rechts, y nach oben; null ohne Lage (eingetragen, Ausdruck
    ohne Trefferbild)“.
- Migration (aus `apps/spiegel`):
  1. `pnpm --filter spiegel exec prisma migrate status` → aktuell, sonst Stopp und melden.
  2. `mkdir prisma/migrations/20261027200000_printout_values`, dann
     `pnpm --filter spiegel exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/20261027200000_printout_values/migration.sql`
     (Form wie in 1b-2; kennt Prisma die Option nicht, die aus `migrate diff --help`). **Nie** `migrate dev`.
  3. Erlaubt sind genau `CREATE TYPE "PrintoutValuesStatus" AS ENUM (...)` und `ALTER TABLE "Printout" ADD COLUMN` für
     die vier Spalten. Sonst Stopp und melden.
  4. `prisma migrate deploy`, dann `prisma generate`. Gegenprobe: zweiter `migrate diff` leer, `migrate status` aktuell.
- Commit: `feat(spiegel): store the reader version, layout and reading of a printout`

### Task 9 · Angaben aus der Lesung (App, rein)

- `apps/spiegel/src/lib/printouts/values.ts` (neu):
  - `ringDiametersMm(target)` und `scaleFromRings(ringPt, ringMm)` hierher aus `tools/printout-check/compare.ts`
    (das Werkzeug importiert sie von hier; Tests ziehen mit).
  - `type ValuesProblem = "rings" | "marks" | "center" | "circle" | "spread" | "teiler" | "details"`
  - `detailsFromReading(reading, targetId: TargetId | null): { ok: true; details: DetailsInput; stand: string | null }
    | { ok: false; problem: ValuesProblem }`:
    - ohne Scheibenbild und mit Bildern → `rings`; je Bild Maßstab aus den Ringen; Zahl der Ringe ≠ Scheibenbild oder ein
      Verhältnis mehr als 0,5 % neben dem Median → `rings`.
    - Lage je Schuss nach Approach, µm = `Math.round(mm * 100) * 10`; Bild der ganzen Scheibe gegen Bild der Serie
      > 0,05 mm → `marks`.
    - mit Lagen: Trefferlage gesamt und je Serie (Schwerpunkt der Schüsse des Modus, je Achse |Δ| ≤ 0,02 mm) → `center`;
      Trefferkreis (`smallestEnclosingCircle` × 2 + `target.caliberMm`, |Δ| ≤ 0,02 mm) → `circle`; Streuwert (σx, σy mit
      n − 1, gesamt √((σx² + σy²)/2), je |Δ| ≤ 0,02 mm) → `spread`; beste Teiler (|hypot · 100 − gedruckt| ≤ 1,5) und
      weiteste (≤ 2,0) → `teiler`. Nur, was gedruckt ist.
    - Angaben: Schüsse `{ series, ring, decimalTenths, innerTen, xUm, yUm, distanceTenthsUm: null, probe }`; in Wertung
      Serien `{ series, shots, rings, decimalTenths }` und Gesamtergebnis `{ shots, rings, decimalTenths }` wie gedruckt;
      im Modus Probe keine Summen. Danach `checkDetails(details, { plannedShots: null, seriesShots: null })` → sonst
      `details`.
  - `readingOrder(printouts)`: Ausdrucke mit `valuesStatus === "ok"` nach `printedAt` absteigend, dann `storedAt`.
- `values.test.ts` mit `valuedPrintout` → `printoutReading` (ohne Kindprozess, über `readPrintoutValues` im Test erlaubt,
  da Testprozess): je Layout, Probe, Wertung, Kreuze, Zwischenausdruck stimmt; Lagen höchstens 10 µm neben den
  erzeugten; LP-Lesung mit `lg-10m` → `rings`; je `tamper` einer Trefferlage, eines Trefferkreises, eines Streuwerts,
  eines Teilers → der Grund. Mutationsproben: Toleranz der Trefferlage auf ∞ → rot; Kreuzprüfung der Bilder entfernt →
  rot (Fall mit verschobenem Serienbild).
- Commit: `feat(spiegel): card details from a printout reading`

### Task 10 · Anhängen und Anwenden (App, Datenbank)

- `src/lib/db/entered.ts`: `EnteredCardInput.stand?: string | null` (fehlt: nicht anfassen), nur bei Herkunft `pdf`,
  höchstens 8 Zeichen aus Ziffern und Buchstaben, sonst `invalid` mit neuem `DetailsProblem` `"stand"`; beim Anlegen und
  Ändern geschrieben.
- `src/lib/printouts/queries.ts`: `attachPrintout` schreibt `readerVersion`, `layout`, `reading`, `valuesStatus` aus
  `file.values` beim Anlegen **und** beim erneuten Anhängen derselben Datei (`update`). Neu
  `markPrintoutValues(tx, printoutId, status)`.
- `src/lib/printouts/apply.ts` (neu): `applyPrintoutValues(tx, cardId): Promise<"taken" | "none" | "skipped">`: Zeile
  sperren (`lockCard`), Scheibe lesen; nicht `origin: "pdf"` oder `sourceId` gesetzt oder im Papierkorb oder wartend →
  `skipped`. Ausdrucke der Scheibe in `readingOrder`, je `detailsFromReading(reading, targetId der Disziplin)`; Problem →
  `markPrintoutValues(…, "inconsistent")`, nächster. Erster passender → `writeEnteredCardIn({ cardId, ownerId, origin:
  "pdf", disciplineId, startedAtMs: startedAt, kind, details, stand, reason: "printout" })` → `taken`. Keiner, die
  Scheibe hat aber Schüsse oder Summen → `writeEnteredCardIn` mit `details: {}` → `none`.
- Tests gegen die Dev-Datenbank (`apply.test.ts`, eigene Anlage über `createTestSite`): neue Scheibe vom Ausdruck +
  stimmiger Ausdruck → Schüsse mit Lage, `stand`, Projektion mit Streuung, Herkunft `pdf`; zweiter, späterer Ausdruck mit
  mehr Schüssen → neue Revision mit allen; späterer Ausdruck im Widerspruch → der frühere zählt, der spätere
  `inconsistent`; Scheibe der Brücke → `skipped`, nichts geschrieben; derselbe Ausdruck zweimal → keine neue Revision.
- Commit: `feat(spiegel): apply the values of a printout to its card`

### Task 11 · Holen: sofort mit Werten, Disziplin vorbelegt

- `src/lib/fetch-card/queries.ts`:
  - Die Suche der eigenen Scheibe des Abends (drei Schritte) als `ownCardOfEvening(tx, { userId, siteId, scheibenId,
    day, timeZone })` herauslösen, `fetchCard` nutzt sie (Verhalten gleich, bisherige Tests grün).
  - Neu anlegen: Ist `file?.values.reading` da, vor `writeEnteredCardIn` `detailsFromReading(reading, discipline.targetId)`
    (die Abfrage der Disziplin liest `targetId` schon); passt es, `details` und `stand` mitgeben; sonst `details: {}` und
    nach dem Anhängen `markPrintoutValues(…, "inconsistent")`. Ergebnis `created` mit `values: boolean`.
  - `opened` und `restored` an einer Scheibe vom Ausdruck ohne Brücke: nach dem Anhängen `applyPrintoutValues`.
  - `headerDisciplineId(db, { siteId, name })`: unter den wählbaren Disziplinen (`choosable`, bekanntes Scheibenbild)
    genau eine mit `name === name` → ihre Id, sonst null.
- `fetch-card/actions.ts`: bei `choose` `disciplineId: got.file ? await headerDisciplineId(db, { siteId, name:
  got.file.values.discipline }) : null` in `FetchOutcome`; `created` reicht `values` durch.
- `fetch-card/texts.ts`: `FetchOutcome.choose.disciplineId: number | null`, `created.values: boolean`; `fetchToast` nach
  „Neue Texte“.
- `src/components/scan/ScanScreen.tsx`: `sheet` merkt `disciplineId` aus dem Ergebnis; `NewCardSheet` bekommt
  `preset={{ ...preset, disciplineId: sheet.disciplineId ?? preset.disciplineId }}`.
- Tests: `queries.test.ts` (neue Scheibe mit stimmigem Ausdruck hat Werte und `stand`; Widerspruch → ohne Werte,
  Status `inconsistent`; vorhandene Scheibe vom Ausdruck aus 1b-2 bekommt beim zweiten Holen ihre Werte;
  `headerDisciplineId` genau, zweideutig und ohne Treffer), `texts.test.ts`, `ScanScreen.test.tsx` (Vorbelegung aus dem
  Ergebnis vor der letzten).
- Commit: `feat(spiegel): a fetched printout gives its card values at once`

### Task 12 · Einlesen: Schuss für Schuss gegen den Ausdruck

- `src/lib/ingest/meyton-ssmdb2.ts`: `shotValuesOf(snapshot): { stellung; treffer; ring: number | null; decimalTenths:
  number | null }[]` über `rawShots` (Ring = ⌊Ring/10⌋, Zehntel = `Ring01`), rein. Der Adapter ändert sich nicht,
  `ADAPTER_VERSION` bleibt.
- `src/lib/card-requests/print-check.ts` (neu, rein): `printedShotsFit(printed, raw)`: `printed` leer → wahr; Art aus
  `printed` (alle `stellung` 0 → Probe); `raw` derselben Art, Probe nach `treffer`, Wertung nach `stellung`, `treffer`;
  `raw.length ≥ printed.length` und je i: Zehntel gleich, wo `printed` sie hat, sonst Ring.
- `src/lib/card-requests/queries.ts`: `printedShotsOf(db, cardIds)` → `Map<cardId, { stellung; treffer; ring;
  decimalTenths }[]>` aus der aktuellen Revision in `seq`-Folge.
- `src/lib/ingest/ingest.ts`: nach `openRequestsFor` die Schüsse der ungefüllten Scheiben vom Ausdruck laden; in `passes`
  zusätzlich `printedShotsFit(printed.get(r.cardId) ?? [], shotValuesOf(s))`. Der Kommentar an „Nichts ohne Zustimmung
  speichern“ in `apps/spiegel/CLAUDE.md` folgt in Task 16.
- `src/lib/card-requests/status.ts`: `REQUEST_STATUS_NOTE.printMismatch` nach „Neue Texte“.
- Tests `requests.test.ts` (Helfer `pdfCard` bekommt optional `shots`): gleiche Werte → gefüllt, neue Revision, Herkunft
  `raw`, Lagen und Zeiten aus den Rohdaten; Zwischenausdruck (die ersten 15 Schüsse) → gefüllt; ein Zehntel anders →
  `printMismatch`, `stored(…) === 0`, Scheibe bleibt `pdf` mit ihren Werten; Ausdruck in Probe gegen Wertung →
  `printMismatch`. `print-check.test.ts` rein mit je Grenze einem Fall. Mutationsprobe: `printedShotsFit` → `true`, der
  Fall mit anderem Zehntel wird rot.
- Commit: `feat(spiegel): raw data must match the printout shot by shot`

### Task 13 · Neu lesen, wenn der Leser neu ist

- `src/lib/printouts/reread.ts` (neu): `rereadOutdatedPrintouts(db, { limit = 50, read = readPrintoutIsolated })`:
  Ausdrucke mit `readerVersion` null oder ≠ `READER_VERSION`, deren Scheibe `origin: "pdf"`, ohne Quelle, nicht im
  Papierkorb, nicht wartend ist, älteste zuerst. Je Ausdruck: Datei lesen (`readPrintoutBytes`, fehlt → zählen, weiter),
  `read(bytes)`; `busy` → Lauf beenden; sonst in einer Transaktion Zeile aktualisieren (wie `attachPrintout`) und
  `applyPrintoutValues`. Ergebnis `{ read, taken, failed, missing }`.
- `src/instrumentation-node.ts`: `rereadPrintouts()` wie `rereadKeys` (Log nur Zahlen und Fehlername), beim Start und
  stündlich.
- `reread.test.ts` gegen die Dev-Datenbank mit `read` als Stub (Version alt → neu gelesen und angewandt; Papierkorb und
  Brücke übersprungen; `busy` beendet).
- Commit: `feat(spiegel): read stored printouts again when the reader changes`

### Task 14 · Grund an der Scheibe, Zustand im Admin

- `fetch-card/queries.ts` `cardFetchInfo`: liest `origin` und je Ausdruck `valuesStatus`; `printouts[]` bekommt
  `unreadable: boolean` (Scheibe vom Ausdruck ohne Quelle und Status `inconsistent` oder `unreadable`).
- `src/components/card/CardPrintout.tsx`: „Werte nicht lesbar“ an die Zeile des Ausdrucks (`·` wie ID und Druckzeit) bzw.
  an „Weiterer Ausdruck …“. `CardPrintout.test.tsx`: mit und ohne.
- `src/lib/admin/overview.ts`: `OverviewInput.printouts: { unreadable: number; unknownLayout: number }`, gezählt in
  `adminOverview` (Ausdrucke an Scheiben vom Ausdruck ohne Quelle, nicht im Papierkorb, Status `inconsistent` oder
  `unreadable`; davon `layout = 'unknown'`); Zusatz in `facts` der Station `site` nach „Neue Texte“, nur bei n > 0.
  Test im bestehenden Test der Übersicht.
- Commit: `feat(spiegel): say quietly when a printout's values cannot be read`

### Task 15 · Ordner alter Ausdrucke einlesen

- `src/lib/fetch-card/import.ts` (neu): `importPrintout(db, { userId, siteId, file, dryRun })` in einer Transaktion
  unter der Sperre der Kontozeile wie `fetchCard`:
  - eigene Scheibe des Abends (`ownCardOfEvening`): im Papierkorb → `trashed`; sonst anhängen, an einer Scheibe vom
    Ausdruck ohne Quelle `applyPrintoutValues` → `attached` (mit `values`).
  - fremde Scheibe der Brücke → `taken`; Grabstein oder Sperre (auch eigene) am Abend → `blocked`.
  - sonst `headerDisciplineId` → null: `noDiscipline`; sonst `writeEnteredCardIn` (Herkunft `pdf`, Beginn Druckzeit, Art
    und `kindChoice` Training, ohne Ort, Angaben wie in Task 11), anhängen, **kein Auftrag** → `created` (mit `values`).
  - `dryRun`: am Ende einen eigenen Fehler werfen, die Transaktion rollt zurück, das Ergebnis wird vorher gemerkt.
- `tools/printout-import.ts` (neu), Script `"printout-import": "tsx tools/printout-import.ts"`:
  `pnpm --filter spiegel printout-import <ordner> [--email <adresse>] [--dry-run] [--force]`. `assertDevDatabase`; Konto
  aus `--email`, sonst `SEED_ADMIN_EMAIL`, sonst Abbruch mit Erklärung wie Task 3; Anlage über `requestSiteId`.
  Je PDF (nach Namen sortiert): sha256 vorab, steht dieselbe Datei schon an einer eigenen Scheibe → `schon da`;
  `storePrintout({ write: !dryRun })`; `importPrintout`. Ausgabe nur Zahlen über `process.stdout.write`: gelesen,
  angelegt, angehängt, schon da, mit Werten, ohne Werte je Status, ohne Disziplin, abgelehnt je Grund, im Papierkorb,
  fremd, gesperrt, größter `maxRssKb`. Kein Name, keine ID, kein Datum, kein Dateiname.
- `tools/printout-sample.ts`: `--values` erzeugt über `valuedPrintout` einen stimmigen Ausdruck (LP, Wertung, 40 Schuss,
  Qt), für Messung, Stack-Test und Prüfung von Hand.
- Tests: `import.test.ts` gegen die Dev-Datenbank (zweimal derselbe Ordner ändert nichts; vorhandene eigene Scheibe der
  Brücke bekommt nur das PDF; Kopf ohne passende Disziplin → `noDiscipline`; `dryRun` schreibt nichts).
- Commit: `feat(spiegel): tool to read a folder of old printouts into cards`

### Task 16 · Doku

- `vault/meyton/meyton-printout.md`: TL;DR ergänzen (Werte und Lagen liest Spiegel getrennt von der Zuordnung, seit 1c);
  „Empfehlung für 1c-1“ und „1c-2“ durch „Umgesetzt in 1c“ mit Verweis ersetzen; neuer Abschnitt „Werte lesen“: Leser
  `meyton-values@1`, Layouts nach Producer, Modus, Selbstprüfung (Liste der Gründe), Prüfungen gegen das Scheibenbild,
  Teiler aus der Lage samt Folge (bester Teiler weicht ≤ 0,01 mm vom Papier ab), Status, Wahl des Ausdrucks, Neulesen
  bei neuer Version, Schuss für Schuss beim Einlesen; „Alte Ausdrucke einlesen“: Aufruf in Dev; für Prod nach dem Deploy
  durch den User: SSH-Tunnel auf die Datenbank, `DATABASE_URL` auf den Tunnel, `UPLOAD_DIR=<leerer Ordner>`,
  `printout-import <ordner> --email <adresse> --dry-run`, dann ohne `--dry-run`, danach `<ordner>/printouts/*.pdf` in das
  Volume `uploads_spiegel` unter `/app/uploads/printouts/` kopieren (`docker cp` in `app-spiegel`); keine Werte, keine
  Zugangsdaten in der Doku.
- `vault/spiegel/spiegel-assignment.md` „Der QR-Weg im Detail“: Werte sofort vom Ausdruck, Vorbelegung der Disziplin,
  Prüfung Schuss für Schuss, `printMismatch` mit beiden Gründen.
- `vault/spiegel/spiegel-ingest-pipeline.md`: Regel „Nichts ohne Zustimmung speichern“ mit Schuss für Schuss.
- `vault/spiegel/spiegel-db-schema.md`: die vier Spalten an `Printout`.
- `vault/spiegel/spiegel-roadmap.md` SP-2.6: Status „Werte und Lagen vom Ausdruck (1c); fremde Anlagen und Luftgewehr
  nicht belegt“.
- `apps/spiegel/CLAUDE.md`: Befehle (`printout-import`, `printout-sample --values`), „Ausdrucke“ (Werte im Kindprozess,
  `values.ts`, `apply.ts`, `reread.ts`, Node-Prüfung), „Scheibe holen“ (Werte sofort, Vorbelegung), Ingest-Regel
  „mit Ausdruck auch: … und Schuss für Schuss“.
- `packages/meyton-pdf/CLAUDE.md`: Exporte `./reading`, `./test-printout`; `./values` kein Prototyp mehr; „Kein
  Layout-Wissen“ gilt für ID und Zeit, die Werte lesen das Layout mit Selbstprüfung; private Regression (Task 6).
- `/sync-graph` grün.
- Commit: `docs(vault): values and positions from the printout (1c)`

### Task 17 · ADR-033 Nachtrag **[geschützt: `vault/decisions/`]**

- `vault/decisions/adr-033.md`: Kopfzeile um „Nachtrag 27. Oktober 2026 (1c): Werte und Lagen vom Ausdruck“ ergänzen;
  neuer Abschnitt „Nachtrag (27. Oktober 2026): Werte und Lagen vom Ausdruck“ nach dem bestehenden Nachtrag:
  - Werte und Lagen vom Ausdruck zählen voll. Die Lage je Schuss aus Kreisen und Kreuzen des Trefferbilds (0,01 mm,
    gemessen in 1c-0) ist eine Angabe wie die gemessene; Herkunft bleibt „vom Ausdruck“. In der Tabelle der Angaben gilt
    für den Meyton-Ausdruck: Lage je Schuss ✓ (aus dem Trefferbild), Teiler aus der Lage, Zeit –. „Nie gleichgesetzt“ im
    Koordinationsplan meinte grobe Lagen; „geschätzt“ (Antippen) bleibt getrennt.
  - Nie raten: Selbstprüfung, bei Widerspruch keine Werte; Leser mit Version, gespeicherte Ausdrucke werden neu gelesen.
  - Rohdaten ergänzen eine Scheibe vom Ausdruck nur, wenn Druckzeit **und** Schüsse passen (die in [[adr-028]],
    Nachtrag 26. Oktober, angekündigte Prüfung Schuss für Schuss), dann als neue Revision.
- `vault/decisions/decisions.md` und `vault/index.md` nur, wenn sie Nachträge aufzählen. `/sync-graph` grün.
- Commit: `docs(adr): values and positions from a printout count fully (ADR-033 addendum)`

### Task 18 · Prüfung an der Prod-Kopie und im Browser

- `pnpm --filter spiegel printout-import <eigener Ordner> --dry-run`, dann ohne `--dry-run` gegen die Dev-Datenbank
  (Konto des Users). Zahlen in den Bericht; zweiter Lauf: alles „schon da“.
- Dev-Server unter Node 26 (Port melden), angemeldet mit dem eigenen Konto: eine eingelesene Scheibe öffnen (Ergebnis,
  Serien, Lagen auf der Scheibe, Streuung, „vom Ausdruck“, „ohne Zeit je Schuss“), eine ohne Werte („Werte nicht
  lesbar“). Upload von `printout-sample --values --id 7fff0a0b` legt eine Scheibe mit Werten an; die Disziplin ist im
  Blatt vorbelegt, wenn eine Disziplin „LP 40“ wählbar ist.
- Speicher des Lesers: `pnpm exec tsx tools/printout-sample.ts --values | node .next/standalone/apps/spiegel/printout-reader.mjs`
  nach `pnpm build`, `maxRssKb` und Dauer in den Bericht (auf dem Mac nur als Hinweis).
- Bericht `reports/2026-10-27-tis-1c-printout-values.md`: Ergebnisse, „nicht belegt“ (Luftgewehr, fremde Anlagen,
  Training, Treffer außerhalb des Bilds, Prod-Weg des Imports), Antwort zu Task 1.

## Required Docs

- `CLAUDE.md`, `vault/conventions.md` §9 (Mutationsprobe, `toBeCloseTo` mit null, Prüfen und Schreiben in einer
  Transaktion, Mocks filtern, Charakterisierung), §10 („So schreiben wir“, Admin nur Zustand).
- `apps/spiegel/CLAUDE.md` (Schichten, Scheiben mit Angaben, Scheibe holen, Ausdrucke, Ingest-API „Nichts ohne Zustimmung
  speichern“, Tests gegen die Dev-Datenbank, Migrationen nur anhängen, Werkzeuge mit `process.stdout.write`).
- `packages/meyton-pdf/CLAUDE.md`, `packages/shot-core/CLAUDE.md` (Geometrie, Wertung wie Meyton, `MEYTON_TOLERANCE_UM`).
- Koordinationsplan (Grundsätze; Stufe 1 → 1c mit „Was der Ausdruck außerdem hergibt“ und „Fehlertoleranz“; „Vor dem
  nächsten Release“).
- `vault/meyton/meyton-printout.md` (ganz, besonders „Werte auf dem Ausdruck, gemessen“), `vault/decisions/adr-028.md`
  (Nachträge), `adr-031.md`, `adr-033.md` (Nachtrag), `adr-029.md` (Nachtrag: private Ordner),
  `vault/spiegel/spiegel-assignment.md`, `spiegel-ingest-pipeline.md`.
- `.claude/skills/migrate/SKILL.md`, hier mit `migrate diff`/`migrate deploy` statt `migrate dev`.

## Test steps

1. `pnpm --filter @vereinsheim/meyton-pdf test` grün (mit und ohne privaten Ordner); Mutationsproben aus Task 5 rot,
   danach zurück.
2. `pnpm --filter spiegel test -- printouts fetch-card card-requests ingest admin CardPrintout scan` grün, danach
   `pnpm --filter spiegel test` ganz. Mutationsproben aus Task 9 und 12 rot, danach zurück; nach Proben am Kindprozess
   `pgrep -fl reader-child` (§9).
3. `pnpm --filter spiegel bridge-e2e` grün (Aufträge per ID mit Ausdruck ohne Werte unverändert).
4. `pnpm --filter spiegel seed:own --demo`, `pnpm build`, `pnpm --filter spiegel pruefen --start --alle` ohne FAIL
   („Scheibe holen“ mit dem Beispiel ohne Werte unverändert).
5. `tools/stack-e2e/run.sh` grün (Image mit `.npmrc`, Migration beim Start, Leser im Image).
6. Task 1 (Node-Prüfung) und Task 18 (Import, Browser, Speicher) wie beschrieben.
7. `git diff main --stat`: nichts unter `apps/spiegel-bridge/`, `packages/ingest-contract/`, `compose.yml`, `Caddyfile`,
   `scripts/`.

## Verification

- Gate `pnpm check` grün im Worktree.
- Migration: `migrate status` aktuell, zweiter `migrate diff` leer, nur `CREATE TYPE` und `ADD COLUMN`.
- An der Prod-Kopie: Anteil der eigenen Ausdrucke mit übernommenen Werten (Erwartung nach 1c-0: rund 64 von 67 mit
  Disziplin, 65 von 67 stimmig), jeder Ablehnungsgrund gezählt; Lagen auf der Seite sichtbar.
- Keine neue Brücke: `git diff main -- packages/ingest-contract apps/spiegel-bridge` leer.
- **Für „Vor dem nächsten Release“** (an die koordinierende Session): Migration `20261027200000_printout_values`
  (additiv; ein älteres Image ignoriert die Spalten); beim ersten Start liest Spiegel alle Ausdrucke an Scheiben vom
  Ausdruck neu (50 je Lauf, stündlich); die Messung des Lesers auf dem VPS mit `printout-sample --values` statt des
  Beispiels ohne Werte; Prod-Import alter Ausdrucke durch den User nach dem Deploy (Weg in [[meyton-printout]]).
