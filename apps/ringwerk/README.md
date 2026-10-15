# Ringwerk

Vereinsinterne Wettbewerbs-Plattform für Schützenvereine. Drei Wettbewerbstypen auf einer gemeinsamen Wertung:

- **Liga** — Spielplanerstellung, Ergebniserfassung, Tabellenberechnung und Playoffs
- **Event** — einmaliges Schießen an einem Abend mit Rangliste, auch mit Teams und Gästen
- **Saison** — Langzeitwertung über die besten Serien

Dazu Disziplinen mit Teiler-Faktor, Teilnehmer- und Nutzerverwaltung mit Rollen (Admin, Manager, Benutzer),
PDF-Export (Spielplan, Tabelle, Rangliste, Playoffs, Starter- und Teilnehmerliste, öffentliche Links) und ein
Audit-Log.

Teil des [`vereinsheim`](../../README.md)-Monorepos: Next.js 16, Prisma 7, NextAuth v4, PostgreSQL 15,
geteilte Pakete `@vereinsheim/config`, `@vereinsheim/lib` und `@vereinsheim/ui`.

## Entwickeln

Die Workstation richtet die Root-[`README.md`](../../README.md) ein (`./scripts/vereinsheim dev-setup`: Dev-Postgres
aus der Root-`docker-compose.dev.yml`, `.env` aus `.env.example`, Schema in die Dev-DB `ringwerk`). Danach von der
Repo-Wurzel:

```bash
pnpm --filter ringwerk dev     # http://localhost:3000
pnpm --filter ringwerk test    # Tests (die DB-Integrationstests brauchen den Dev-Postgres)
pnpm check                     # alle Gates vor dem Commit
pnpm --filter ringwerk exec prisma migrate dev --name <name>   # Migration nach einer Schemaänderung
```

Beim ersten Request legt `src/lib/startup.ts` die Standarddisziplinen und, wenn noch kein Admin existiert, das erste
Admin-Konto aus `SEED_ADMIN_EMAIL` und `SEED_ADMIN_PASSWORD` an.

## Umgebungsvariablen

Vorlage: [`.env.example`](.env.example). In Produktion setzt die Root-`compose.yml` die Werte aus der Root-`.env`
(`RINGWERK_*`).

| Variable                                                                                 | Bedeutung                                                                              |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                           | PostgreSQL-Verbindung (lokal die Dev-DB `ringwerk`)                                    |
| `NEXTAUTH_SECRET`                                                                        | Secret der Sitzungen, mindestens 32 Zeichen (`openssl rand -base64 48`)                |
| `NEXTAUTH_URL`                                                                           | öffentliche URL der App (lokal `http://localhost:3000`)                                |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`                                                | erstes Admin-Konto, nur wenn noch keines existiert                                     |
| `DISPLAY_TIME_ZONE`                                                                      | Anzeige-Zeitzone (IANA), Vorgabe `Europe/Berlin`; die Datenbank speichert UTC          |
| `AUTH_TRUST_PROXY_HEADERS`                                                               | Proxy-Header für die Ratenbegrenzung der Anmeldung vertrauen (nur hinter Caddy `true`) |
| `AUTH_RATE_LIMIT_MAX_BUCKETS`                                                            | höchstens so viele Einträge der Ratenbegrenzung im Speicher (Vorgabe 10000)            |
| `PRISMA_AUTO_RESOLVE_FAILED_MIGRATIONS`, `PRISMA_AUTO_RESOLVE_UNKNOWN_FAILED_MIGRATIONS` | Wiederherstellung fehlgeschlagener Migrationen im Migrator (`scripts/`)                |

## Projektstruktur

```
src/
├── app/
│   ├── (public)/          # Anmeldung
│   ├── (app)/             # geschützte Seiten: Wettbewerbe, Teilnehmer, Disziplinen, Admin, Konto
│   └── api/               # NextAuth, PDF-Export, öffentliche PDF-Links
├── proxy.ts               # Routenschutz
├── components/
│   ├── ui/                # app-eigene shadcn-Komponenten (die geteilten liegen in @vereinsheim/ui)
│   └── app/               # Komponenten je Fachgebiet
└── lib/                   # Fachmodule (Actions, Queries, Typen, Berechnung): competitions,
                           # competitionParticipants, eventTeams, series, scoring, matchups, results,
                           # standings, playoffs, participants, disciplines, users, admin, auditLog, pdf;
                           # dazu auth, db, startup
prisma/
├── schema.prisma          # Datenbankschema
└── migrations/            # Migrationen (eingecheckt)
scripts/                   # Migrator mit Wiederherstellung (Produktions-Image)
```

## Weiterlesen

- Fachdoku: [`vault/apps/ringwerk/`](../../vault/apps/ringwerk/) — Einstieg
  [`ringwerk.md`](../../vault/apps/ringwerk/ringwerk.md), Funktionen in
  [`ringwerk-features.md`](../../vault/apps/ringwerk/ringwerk-features.md)
- Betrieb, Deploy, Backup: [`vault/operations/operations.md`](../../vault/operations/operations.md)
- Arbeitsregeln für Agenten: [`CLAUDE.md`](CLAUDE.md)

## Lizenz

Dieses Projekt steht unter der [Apache License 2.0](LICENSE).

Copyright 2026 Christian Eiden
