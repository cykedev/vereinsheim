# Spiegel: verdächtige Platzhalter nicht zeichnen (SF-15)

Branch `feat/spiegel-platzhalter` auf `main` (adfd8fcb, nach dem History-Rewrite), Merge ff-only.

## Context

- Der Adapter (`apps/spiegel/src/lib/ingest/meyton-ssmdb2.ts`, `shotFlags`) markiert einen Platzhalter oder Handeintrag
  (x = y = 0, `Teiler01` 0, `Ring01` ≠ 109) als `verdaechtig`, ebenso einen Schuss, dem die Gegenprobe widerspricht. Die
  Lage bleibt, beim Platzhalter also 0|0.
- SF-15 ([[spiegel-edge-cases]]), [[spiegel-ingest-pipeline]] („markiert statt gezeichnet“), [[spiegel-metrics]] und die
  Erwartung des Falls `packages/ssmdb2-cases/cases/v1/SF-15/expected.json` („Verdächtig: nicht gezeichnet“) verlangen:
  nicht zeichnen.
- Gezeichnet wird heute mit `hasPosition` (nur endliche Zahlen) an drei Stellen:
  - `TargetView` (große Scheibe, `packages/shot-ui/src/target/TargetView.tsx:99`),
  - `SeriesStrip` (kleine Scheibe je Serie, `packages/shot-ui/src/series/SeriesStrip.tsx:73` und die Schüsse an
    `MiniTarget`, dort `hasPosition` in `MiniTarget.tsx:81`),
  - `cardMarks` (Lagen der kleinen Scheiben in Start, Liste und Fortschritt, mit der Projektion gespeichert,
    `packages/shot-core/src/analysis/projection.ts:152`).

  Folge: Der Platzhalter steht als Treffer in der Mitte, auf der großen und den kleinen Scheiben.

- Richtig sind schon: Gruppe, Streukreis, Ellipse, Schwerpunkt (`groupShots`), die Diagramme der Analyse (`PathChart`,
  `ShapeChart`, `ClockCard`) und die Ablesung (`placed: hasValidPosition`). Sie wählen über
  `selectShots(…, { need: "position" })`.

## Entscheidung D1: dieselbe Regel für Schüsse über der Soll-Zahl

`hasValidPosition` ist `selectShots([shot], { need: "position" })` und lässt **verdächtige und Schüsse über der Soll-Zahl**
(`ueber-soll`, SF-08) weg. Damit erscheinen auch die Schüsse 41 bis 46 einer LG 40 nicht mehr auf der Scheibe.

Begründung: Meyton führt sie als „0F“ oder „inv“ mit Wert 0. Gezeichnet stünden sie an ihrer echten Lage in der Farbe
einer Null, womöglich mitten in der Zehn. Gruppe, Analyse und Ablesung behandeln sie schon heute als Schüsse ohne
gültige Lage; die Scheibe zieht nach. In der Schusstabelle bleiben beide Arten mit ihrem Wert.

Verworfen: nur `verdaechtig` ausblenden. Das bräuchte eine zweite Regel neben `selectShots`, und Scheibe und Gruppe
zeigten wieder Verschiedenes.

## Approach

Eine Regel aus dem Fachkern: Gezeichnet wird, was eine gültige Lage hat, also `selectShots(…, { need: "position" })`
(`cardMarks`) bzw. `hasValidPosition` (`shot-ui`). `MiniTarget` behält `hasPosition`: Es bekommt auch `MarkShot` ohne
Merkmale; gefiltert wird vorher (`SeriesStrip`, `cardMarks`). Weil sich die gespeicherten Lagen ändern, steigt
`PROJECTION_VERSION` auf 3 (Regel in `packages/shot-core/CLAUDE.md`); `refreshStaleProjections` rechnet sie beim
nächsten Start des Servers neu. Form von `values` und `records` bleibt, keine Migration.

### Dateien

| Datei                                                        | Änderung                                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| `packages/shot-core/src/analysis/projection.ts`              | `cardMarks` über `selectShots`, `finite` entfällt, `PROJECTION_VERSION` 3 |
| `packages/shot-core/src/analysis/projection.test.ts`         | neuer Test, Fingerabdruck neu                                             |
| `packages/shot-ui/src/target/TargetView.tsx`                 | `hasValidPosition` statt `hasPosition`                                    |
| `packages/shot-ui/src/target/TargetView.test.tsx`            | neuer Test                                                                |
| `packages/shot-ui/src/series/SeriesStrip.tsx`                | Filter `hasValidPosition` vor `seriesTileView` und `MiniTarget`           |
| `packages/shot-ui/src/series/SeriesStrip.test.tsx`           | neuer Test                                                                |
| `packages/shot-ui/src/shots.ts`                              | Kommentar an `hasPosition`: nur Zahlen, für schon gefilterte Lagen        |
| `apps/spiegel/src/lib/ingest/meyton-ssmdb2.test.ts`          | Ende zu Ende an den Fällen SF-15 und SF-08                                |
| `vault/spiegel/spiegel-roadmap.md`                           | Punkt „Verdächtige Platzhalter werden gezeichnet“ entfernen               |
| `vault/spiegel/spiegel-edge-cases.md`                        | SF-08: „nicht gezeichnet“                                                 |
| `vault/spiegel/spiegel-db-schema.md`                         | Lagen: nur mit gültiger Lage, `PROJECTION_VERSION` 3                      |
| `packages/shot-core/CLAUDE.md`, `packages/shot-ui/CLAUDE.md` | Regel „gezeichnet nur mit gültiger Lage“, Version 3                       |

## Required Docs

- `packages/shot-core/CLAUDE.md` (Projektion gleich Live-Rechnung, `PROJECTION_VERSION`, Fingerabdruck-Test)
- `packages/shot-ui/CLAUDE.md` (Zahlen nur aus dem Fachkern, Markup-Tests)
- `vault/spiegel/spiegel-edge-cases.md` (SF-08, SF-15)
- `vault/conventions.md` §9 („Charakterisierungstests müssen die falsche Quelle erkennen können“, „Eigenschaftstests
  per Mutation gegenprüfen“)

## Tasks

Jeder neue Test wird **vor** dem Fix geschrieben und rot gesehen; für T4 belegt eine Mutation, dass er ohne Fix rot ist.
Mutationen über eine Kopie im Scratchpad zurücksetzen (`cp`), nicht über `git checkout`.

### T1 Fachkern: `cardMarks` nur mit gültiger Lage

1. In `projection.test.ts`, `describe("Lagen für die kleinen Scheiben")`, nach dem ersten Test (`FLAG_OVER_TARGET` aus
   `../metrics` importieren):

   ```ts
   it("ohne verdächtige Schüsse und ohne Schüsse über der Soll-Zahl (SF-15, SF-08)", () => {
     const marks = cardMarks([
       shot({ seq: 1, xUm: 1000, yUm: 0, ring: 10 }),
       shot({
         seq: 2,
         xUm: 0,
         yUm: 0,
         ring: 9,
         decimalTenths: 95,
         flags: [FLAG_SUSPICIOUS],
       }),
       shot({ seq: 3, xUm: 2000, yUm: 0, ring: 10 }),
       shot({
         seq: 4,
         xUm: 300,
         yUm: 300,
         ring: 0,
         decimalTenths: 0,
         flags: [FLAG_OVER_TARGET],
       }),
     ]);
     expect(marks).toEqual([
       [100, 0, 10],
       [200, 0, 10],
     ]);
   });
   ```

   `pnpm --filter @vereinsheim/shot-core test -- projection` → rot (vier Lagen statt zwei).

2. In `projection.ts` `selectShots` aus `../metrics` importieren und `cardMarks` ersetzen; `finite` (nur hier genutzt)
   entfällt:

   ```ts
   /**
    * Die Lagen einer Scheibe für die kleinen Scheiben der Übersichten: die Schüsse wie am Ausdruck (`asOnPrintout`, bei
    * nur Probe die Probe), in Abgabefolge, nur mit gültiger Lage (`selectShots`: ohne verdächtige, SF-15, und ohne
    * Schüsse über der Soll-Zahl, SF-08). Gespeichert neben der Projektion und nur für die gezeigten Scheiben gelesen;
    * rund 0,6 KB bei 40 Schuss statt aller Angaben jedes Schusses.
    */
   export function cardMarks(shots: readonly MetricShot[]): CardMark[] {
     return selectShots(inShotOrder(asOnPrintout(shots)), {
       need: "position",
     }).map((shot): CardMark => [
       Math.round((shot.xUm as number) / MARK_UM) || 0,
       Math.round((shot.yUm as number) / MARK_UM) || 0,
       shot.ring ?? null,
     ]);
   }
   ```

3. Test erneut: neuer Test grün, „Version und Ausgabe hängen zusammen“ rot (Scheibe `suspicious` in `special` verliert
   Schuss 5). `PROJECTION_VERSION = 3`, im Kommentar darüber „2: Lagen für die kleinen Scheiben. 3: nur mit gültiger
   Lage (SF-15, SF-08).“; Version (`p3-…`) und Ausgabe aus der Fehlermeldung in den Test übernehmen. Die übrigen Tests
   der Lagen bleiben unverändert grün (die erzeugten Scheiben und `EDGE` haben keine Merkmale).

### T2 Große Scheibe: `TargetView`

1. In `TargetView.test.tsx` (`FLAG_OVER_TARGET`, `FLAG_SUSPICIOUS` aus `@vereinsheim/shot-core/metrics`), in
   `describe("TargetView: Auswahl und Antippen")`:

   ```ts
   it("ohne verdächtigen Platzhalter und ohne Schuss über der Soll-Zahl (SF-15, SF-08)", () => {
     const html = renderToStaticMarkup(
       createElement(TargetView, {
         target: LP_10M,
         shots: [
           ...CARD,
           { ...shot("match", 2, 0, 0, 95), flags: [FLAG_SUSPICIOUS] },
           { ...shot("match", 2, 500, 500, 0), flags: [FLAG_OVER_TARGET] },
         ],
         state: initialViewState({
           layers: { mpi: false, circle: false, numbers: true, ellipse: false },
         }),
       }),
     );
     expect(shotOrder(html)).toEqual(["1", "2", "3", "4", "5"]);
   });
   ```

   `pnpm --filter @vereinsheim/shot-ui test -- TargetView` → rot (`6`, `7` gezeichnet).

2. In `TargetView.tsx` `hasValidPosition` statt `hasPosition` importieren und in `order` nutzen. Test grün.

### T3 Kleine Scheiben der Serien: `SeriesStrip`

1. In `SeriesStrip.test.tsx` (`FLAG_OVER_TARGET`, `FLAG_SUSPICIOUS` importieren), in `describe("SeriesStrip")`:

   ```ts
   it("ohne verdächtigen Platzhalter und ohne Schuss über der Soll-Zahl (SF-15, SF-08)", () => {
     const html = renderToStaticMarkup(
       createElement(SeriesStrip, {
         target: LP_10M,
         shots: [
           shot("match", 1, 1000, 105),
           { ...shot("match", 1, 0, 95), flags: [FLAG_SUSPICIOUS] },
           { ...shot("match", 1, 2000, 0), flags: [FLAG_OVER_TARGET] },
         ],
         state: initialViewState(),
       }),
     );
     // ein Treffer trägt den Rand `--shot-edge` (MiniTarget), Ringe nicht
     expect(html.match(/stroke="var\(--shot-edge\)"/g)).toHaveLength(1);
   });
   ```

   Rot (drei Treffer).

2. In `SeriesStrip.tsx` `hasValidPosition` statt `hasPosition` importieren; im `view`-Memo `.filter(hasValidPosition)`,
   an `MiniTarget` `shots={block.indices.map((i) => shots[i]).filter(hasValidPosition)}`. Test grün.
3. In `shots.ts` den Kommentar über `hasPosition` ergänzen: „nur endliche Zahlen; für Lagen, die schon gefiltert sind
   (`MiniTarget` mit `MarkShot`). Gezeichnet wird mit `hasValidPosition`.“

### T4 Ende zu Ende am Adapter

1. In `meyton-ssmdb2.test.ts`, `describe("Adapter im Einzelnen")`; `cardMarks` aus `@vereinsheim/shot-core/projection`,
   `toMetricShot` aus `../db/cards` importieren:

   ```ts
   it("die kleinen Scheiben zeichnen keinen Platzhalter und keinen Schuss über der Soll-Zahl (SF-15, SF-08)", () => {
     for (const [caseId, drawn] of [
       ["SF-15", 19],
       ["SF-08", 40],
     ] as const) {
       const [card] = frozenExpected(caseId).cards;
       const readings = frozenReadings(caseId);
       const sent = card.sentReadings.map((n) =>
         readings
           .find((r) => r.reading === n)!
           .snapshots.find((s) => s.scheibenId === card.scheibenId)!,
       );
       const last = adaptAll(sent).at(-1)!;
       expect(cardMarks(last.shots.map(toMetricShot)), caseId).toHaveLength(
         drawn,
       );
     }
   });
   ```

   (SF-15: 20 Schuss, Schuss 12 verdächtig; SF-08: 46 Schuss, 41 bis 46 über der Soll-Zahl.)

2. `pnpm --filter spiegel test -- meyton-ssmdb2` → grün. Gegenprobe: `projection.ts` ins Scratchpad kopieren, in
   `cardMarks` `{ need: "position" }` durch einen Filter nur auf endliche `xUm`/`yUm` ersetzen, Test → rot (20 bzw. 46),
   Kopie zurück, Test → grün.

### T5 Doku und Roadmap

- `vault/spiegel/spiegel-roadmap.md`, „Offene Einzelpunkte“ → „Fachkern und Darstellung“: den Punkt „Verdächtige
  Platzhalter werden gezeichnet“ (drei Zeilen) entfernen.
- `vault/spiegel/spiegel-edge-cases.md`, Zeile SF-08, Absicherung: „… Wert 0 und Zeit zählen, Lage und Abstand nicht;
  nicht gezeichnet“.
- `vault/spiegel/spiegel-db-schema.md`, „Lagen“: „die Schüsse wie am Ausdruck mit gültiger Lage (ohne verdächtige und
  ohne Schüsse über der Soll-Zahl) … (`PROJECTION_VERSION` 3)“.
- `packages/shot-core/CLAUDE.md`, Regel „Projektion gleich Live-Rechnung“: Lagen aus `cardMarks` nur mit gültiger Lage
  (`selectShots`), seit Version 3.
- `packages/shot-ui/CLAUDE.md`, Regel „Zahlen nur aus dem Fachkern“: „Gezeichnet wird nur, was eine gültige Lage hat
  (`hasValidPosition`, wie `selectShots` mit `need: "position"`): kein verdächtiger Schuss (SF-15), keiner über der
  Soll-Zahl (SF-08). `hasPosition` prüft nur Zahlen und gilt allein für schon gefilterte Lagen (`MiniTarget`).“ In der
  Export-Tabelle `hasValidPosition` neben `hasPosition` nennen.
- `/sync-graph` (vault-lint).

### T6 Abschluss

- `pnpm check` grün (alle fünf Gates; in einem frischen Worktree vorher die `.env` der Apps aus dem Haupt-Checkout
  verlinken).
- Plan nach dem Review löschen (`plans/README.md`: nur offene Pläne), im letzten Commit vor dem Merge.

## Verification

- Tests aus T1 bis T4 grün; T1 bis T3 vor dem Fix rot gesehen, T4 per Mutation.
- Fingerabdruck-Test mit `p3-…` und neuer Ausgabe.
- Browser (`pnpm --filter spiegel dev`, :3002): Datenlage vorher prüfen, ob die Dev-Datenbank Scheiben mit Schüssen
  `verdaechtig` oder `ueber-soll` hat (gegen die Dev-DB `spiegel`: `SELECT count(*) FROM "Shot" WHERE 'verdaechtig' =
ANY(flags) OR 'ueber-soll' = ANY(flags)`). Wenn ja: Seite der Scheibe (große Scheibe,
  Serien) und Liste ansehen, nach dem Neustart des Servers (Projektion Version 3). Wenn nein: im Bericht „nicht belegt“,
  abgedeckt durch die Markup-Tests aus T2 und T3 und T4.
- Nach dem Deploy rechnet `refreshStaleProjections` beim Start alle Projektionen neu; keine Migration.
