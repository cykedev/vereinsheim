# 1a-1 · Modell und Fachkern: Scheiben mit Angaben

Teil 1a-1 aus [`2026-10-26-treffsicher-in-spiegel.md`](2026-10-26-treffsicher-in-spiegel.md) (Stufe 1, Angaben-Modell).
Branch `feat/tis-1a1-card-details`, abgezweigt von `main` (Stufe 1 geht Teil für Teil nach `main`); diesen Plan als ersten
Commit übernehmen (`git show feat/treffsicher-in-spiegel:plans/2026-10-27-tis-1a1-card-details.md`). **Interaktiv, nicht
autonom:** Schema und Migration sowie `vault/decisions/` sind geschützte Pfade; diese Tasks sind mit **[geschützt]**
markiert, die Kindsession holt dort die Freigabe über die koordinierende Session. 1b-1 (`feat/tis-1b1-printouts`) läuft
parallel und ändert kein Schema; dieser Plan fasst `apps/spiegel/src/lib/printouts/`, `packages/meyton-pdf`,
`compose.yml` und `scripts/` nicht an.

## Context

ADR-033 legt fest: Eine Scheibe speichert, welche Angaben sie hat; keine Detailtiefe ist garantiert, Fehlendes ist
„fehlt“, nie 0. Mit dem User am 26. Oktober 2026 entschieden (Koordinationsplan Stufe 1 → 1a, nicht wieder aufmachen):

- Angaben je Scheibe in jeder Kombination: nur der Ausdruck (noch ohne Werte), nur das Gesamtergebnis, Serien-Summen,
  Schüsse in ganzen Ringen, Schüsse mit Zehnteln, Lage je Schuss, Lage nur als Summe (Trefferlage), Zeit je Schuss.
- Immer das Maximum speichern: Ring und Zehntel getrennt, auch bei Summen (98,4 oder nur ganze Ringe).
- Herkunft gespeichert: Brücke (`raw`), Ausdruck (`pdf`), von Hand, Treffsicher (getrennt für Wiederholung und
  Dubletten, gezeigt wie „eingetragen“). Die Wörter sind Oberfläche (1a-2).
- Disziplinen aus derselben Liste (Admin → Disziplinen), `Discipline.meytonId` wird optional. Ort als Freitext an der
  Scheibe (`Card.place`), Scheiben der Brücke ohne.
- Schusszahl bei Summen: ohne Einzelschüsse gilt jede Serie als volle Serie (Serienlänge der Disziplin), ein
  Gesamtergebnis ohne Serien als volle Schusszahl der Disziplin, außer der Erzeuger sagt etwas anderes. Die Zahl wird
  **mit der Summe gespeichert**. Vollständig heißt: Schusszahl der Disziplin. Unvollständige Scheiben zählen im Ø je
  Schuss, nicht bei Rekorden des Gesamtergebnisses.
- Trefferlage als Summe zählt nur für die Lage (Versatz, Richtung), gewichtet mit der Schusszahl, zusammen mit Lagen je
  Schuss (ADR-034). Nie für Streukreis, R50, σ oder die engste Gruppe. Kein Urteil („versetzt“) aus Summen allein.
- Eine Scheibe ohne Werte (Scan wartet auf die Brücke) existiert, hat eine Projektion ohne Werte, zählt in keiner Zahl
  und ist **nicht** „nur Probe“.
- Eine später dazukommende Angabe ist eine neue Revision; die Werte gehören zur Revision (ADR-031).

Heute fehlt dafür im Modell (geprüft am Code):

- `CardOrigin` kennt nur `raw` und `pdf`. Es gibt keine Tabelle für Serien-Summen, kein Gesamtergebnis, keine
  Trefferlage als Summe, keinen Ort und keine Serienlänge an der Disziplin.
- `Discipline.meytonId` ist Pflicht. Ohne sie ginge vieles kaputt: `plannedShotsOf` (shot-core), `recomputeDisciplineCard`
  (SQL liest `d."meytonId"`), `KnownDiscipline` in `ingest.ts`, `disciplineRow` und `siblingOf` im Admin,
  „Nummer {meytonId}“ in `DisciplineList`/`DisciplineForm`. `@@unique([siteId, meytonId, name])` lässt in Postgres
  mehrere `NULL` zu.
- `cardProjection` rechnet nur aus Schüssen. Eine Scheibe ohne Schüsse bekommt `probeOnly: true`.
  `recomputeDisciplineCard` setzt bei ihr „leer“, zählt nur Schusszeilen und würde eine Scheibe nur aus Summen „leer“
  nennen.
- `toPageCard` (`reads.ts:262`) hält eine Scheibe ohne Wertungsschuss für „nur Probe“ und nimmt ihr die Wertung der
  Disziplin.
- `result.innerTens` zählt `Shot.innerTen` (Pflicht-Boolean): Unbekannt zählt als 0.
- `projectedVolume`, `trainingVolume`, Start und Liste zählen Schüsse über `printedShots`. Für eine Scheibe aus Summen
  stünde dort 0.
- `writeRevision` mit `cardId` auf einer Scheibe vom Ausdruck: `shotChange` ergänzt die Revision des Ausdrucks
  („update“) statt eine neue anzulegen. Die Angaben des Ausdrucks und die Rohdaten mischten sich in einer Revision.
- Die Zählung je Disziplin im Admin (`admin/disciplines.ts:58`) zählt jede Scheibe mit nicht `probeOnly` als
  gewertet. Eine leere zählte dann mit 0 Schuss.

Entschieden mit dem User bei der Freigabe (26. Oktober 2026): **Vollständige Scheiben aus Summen zählen bei den
Rekorden für Ergebnis (R1), beste Serie (R2) und beste Form (R8)**, gleichrangig mit gemessenen; was Einzelschüsse
braucht, nur aus Schüssen. Erweitert ADR-033 („Rekorde je Angabe“); Task 14 trägt es dort nach.

Entschieden von der koordinierenden Session (technisch, beim Prüfen dieses Plans):

- **`Card.importKey` schon jetzt** (nullable, eindeutig), damit `writeEnteredCard` wiederholbar und testbar ist und Stufe
  3 keine zweite Schemaänderung braucht.
- **Eine übernommene Scheibe, die der Schütze ändert, wird `manual`**, der `importKey` bleibt. Eine wiederholte Übernahme
  überschreibt sie nicht und meldet „von Hand geändert, übersprungen“.
- **Zeiträume mit Scheiben ohne Streuung der Schusswerte** urteilen mit dem Rangtest über die Scheiben, wie ADR-034 es
  für Treffsicher sagt; 1a-2 zeigt das als Grundlage.
- **Serienlänge:** `Discipline.seriesShots`, null heißt 10, wenn die Schusszahl ein Vielfaches von 10 ist, sonst nennt
  sie der Erzeuger; das Feld im Admin kommt mit 1d.

Die ID vom Ausdruck einer fremden Anlage (Koordinationsplan, Wunsch des Users) braucht kein Schema. Sie steht nur am
`Printout` (`footerId`). `Card.scheibenId` setzt allein die Brücke, zusammen mit `sourceId`. Eine Scheibe ohne Quelle wird
so nie mit einer ID der eigenen Anlage gleichgesetzt.

Die Dev-Datenbank ist eine Prod-Kopie mit 272 Scheiben der Brücke, alle voll: nie zurücksetzen. Migration über
`prisma migrate diff` und `prisma migrate deploy`, nur anhängen. Tests über `createTestSite`.

## Approach

**Schema (additiv, alte Clients laufen weiter):**

- `enum CardOrigin { raw pdf manual treffsicher }`.
- `Discipline.meytonId Int?`, neu `Discipline.seriesShots Int?`. Admin; null heißt: 10, wenn die Schusszahl ein
  Vielfaches von 10 ist, sonst unbekannt (`seriesShotsOf`).
- `Card.place String?` (Freitext, höchstens 80 Zeichen; Brücke null) und `Card.importKey String? @unique` (Übernahme:
  `treffsicher:<id der Einheit>`, wiederholbar statt doppelt).
- **Angaben an der Revision**, denn die Werte gehören zur Revision:
  - `CardRevision.totalRings Int?`, `totalDecimalTenths Int?`, `totalShots Int?`;
  - `CardRevision.centerXUm Int?`, `centerYUm Int?`, `centerShots Int?`;
  - neue Tabelle `SeriesSum` (`revisionId`, `series`, `shots`, `rings Int?`, `decimalTenths Int?`,
    `@@unique([revisionId, series])`, Kaskade über die Revision).
  - **Warum zwei nullable Summen:** Ring und Zehntel einer Summe hängen nicht voneinander ab. Aus 98,4 folgt nicht die
    Summe in ganzen Ringen. Ein Ausdruck in Zehnteln zeigt nur 98,4, einer in Ringen nur 93. CHECK: mindestens einer.
- `Shot.innerTen Boolean?`: null heißt unbekannt (eingetragen ohne Lage).
- `CardProjection.detail Json?`: die Grundlage, unten.
- Kein Index neu außer dem eindeutigen `importKey`. Die Übersichten bleiben bei ihren Indizes.

**Fachkern (`@vereinsheim/shot-core`):**

- **Eingabe:** `PeriodCard.sums?: CardSums` (optional; Treffsicher und alle Tests bleiben unverändert):
  - `series: SeriesSum[]` mit `{ series, shots, rings: number|null, decimalTenths: number|null }`;
  - `total: { shots, rings, decimalTenths } | null`;
  - `center: { xUm, yUm, shots } | null`.
  - Das Präzedenz aus Treffsicher (`periodItems.ts` überschreibt `group.mpiDistance` aus `hitLocation*`) wird damit eine
    normale Eingabe: `center`.
- **Registry:**
  - `MetricDefinition.summary?: (sums: CardSums) => { value, n } | null`, nur für Kennzahlen der Ebene Scheibe ohne
    Pooling der Streuung (geprüft in `defineMetric`). Genau fünf tragen sie:
    - `result.rings` und `result.decimal` (E1): Summe der Serien, sonst das Gesamtergebnis;
    - `result.ringsMean` und `result.decimalMean` (E2): Summe durch Schusszahl;
    - `group.mpiDistance` (L2): Betrag der Trefferlage, n = deren Schusszahl.
    - Alles andere (Zehner, Innenzehner, Teiler, Streuung, Tempo) fehlt ohne Einzelschüsse.
  - **Kaskade:** erst die Schüsse wie bisher (`computeMetric`). Ist der Wert null, die Serien-Summen, wenn jede Serie
    die Angabe der Wertung trägt, sonst das Gesamtergebnis, sonst fehlt er.
    - So nimmt eine Scheibe mit Schüssen in ganzen Ringen und Serien-Summen mit Zehnteln die Zehntel aus den Summen.
    - Werte aus Summen tragen **kein** `sd`. `meanGroups` fällt dann wie bei Treffsichers Einheiten auf den Rangtest
      zurück. Ein `sd: null` würde dort als Streuung 0 mit n = 40 gelesen.
  - `MetricNeed` bekommt `"innerTen"`. `result.innerTens` braucht ihn (Version 2): Unbekannt gibt keinen Wert, nicht 0.
- **Über viele Scheiben:**
  - `shotCountOf(card)`: Schüsse wie am Ausdruck, ohne sie die Schusszahl der Summen. `trainingVolume` und
    `printedShots` zählen damit.
  - Rekord-Kandidaten aus Summen: R1 (Ergebnis je Schusszahl), R2 (beste Serie voller Länge aus Serien-Summen) und R8
    (Ø je Schuss). Die übrigen sind null. Rekorde bleiben an `complete` gebunden, unvollständige zählen also nicht.
- **Projektion, `PROJECTION_VERSION` 6:**
  - `probeOnly` nur mit mindestens einem Schuss, nur Probe und ohne Summen;
  - `printedShots = shotCountOf`;
  - neu `detail: CardDetail` mit `rings` und `tenths` (woher das Ergebnis je Wertung kommt: `"shots" | "series" |
    "total" | null`), `positions` und `times` (Schüsse wie am Ausdruck mit Lage bzw. Zeit) und `center` (Mitte aus den
    Lagen je Schuss oder die Trefferlage als Summe, mit n und Herkunft);
  - 1a-2 liest daraus „nur Serien-Summen“, „nur Gesamtergebnis“, „ohne Zehntel“, „wartet auf die Anlage“ und die
    Grundlage, ohne Schüsse zu laden;
  - `pooledCenter(cards)` führt Mitten gewichtet mit n zusammen (nur Versatz und Richtung). Urteile laufen weiter nur über
    Lagen je Schuss (`marks`), dort stehen Summen nicht.
- **Innenzehner:** `MetricShot.innerTen: boolean | null`; `ringDistribution.innerTens` ist null, wenn einem gezählten
  Schuss die Angabe fehlt.
- **Disziplin:** `plannedShotsOf(meytonId: number | null, override)` und `seriesShotsOf(override, plannedShots)`.
- **Treffsicher bleibt, wie es ist** (ADR-033: nur Fehlerbehebungen). Sein Adapter könnte `center` und Summen übergeben,
  der Wechsel brächte Nutzern aber nichts. Treffsicher endet ohnehin, und die Übernahme (Stufe 3) schreibt die Daten mit
  `writeEnteredCard` nach Spiegel.

**App (`apps/spiegel`):**

- `revisionSums(tx, revisionId)` liest die Angaben einer Revision (undefined ohne Summen: Scheiben der Brücke rechnen
  genau wie bisher). `saveProjection`, `refreshProjections` und `recomputeDisciplineCard` übergeben sie an den Fachkern.
- `detailFlags` und `revisionCounts` (`card-checks.ts`):
  - Schusszahl der Wertung aus den Wertungsschüssen, ohne sie aus den Summen;
  - Merkmale der Vollständigkeit (`leer`, `nur-probe`, `unvollstaendig`, `ueber-soll`) nur für Scheiben mit Werten,
    Scheiben der Brücke wie bisher;
  - `complete` nur mit Werten.
- `writeRevision` (Brücke):
  - Bekommt eine Scheibe vom Ausdruck ihre Rohdaten (Quelle neu), entsteht immer eine neue Revision, ohne „korrigiert“.
    Der Ort wird geleert.
  - Eine eingetragene Scheibe (`manual`, `treffsicher`) bekommt nie Rohdaten (`RangeError`).
  - `writeRevision` nimmt keine eingetragene Herkunft an.
- **`writeEnteredCard` / `writeEnteredCardIn(tx, …)`** (`src/lib/db/entered.ts`): einziger Weg für Scheiben ohne
  Brücke (Scan 1b-2, Parser 1c, Hand 1d, Übernahme Stufe 3).
  - Prüft und normalisiert die Angaben rein (`src/lib/entered/details.ts`).
  - Legt Scheibe und Revision 1 an oder schreibt bei einer Änderung eine neue Revision, rechnet Merkmale und
    Projektion. Gleiche Angaben bleiben `unchanged`.
  - **Wer was ändern darf** (`detailsWriter`): Rohdaten nie. Eine Scheibe vom Ausdruck nur vom Ausdruck (Parser), nie
    von Hand. Eingetragene nur von Hand. Eine aus Treffsicher von Hand (dann `manual`, der `importKey` bleibt, damit
    eine wiederholte Übernahme sie nicht überschreibt) oder von der Übernahme.
  - `standScoring` einer eingetragenen Scheibe ist „wie eingetragen“: Zehntel, wenn alle Werte Zehntel tragen, sonst
    ganze Ringe. So stimmt `cardScoring` ohne Wertung an der Disziplin.
- **Leser:**
  - `toPageCard`: „nur Probe“ erst mit mindestens einem Schuss.
  - Admin-Zahlen: Schusszahl nur mit `printedShots > 0`, „Anzeige am Stand“ nur aus Scheiben der Brücke.
  - Liste, Start und Fortschritt bleiben unverändert und zählen richtig, weil `printedShots` die Schusszahl ist.
  - `OVERVIEW_SELECT` bekommt `detail`, `origin` und `place` erst in 1a-2.
- **Nicht in 1a-1:**
  - Oberfläche: Wörter der Herkunft, „–“ mit Grund, Grundlage, Demo-Scheiben (1a-2).
  - Admin-Formular für eine Disziplin ohne Meyton-ID und für `seriesShots`: gehört an den Anfang von **1d**, die erste
    Stelle, die sie braucht. Dort prüft die Action auch eindeutige Namen unter den Disziplinen ohne Nummer in einer
    Transaktion, weil die Datenbank `NULL` nicht als gleich ansieht.
  - Wahl der Disziplin für eingetragene Scheiben über `choiceWhere` hinaus (1d).
  - Vorschläge für den Ort (1d).

## Files

### Task 0 · Branch und Plan

- Im eigenen Worktree: `git switch -c feat/tis-1a1-card-details main`, dann
  `git show feat/treffsicher-in-spiegel:plans/2026-10-27-tis-1a1-card-details.md > plans/2026-10-27-tis-1a1-card-details.md`.
- Commit: `docs(plans): plan the card details model (1a-1)`

### Task 1 · Werkzeug: Projektionen vor und nach einer neuen Version vergleichen; Stand sichern

Zuerst, bevor irgendein Code dieses Branchs Projektionen der Dev-Datenbank neu rechnet. Kein Dev-Server aus diesem
Worktree vor diesem Schritt.

- `apps/spiegel/tools/dev-guard.ts` (neu): `assertDevDatabase(url: string, force: boolean)`, aus
  `tools/seed-own.ts` verschoben (unverändert). `seed-own.ts` importiert es von dort.
- `apps/spiegel/tools/projection-check.ts` (neu, Ausgabe nur über `process.stdout.write`, nur Kennungen und Zahlen,
  nie Werte):
  - `dump <datei>`:
    - liest für alle Scheiben mit `origin = 'raw'` die Projektion (`cardId`, `revisionId` als Text, `version`,
      `probeOnly`, `suspicious`, `printedShots`, `values`, `records`, `marks`), nach `cardId` sortiert;
    - schreibt JSON (Verzeichnis mit `mkdirSync(…, { recursive: true })`);
    - Ausgabe `<n> Projektionen gesichert`.
  - `compare <datei>`:
    - `await refreshStaleProjections(db)`, liest dieselben Felder neu;
    - je Scheibe Vergleich von `probeOnly`, `suspicious`, `printedShots`, `values`, `records`, `marks` über
      `canonicalize` aus `@vereinsheim/ingest-contract/canonical`;
    - prüft, dass jede `version` gleich `projectionVersion()` ist;
    - Ausgabe `gleich: <n>, abweichend: <n>, fehlt: <n>, alte Version: <n>`, je abweichender Scheibe
      `<cardId>: <schlüssel,…>`;
    - Exit 1 bei jeder Abweichung.
  - Vorher `assertDevDatabase(process.env.DATABASE_URL ?? DEV_DATABASE_URL, args.includes("--force"))`.
  - Kopfkommentar: Die Datei enthält Werte echter Schützen und gehört nach `reports/` (gitignored, ADR-029).
- `apps/spiegel/package.json`: `"projection-check": "tsx tools/projection-check.ts"`.
- `apps/spiegel/CLAUDE.md`, Befehlstabelle: Zeile `pnpm --filter spiegel projection-check dump|compare <datei>`,
  „Projektionen der Brücke vor und nach einer neuen `PROJECTION_VERSION` vergleichen; Datei nach `reports/`“.
- Ausführen: `pnpm --filter spiegel projection-check dump ../../reports/tis-1a1/projections-before.json`, erwartet
  „272 Projektionen gesichert“. Weicht die Zahl ab, die Zahl melden und weitermachen.
- Commit: `feat(spiegel): tool to compare stored projections before and after a new version`

### Task 2 · shot-core: Innenzehner unbekannt statt 0

- `packages/shot-core/src/metrics.ts`:
  - `MetricShot.innerTen: boolean | null` (Kommentar: „null unbekannt, etwa eingetragen ohne Lage“).
  - `MetricNeed = "ring" | "decimal" | "position" | "distance" | "time" | "innerTen"`. In `satisfies`:
    `case "innerTen": return typeof shot.innerTen === "boolean"`. In `allowed`:
    `const valueOnly = filter.need === "ring" || filter.need === "decimal" || filter.need === "innerTen"`.
  - `result.innerTens`: `needs: "innerTen"`, `version: 2` (Kommentar „2: unbekannt ist kein Innenzehner, sondern kein
    Wert“), `compute: (shots) => shots.filter((shot) => shot.innerTen === true).length`.
- `packages/shot-core/src/analysis/result.ts`: `RingDistribution.innerTens: number | null`. Null, wenn ein gezählter
  Schuss `innerTen === null` hat, sonst die Zahl mit `=== true`.
- `packages/shot-ui/src/analysis/tabs/ResultTab.tsx:125`: Note ohne Innenzehner, wenn null:
  ``{`${dist.innerTens === null ? "" : `${dist.innerTens} Innenzehner · `}n = ${dist.n}`}``.
- Tests:
  - `metrics.test.ts`: zehn Schüsse mit Ring und `innerTen: null` → `computeMetric(result.innerTens)` ist `null`
    (`toBeNull`); dieselben mit `innerTen: false` → erst `not.toBeNull()`, dann `toBe(0)`; ein verdächtiger Schuss
    mit `innerTen: true` zählt weiter (wertbasiert).
  - `result.test.ts`: `ringDistribution` mit einem `innerTen: null` → `innerTens` null.
  - `projection.test.ts`: Der Fingerabdruck wird rot (Version von E5). Erst nach Task 5 neu setzen; in diesem Commit
    nur `version` und `output` auf die Werte des Tests setzen, die der Lauf meldet. Vorher prüfen, dass sich nur die
    Version ändert: `output` bleibt gleich.
- Commit: `fix(shot-core): unknown inner tens are missing, not zero`

### Task 3 · shot-core: Disziplin ohne Meyton-ID, Serienlänge

- `packages/shot-core/src/discipline.ts`:
  - `plannedShotsOf(meytonId: number | null, override: number | null)`: `override === 0` → null; `override !== null` →
    override; `meytonId === null` → null; sonst aus der ID.
  - `export const DEFAULT_SERIES_SHOTS = 10`.
  - `export function seriesShotsOf(override: number | null, plannedShots: number | null): number | null`: override,
    sonst `DEFAULT_SERIES_SHOTS`, wenn `plannedShots` ein positives Vielfaches von 10 ist, sonst null. Kommentar:
    „Schüsse je Serie: ohne Einzelschüsse gilt jede Serie als volle Serie ([[adr-033]], Nachtrag 27. Oktober 2026)“.
- `discipline.test.ts`:
  - `plannedShotsOf(null, null)` null, `(null, 40)` 40, `(null, 0)` null;
  - `seriesShotsOf(null, 40)` 10, `(null, 15)` null, `(5, 40)` 5, `(null, null)` null, `(null, 0)` null.
- Commit: `feat(shot-core): disciplines without a Meyton id and their series length`

### Task 4 · shot-core: Summen und Trefferlage als Eingabe der Kennzahlen

- `packages/shot-core/src/metrics.ts`:
  - Typen:
    ```ts
    export interface SeriesSum { series: number; shots: number; rings: number | null; decimalTenths: number | null }
    export interface CardSums {
      series: readonly SeriesSum[]
      total: { shots: number; rings: number | null; decimalTenths: number | null } | null
      center: { xUm: number; yUm: number; shots: number } | null
    }
    export type SumSource = "series" | "total"
    ```
  - `sumsShots(sums?: CardSums): number`: Σ `series[].shots`, wenn Serien da sind, sonst `total?.shots ?? 0`.
  - `sumsResult(sums: CardSums | undefined, scoring: Scoring): { tenths: number; shots: number; source: SumSource } |
    null`:
    - Serien, wenn es welche gibt und jede den Wert der Wertung trägt (rings → `rings * 10`, decimal →
      `decimalTenths`), mit Σ `shots`;
    - sonst das Gesamtergebnis mit diesem Wert;
    - sonst null.
    - Ergebnis in Zehnteln, damit beide Wertungen eine Rechnung haben.
  - `MetricDefinition.summary?: (sums: CardSums) => { value: number; n: number } | null`. Kommentar: Wert aus Angaben
    ohne Einzelschüsse, nur wenn die Schüsse keinen geben; nie für Streuung ([[adr-033]]).
  - `defineMetric` prüft:
    - `summary` nur mit `scopes` mit „card“;
    - `summary` nicht mit `pooling` `spreadAxis` oder `spreadRadial`;
    - sonst `RangeError`.
  - `export function summaryValue(metric, sums?: CardSums): { value: number; n: number } | null`: ohne `metric.summary`
    oder `sums` null; sonst das Ergebnis, nur wenn `n >= metric.minShots`.
  - In `METRICS`:
    - `result.rings`: `summary: (s) => { const r = sumsResult(s, "rings"); return r && { value: r.tenths / 10, n: r.shots } }`;
    - `result.decimal`: dasselbe mit „decimal“;
    - `result.ringsMean` und `result.decimalMean`: `value: r.tenths / 10 / r.shots`;
    - `group.mpiDistance`: `s.center && { value: Math.hypot(s.center.xUm, s.center.yUm) / 1000, n: s.center.shots }`.
    - Keine Versionen erhöhen (die Formel aus Schüssen bleibt), die Projektion steigt in Task 6.
- `metrics.test.ts`, „Registry“:
  - `METRICS.filter((m) => m.summary).map((m) => m.key).sort()` ist genau
    `["group.mpiDistance", "result.decimal", "result.decimalMean", "result.rings", "result.ringsMean"]`;
  - `defineMetric` mit `summary` an einer Kennzahl mit `pooling: "spreadRadial"` wirft; ebenso mit
    `scopes: ["series"]`;
  - `sumsResult`:
    - Serien `[93, 95, 94, 96]` Ringe → `{ tenths: 3780, shots: 40, source: "series" }`;
    - eine Serie ohne Ringe und `total.rings` 378 → `source: "total"`;
    - ohne beides null.
- Commit: `feat(shot-core): series sums, totals and the summary position as metric input`

### Task 5 · shot-core: Werte und Rekorde über Scheiben aus Summen

- `packages/shot-core/src/analysis/period.ts`:
  - `PeriodCard.sums?: CardSums` (Kommentar: Angaben ohne oder neben Einzelschüssen, [[adr-033]]).
  - `cardValues`: ist der Wert aus Schüssen null (oder gibt es keine zählenden Schüsse), dann
    `summaryValue(scored, card.sums)`. Eintrag `{ id, atMs, value: gerundet wie bisher, n }` **ohne** `sd`.
  - Kommentar an `CardValue.sd`: fehlt bei Werten aus Summen. Zeiträume urteilen dann mit dem Rangtest (`compareValues`).
  - `trainingVolume`: `shots: group.reduce((sum, card) => sum + shotCountOf(card), 0)`.
- `packages/shot-core/src/analysis/card-shots.ts`:
  - `shotCountOf(card: Pick<PeriodCard, "shots" | "sums">): number`: `asOnPrintout(card.shots).length ||
    sumsShots(card.sums)`.
  - Kommentar an `cardShots`: „ohne Schüsse zählt die Scheibe nur über ihre Summen“.
- `packages/shot-core/src/analysis/records.ts`, `cardRecordCandidates`:
  - Ohne zählende Schüsse: null nur, wenn `sumsResult(card.sums, scoring)` und die Serien-Summen nichts geben. Sonst
    Kandidaten mit:
    - `n: shotCountOf(card)`;
    - `result: summaryValue(inScoring(RESULT, scoring), card.sums)?.value ?? null`;
    - `bestSeries` aus den Serien-Summen: volle Länge = `modalLength` der `shots`, die höchste mit Wert der Wertung,
      bei Gleichstand die frühere;
    - `mean` aus `cardValues`;
    - alles andere null.
  - Mit Schüssen: `result: computeMetric(…) ?? summaryValue(inScoring(RESULT, scoring), card.sums)?.value ?? null`, und
    `bestSeries` aus den Serien-Summen, wenn `seriesCurve` keine liefert.
  - Scheiben ohne `sums` rechnen unverändert.
- `packages/shot-core/src/analysis/sums.test.ts` (neu). Erfundene Scheiben, Startzeit je einen Tag auseinander,
  `complete: true`, wo nicht anders gesagt. Erwartungen von Hand gerechnet:
  1. `total-rings`: `sums.total = { shots: 40, rings: 371, decimalTenths: null }`:
     - `result.rings` 371 mit n 40;
     - `result.ringsMean` 9,275 mit n 40, und `"sd" in entry` ist false;
     - `cardValues(…, result.decimal, "decimal")` ist leer;
     - `result.tens` leer.
  2. `series-tenths`: Serien 984, 991, 977, 1002 (je 10 Schuss, ohne Ringe):
     - `result.decimal` 395,4;
     - `result.decimalMean` 9,885;
     - `result.rings` leer;
     - Rekord-Kandidaten Zehntel: `bestSeries` `{ length: 10, value: 100.2, series: 4 }`, `n` 40.
  3. `shots-rings`: zehn Wertungsschüsse Serie 1, Ringe 10, 9, 10, 8, 9, 10, 10, 9, 9, 10, ohne Zehntel, ohne Lage,
     `innerTen: null`:
     - `result.rings` 94;
     - `result.tens` 5 (erst `not.toBeNull()`);
     - `result.innerTens` leer;
     - `result.decimal` leer.
  4. Kaskade: wie 3, dazu `sums.series = [{ series: 1, shots: 10, rings: 94, decimalTenths: 978 }]` →
     `result.decimal` 97,8 aus den Summen, `result.rings` 94 aus den Schüssen.
  5. `center-total`: `total = { shots: 40, rings: 380, decimalTenths: null }`,
     `center = { xUm: 1200, yUm: -500, shots: 40 }`:
     - `group.mpiDistance` 1,3 mit n 40;
     - `group.sigma`, `group.enclosingDiameter` und `group.r50` leer.
  6. Präzedenz Treffsicher: Schüsse wie 3 und `center = { xUm: 500, yUm: 1200, shots: 10 }` → `group.mpiDistance` 1,3
     mit n 10.
  7. Unvollständig: `total = { shots: 30, rings: 280, decimalTenths: null }`, `complete: false`:
     - in `cardValues(result.ringsMean)` mit n 30 (Wert `280 / 30`, erst `not.toBeNull()`, dann `toBeCloseTo`);
     - in `periodRecords(…, "rings")` nicht in `bestCard`.
  8. `periodRecords([1, 7, Scheibe aus `card()` mit 40 Schuss], "rings")`: `bestCard[40]` ist Scheibe 1 mit 371 (oder
     die aus `card()`, wenn höher). Der Test baut die `card()`-Scheibe mit einem Ergebnis unter 371.
  9. `trainingVolume([leer, 1, 3])` in einem Abschnitt: `shots` 50, `cards` 3.
  10. `compareValues`: fünf Scheiben wie 1 gegen fünf aus `card()` (`result.ringsMean`) → `basis: "cards"`.
- Commit: `feat(shot-core): card values and records from sums`

### Task 6 · shot-core: Projektion jeder Detailtiefe

- `packages/shot-core/src/analysis/projection.ts`:
  - `PROJECTION_VERSION = 6`, Kommentar ergänzen: „6: Angaben ohne Einzelschüsse (Summen, Trefferlage als Summe), die
    Grundlage (`detail`), nur Probe erst mit einem Schuss“.
  - Typen:
    ```ts
    export type ValueSource = "shots" | SumSource
    export interface CardDetail {
      rings: ValueSource | null
      tenths: ValueSource | null
      positions: number
      times: number
      center: { xUm: number; yUm: number; n: number; from: "shots" | "summary" } | null
    }
    ```
    `CardProjection.detail?: CardDetail`. Kommentar: fehlt in Projektionen vor Version 6, bis `refreshProjections` sie
    nachrechnet. `cardProjection` liefert sie immer.
  - `cardDetail(card: PeriodCard): CardDetail` (exportiert):
    - `counted = cardShots(card.shots, true)?.match ?? []`;
    - `rings`: „shots“, wenn `computeMetric(result.rings, counted)` nicht null ist, sonst
      `sumsResult(card.sums, "rings")?.source ?? null`; `tenths` ebenso mit „decimal“;
    - `positions = selectShots(counted, { need: "position" }).length`;
    - `times = selectShots(counted, { need: "time" }).length`;
    - `center`: Schwerpunkt (`centroid`) von `eligibleShots(group.mpiDistance, counted)` mit n und `from: "shots"`,
      wenn es welche gibt; sonst `card.sums.center` mit `n: center.shots`, `from: "summary"`; sonst null.
  - `cardProjection`:
    - `probeOnly: card.shots.length > 0 && !card.shots.some((s) => s.kind === "match") &&
      sumsShots(card.sums) === 0`;
    - `printedShots: shotCountOf(card)`;
    - `detail: cardDetail(card)`.
  - `pooledCenter(cards: readonly Pick<ProjectedCard, "projection">[]): { xUm: number; yUm: number; n: number;
    summaryShots: number } | null`:
    - Σ nᵢ·cᵢ / Σ nᵢ über `projection.detail?.center`;
    - `summaryShots` = Σ n der Mitten mit `from: "summary"`;
    - ohne Mitte null.
    - Kommentar: nur Versatz und Richtung ([[adr-034]]). Streuung und Urteile nehmen nur Lagen je Schuss.
- `packages/shot-core/src/analysis/projection.test.ts`:
  - „Grenzfälle“: Erwartung `[true, false, false, false, true]` → `[false, false, false, false, true]` (die leere ist
    nicht „nur Probe“).
  - Neue Liste `SUMS` (die Scheiben 1–7 aus Task 5 plus eine leere ohne `sums`), nicht in `CARDS` (der Fingerabdruck
    hängt nicht an neuen Fällen). Je Wertung und `includeProbeOnly`:
    - `projectedValues(SUMS.map(projectCard)) == cardValues(SUMS)`;
    - `projectedRecords == periodRecords`;
    - `projectedVolume == trainingVolume`;
    - `pooledMean == ` Hand-Rechnung: `pooledMean([total-rings, shots-rings], "rings")` ist 9,3 (465 / 50).
  - `detail`:
    - leer → `{ rings: null, tenths: null, positions: 0, times: 0, center: null }`, `printedShots` 0, `values` `{}`,
      `records` `{ decimal: null, rings: null }`, `probeOnly` false;
    - `total-rings` → `rings: "total"`, `tenths: null`, `printedShots` 40;
    - `series-tenths` → `tenths: "series"`;
    - Kaskade → `rings: "shots"`, `tenths: "series"`;
    - `center-total` → `center` `{ xUm: 1200, yUm: -500, n: 40, from: "summary" }`;
    - eine Scheibe aus `card()` → `from: "shots"` mit n gleich `values["group.mpiDistance"].n`.
  - `pooledCenter`:
    - `center-total` und eine Projektion mit `center: { xUm: -1000, yUm: 2000, n: 10, from: "shots" }` →
      `{ xUm: 760, yUm: 0, n: 50, summaryShots: 40 }` (für `yUm` erst `not.toBeNull()` auf das Ergebnis, dann `toBe(0)`);
    - ohne Mitten null.
  - Fingerabdruck: Version `p6-…` und `output` neu setzen. Vorher den Fehltext lesen: Nur `detail` darf in der Ausgabe
    neu sein, alle übrigen Felder der `CARDS` gleich. Dafür einmalig lokal `JSON.stringify` ohne `detail` vergleichen:
    gleicher `output` wie in Task 2.
- `packages/shot-core/src/analysis/card-shots.test.ts`: `shotCountOf` mit Schüssen, nur Summen, nichts.
- Commit: `feat(shot-core): project cards at any level of detail`

### Task 7 · Schema und Migration **[geschützt]**

Vor dem Anwenden eine Nachricht an die koordinierende Session: „1a-1 ändert das Schema der Dev-Datenbank von Spiegel,
additiv (Herkunft, Summen, Ort, Disziplin ohne Nummer). Andere Worktrees laufen weiter, Dev-Server mit altem Code
rechnen die Projektionen nur auf p5 zurück.“ Erst nach OK weiter.

- `apps/spiegel/prisma/schema.prisma`:
  - `enum CardOrigin { raw pdf manual treffsicher }`. Kommentar: Rohdaten der Brücke, vom Ausdruck (Scan, Upload,
    Parser), von Hand eingetragen, aus Treffsicher übernommen (gezeigt wie eingetragen, getrennt für Wiederholung und
    Dubletten der Übernahme).
  - `Discipline.meytonId Int?`. Kommentar: „null: vom Admin ohne Meyton angelegt; der eindeutige Schlüssel lässt dann
    mehrere zu, das Anlegen prüft den Namen“.
  - `Discipline.seriesShots Int?`. Kommentar: „Schüsse je Serie vom Admin; null: 10 bei einer Schusszahl aus Zehnern
    (`seriesShotsOf`)“.
  - `Card.place String?`. Kommentar: „Ort als Freitext für Scheiben ohne Brücke; null: die Anlage (Brücke) oder ohne
    Angabe“.
  - `Card.importKey String? @unique`. Kommentar: „Schlüssel der Übernahme (`treffsicher:<id>`): ein zweiter Lauf
    ersetzt statt zu verdoppeln“.
  - `CardRevision.totalRings Int?`, `totalDecimalTenths Int?`, `totalShots Int?`, `centerXUm Int?`, `centerYUm Int?`,
    `centerShots Int?`, `seriesSums SeriesSum[]`, mit Kommentaren wie in „Approach“.
  - Neues Modell:
    ```prisma
    // Serien-Summe einer Revision: ohne Einzelschüsse die Angabe der Serie, neben ihnen die Summe vom Ausdruck
    model SeriesSum {
      id            BigInt       @id @default(autoincrement())
      revisionId    BigInt
      revision      CardRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)
      series        Int
      // Schusszahl der Serie, gespeichert mit der Summe ([[adr-033]], Nachtrag 27. Oktober 2026)
      shots         Int
      // Summe in ganzen Ringen und in Zehnteln (984 = 98,4), getrennt; mindestens eine
      rings         Int?
      decimalTenths Int?

      @@unique([revisionId, series])
    }
    ```
  - `Shot.innerTen Boolean?`. Kommentar: „null: unbekannt (eingetragen ohne Lage)“.
  - `CardProjection.detail Json?`. Doc-Kommentar: „/// Grundlage der Werte (`CardDetail`); null vor Version 6“.
- Migration:
  1. `pnpm --filter spiegel exec prisma migrate status` → „Database schema is up to date!“ (sonst Stopp und melden).
  2. `mkdir apps/spiegel/prisma/migrations/20261027120000_card_details`, dann
     `pnpm --filter spiegel exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/20261027120000_card_details/migration.sql`
     (aus `apps/spiegel`). Prisma 7: kennt es die Option nicht, die Form aus `prisma migrate diff --help` nehmen. **Nie**
     `migrate dev`: es verlangt bei einer Abweichung einen Reset der Prod-Kopie.
  3. Die Datei prüfen. Erlaubt sind nur:
     - `ALTER TYPE "CardOrigin" ADD VALUE` (zweimal);
     - `ALTER TABLE … ADD COLUMN`;
     - `ALTER COLUMN "meytonId" DROP NOT NULL` und `ALTER COLUMN "innerTen" DROP NOT NULL`;
     - `CREATE TABLE "SeriesSum"`, `CREATE UNIQUE INDEX` (zweimal), `ADD CONSTRAINT … FOREIGN KEY`.
     - Kein `DROP`. Sonst Stopp und melden.
  4. Ans Ende anhängen:
     ```sql
     -- Angaben ohne Einzelschüsse: Prisma kennt keine CHECKs, sie halten nur die Datenbank sauber
     ALTER TABLE "SeriesSum" ADD CONSTRAINT "SeriesSum_value_check" CHECK ("rings" IS NOT NULL OR "decimalTenths" IS NOT NULL);
     ALTER TABLE "SeriesSum" ADD CONSTRAINT "SeriesSum_count_check" CHECK ("series" > 0 AND "shots" > 0);
     ALTER TABLE "CardRevision" ADD CONSTRAINT "CardRevision_total_check" CHECK (
       (("totalRings" IS NULL AND "totalDecimalTenths" IS NULL) = ("totalShots" IS NULL)) AND ("totalShots" IS NULL OR "totalShots" > 0));
     ALTER TABLE "CardRevision" ADD CONSTRAINT "CardRevision_center_check" CHECK (
       ("centerXUm" IS NULL) = ("centerYUm" IS NULL) AND ("centerXUm" IS NULL) = ("centerShots" IS NULL) AND ("centerShots" IS NULL OR "centerShots" > 0));
     ```
  5. `pnpm --filter spiegel exec prisma migrate deploy`, dann `pnpm --filter spiegel exec prisma generate`.
  6. Gegenprobe: derselbe `migrate diff` liefert eine leere Migration; `migrate status` ist aktuell.
- Typen dem Schema nachziehen (sonst rotes Gate in diesem Commit):
  - `apps/spiegel/src/lib/db/cards.ts`: `ShotInput.innerTen: boolean | null`, `shotFromRow` (`innerTen: boolean |
    null`). In `recomputeDisciplineCard` der Typ `meytonId: number | null`.
  - `apps/spiegel/src/lib/ingest/card-checks.ts`: `CheckableShot.innerTen: boolean | null`.
  - `apps/spiegel/src/lib/ingest/ingest.ts`: `KnownDiscipline.meytonId: number | null`.
  - `apps/spiegel/src/lib/admin/discipline-model.ts`:
    - `DisciplineRow.meytonId: number | null`, Eingabe `meytonId: number | null`;
    - in `disciplineRow` bei `meytonId === null`: `suggestion` `{ targetId: null, source: "unknown",
      plannedShotsFromId: null, ignore: false, sibling }` ohne `resolveTarget`/`parseDisciplineId`.
  - `apps/spiegel/src/lib/admin/disciplines.ts` (`siblingOf`): `d.meytonId !== null && o.meytonId === d.meytonId`.
  - `apps/spiegel/src/components/admin/DisciplineList.tsx:91` und `DisciplineForm.tsx:109`: „Nummer {row.meytonId} ·
    “ nur, wenn nicht null; sonst nur `cardsText(…)`. Kein neues Wort.
  - `apps/spiegel/tools/own-cards.ts`: `innerTen` bleibt `boolean`, passt.
- Tests: `discipline-model.test.ts` (Zeile ohne Nummer: kein Wurf, Vorschlag unbekannt), `disciplines.test.ts` (eine
  Disziplin ohne Nummer neben einer mit Nummer: keine Zuordnung als umbenannt).
- Commit: `feat(spiegel): schema for card details, origins and disciplines without a Meyton id`

### Task 8 · Projektion und Nachrechnen aus den gespeicherten Angaben

- `apps/spiegel/src/lib/db/cards.ts`:
  - `export async function revisionSums(tx: Tx | Db, revisionId: bigint): Promise<CardSums | undefined>`:
    - eine Abfrage der Revision mit `total*`, `center*` und `seriesSums` (nach `series`);
    - `undefined`, wenn nichts davon gesetzt ist;
    - sonst `{ series, total: totalShots === null ? null : { shots, rings, decimalTenths }, center: centerShots ===
      null ? null : { xUm, yUm, shots } }`.
  - `saveProjection` exportieren, Signatur `(tx, cardId, revisionId, shots, sums?: CardSums)`:
    - `PeriodCard` mit `sums`;
    - `detail: projection.detail as unknown as Prisma.InputJsonObject` in `data`.
  - `refreshProjections`:
    - neue Option `cardIds?: readonly string[]` (`AND c.id = ANY(${[...cardIds]})`, für Tests eingetragener Scheiben ohne
      Quelle);
    - je Scheibe `revisionSums` laden und übergeben.
  - `recomputeDisciplineCard`:
    - SQL liest zusätzlich `c.origin`;
    - `sums = await revisionSums(tx, revisionId)`;
    - Merkmale über `detailFlags({ origin: row.origin, ...revisionCounts(shots, sums), plannedShots:
      plannedShotsOf(row.meytonId, row.plannedShots), targetId, targetMismatch })`;
    - `complete: isComplete(row.state, flags) && counts.valued`;
    - `saveProjection(…, sums)`.
- `apps/spiegel/src/lib/ingest/card-checks.ts`:
  - `export const COMPLETENESS_FLAGS = ["leer", "nur-probe", "unvollstaendig", "ueber-soll"] as const satisfies
    readonly CardFlag[]`.
  - `revisionCounts(shots: readonly { stellung: number }[], sums: CardSums | undefined): { sighterShots: number;
    matchShots: number; valued: boolean }`:
    - Wertungsschüsse aus den Zeilen, ohne sie `sumsShots(sums)`;
    - `valued` = Schüsse oder `sumsShots(sums) > 0`.
  - `detailFlags(input: Parameters<typeof mappingFlags>[0] & { origin: CardOrigin; valued: boolean }): CardFlag[]`:
    `mappingFlags(input)`, ohne `COMPLETENESS_FLAGS`, wenn `!valued && origin !== "raw"`.
  - Kommentar: Eine Scheibe ohne Werte (wartet auf die Brücke) ist weder leer noch nur Probe.
- Tests:
  - `cards-discipline.test.ts`: vorhandene bleiben grün. Neu: Scheibe der Brücke ohne Schüsse behält „leer“ und
    `complete` false (Raw-Verhalten unverändert).
  - `card-checks.test.ts` (falls fehlt: neu):
    - `revisionCounts` mit Zeilen, nur Summen (`total.shots` 40 → `matchShots` 40, `valued` true), nichts;
    - `detailFlags` für `pdf` ohne Werte → ohne „leer“; `raw` ohne Werte → „leer“.
  - `cards-refresh.test.ts`: `refreshProjections(db, { cardIds: [id] })` rechnet nur diese Scheibe.
- Commit: `feat(spiegel): project and recompute cards from their stored details`

### Task 9 · Rohdaten an einer Scheibe vom Ausdruck: neue Revision

- `apps/spiegel/src/lib/db/cards.ts`:
  - `writeRevision`: am Anfang `if (input.card.origin === "manual" || input.card.origin === "treffsicher") throw new
    RangeError("eingetragene Scheiben schreibt writeEnteredCard")`.
  - `writeCard`:
    - `const upgrade = existing.sourceId === null && input.card.sourceId !== null`;
    - bei `upgrade` und `existing.origin !== "pdf"`: `RangeError("Scheibe … ist eingetragen und bekommt keine
      Rohdaten")`;
    - bei `upgrade` kein `shotChange` (`change = null`, also kein „korrigiert“), nach dem `card.update` direkt
      `newRevision(tx, cardId, current ? current.number + 1 : 1, input, hash)`.
    - Kommentar: Die Angaben des Ausdrucks bleiben in ihrer Revision ([[adr-031]]).
  - `identityUpdate` gibt beim Verbinden zusätzlich `place: null` zurück (der Ort ist dann die Anlage).
  - `EXISTING_SELECT` bleibt (`origin` ist schon drin).
- `cards.test.ts`, Test „Scheibe nur aus dem PDF“:
  - zusätzlich `row.flags` ohne „korrigiert“ nach dem Verbinden;
  - neu: Scheibe vom Ausdruck **ohne Schüsse** (über `writeEnteredCard` aus Task 11, deshalb dieser Teil in Task 11)
    und eine eingetragene (`manual`): `writeRevision` mit `cardId` und Quelle wirft `RangeError`;
  - `writeRevision` mit `origin: "manual"` wirft.
- Commit: `fix(spiegel): raw data for a printout card starts a new revision`

### Task 10 · Angaben prüfen und normalisieren (rein)

- `apps/spiegel/src/lib/entered/details.ts` (neu, ohne Datenbank):
  - Eingabetypen:
    ```ts
    export type EnteredOrigin = "pdf" | "manual" | "treffsicher"
    export interface EnteredShot {
      series: number | null; ring: number | null; decimalTenths: number | null; innerTen?: boolean | null
      xUm?: number | null; yUm?: number | null; distanceTenthsUm?: number | null; firedAtMs?: number | null; probe?: boolean
    }
    export interface DetailsInput {
      shots?: readonly EnteredShot[]
      series?: readonly { series: number; shots?: number | null; rings?: number | null; decimalTenths?: number | null }[]
      total?: { shots?: number | null; rings?: number | null; decimalTenths?: number | null } | null
      center?: { xUm: number; yUm: number; shots?: number | null } | null
    }
    export interface NormalizedDetails { shots: ShotInput[]; sums: CardSums | undefined }
    export type DetailsProblem =
      | "shotValue" | "shotRingTenths" | "shotSeries" | "seriesNumber" | "seriesShotsUnknown" | "seriesValue"
      | "seriesShots" | "seriesSum" | "totalShotsUnknown" | "totalValue" | "totalMismatch" | "centerWithoutResult"
      | "centerValue" | "place" | "importKey"
    ```
  - `PLACE_MAX = 80`. `normalizePlace(raw: string | null | undefined)`: `undefined` bleibt `undefined`; sonst trimmen,
    Leerraum zusammenfassen, leer → null, länger als 80 → Problem `place`.
  - `checkDetails(input: DetailsInput, discipline: { plannedShots: number | null; seriesShots: number | null }):
    { ok: true; details: NormalizedDetails } | { ok: false; problem: DetailsProblem }`. Regeln:
    - **Schuss:**
      - `ring` ganzzahlig 0–10 oder null, `decimalTenths` ganzzahlig 0–`MAX_DECIMAL_TENTHS` oder null, mindestens
        einer (`shotValue`);
      - beide da: `ring === Math.min(10, Math.floor(decimalTenths / 10))` (`shotRingTenths`);
      - `series` ganzzahlig ≥ 1 oder null;
      - Zeilen: `seq` 1…n in Eingabefolge, `stellung` 0 bei `probe`, sonst 1, `treffer` laufend je Stellung ab 1,
        `displayMode` null, `flags` aus `baseShotFlags` (ohne Gegenprobe; die macht der Writer mit dem Scheibenbild),
        `innerTen ?? null`, übrige `?? null`.
    - **Serien:**
      - Nummern ganzzahlig ≥ 1, eindeutig (`seriesNumber`);
      - `shots ?? discipline.seriesShots`, sonst `seriesShotsUnknown`;
      - `rings` 0…10·shots, `decimalTenths` 0…109·shots, mindestens einer; beide da:
        `rings*10 <= decimalTenths <= rings*10 + 9*shots` (`seriesValue`).
      - Mit Einzelschüssen muss jeder Wertungsschuss eine Seriennummer tragen, die es als Summe gibt, und umgekehrt
        (`shotSeries`). Die Zahl der Wertungsschüsse der Serie ist gleich `shots` (`seriesShots`). Die Summe der Ringe
        bzw. Zehntel ist gleich, wo alle Schüsse den Wert tragen (`seriesSum`).
    - **Gesamtergebnis:**
      - Wertebereich wie Serien (`totalValue`);
      - `shots ?? (Serien ? Σ Serien : Wertungsschüsse || discipline.plannedShots)`, sonst `totalShotsUnknown`;
      - mit Serien: `shots` gleich Σ und Werte gleich Σ, wo beide da sind (`totalMismatch`);
      - mit Einzelschüssen ebenso gegen die Schüsse.
    - **Trefferlage:**
      - nur mit einem Ergebnis (Schüsse, Serien oder Gesamtergebnis), sonst `centerWithoutResult`;
      - `xUm`, `yUm` ganzzahlig mit |…| ≤ 100 000 (`centerValue`);
      - `shots ?? ` Schusszahl der Scheibe (`shotCountOf`), ≥ 1.
    - `sums`: undefined, wenn weder Serien noch Gesamtergebnis noch Trefferlage.
  - `enteredScoring(details: NormalizedDetails): "decimal" | "rings" | null`:
    - mit Wertungsschüssen: Zehntel, wenn alle Zehntel tragen; Ringe, wenn alle Ringe tragen;
    - sonst Serien ebenso, sonst das Gesamtergebnis, sonst null.
    - Kommentar: die Wertung „wie eingetragen“ als `standScoring`.
  - `detailsWriter(existing: CardOrigin, writer: EnteredOrigin): CardOrigin | null`:
    - raw → null;
    - pdf → `writer === "pdf" ? "pdf" : null`;
    - manual → `writer === "manual" ? "manual" : null`;
    - treffsicher → `writer === "treffsicher" ? "treffsicher" : writer === "manual" ? "manual" : null`.
    - Kommentar: [[adr-033]] „nur Eingetragenes ist änderbar“; gemessen und gescannt nie von Hand.
  - `IMPORT_KEY = /^treffsicher:[A-Za-z0-9_-]{1,64}$/`. Ein `importKey` nur mit `origin: "treffsicher"` und passend,
    sonst `importKey`.
- `apps/spiegel/src/lib/entered/details.test.ts` (neu):
  - je Problem ein Fall (Tabelle) mit dem erwarteten Code.
  - Vorgaben:
    - vier Serien ohne `shots` bei `seriesShots` null und `plannedShots` 40 → je 10 (über `seriesShotsOf` des
      Aufrufers: der Test gibt `seriesShots: 10`);
    - Gesamtergebnis ohne Serien → `plannedShots`;
    - ohne `plannedShots` → `totalShotsUnknown`;
    - Trefferlage ohne `shots` → Schusszahl der Scheibe.
  - `enteredScoring` für Schüsse mit, ohne und mit gemischten Zehnteln, Serien und Gesamtergebnis.
  - `detailsWriter` für alle zwölf Paare.
  - `normalizePlace`: `"  Schützenhaus   Nord "` → `"Schützenhaus Nord"`, `""` → null, 81 Zeichen → Problem.
- Commit: `feat(spiegel): check and normalize card details from printouts, hand entry and imports`

### Task 11 · Scheiben ohne Brücke schreiben

- `apps/spiegel/src/lib/db/cards.ts`: `shotRows` exportieren.
- `apps/spiegel/src/lib/db/entered.ts` (neu):
  ```ts
  export interface EnteredCardInput {
    /** fehlt: neue Scheibe; sonst ändern */
    cardId?: string
    ownerId: string
    origin: EnteredOrigin
    disciplineId: number
    startedAtMs: number
    kind: CardKind
    /** fehlt: beim Ändern nicht anfassen; null leeren */
    place?: string | null
    /** nur beim Anlegen, nur aus Treffsicher */
    importKey?: string | null
    details: DetailsInput
    reason: string
  }
  export type EnteredResult =
    | { kind: "saved"; change: "created" | "revised" | "unchanged"; cardId: string; revisionId: bigint; number: number }
    | { kind: "missing" } | { kind: "notEditable" } | { kind: "keyTaken" } | { kind: "invalid"; problem: DetailsProblem }
  export const writeEnteredCard = (db: Db, input: EnteredCardInput) => db.$transaction((tx) => writeEnteredCardIn(tx, input))
  export async function writeEnteredCardIn(tx: Tx, input: EnteredCardInput): Promise<EnteredResult>
  ```
  Ablauf von `writeEnteredCardIn`:
  1. Disziplin `FOR SHARE` (`familyId`, `targetId`, `plannedShots`, `seriesShots`, `meytonId`, `version`); fehlt →
     `missing`.
  2. `checkDetails(input.details, { plannedShots: plannedShotsOf(meytonId, plannedShots), seriesShots:
     seriesShotsOf(seriesShots, plannedShotsOf(…)) })`, `normalizePlace`, `importKey`. Problem → `invalid`.
  3. Gegenprobe wie `recomputeDisciplineCard`: `verifyShots(targetId, checkables)`, `verdaechtig` an die Schüsse,
     `targetMismatch`.
  4. `counts = revisionCounts(shots, sums)`; `flags = detailFlags({ origin, ...counts, plannedShots, targetId,
     targetMismatch })`; `complete = isComplete("final", flags) && counts.valued`.
  5. `hash = detailsHash(details)`: sha256 über `canonicalize({ shots: sortiert nach stellung, treffer, mit sortierten
     flags; series: nach Nummer; total; center })`.
  6. **Anlegen** (ohne `cardId`):
     - mit `importKey`: vorhandene Scheibe dieses Schlüssels? Anderer Besitzer → `keyTaken`; sonst weiter als Ändern
       mit ihrer Id.
     - Sonst `tx.card.create` mit `sourceId`/`scheibenId` null, `ownerId`, `ownerPending: false`, `origin`,
       `disciplineId`, `disciplineVersion: version`, `familyId`, `startedAt`, `kind`, `state: "final"`, `complete`,
       `flags`, `standScoring: enteredScoring(details)`, `place ?? null`, `importKey ?? null`.
     - Dann Revision 1 (`createDetailsRevision`) und `saveProjection(tx, id, revisionId, shots.map(toMetricShot),
       sums)`. Ergebnis `created`.
  7. **Ändern:**
     - `lockCard(tx, cardId)` (fehlt → `missing`);
     - Scheibe mit `{ id, ownerId, deletedAt: null, ownerPending: false }` (fehlt → `missing`);
     - `next = detailsWriter(card.origin, input.origin)`, null → `notEditable`;
     - `card.update` mit `origin: next`, `disciplineId`, `familyId`, `disciplineVersion`, `startedAt`, `kind`,
       `place` (nur wenn nicht `undefined`), `flags`, `complete`, `standScoring`;
     - gleicher `hash` wie die aktuelle Revision → `unchanged`;
     - sonst Revision `number + 1`, `currentRevisionId`, Projektion → `revised`.
  - `createDetailsRevision(tx, cardId, number, details, hash, reason)`: `cardRevision.create` mit
    `total*`/`center*`, `seriesSum.createMany`, `shot.createMany({ data: shotRows(...) })`.
  - Kopfkommentar:
    - der einzige Weg für Scheiben ohne Brücke (Scan 1b-2, Ausdruck 1c, Hand 1d, Übernahme Stufe 3);
    - Rohdaten schreibt nur `writeRevision`;
    - 1b-2 ruft `writeEnteredCardIn` in der Transaktion, in der es `attachPrintout` ruft.
- `apps/spiegel/src/lib/db/entered.test.ts` (neu, `createTestSite`).
  - Eigene Disziplin der Testanlage: `meytonId: null`, `name: "LG 40 eingetragen"`, `familyId: site.familyId`,
    `targetId: "lg-10m"`, `plannedShots: 40`, `seriesShots: 10`, `confirmedAt: new Date()`.
  - Je Detailtiefe die Zeile, die Revision und `CardProjection`:
    1. nur der Ausdruck (`origin: "pdf"`, `details: {}`):
       - Revision 1 ohne Schüsse und ohne Summen;
       - `probeOnly` false, `printedShots` 0, `values` `{}`, `detail.rings` null;
       - `flags` ohne „leer“ und „nur-probe“, `complete` false, `standScoring` null.
    2. nur Gesamtergebnis (`manual`, `total: { rings: 371 }`):
       - `totalShots` 40 gespeichert;
       - `values["result.rings"]` `{ value: 371, n: 40 }`, kein `result.decimal`;
       - `complete` true, `standScoring` „rings“.
    3. Gesamtergebnis mit Zehnteln (`total: { decimalTenths: 3804 }`): `result.decimal` 380,4, kein `result.rings`.
    4. Serien-Summen in ganzen Ringen (4 × ohne `shots`): je `shots` 10 gespeichert; `result.rings` Σ;
       `records.rings.bestSeries`.
    5. Serien mit Ringen und Zehnteln: beide Werte.
    6. Schüsse in ganzen Ringen:
       - `Shot.innerTen` null in der Datenbank;
       - `values["result.innerTens"]` fehlt;
       - `result.tens` da (erst `not.toBeNull`).
    7. Schüsse mit Zehnteln.
    8. Gesamtergebnis und Trefferlage: `group.mpiDistance` aus der Trefferlage, `group.sigma` fehlt.
    9. Schüsse mit Lage und Zeit: `detail.positions` und `detail.times` gleich der Schusszahl.
    10. unvollständig (3 Serien bei 40): `unvollstaendig`, `complete` false, `result.ringsMean` da.
  - Ändern:
    - `manual` mit neuen Serien → `revised`, Nummer 2; Revision 1 behält ihre `SeriesSum`; Projektion aus Revision 2;
    - noch einmal dieselben → `unchanged`;
    - `pdf`-Scheibe mit `origin: "manual"` → `notEditable`;
    - eine Scheibe der Brücke (`createTestSite`-Quelle, `writeRevision`) → `notEditable`;
    - `treffsicher` mit `manual` → `origin` „manual“, `importKey` bleibt;
    - fremder Besitzer → `missing`.
  - `importKey`: zweimal anlegen → beim zweiten Mal `unchanged` und dieselbe Id; mit anderem Besitzer → `keyTaken`.
  - Ungültig: `total: { rings: 371 }` und Serien mit Σ 370 → `invalid` / `totalMismatch`, nichts geschrieben (Zahl der
    Scheiben gleich).
  - Rohdaten an einer Scheibe vom Ausdruck (aus Task 9):
    - leere `pdf`-Scheibe, dann `writeRevision` mit `cardId` und den Schüssen aus `season(1, 3100)` → Nummer 2,
      `origin` „raw“, `place` null, ohne „korrigiert“;
    - Revision 1 hat weiter keine Schüsse;
    - `manual`-Scheibe dasselbe → `RangeError`.
  - Nachrechnen:
    - `plannedShots` der Disziplin auf 30 setzen und `version` erhöhen, `refreshDisciplineCards(db, { limit: 50 })` mit
      Filter über die Testscheiben (`cardIds`-Option analog zu Task 8 ergänzen, wenn nötig) → die Scheibe aus Fall 2
      bekommt `ueber-soll`;
    - die leere aus Fall 1 bleibt ohne „leer“.
  - `refreshProjections(db, { cardIds })` nach `UPDATE "CardProjection" SET version = 'alt'` → gleiche `values` wie
    vorher.
- Commit: `feat(spiegel): write cards from printouts, hand entry and imports`

### Task 12 · Leser und Admin-Zahlen

- `apps/spiegel/src/lib/db/reads.ts` (`toPageCard`): `const shots = row.currentRevision.shots; const probeOnly =
  shots.length > 0 && shots.every((shot) => shot.stellung === 0)` (wie `probeOnlyShots`).
- `apps/spiegel/src/lib/admin/disciplines.ts`:
  - Abfrage der Schusszahl `AND p."printedShots" > 0`;
  - `groupBy` „Anzeige am Stand“ mit `where: { ...visible, origin: "raw" }`.
  - Kommentar: Die Wertung eingetragener Scheiben ist „wie eingetragen“, nicht am Stand.
- Tests:
  - `reads.test.ts`: `cardWithShots` einer Scheibe nur aus Serien-Summen trägt `official` der Disziplin; die leere
    ebenso (keine Probe).
  - `overview.test.ts`, neuer `describe("Scheiben ohne Einzelschüsse")`:
    - `writeEnteredCard` für eine leere, eine aus Serien-Summen (378 Ringe, 40 Schuss) und eine aus Schüssen in ganzen
      Ringen, alle in der Familie der Testanlage (eigene Disziplin mit `targetId`);
    - `startPageData`, `listPageData` und `progressPageData` werfen nicht;
    - in der Liste: Zeile der Summen-Scheibe `shots` 40 und `mean` 9,45 bei Wertung „rings“ (erst `not.toBeNull`);
      Zeile der leeren `result` und `mean` null, `shots` 0, `kind` nicht „probe“.
  - `disciplines.test.ts` (Admin): eine leere eingetragene Scheibe zählt nicht in `stats.shots`.
- Commit: `fix(spiegel): overviews and admin counts for cards without single shots`

### Task 13 · Prüfung an der Prod-Kopie

Kein Dev-Server, keine Skriptprüfung und kein Test eines anderen Worktrees gegen die Dev-Datenbank währenddessen
(Absprache über die koordinierende Session). Alter Code würde die Projektionen sonst auf Version 5 zurückrechnen.

- `pnpm --filter spiegel projection-check compare ../../reports/tis-1a1/projections-before.json` → „gleich: 272,
  abweichend: 0, fehlt: 0, alte Version: 0“.
- Weicht eine ab: die Kennung und die Schlüssel melden. Erwartbar wäre nur eine Scheibe der Brücke ohne einen
  Wertungsschuss (`probeOnly`). Die Abweichung prüfen (`/debug`), nicht die Erwartung lockern.
- Ergebnis in `reports/2026-10-27-tis-1a1-card-details.md` (aus `/validate`).
- Kein Commit.

### Task 14 · Doku und ADR **[geschützt: `vault/decisions/`]**

- `vault/decisions/adr-033.md`:
  - TL;DR am Ende: „Nachtrag 27. Oktober 2026: Modell der Angaben (1a-1).“ `keywords` um `ort, freitext, serien-summe,
    gesamtergebnis, trefferlage als summe, schusszahl, herkunft treffsicher, ohne meyton-id, serienlänge`.
  - Abschnitt `## Nachtrag (27. Oktober 2026): Modell der Angaben` mit:
    - **Eingetragene Disziplinen entfallen.** Jede Scheibe nimmt eine Disziplin aus Admin → Disziplinen; der Admin
      legt fehlende ohne Meyton-ID an (`Discipline.meytonId` optional, `seriesShots`). Ersetzt „eingetragene
      Disziplinen“ in der Tabelle „Was aus Treffsicher umzieht“ und in „Handeingabe und fremde Anlagen“.
    - **Fremde Orte sind Freitext** an der Scheibe (`Card.place`), kein `Site`. Scheiben der Brücke tragen den Ort über
      ihre Anlage.
    - **Summen getrennt in Ringen und Zehnteln**, an der Revision (`SeriesSum`, Gesamtergebnis, Trefferlage). Zehntel
      werden nie abgeschnitten. Die Tabelle der Angaben bekommt die Spalten „nur der Ausdruck“ und „nur
      Gesamtergebnis“.
    - **Schusszahl bei Summen:** gespeichert mit der Summe. Vorgabe: volle Serie bzw. volle Schusszahl der Disziplin.
      Vollständig nur mit der Schusszahl der Disziplin; unvollständige zählen im Ø je Schuss, nicht bei Rekorden.
    - **Trefferlage als Summe nur für die Lage:** gewichtet mit ihrer Schusszahl in Versatz und Richtung. Nie für
      Streuung; kein Urteil aus Summen allein.
    - **Herkunft:** `raw`, `pdf`, `manual`, `treffsicher`.
      - Von Hand änderbar sind nur `manual` und `treffsicher`; eine aus Treffsicher wird dabei `manual` und behält
        ihren Schlüssel der Übernahme.
      - `pdf` ändert nur der Ausdruck (Parser), `raw` niemand.
      - Rohdaten an einer Scheibe vom Ausdruck sind eine neue Revision.
    - **Ohne Werte** (Scan wartet auf die Brücke): eine Scheibe mit leerer Projektion, weder leer noch nur Probe, in
      keiner Zahl.
    - **Rekorde aus Summen:** Ergebnis (R1), beste Serie (R2) und beste Form (R8). Was Schüsse braucht, nur aus
      Schüssen.
    - „Offene Fragen: Modell im Einzelnen“ als beantwortet markieren (Verweis auf diesen Nachtrag).
- `vault/spiegel/spiegel-data-model.md`:
  - Zeile „Scheibe“: Herkunft (Brücke, Ausdruck, von Hand, Treffsicher), Ort.
  - Neue Zeilen „Serien-Summe“ und „Angaben der Revision“ (Gesamtergebnis, Trefferlage als Summe, Schusszahl).
  - „Disziplin“: DisziplinID optional, Serienlänge.
  - Im Block `Shot`: `innerTen: boolean | null`.
  - `keywords` um `serien-summe, gesamtergebnis, trefferlage, ort, herkunft`.
- `vault/spiegel/spiegel-db-schema.md`:
  - Tabellen: Zeile „Scheiben“ um `SeriesSum` (`(revisionId, series)` eindeutig) und `Card.importKey`. „Disziplinen“:
    `meytonId` optional (NULL mehrfach, das Anlegen prüft den Namen) und `seriesShots`. „Projektion“: `detail`.
  - Spiegelstrich **Angaben an der Revision** mit den CHECKs.
  - „Schreiben“: Punkt `writeEnteredCard` (Regeln, Revisionen, `detailsWriter`); `writeRevision`: Rohdaten an einer
    Scheibe vom Ausdruck → neue Revision, eingetragene nie.
  - „Projektion“: `PROJECTION_VERSION` 6, `detail`.
  - Migration `card_details` nennen. `keywords` um `seriessum, writeenteredcard, importkey, place`.
- `vault/spiegel/spiegel-metrics.md`, Abschnitt „Registry“:
  - `summary` (nur E1, E2, L2, nie Streuung), die Kaskade Schüsse → Serien → Gesamtergebnis;
  - kein `sd` aus Summen (Rangtest);
  - Need `innerTen`;
  - `CardDetail` und `pooledCenter`.
- `vault/spiegel/spiegel-statistics.md`: Zeilen E1, E2 („auch aus Serien-Summen oder dem Gesamtergebnis, n = gespeicherte
  Schusszahl“), E5 („unbekannt ohne Angabe, nie 0“), L2 („auch aus der Trefferlage als Summe; nie für P1–P6“).
- `packages/shot-core/CLAUDE.md`:
  - Exporte: `metrics` um `CardSums`, `SeriesSum`, `sumsResult`, `sumsShots`, `summaryValue`; `discipline` um
    `seriesShotsOf`, `DEFAULT_SERIES_SHOTS`; `projection` um `CardDetail`, `cardDetail`, `pooledCenter`, `detail`.
  - Regel **Angaben ohne Einzelschüsse:** `PeriodCard.sums`; Kaskade; nur Kennzahlen mit `summary`; kein `sd`; Trefferlage
    nur für die Lage; `shotCountOf` für Umfang und `printedShots`; „nur Probe“ erst mit einem Schuss.
- `apps/spiegel/CLAUDE.md`:
  - Regel **Scheiben mit Angaben:** `writeEnteredCard` als einziger Weg ohne Brücke, `detailsWriter`, Angaben an der
    Revision, `revisionSums`, `detailFlags`, Rohdaten an einer Scheibe vom Ausdruck → neue Revision.
  - Regel „Disziplinen einordnen“: ohne Meyton-ID möglich (Anlegen im Admin folgt mit 1d), `seriesShots`.
  - Befehl `projection-check` aus Task 1.
- `/sync-graph`: `vault-lint` grün.
- Commits:
  - `docs(adr-033): card details model, place as text, shot counts for sums`
  - `docs(vault): card details in data model, schema, metrics and catalog`

## Required Docs

- `plans/2026-10-26-treffsicher-in-spiegel.md` (Grundsätze, Stufe 1 → 1a, Regeln für Kindsessions)
- `vault/decisions/adr-033.md`, `adr-031.md`, `adr-034.md`
- `vault/spiegel/spiegel-data-model.md`, `spiegel-db-schema.md`, `spiegel-metrics.md`, `spiegel-statistics.md`
  (E1, E2, E5, L2)
- `packages/shot-core/CLAUDE.md` (Projektion gleich Live-Rechnung, `toBeCloseTo` und null, Kennzahlen nur über
  `defineMetric`)
- `apps/spiegel/CLAUDE.md` (Schichten, Projektion nur aus dem Fachkern, Revisionen, Disziplin je Scheibe, Migrationen
  nur anhängen, Tests gegen die Dev-Datenbank)
- `vault/conventions.md` §9 (Mutationsprobe, Drei-Wege-Semantik, `toBeCloseTo` und null, Prüfen und Schreiben in einer
  Transaktion)
- `.claude/skills/migrate/SKILL.md` (hier mit `migrate diff` statt `migrate dev`, siehe Task 7)

## Test steps

1. `pnpm --filter @vereinsheim/shot-core test` grün.
2. `pnpm --filter spiegel test -- entered details cards card-checks reads overview disciplines discipline-model` grün;
   danach `pnpm --filter spiegel test` ganz.
3. `pnpm --filter treffsicher test` und `pnpm --filter @vereinsheim/shot-ui test` grün (Typen von `innerTen` und
   `RingDistribution`).
4. Mutationsproben (Datei vorher per `cp` sichern, danach zurückkopieren, nicht `git checkout`); jede muss einen Test
   rot machen:
   - `period.ts`: Rückfall auf `summaryValue` in `cardValues` entfernen → `sums.test.ts` Fall 1 rot.
   - `period.ts`: im Rückfall `sd: null` setzen → „kein `sd`“ rot.
   - `metrics.ts`: `case "innerTen": return true` → Fall 3 (Innenzehner leer) rot.
   - `projection.ts`: `probeOnly: !card.shots.some(match)` → leere Scheibe in `projection.test.ts` und `entered.test.ts`
     rot.
   - `metrics.ts`: `summary` an `group.sigma` (mit entfernter Prüfung in `defineMetric`) → Registry-Test rot.
   - `card-checks.ts`: in `detailFlags` nie filtern → Fall 1 in `entered.test.ts` rot (`leer`).
   - `cards.ts`: Sonderweg `upgrade` entfernen → Test „Rohdaten an einer Scheibe vom Ausdruck“ rot.
   - `details.ts`: `detailsWriter("pdf", "manual")` gibt „pdf“ → Tabelle rot.
   - `details.ts`: Prüfung `totalMismatch` entfernen → Fall „ungültig“ rot.
5. `git diff main --stat`: nichts unter `apps/spiegel/src/lib/printouts/`, `packages/meyton-pdf`, `compose.yml`,
   `scripts/`, `apps/treffsicher/` (außer keiner Datei; Treffsicher bleibt unverändert).
6. Migration: `prisma migrate status` aktuell, ein zweiter `migrate diff` leer.
7. Task 13: `projection-check compare` mit 272 gleich.
8. `pnpm check` grün.

## Verification

Die Kindsession meldet an die koordinierende Session:

- Branch, Commits, Bericht aus `reports/`.
- Ergebnis von `projection-check` (272 gleich, oder die Abweichungen mit Grund).
- Den Text der Migration (Liste der Anweisungen) und dass sie nur additiv ist; dass Prod beim Start alle Projektionen
  einmal neu rechnet (Version 6).
- Was 1a-2 aus der Projektion liest (`detail`, `printedShots`, `probeOnly`) und noch selektieren muss (`detail`,
  `origin`, `place` in `OVERVIEW_SELECT`), und was 1b-2, 1c, 1d und Stufe 3 aufrufen (`writeEnteredCardIn`,
  `detailsWriter`).
- Nicht belegt bleibt bis 1a-2: wie die Ansichten „–“ mit Grund und die Grundlage zeigen, und wie sich Zeiträume mit
  gemischten Scheiben im Browser lesen.
- Keine neue Brücke nötig. Release und Merge nach `main` entscheidet der User.
