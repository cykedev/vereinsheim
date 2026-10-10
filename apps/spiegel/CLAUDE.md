# Spiegel — Claude Scope-Notiz

Dritte App im Monorepo: Schussrohdaten der Meyton-Anlage (SSMDB2) über eine lokale Brücke, Zuordnung per
Sportpass-Opt-in und Meyton-QR ([`vault/spiegel/spiegel.md`](../../vault/spiegel/spiegel.md)). Seit SP-1.6 a Teil 1
(Oktober 2026) stehen Datenbank, Zugriffe und Messung ([ADR-031](../../vault/decisions/adr-031.md),
[`spiegel-db-schema`](../../vault/spiegel/spiegel-db-schema.md)); seit Teil 2 Anmeldung, Admin und Ratenbegrenzung,
seit N7 (erster Teil) Start, Scheiben, die Seite einer Scheibe und Profil mit echten Daten
([`spiegel-navigation`](../../vault/spiegel/spiegel-navigation.md)). Der Deploy-Vertrag (`compose.yml`, `Caddyfile`,
`db-init/`) folgt in SP-1.9.

## Befehle

| Befehl                                                     | Zweck                                                                                                      |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm dev --filter spiegel`                                | Dev-Server auf :3002                                                                                       |
| `pnpm --filter spiegel exec prisma migrate dev --name <x>` | Schema ändern (braucht `.env` mit `DATABASE_URL`)                                                          |
| `pnpm --filter spiegel test`                               | Tests, die Zugriffe gegen die Dev-Datenbank `spiegel`                                                      |
| `pnpm --filter spiegel measure`                            | Messung „sehr aktiv, 5 Jahre“ mit `EXPLAIN ANALYZE`, nicht im Gate                                         |
| `pnpm --filter spiegel seed:own`                           | die echten Scheiben des Users in die Dev-Datenbank, dem Konto aus `SEED_ADMIN_EMAIL` (`--email`, `--demo`) |

Die Dev-Datenbank legt `dev/db-init` beim ersten Start an, `scripts/bootstrap-dev.sh` zieht sie für bestehende Volumes
nach. Ohne `.env` nehmen Tests und Messung die Dev-Datenbank aus `.env.example` (`test/dev-database.ts`), NextAuth den
Beispiel-Secret (`src/lib/auth-secret.ts`, nur außerhalb von Produktion). Das erste Admin-Konto legt der Server beim Start
an (`src/instrumentation.ts`, aus `SEED_ADMIN_*`); danach `seed:own`. Für Prüfungen im Browser: `seed:own --demo`, dann
mit dem Demo-Konto aus `tools/seed-own.ts` anmelden; danach `seed:own` für das eigene Konto.

## Aufbau

- `src/app/login` ohne Rahmen; `src/app/(app)/*` mit Anmeldepflicht (`requireSession` im Layout, `proxy.ts` davor):
  Start `/`, Scheiben `/cards`, Scheibe `/cards/[id]`, Profil, Platzhalter (Fortschritt, Scannen, Offen), Admin
  `/admin/users`.
- Seiten sind Server-Komponenten: Sitzung, Daten (`src/lib/db/reads.ts`), Kontext (`pageContext`: Zone, „jetzt“,
  Wertung des Geräts, benannte Zeiträume). Die Hüllen in `src/components/*/…Screen.tsx` sind Client-Komponenten und
  bauen Routen und Rückrufe (Funktionen gehen nicht vom Server zum Client), wie die Ansichten im Labor.
- `AppShell`: `AppFrame` mit `next/link`, Bereich aus der Adresse, letzte Adresse je Bereich, Blatt der Hilfe
  (`useHelp`). Darstellung über `ThemeProvider` (Skript vor dem Zeichnen, `localStorage`).

## Regeln

- **Schichten** (`src/lib/db/`): `raw.ts` legt Rohdaten ab, `cards.ts` schreibt Scheiben, Revisionen und Projektion,
  `reads.ts` liest für die Ansichten. Seiten und Server Actions rufen nur diese Funktionen, nie Prisma direkt auf Schüsse.
- **Übersichten lesen keine Schüsse** (Ziel, ADR-031): Liste, Fortschritt und Start nehmen `familyCards`/`ownerCards`
  (Scheibe mit Projektion) und rechnen mit `projectedValues`/`projectedRecords`. Messung: „Alles“ 39 ms statt 200 ms
  Laden plus 48 ms Rechnen. **Übergang:** Start, Liste und das Blättern laden noch `ownerCardsWithShots`, weil die
  Modelle in `shot-ui` aus Schüssen rechnen; vor dem ersten Deploy auf die Projektion umstellen (SP-1.8). Nur die Seite
  einer Scheibe lädt Schüsse auf Dauer (`cardWithShots`, immer mit `ownerId`).
- **Privat ist Standard** ([[spiegel-privacy]]): Jeder Lesezugriff filtert nach dem angemeldeten Schützen, auch für
  Admins. Admin verwaltet Konten und sieht keine fremden Schüsse.
- **Anmeldung wie Ringwerk:** `getAuthSession` prüft gegen die Datenbank (aktiv, `sessionVersion`, einmal je Anfrage
  über `cache`), Server Actions geben `ActionResult` zurück (nie werfen). Ablauf von `authorize`, Store und
  Admin-Auswertung der Sperren kommen aus `@vereinsheim/lib/auth/*`, gemeinsam mit Ringwerk und Treffsicher. Neue
  Rolle, neuer Status oder neues Passwort beenden die Sitzungen eines Kontos (das JWT trägt die Rolle).
- **Admin-Daten prüfen selbst:** jede Admin-Seite und jede Admin-Abfrage ruft `requireAdmin`; das Layout allein schützt
  die Daten einer Seite nicht (Next: bei Navigation im Client läuft es nicht erneut).
- **Passwort vom Admin:** `mustChangePassword` (beim Anlegen und Zurücksetzen). `requireSession` leitet jede Seite zur
  Passwortseite, bevor sie Daten lädt; nur die Passwortseite und das Layout der App rufen mit `passwordChange: true`
  (das Layout läuft auch für die Passwortseite und leitete sie sonst auf sich selbst um, Test).
- **Nach der Anmeldung** nur Pfade derselben Herkunft (`safeCallback`, aufgelöst wie im Browser). Abmelden mit `signOut({ redirect: false })` und eigener Navigation: Mit Umleitung
  baut `next-auth/react` die Adresse aus `NEXTAUTH_URL`, ohne sie `localhost:3000` (Ringwerk), am Handy über die
  Netzadresse ins Leere. `proxy.ts` lässt alles unter `_next/` frei (sonst fängt es die Verbindung des Dev-Servers ab).
- **Formulare mit Server Action gesteuert** (`value` + `onChange`): React setzt ungesteuerte Felder nach dem Absenden
  zurück, ein Feldfehler löschte sonst die Eingaben.
- **instrumentation:** den Node-Teil nur im Zweig `NEXT_RUNTIME === "nodejs"` laden (`instrumentation-node.ts`); Next
  bündelt die Datei auch für Edge, und dort fehlt `fs` für `pg`.
- **Wertung des Geräts** als Cookie (`spiegel-scoring`, `src/lib/device*.ts`): Start und Liste rendern auf dem Server.
  Der Name steht in `device-cookie.ts` ohne Importe, damit die Client-Seite nicht `next/headers` zieht.
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
- **Speicher** im Container messen, nicht auf dem Mac (macOS zählt anders; 765 MB auf dem Mac waren 227 MiB im
  Container): Standalone-Build in `node:24-alpine` mit `--memory=256m`, anmelden, Seiten abrufen, `docker stats`
  (10. Oktober 2026, nach dem Review: 57 MiB nach dem Start, 147 bis 152 MiB unter Last). Dafür einen eigenen
  `NEXTAUTH_SECRET` setzen: Produktion verweigert den Beispielwert aus `.env.example`.
- **seed:own** nur gegen die lokale Dev-Datenbank `spiegel` (prüft die Adresse, `--force` für eine andere lokale).
- Ausgabe in Werkzeugen über `process.stdout.write`, nicht `console.log` (Lint).
