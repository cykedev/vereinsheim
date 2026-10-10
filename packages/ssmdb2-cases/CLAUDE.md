# @vereinsheim/ssmdb2-cases — Claude Scope-Notiz

Sonderfall-Testdaten für Brücke und Spiegel (SP-1.0 b, 10. Oktober 2026, `plans/2026-10-10-spiegel-ssmdb2-cases.md`):
je Sonderfall mit Bezug zur Ablage eine erfundene SSMDB2 im echten Schema als Folge von Ständen, mit Snapshots v1,
SQL je Schritt und von Hand geschriebenem erwartetem Ergebnis. Die Brücke (SP-1.4) und das Einlesen (SP-1.6) werden
an ihnen abgenommen. Fachwissen: `vault/meyton/meyton-ssmdb2.md`, `vault/spiegel/spiegel-edge-cases.md`,
`vault/spiegel/spiegel-ingest-contract.md`.

## Befehle

| Befehl                                           | Zweck                                                                        |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `pnpm --filter @vereinsheim/ssmdb2-cases cases`  | Fälle nach `cases/v1/<SF-ID>/` schreiben (nach jeder Änderung an einem Fall) |
| `pnpm --filter @vereinsheim/ssmdb2-cases replay` | Fälle in `mariadb:10.6` abspielen und wie die Brücke lesen (Docker, ~35 s)   |

## Exporte

| Export                               | Datei                | Inhalt                                                                                                                                                 |
| ------------------------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@vereinsheim/ssmdb2-cases/schema`   | `src/schema.ts`      | `COLUMNS` (Spalte → `COLUMN_TYPE` je Tabelle), `PRIMARY_KEYS`, `SCHEMA_VERSION` (9), Zeilentypen; folgt `schema/ssmdb2.sql`                            |
| `@vereinsheim/ssmdb2-cases/values`   | `src/values.ts`      | `shotValues` (Ring, Zehntel, Innenzehner, Teiler aus der Lage), `displayText` je Anzeigeart, `overTargetValues`, `hiddenValues`                        |
| `@vereinsheim/ssmdb2-cases/ablage`   | `src/ablage.ts`      | die Ablage im Speicher (Version, Scheiben, Serien, Treffer), `trefferOf`, `serienOf`, `deleteScheibe` (Kaskade)                                        |
| `@vereinsheim/ssmdb2-cases/stand`    | `src/stand.ts`       | der Baukasten: `Sim` (Uhr, Lesungen), `Card` (Schuss, Handeintrag, Neustart der Probe, Anzeigeart, Korrektur, Löschen, Riss), `scheibenIdAt`, `MUSTER` |
| `@vereinsheim/ssmdb2-cases/output`   | `src/output.ts`      | `readingSnapshots` (Snapshot v1 je Lesung und Scheibe), `stepSql` (Anweisungen vom vorigen Stand), `textCell`, `sqlLiteral`                            |
| `@vereinsheim/ssmdb2-cases/expected` | `src/expected.ts`    | `ExpectedCard` (was die Brücke tut, Schüsse je Lesung, Merkmale, Vollständigkeit, zählende Schüsse), `numbers`                                         |
| `@vereinsheim/ssmdb2-cases/cases`    | `src/cases/index.ts` | `CASES` (31 Fälle), `runCase`                                                                                                                          |

## Regeln

- **Nur erfundene Personen** (ADR-029): „Muster“, Sportpass 12345678, Verein „SV Musterstadt“; ein Test listet alle
  Personen der Snapshots. Erfundene ScheibenIDs aus einem erfundenen Zählerstart (`BOOT`).
- **Das Schema ist das echte** (`schema/ssmdb2.sql`, `SHOW CREATE TABLE` der Kopie vom 9. Oktober 2026, nur DDL); ein
  Test hält `src/schema.ts` gleich, `replay` vergleicht mit `information_schema`.
- **Der Baukasten schreibt wie beobachtet**:
  - Probe weg mit dem ersten Wertungsschuss, beim Neustart mit dem ersten neuen Probeschuss.
  - Über der Soll-Zahl Wert 0, „0F“ und Platzhalter-Teiler.
  - Verdeckt (5): „\*\*\*“, Lage und Teiler bleiben; der Wert bleibt mit `hiddenKeepsValue` (15 von 25
    Königsscheiben), sonst 0.
  - `Text` je Anzeigeart, Lebenszeichen, Uhr je Stand (auch umstellbar, Uhrsprung), ScheibenID als
    Millisekundenzähler, Millisekunden verteilt (0 bis 999).
  - Ohne Wertung `BesterTeiler` 2147483647.
  - **Annahmen**, im Code markiert, bis das Schießprotokoll (SP-0.6) sie klärt:
    - Probe nach einem Wechsel zurück von Wertung (SF-04);
    - Korrektur und Löschen mit Nachrücken (SF-21, SF-22), beide ohne neues Lebenszeichen;
    - Schüsse über der Soll-Zahl in einer eigenen Serie;
    - `Text` bei 0, 10 und beim Fehlschuss;
    - „Hand“ und bester Teiler 0 beim Handeintrag;
    - die Anzeigeart schreibt nur die Wertung um;
    - beim Riss fehlen die Serien ganz.
- **Werte aus dem Fachkern** (`shotValues` über `scoreFromCoordinates` mit Meytons Toleranz), nie von Hand.
- **Das erwartete Ergebnis ist eine Vorgabe**, von Hand geschrieben, nicht aus Brücke oder Adapter gerechnet:
  - Jede Lesung steht für einen Stand, den die Brücke mindestens zweimal gleich liest; nur flüchtige
    (`transient`, Riss) nicht.
  - Die Brücke sendet jede nicht flüchtige Lesung mit neuem Stand. „zurueckhalten“: nur bis zum ersten verdeckten
    Wertungsschuss oder Modus 0. „auslassen“: ohne Treffer. „nur-qr“: ohne zugestimmten Sportpass.
  - Ein Test hält jede Vorgabe gegen die Daten:
    - Schüsse je Lesung, gesendete Lesungen, zählende Nummern;
    - Vollständigkeit über `classifyCompleteness`;
    - die Merkmale `disziplin-unbekannt`, `uhr-abweichung` (Versatz ab 1 min bei laufendem Lebenszeichen oder
      Schusszeit über einen Tag daneben) und `korrigiert`;
    - Merkmale je Schuss (`fehlschuss`, `ueber-soll`, `verdaechtig`).
  - Angenommen ist, dass nur Sportpass 12345678 zugestimmt hat.
- **Eingefroren** unter `cases/v1/`, nicht von Prettier geformt (`.prettierignore`), eine Zeile je Tabellenzeile.
  - Nach einer Änderung `cases` laufen lassen; der Test meldet sonst „Fälle veraltet“.
  - Sobald Brücke oder Adapter an den Fällen hängen, nur ergänzen (neue Fälle, `cases/v2` bei neuem Vertrag), wie bei
    `ingest-contract`.
- **Sommerzeit:** Die Fälle liegen zwischen 29. März und 25. Oktober 2026 (Ortszeit = UTC + 2 h im Baukasten), ein Test
  prüft es. Lesungen haben eine streng steigende Beobachtungszeit; sie ist die Folgenummer (SF-26).
- **MariaDB ab 10.6:** Die Schritte setzen `SET NAMES utf8mb4` und eine Null-Zeit (`0000-00-00`), MySQL 8 lehnt sie
  ab (`NO_ZERO_DATE`). `replay` läuft gegen `mariadb:10.6` und `mariadb:11`.
- Werkzeuge unter `tools/`, nicht `scripts/` (im Autopiloten geschützt).
- Nach Änderungen: `pnpm check`; `format:check` prüft auch diese Datei.
