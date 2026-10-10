# Spiegel: Start, Liste und Blättern auf der Projektion

## Kontext

Der User am 10. Oktober 2026: „mach mit der Projektion für Start und Liste weiter“. Heute laden Start, die Liste und das
Blättern auf der Seite einer Scheibe jede Scheibe des Schützen mit allen Schüssen (`ownerCardsWithShots`). Die Modelle
in `shot-ui` (`startModel`, `cardListModel`, `periodModel`) rechnen im Browser aus den Schüssen. Bei 1.564 Scheiben
trüge jede Seite so alle 57.665 Schuss. Laut [[adr-031]] (Folgen) bekommen Liste, Fortschritt und Start in SP-1.8
Modelle, die `ProjectedCard` statt `PeriodCard` nehmen. Das ist Bedingung für den ersten Deploy (SP-1.9, Roadmap).

Geprüft vor dem Plan:
- Start braucht das Modell des Zeitraums für „Form der letzten 90 Tage“ (`formOf` → `periodModel`). Damit Start und
  Fortschritt dasselbe sagen, zieht `periodModel` mit um.
- Alles, was die Modelle aus Schüssen rechnen, steht in der Projektion oder folgt aus ihr:
  - `cardValues` → `projectedValues`, `periodRecords` → `projectedRecords` (beide gibt es).
  - Schusszahl wie am Ausdruck = `printedShots` (`cardShots(…, true).match` ist `asOnPrintout`).
  - „nur Probe“ = `probeOnly && printedShots > 0`: `isProbeOnly` verlangt mindestens einen Schuss.
  - Der Ø je Schuss über alle Schüsse eines Abends ist exakt die Summe der Scheiben geteilt durch die Summe ihrer n
    (`result.decimalMean`, `onMissing: "drop"`). Die Summe je Scheibe wird aus Wert und n auf das Raster der Wertung
    gerundet (Zehntel bzw. ganze Ringe). Das macht den gespeicherten Wert, der auf 1e-9 gerundet ist, wieder exakt.
  - `trainingVolume` zählt `asOnPrintout(shots).length`, also `printedShots`.
- Was nicht in der Projektion steht: die Lagen für die kleinen Scheiben (`MiniTarget` in Liste, Start und Ablesung
  des Zeitraums). Sie brauchen je Schuss nur x, y und den Ring.

## Entscheidungen

- **Kompakte Lagen je Scheibe** (`cardMarks` in `shot-core/projection`): die Schüsse wie am Ausdruck (`asOnPrintout`)
  mit Lage, je `[x, y, ring]` in 10 µm, Ring `null` ohne Wert, in Abgabefolge. Etwa 0,6 KB je Scheibe mit 40 Schuss.
  `markShots` macht daraus, was `MiniTarget` zeichnet (`MarkShot`: `xUm`, `yUm`, `ring`).
  - Gespeichert in einer eigenen Spalte `CardProjection.marks`. Die Modelle brauchen sie nicht. Gelesen werden sie nur
    für die Scheiben, die eine Seite zeigt (`cardMarks(db, { ownerId, ids })`).
  - `PROJECTION_VERSION` steigt auf 2. Damit rechnet `refreshProjections` jede gespeicherte Projektion nach und füllt
    die neue Spalte.
- **`projectCard(card)`** in `shot-core/projection`: Merkmale und Projektion einer Scheibe mit Schüssen. Das Labor und
  die Tests machen so aus ihren Scheiben die Eingabe der Modelle; `ProjectedCard` bekommt `official?` wie `PeriodCard`.
- **Modelle in `shot-ui` nehmen `ProjectedCard`:**
  - `cardListModel`, `startModel`, `periodModel`, `contextCardIds`, `lastEvening`.
  - Dazu `isProbeOnly`, `cardKind` und `byStart`.
  - Die Bausteine mit kleiner Scheibe bekommen die Lagen als Karte `marks` (Id → `MarkShot[]`) statt der Scheiben mit
    Schüssen: `EveningList`, `EveningBlock` und `CardReadout`.
  - `CardList` zählt `printedShots`. `MiniTarget` nimmt `MarkShot` (passt auch auf `MetricShot`).
- **Gleichheit statt neuer Erwartungen:** Die bestehenden Tests der Modelle und Bausteine bleiben in ihren Erwartungen
  unverändert und bekommen ihre Scheiben über `projectCard`. Was grün bleibt, rechnet wie vorher. Eine Gegenprobe zeigt,
  dass die Tests den Unterschied sehen (zum Beispiel `printedShots` durch die Zahl aller Schüsse ersetzt).
- **Die App rechnet die Modelle auf dem Server:**
  - Die Seite liest Scheiben mit Projektion (`ownerCards`), rechnet `startModel` bzw. `cardListModel` und gibt der
    Client-Hülle nur das Modell und die Lagen der gezeigten Scheiben.
  - Die Liste liest ihre Abfrage auf dem Server aus `searchParams` (wie die Seite einer Scheibe). Ein Filter schreibt
    weiter die Adresse, und die Seite rechnet neu.
  - Die Hüllen bauen Routen und Rückrufe. Eine Scheibe öffnet in `row.resultScoring`: das ist die amtliche Wertung,
    sonst die des Geräts, wie bisher `card.official ?? scoring`.
- **Blättern** auf der Seite einer Scheibe rechnet `contextCardIds` aus `ownerCards` statt aus allen Schüssen.
- **Nachrechnen beim Start:** `refreshStaleProjections` ruft `refreshProjections` in Stapeln, bis keine veraltete mehr
  übrig ist. Der Server startet es in `instrumentation-node.ts` nach dem Seed-Admin, ohne darauf zu warten. Bisher rief
  niemand außer den Tests `refreshProjections`; nach einer neuen Version zeigten die Übersichten sonst nie die neue
  Rechnung.
- **Schema nach der Regel „eine Migration bis zum ersten Deploy“:**
  - `init` wird neu erzeugt und in einem Wegwerf-Postgres gegengeprüft.
  - Die Dev-Datenbank bekommt die Spalte nicht destruktiv (`ADD COLUMN … DEFAULT '[]'`, danach `DROP DEFAULT`). Ihre
    Projektionen rechnet der Start nach.
  - Den Verlauf der Migrationen gleicht der User beim nächsten Reset an.

## Aufgaben

1. **Fachkern** (`packages/shot-core/src/analysis/projection.ts`):
   - `PROJECTION_VERSION = 2` und `ProjectedCard.official?`.
   - Neu: `projectCard`, `CardMarks`, `cardMarks`, `MarkShot`, `markShots`, `projectedVolume`, `pooledMean(cards,
     scoring)`.
   - Tests zuerst:
     - Lagen: Rundung auf 10 µm, Ring `null`, ohne Lage weg, nur Probe als Wertung, Abgabefolge.
     - `projectedVolume` gleich `trainingVolume` und `pooledMean` gleich `computeMetric` über die Schüsse zusammen, an
       den Fixtures und den Sonderfällen.
     - Die Version ist neu festgeschrieben.
2. **Modell des Zeitraums** (`shot-ui/period/model.ts`, `CardReadout`, `CardList`):
   - auf `ProjectedCard` umstellen; `CardReadout` bekommt `marks`;
   - die Tests (`period/*.test.ts*`) projizieren ihre Scheiben.
3. **Liste** (`list/evenings.ts`, `EveningList.tsx`): `ListInputCard.card` ist `ProjectedCard`, Werte aus der Projektion,
   `EveningList` mit `marks`; Tests projizieren.
4. **Start und Blättern** (`start/model.ts`, `EveningBlock.tsx`, `nav/context.ts`, `target/MiniTarget.tsx`): Ø des Abends
   über `pooledMean`, `EveningBlock` mit `marks`; Tests projizieren. Gegenprobe wie oben.
5. **Labor** (`tools/labor/src`):
   - `ListView`, `StartView`, `PeriodView`, `CardView` (Blättern) und `testHook` projizieren die Saison einmal
     (`projectCard`).
   - Die Lagen kommen über `markShots(cardMarks(card))`, derselbe Weg wie in der App.
   - Die Skriptprüfung bleibt grün.
6. **Schema und Schreiben** (`apps/spiegel`):
   - `CardProjection.marks Json`; `saveProjection` schreibt `cardMarks`.
   - `init` neu erzeugen und im Wegwerf-Postgres prüfen; die Dev-Datenbank nicht destruktiv nachziehen.
   - `refreshStaleProjections` in `src/lib/db/cards.ts` mit Test (nur mit `sourceId`). Aufruf in
     `instrumentation-node.ts`.
7. **Lesen** (`src/lib/db/reads.ts`, `src/lib/pages.ts`):
   - `OverviewCard` mit Familie (Kennung, Name), Scheibenbild und `official?`.
   - Neu `cardMarks(db, { ownerId, ids })` (nur eigene Scheiben); `ownerCardsWithShots` entfällt.
   - `familiesOf` und `listable` auf `OverviewCard`; Tests.
8. **Seiten:**
   - Start (`(app)/page.tsx`, `StartScreen`) und Liste (`cards/page.tsx`, `ListScreen`) rechnen auf dem Server.
   - `searchOf` wird geteilt (`src/lib/search.ts`); die Seite einer Scheibe blättert über `ownerCards`.
9. **Messung** (`tools/measure.ts`): Start und Liste („Alles“) aus der Projektion über 1.564 Scheiben. Gemessen werden
   die Zeit für Lesen und Rechnen und die Größe dessen, was an den Browser geht (Modell plus Lagen, als JSON).
10. **Doku:**
    - Roadmap SP-1.8 und SP-1.9 (Übergang erledigt).
    - [[spiegel-db-schema]] (Spalte `marks`, Nachrechnen beim Start).
    - `apps/spiegel/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`, `packages/shot-core/CLAUDE.md`, Architekturkarte.

## Dateien

- `packages/shot-core/src/analysis/projection.ts` und Test, `packages/shot-core/src/analysis/index.ts` (falls dort
  exportiert)
- `packages/shot-ui/src/{list/evenings.ts,list/EveningList.tsx,start/model.ts,start/EveningBlock.tsx,period/model.ts,
  period/CardReadout.tsx,period/CardList.tsx,nav/context.ts,target/MiniTarget.tsx}` und ihre Tests
- `tools/labor/src/{ListView,StartView,PeriodView,CardView}.tsx`, `tools/labor/src/testHook.ts`
- `apps/spiegel/prisma/schema.prisma`, `apps/spiegel/prisma/migrations/*_init/migration.sql`
- `apps/spiegel/src/lib/db/{cards,reads}.ts` und Tests, `src/lib/pages.ts`, `src/lib/search.ts`,
  `src/instrumentation-node.ts`
- `apps/spiegel/src/app/(app)/page.tsx`, `src/app/(app)/cards/page.tsx`, `src/app/(app)/cards/[id]/page.tsx`,
  `src/components/start/StartScreen.tsx`, `src/components/list/ListScreen.tsx`
- `apps/spiegel/tools/measure.ts`
- Doku wie in Aufgabe 10

## Required Docs

- [[adr-031]], [[spiegel-db-schema]], `apps/spiegel/CLAUDE.md`, `packages/shot-ui/CLAUDE.md` (Liste, Start, Zeitraum,
  Rahmen und Links), `packages/shot-core/CLAUDE.md` (Regel zur Projektion), `vault/conventions.md` §9 und §10

## Tests

- Fachkern: siehe Aufgabe 1.
- `shot-ui`: Alle Tests von Liste, Start, Zeitraum, Blättern und den Bausteinen mit kleiner Scheibe bleiben in ihren
  Erwartungen gleich, mit projizierten Scheiben. Dazu je Modell eine Gegenprobe.
- App:
  - `reads.test.ts`: `ownerCards` mit Familie, Scheibenbild und amtlicher Wertung; `cardMarks` nur eigene, nicht
    gelöschte Scheiben, Lagen wie `cardMarks` des Fachkerns.
  - `cards.test.ts`: Die Projektion trägt die Lagen; `refreshStaleProjections` rechnet eine veraltete nach, bis keine
    übrig ist.
- Labor: `pnpm --filter @vereinsheim/labor pruefen`.

## Verifikation

- `pnpm check` grün, `vault-lint` gültig, Skriptprüfung des Labors grün.
- Browser mit den eigenen Scheiben des Users gegen die Aufnahme vor dem Umbau (Text und kleine Scheiben):
  - Start: Zahlen, Satz, Verlauf, Form.
  - Liste: Luftpistole mit 30 Scheiben, Luftgewehr mit 2; Zeilentexte, Zahl der Punkte, Ausschnitt und Farben der
    kleinen Scheiben.
  - Filter, Blättern von Liste und Start, Telefonbreite; keine Konsolenfehler.
- Messung aus Aufgabe 9 im Bericht. Ziel: deutlich weniger als die Schüsse aller Scheiben.
