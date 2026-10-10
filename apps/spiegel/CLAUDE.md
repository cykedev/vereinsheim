# Spiegel — Claude Scope-Notiz

Dritte App im Monorepo: Schussrohdaten der Meyton-Anlage (SSMDB2) über eine lokale Brücke, Zuordnung per
Sportpass-Opt-in und Meyton-QR ([`vault/spiegel/spiegel.md`](../../vault/spiegel/spiegel.md)). Seit SP-1.6 a Teil 1
(Oktober 2026) stehen Datenbank, Zugriffe und Messung ([ADR-031](../../vault/decisions/adr-031.md),
[`spiegel-db-schema`](../../vault/spiegel/spiegel-db-schema.md)); Anmeldung, Admin und Ratenbegrenzung folgen in Teil 2,
die Ansichten in SP-1.8, der Deploy-Vertrag (`compose.yml`, `Caddyfile`, `db-init/`) in SP-1.9.

## Befehle

| Befehl                                                     | Zweck                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm dev --filter spiegel`                                | Dev-Server auf :3002                                               |
| `pnpm --filter spiegel exec prisma migrate dev --name <x>` | Schema ändern (braucht `.env` mit `DATABASE_URL`)                  |
| `pnpm --filter spiegel test`                               | Tests, die Zugriffe gegen die Dev-Datenbank `spiegel`              |
| `pnpm --filter spiegel measure`                            | Messung „sehr aktiv, 5 Jahre“ mit `EXPLAIN ANALYZE`, nicht im Gate |

Die Dev-Datenbank legt `dev/db-init` beim ersten Start an, `scripts/bootstrap-dev.sh` zieht sie für bestehende Volumes
nach. Ohne `.env` nehmen Tests und Messung die Dev-Datenbank aus `.env.example` (`test/dev-database.ts`).

## Regeln

- **Schichten** (`src/lib/db/`): `raw.ts` legt Rohdaten ab, `cards.ts` schreibt Scheiben, Revisionen und Projektion,
  `reads.ts` liest für die Ansichten. Seiten und Server Actions rufen nur diese Funktionen, nie Prisma direkt auf Schüsse.
- **Übersichten lesen keine Schüsse.** Liste, Fortschritt und Start nehmen `familyCards`/`ownerCards` (Scheibe mit
  Projektion) und rechnen mit `projectedValues`/`projectedRecords` aus `@vereinsheim/shot-core/projection`. Nur die
  Seite einer Scheibe lädt Schüsse (`cardWithShots`, immer mit `ownerId`). Messung: „Alles“ 39 ms statt 200 ms Laden
  plus 48 ms Rechnen.
- **Projektion nur aus dem Fachkern.** `cardProjection` rechnet, die App speichert. Steigt eine Kennzahl-`version` oder
  `PROJECTION_VERSION`, holt `refreshProjections` die veralteten nach (auch die einer früheren Revision), je Scheibe
  unter der Sperre ihrer Zeile.
- **Revisionen sind Korrekturen der Wertung** (SF-67, `shotChange`): Eine neue entsteht nur, wenn sich eine
  Wertungszeile ändert oder wegfällt. Neue Schüsse und die Probe, die Meyton beim ersten Wertungsschuss löscht (SF-03)
  oder neu beginnt (SF-72), ändern die aktuelle Revision; die Scheibe ist so, wie am Ausdruck. Merkmale der Scheibe
  (Zustand, vollständig, Merkmale) stehen in ihrer Zeile, die amtliche Wertung an der Disziplin (SF-74).
- **Reihenfolge und Kennung:** `storeSnapshot` und `writeRevision` nehmen dasselbe Advisory-Lock (Quelle, ScheibenID).
  Ein Stand mit nicht größerer Folgenummer als `RawSnapshot.lastSequence` bzw. `Card.lastSequence` ändert nichts
  (SF-26), einer mehr als zehn Minuten in der Zukunft wird abgelehnt. Dieselbe ScheibenID Wochen später ohne gemeinsamen
  Schuss ist ein `CardIdentityConflictError`: der nächste Zyklus (`cycle`, SF-77). Die Kennung einer Scheibe ändert ein
  Stand nie, außer eine Scheibe aus dem PDF bekommt ihre Rohdaten.
- **Familie mitgeführt:** `Card.familyId` kopiert die Familie der Disziplin für den Index; umhängen nur über
  `setDisciplineFamily` (eine Transaktion mit den Scheiben).
- **Tests gegen die Dev-Datenbank:** je Datei eine eigene Anlage (`test/fixtures.ts`, `createTestSite`), am Ende
  gelöscht (Scheiben der Disziplinen, Kaskade über die Anlage, dazu Schütze und Familie); Dateien laufen nacheinander
  (`fileParallelism: false`). Testscheiben aus `test/generate.ts` (fester Seed, Werte aus der Lage über den Fachkern,
  Probe beim ersten Wertungsschuss gelöscht, `liveStates` für den offenen Durchgang), echte Snapshot-Folgen aus
  `@vereinsheim/ssmdb2-cases/frozen` (als Empfangszeit die Beobachtungszeit: die Fälle sind teils auf Tage nach heute
  datiert). `refreshProjections` in Tests nur mit `sourceId`.
- **Prisma 7 wie Ringwerk:** Client in `src/generated/prisma` (gitignored), `@prisma/adapter-pg`, keine URL im Schema.
  Nach einer Schemaänderung `prisma generate`, sonst meldet der Client unbekannte Felder.
- **Bis zum ersten Deploy (SP-1.9) genau eine Migration** (User, 10. Oktober 2026): `prisma/migrations/*_init`. Eine
  Schemaänderung ersetzt sie, statt eine zweite anzulegen: `prisma migrate diff --from-empty --to-schema
prisma/schema.prisma --script` (ohne die Zeilen `CREATE SCHEMA`) nach `…_init/migration.sql`, gegengeprüft in einem
  Wegwerf-Postgres (`migrate diff --from-config-datasource` gegen das Schema leer). Die Dev-Datenbank zieht der User
  nach (`pnpm --filter spiegel exec prisma migrate reset --force`); ein Agent setzt sie nicht zurück, Prisma und der
  Auto-Modus verlangen dafür den User. Ab dem ersten Deploy nur noch neue Migrationen.
- Ausgabe in Werkzeugen über `process.stdout.write`, nicht `console.log` (Lint).
