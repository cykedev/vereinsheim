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
  Seite einer Scheibe lädt Schüsse (`cardWithShots`). Messung: „Alles“ 38 ms statt 234 ms Laden plus 50 ms Rechnen.
- **Projektion nur aus dem Fachkern.** `cardProjection` rechnet, die App speichert. Steigt eine Kennzahl-`version` oder
  `PROJECTION_VERSION`, holt `refreshProjections` die veralteten in Stapeln nach.
- **Revisionen sind Korrekturen.** Kommen nur Schüsse dazu (offener Durchgang nach jedem Schuss, SF-03), wächst die
  aktuelle Revision (`appendedShots`); ein geänderter oder fehlender Schuss ergibt eine neue, die vorige bleibt.
  Derselbe Inhalt ergibt keine (Inhalts-Prüfsumme). Merkmale der Scheibe (Zustand, Merkmale, Wertung) stehen in der
  Zeile der Scheibe, nicht in der Revision.
- **Rohdaten als Zeilenversionen.** Gleiche Prüfsumme wie der letzte Stand: nichts Neues, nur `lastSequence` steigt;
  kleinere Folgenummer als `lastSequence`: veraltet (SF-26). Ohne `lastSequence` überholte ein verspäteter Stand den
  wiederholten neueren.
- **Familie mitgeführt:** `Card.familyId` kopiert die Familie der Disziplin für den Index; umhängen nur über
  `setDisciplineFamily` (eine Transaktion mit den Scheiben).
- **Tests gegen die Dev-Datenbank:** je Datei eine eigene Anlage (`test/fixtures.ts`, `createTestSite`), am Ende
  gelöscht (Kaskade über die Anlage, dazu Schütze und Familie); Dateien laufen nacheinander (`fileParallelism: false`).
  Testscheiben aus `test/generate.ts` (fester Seed, Werte aus der Lage über den Fachkern), echte Snapshot-Folgen aus
  `@vereinsheim/ssmdb2-cases/frozen`. Nach einer Schemaänderung `prisma generate`, sonst meldet der Client unbekannte
  Felder.
- **Prisma 7 wie Ringwerk:** Client in `src/generated/prisma` (gitignored), `@prisma/adapter-pg`, keine URL im Schema.
  `prisma migrate reset` verlangt eine ausdrückliche Zustimmung des Users; nie umgehen, stattdessen eine neue Migration.
- Ausgabe in Werkzeugen über `process.stdout.write`, nicht `console.log` (Lint).
