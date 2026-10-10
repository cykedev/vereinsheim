# SP-1.0 b — Sonderfall-Testdaten (`packages/ssmdb2-cases`)

## Kontext

SP-1.0 a (Vertrag, `packages/ingest-contract`) ist fertig, b ist offen und liegt auf dem kritischen Pfad: Die Brücke
(SP-1.4) wird „gegen eine lokale MySQL mit SSMDB2-Schema und den Fällen aus SP-1.0“ abgenommen, das Einlesen (SP-1.6)
mit „Snapshot rein → kanonische Scheibe raus“. Der Zuschnitt ist seit dem 9. Oktober 2026 abgestimmt
(`vault/spiegel/spiegel-roadmap.md`, SP-1.0, „Zuschnitt b“): eigenes Paket, je Sonderfall mit SSMDB2-Bezug eine
erfundene Ablage im echten Schema als Folge von Ständen, gebaut mit einem Baukasten für das beobachtete Verhalten; je
Fall Snapshots v1, SQL je Schritt und erwartetes Ergebnis, eingefroren unter `cases/v1/<SF-ID>/`, ein Test hält sie
aktuell; ein eigener Befehl spielt die Fälle in `mariadb:11` ein und liest nach jedem Schritt wie die Brücke (nicht im
`pnpm check`). Der User hat am 10. Oktober 2026 freigegeben, autonom weiterzumachen.

## Fakten aus der Kopie vom 9. Oktober 2026 (nur Schema und eigene Scheiben des Users gelesen)

- **Schema** (`SHOW CREATE TABLE`, `bericht/schema.sql` der Erkundung, nur DDL): InnoDB, `utf8mb3`, alle Spalten
  `NOT NULL`; Namen wie `StarterlistenID`, `KlassenID`, `VereinsID`, `MannschaftsID`, `RanglistenID`, `GruppenID`;
  `StandNr smallint(6)`, `Trefferzahl smallint(6)`, `Status varchar(72)`, Textspalten `varchar(36)`; `Serien` und
  `Treffer` mit Fremdschlüssel `ON DELETE CASCADE ON UPDATE CASCADE`; `Version(Versionsnummer int(11))` mit dem Wert 9.
- **Training:** `Startzeit` „0000-00-00 00:00:00“, `Status` leer, `Starterliste` „Direktbelegung“ (oder leer mit
  `StarterlistenID` 0, `Geschlecht` `unknown`, `Rangliste` leer), `Rangliste` etwa „Training-LP“, `Gruppe` leer mit
  `GruppenID` 0, `StandNrText` die Standnummer als Text, `Land` „GER“.
- **Ohne Wertungsschuss:** `Trefferzahl` 0, `TotalRing` 0, `TotalRing01` 0, `BesterTeiler01` und `BesterTeiler001`
  2147483647.
- **`Text` je Anzeigeart (`Treffer.Wertung`):**

  | Anzeigeart | `Text` |
  | --- | --- |
  | 1 | Zehntel mit Punkt („10.1“) |
  | 2 | ganzer Ring („9“), Innenzehner „10*“ |
  | 5 | „***“, mit Ring und Zehntel 0, Teiler vorhanden |
  | 7 | Zehntel und Teiler in 1/10 mm („9.9 851T“, `Teiler01` 8510) |
  | 8 | Ring und Teiler („9 995T“) |

- **Probe** hat eigene Zeilen in `Serien` (Stellung 0, Serien zu zehn); `Treffer.Serie` zählt je Stellung.

## Ansatz

- **Paket** `@vereinsheim/ssmdb2-cases` (Vorlage `packages/ingest-contract`):
  - Abhängigkeiten `@vereinsheim/shot-core` (Wertung aus der Lage, Toleranz wie Meyton) und
    `@vereinsheim/ingest-contract` (Snapshot v1, Prüfsumme).
  - Nur erfundene Daten (ADR-029): Namen „Muster“, Verein „SV Musterstadt“, Sportpass 12345678.
- **Schema** `schema/ssmdb2.sql` = das echte DDL. `src/schema.ts` hält die Spalten mit ihrem `COLUMN_TYPE`; ein Test
  liest das DDL und vergleicht.
- **Werte** (`src/values.ts`): aus x/y (1/100 mm) über `scoreFromCoordinates`:
  - `Ring` = ganzer Ring × 10, `Ring01`, `Innenzehner`;
  - `Teiler01` = Abstand in µm, `Teiler001` in 0,1 µm;
  - `Text` je Anzeigeart (oben);
  - über der Soll-Zahl Ring 0, `Text` „0F“, Teiler 2147483647 (SF-08);
  - verdeckt (5) Ring 0 und „***“.
- **Baukasten** (`src/ablage.ts`, `src/stand.ts`): eine Ablage (Version, Scheiben, Serien, Treffer) und je Stand eine
  Scheibe mit den beobachteten Regeln:
  - Probe wird mit dem ersten Wertungsschuss gelöscht (SF-03); nach einem Neustart der Probe mit deren erstem Schuss,
    die Nummern beginnen wieder bei 1 (SF-72).
  - `Serien` und die Summen der Kopfzeile folgen den Treffern. `Trefferzahl` zählt Wertungsschüsse, auch über der
    Soll-Zahl; Summen und bester Teiler kommen nur aus der Wertung.
  - Lebenszeichen `Scheiben.Zeitstempel` und Uhr je Stand mit Versatz (SF-73); ScheibenID als
    Millisekundenzähler mit Überlauf (SF-77).
  - Anzeigeart umschalten (SF-74), Korrektur und Löschung (SF-21, SF-22; Verhalten nicht beobachtet, als Annahme
    markiert), zerrissene Lesung als Löschen und Neuschreiben der Scheibe (SF-71).
  - Zeit: Fälle laufen in der Sommerzeit 2026, Ortszeit = UTC + 2 h; ein Test prüft das.
- **Fall** (`src/cases/sf-xx.ts`): ein Skript gegen den Baukasten, das nach jedem Schritt eine Lesung macht, und ein
  von Hand geschriebenes erwartetes Ergebnis je Scheibe:
  - was die Brücke tut: senden, zurückhalten, auslassen;
  - Merkmale, Vollständigkeit, zählende Schüsse „wie am Ausdruck“ (Art und Nummern), Merkmale je Schuss;
  - wo nötig, welche Lesungen gesendet werden (SF-71).
- **Ausgaben** (`src/output.ts`):
  - je Lesung und Scheibe ein Snapshot v1: Zellen als Text wie das MySQL-Textprotokoll, `columns` aus dem Schema,
    `sequence` steigend, `observedAt` die Beobachtungszeit, Epoche 1, Sitzungs-Zeitzone „+00:00“, Prüfsumme aus
    `ingest-contract`;
  - je Schritt die SQL-Anweisungen (Unterschied zum vorigen Stand);
  - `expected.json`.
- **Eingefroren** unter `cases/v1/<SF-ID>/` (`snapshots.json`, `steps/NN.sql`, `expected.json`). Erzeugt mit
  `pnpm --filter @vereinsheim/ssmdb2-cases cases` (`tools/write-cases.ts`). Der Test erzeugt neu und vergleicht
  („Fälle veraltet: pnpm --filter @vereinsheim/ssmdb2-cases cases“). Jeder Snapshot besteht `parseSnapshot`.
- **MySQL** (`tools/replay.ts`, `pnpm --filter @vereinsheim/ssmdb2-cases replay`):
  - startet `mariadb:11` mit `schema/ssmdb2.sql` und vergleicht `information_schema.COLUMNS` mit `src/schema.ts`;
  - spielt je Fall die Schritte ein und liest nach jedem wie die Brücke (`START TRANSACTION WITH CONSISTENT
    SNAPSHOT, READ ONLY`, `SELECT *` je ScheibenID nach Primärschlüssel);
  - vergleicht die Prüfsumme mit dem eingefrorenen Snapshot. Nicht im Gate.

## Fälle (30, wie im Zuschnitt)

- Probe: SF-01, 02, 03, 04, 05, 72.
- Vollständigkeit und Abend: SF-07, 08, 09, 10, 11.
- Werte: SF-14, 15, 16, 17, 18, 19, 20.
- Korrektur und Lesung: SF-21, 22, 23, 71, 74.
- Zeit, IDs, Namen: SF-30, 73, 77, 13, 78, 35, 36.

## Dateien

- neu: `packages/ssmdb2-cases/` (package.json, tsconfig.json, vitest.config.ts, CLAUDE.md, `schema/ssmdb2.sql`,
  `src/*.ts`, `src/cases/*.ts`, `tools/write-cases.ts`, `tools/replay.ts`, `cases/v1/**`)
- `pnpm-lock.yaml` (neuer Importer, nur Workspace- und Katalog-Pakete)
- Doku: `vault/spiegel/spiegel-roadmap.md` (Status SP-1.0 b), `vault/architecture/architecture.md`,
  `vault/meyton/meyton-ssmdb2.md` (Felder im Training, `Text` je Anzeigeart), `vault/spiegel/spiegel-ingest-contract.md`
  (Verweis auf die Fälle)

## Required Docs

- `packages/ingest-contract/CLAUDE.md`, `packages/shot-core/CLAUDE.md`, `vault/conventions.md`
- `vault/spiegel/spiegel-edge-cases.md`, `vault/meyton/meyton-ssmdb2.md`, `vault/spiegel/spiegel-ingest-pipeline.md`

## Tasks

1. Gerüst, Schema, Spaltenliste mit Test gegen das DDL.
2. Werte je Schuss (`values.ts`) mit Handwerten aus der Kopie (Textformate, Innenzehner, Platzhalter, verdeckt).
3. Ablage und Stand (Baukasten) mit Tests je Regel.
4. Ausgaben: Snapshot je Lesung, SQL je Schritt; Tests (Textprotokoll, `parseSnapshot`, SQL rund).
5. Fälle Probe (6).
6. Fälle Vollständigkeit und Abend (5).
7. Fälle Werte (7).
8. Fälle Korrektur und Lesung (5).
9. Fälle Zeit, IDs, Namen (7).
10. Einfrieren und Test (aktuell, alle 30 Ids, nur erfundene Namen).
11. MySQL-Abspielen, einmal laufen lassen.
12. Doku.

## Tests

- Unit-Tests je Modul mit Handwerten.
- Ein Test erzeugt die Fälle neu und vergleicht mit `cases/v1`.
- Jede SF-ID der Liste hat einen Fall mit mindestens einer Lesung.
- Nur erfundene Namen.
- Jeder Snapshot ist gültig nach `parseSnapshot`.
- `replay` meldet für jeden Schritt jedes Falls dieselbe Prüfsumme wie eingefroren.

## Verifikation

- `pnpm check` grün.
- `pnpm --filter @vereinsheim/ssmdb2-cases replay` ohne Abweichung.
- `vault-lint` gültig.
