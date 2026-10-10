# SP-1.6 a (Teil 1) — Datenbank von Spiegel: Schema, Projektion, Zugriffe

## Kontext

Der User (10. Oktober 2026): „Da wir jetzt viel über die Daten und Formate wissen, würde ich gerne anfangen, unsere
eigene DB zu designen … wir wissen, auf was und wie wir zugreifen und welche Indizes wir brauchen. Wir müssen wissen,
wo unsere Scheiben-Anzeigen Performance-Probleme machen. Oder sind wir zu früh dafür?“

**Bewertung: nicht zu früh.** SP-1.6 hängt nur an SP-1.0 und SP-1.1, beide erledigt. Bekannt sind:
- die Quelle (echtes Schema, 31 Sonderfälle mit Vorgabe, Vertrag v1);
- die Zugriffe der Oberfläche (Start, Liste, Fortschritt, Seite einer Scheibe in `shot-ui`);
- die Mengen: an der Vereinsanlage rund 750 Scheiben im Jahr, 45.000 Treffer in zwei Jahren.

**Messung** der Modelle von `shot-ui` (Rechnen aus Schüssen, ohne Datenbank):

| Daten | Fortschritt 90 Tage | „Alles“ | Liste | Start | eine Scheibe |
| --- | --- | --- | --- | --- | --- |
| echte LP des Users (30 Scheiben) | 7 ms | 34 ms | 3 ms | 14 ms | – |
| sehr aktiv, 5 Jahre (1.564 Scheiben, 57.665 Schuss) | 82 ms | 361 ms | 118 ms | 362 ms | 2 ms |

Eine Scheibe ist nie das Problem. Die Seiten über viele Scheiben würden jede Kennzahl aus allen Schüssen neu rechnen
und dafür jeden Schuss laden. Abhilfe ist die Projektion aus dem Datenmodell ([[spiegel-data-model]]): Werte und
Rekord-Kandidaten je Scheibe, einmal beim Schreiben gerechnet. Die Übersichten lesen dann eine Zeile je Scheibe, Schüsse
nur die Seite einer Scheibe.

## Ansatz

- **Fachkern** (`shot-core`):
  - Rekorde zerlegt in Kandidaten je Scheibe (`cardRecordCandidates`) und ihr Zusammenführen (`combineRecords`);
    `periodRecords` nutzt beides und bleibt im Verhalten gleich, die bestehenden Tests halten das.
  - `cardProjection(card, scoring)`: alle Kennzahlen der Ebene Scheibe und die Rekord-Kandidaten in einem Objekt,
    mit Version.
  - Ein Test belegt an der Saison des Labors und den Fixtures: Aus der Projektion zusammengeführt ergeben sich dieselben
    Rekorde und Werte wie aus den Schüssen.
- **App-Gerüst** `apps/spiegel` (minimal, damit Schema und Zugriffe im Monorepo-Muster leben):
  - Next 16 und Prisma 7 wie Ringwerk: Client unter `src/generated/prisma`, `@prisma/adapter-pg`.
  - Design-2-`globals.css`, Layout und eine Startseite ohne Daten.
  - Dev-Port 3002, Dev-Datenbank `spiegel` (`dev/db-init`, `scripts/bootstrap-dev.sh`).
  - Auth, Admin, Ratenbegrenzung und die Speichermessung folgen als Teil 2 von SP-1.6 a.
  - Der Deploy-Vertrag (`compose.yml`, `Caddyfile`, `db-init/`) bleibt bei SP-1.9 und wird hier nicht angefasst.
- **Schema** (`apps/spiegel/prisma/schema.prisma`, ADR-031):
  - **Rohdaten als Zeilenversionen:** `RawRow` je Tabelle, Schlüssel und Inhalt (Prüfsumme der Zeile), nur neu oder
    geändert; `RawSnapshot` mit Hülle und Verweisen auf die Zeilen (`BigInt[]`). Gleiche Prüfsumme heißt nichts zu tun
    (SF-26).
  - **Kanonisch:** `Site`, `Source` (Epoche), `Bridge`, `Family`, `Discipline`, `Card`, `CardRevision`, `Shot` (mit
    Fingerabdruck), `Printout`, `Tombstone`, `DeleteLock`, `NamedPeriod`, `User`.
  - **Projektion:** `CardProjection` je Scheibe und Wertung mit Werten und Rekord-Kandidaten (JSONB) und Version.
    Neu gerechnet beim Schreiben einer Revision und bei neuer Version.
- **Zugriffe** (`apps/spiegel/src/lib/db/*`), je mit Test gegen die Dev-Datenbank:
  - Rohdaten speichern, idempotent, mit den eingefrorenen Fällen aus `@vereinsheim/ssmdb2-cases`;
  - Revision einer Scheibe schreiben (Schüsse und Projektion);
  - lesen für Liste, Fortschritt und Start (Karten und Projektion, ohne Schüsse) und für die Seite einer Scheibe (Schüsse
    der aktuellen Revision).
- **Indizes** nach den Zugriffen:
  - `Card(ownerId, familyId, startedAt)` für Liste, Fortschritt, Start und Blättern;
  - `Card(sourceId, scheibenId)` eindeutig für das Einlesen;
  - `Shot(revisionId, stellung, treffer)` eindeutig für die Seite einer Scheibe;
  - `Shot(cardId, fingerprint)` für Notizen über Revisionen;
  - `RawSnapshot(sourceId, scheibenId, sequence)`, `RawRow` eindeutig über Quelle, ScheibenID, Tabelle, Schlüssel und
    Prüfsumme;
  - `CardProjection(cardId, scoring)` als Primärschlüssel;
  - `Bridge.tokenHash` eindeutig.
- **Messung an der Datenbank** (`apps/spiegel/tools/measure.ts`, nicht im Gate): Volumen „sehr aktiv, 5 Jahre“ schreiben,
  dann Liste/Fortschritt aus der Projektion gegen „alle Schüsse laden“ und eine Scheibe messen, mit `EXPLAIN ANALYZE`
  für die Index-Nutzung.

## Dateien

- `packages/shot-core/src/analysis/records.ts`, `records.test.ts`, neu `analysis/projection.ts` und Test, `index.ts`,
  `catalog.ts` (falls exportierte Funktionen dazukommen), `CLAUDE.md`
- neu `apps/spiegel/**` (package.json, next.config.ts, tsconfig, eslint, postcss, vitest, `.env.example`, `prisma/`,
  `src/app/*`, `src/lib/db/*`, `tools/measure.ts`, `CLAUDE.md`)
- `dev/db-init/01-create-dev-dbs.sh`, `scripts/bootstrap-dev.sh` (Spiegel in die Liste)
- `packages/config/next/index.mjs` nur, wenn Spiegel weitere `transpilePackages` braucht (sonst in der App)
- `pnpm-lock.yaml` (neuer Importer)
- Doku: neu `vault/decisions/adr-031.md`, `decisions.md`, `vault/index.md`, `spiegel-data-model.md` (physisches
  Schema, Zugriffe, Messung), `spiegel-roadmap.md` (SP-1.6 a Teil 1), `vault/architecture/architecture.md`, Root-`CLAUDE.md`

## Required Docs

- `vault/spiegel/spiegel-data-model.md`, `spiegel-ingest-pipeline.md`, `spiegel-ingest-contract.md`, `spiegel-edge-cases.md`
- `vault/apps/ringwerk/prisma7-conventions.md`, `vault/conventions.md`, `packages/shot-core/CLAUDE.md`

## Tests

- `records.test.ts` bleibt unverändert grün; neu: Zusammenführen aus Kandidaten gleich `periodRecords`.
- `projection.test.ts`: Projektion gleich Live-Rechnung (`cardValues`, `periodRecords`) an Labor-Saison und Fixtures;
  Version steigt mit einer Kennzahl-Version.
- `apps/spiegel` (gegen die Dev-Datenbank, je Test aufgeräumt):
  - Rohdaten: Die Fälle SF-03, SF-71 und SF-72 speichern weniger Zeilen als Snapshots × Zeilen; dieselbe Prüfsumme
    zweimal ergibt nichts Neues; eine kleinere Folgenummer ändert nichts.
  - Revision: Schreiben und Lesen geben dieselben Schüsse zurück; die Projektion steht dabei.
  - Lesen: Liste und Fortschritt ohne Schüsse.

## Verifikation

- `pnpm check` grün (die neue App baut im Gate).
- Messung an der Dev-Datenbank im Bericht.
- `vault-lint` gültig.
