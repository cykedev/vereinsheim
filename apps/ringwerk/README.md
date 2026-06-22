# Ringwerk

Vereinsinterne Wettbewerbs-Plattform für Schützenvereine. Ligaverwaltung, Spielplanerstellung, Ergebniserfassung, Tabellenberechnung, Playoffs und Audit-Log in einer Web-App.

---

## Lokale Entwicklung

### Voraussetzungen

- [Docker](https://www.docker.com/) + Docker Compose v2.22+
- Optional: Node.js 24+ (nur wenn `npm`/Prisma-Befehle lokal statt im Container laufen sollen)

### Erste Inbetriebnahme

**1. App mit Watch starten**

```bash
docker compose -f docker-compose.dev.yml up --watch
```

Beim Start läuft zuerst der dedizierte Service `migrate` (`prisma migrate deploy` mit optionaler Recovery).
Danach startet der App-Container über `scripts/start-dev-with-migrations.sh` (`prisma db push`, `prisma generate`, dann Next.js dev server).

Die App läuft unter [http://localhost:3000](http://localhost:3000).

**2. Erster Login**

Beim ersten Request wird die Startup-Initialisierung ausgeführt (`src/lib/startup.ts`):

- Admin-Account wird angelegt, falls noch keiner existiert
- Standarddisziplinen werden angelegt, falls sie fehlen

Die Credentials kommen aus `docker-compose.dev.yml`:

| Variable              | Wert in dev         |
| --------------------- | ------------------- |
| `SEED_ADMIN_EMAIL`    | `admin@example.com` |
| `SEED_ADMIN_PASSWORD` | `admin-passwort-12` |

Mit diesen Daten unter [http://localhost:3000/login](http://localhost:3000/login) einloggen.

### Stoppen

```bash
docker compose -f docker-compose.dev.yml down
```

Daten (Datenbank, Uploads) bleiben in den Docker Volumes erhalten.

Vollständiger Reset inkl. Datenverlust:

```bash
docker compose -f docker-compose.dev.yml down -v
# Danach: App-Start erneut ausführen (Schritt 1)
```

Nach `down -v` sind alle Daten zurückgesetzt. Falls im Browser noch eine alte Session liegt, einmal neu einloggen (ggf. Cookies löschen).

### Ab dem zweiten Start

```bash
docker compose -f docker-compose.dev.yml up --watch
```

Keine weiteren Initialisierungsschritte nötig (ausser nach `down -v`).

### Docker Compose Watch

Der Dev-Workflow nutzt [Compose Watch](https://docs.docker.com/compose/how-tos/file-watch/) für automatische Reaktion auf Dateiänderungen:

| Datei / Pfad           | Aktion         | Effekt                                                                 |
| ---------------------- | -------------- | ---------------------------------------------------------------------- |
| `src/**`               | Bind-Mount HMR | Next.js Hot-Reload (kein Compose-Watch-Eintrag nötig)                  |
| `prisma/schema.prisma` | `restart`      | App-Container startet neu, `prisma db push` + `prisma generate` laufen |
| `prisma/migrations/**` | `restart`      | `migrate`-Container läuft erneut und wendet Migrationen an             |
| `next.config.ts`       | `restart`      | App-Container startet neu                                              |
| `package.json`         | `rebuild`      | Image neu gebaut (npm ci), Container neu gestartet                     |
| `package-lock.json`    | `rebuild`      | Wie `package.json`                                                     |

---

## Schemaänderungen

In der laufenden Entwicklung sind keine manuellen Schritte nötig:
Änderungen an `prisma/schema.prisma` triggern automatisch einen Container-Restart mit `db push` + `prisma generate`.

Wenn eine Schemaänderung ins Repository soll, Migration erzeugen und committen:

```bash
docker compose -f docker-compose.dev.yml run --rm app npx prisma migrate dev --name beschreibender-name
```

Oder via Claude Code Slash Command:

```
/migrate beschreibender-name
```

---

## Qualitätschecks

Vor jedem Commit müssen alle vier Gates fehlerfrei durchlaufen.
Container-basiert (ohne lokales `npm ci`):

```bash
docker compose -f docker-compose.dev.yml run --rm app npm run lint
docker compose -f docker-compose.dev.yml run --rm app npm run format:check
docker compose -f docker-compose.dev.yml run --rm app npm run test
docker compose -f docker-compose.dev.yml run --rm app npx tsc --noEmit
```

Oder via Slash Command `/check` (führt alle vier in Folge aus).

Formatierung automatisch korrigieren:

```bash
docker compose -f docker-compose.dev.yml run --rm app npm run format
```

---

## Konfiguration (Umgebungsvariablen)

Alle Konfiguration erfolgt über Umgebungsvariablen. Die Vorlage liegt in `.env.example`.

| Variable                                        | Beschreibung                                                                          | Beispiel                              |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------- |
| `DATABASE_URL`                                  | PostgreSQL Connection String                                                          | `postgresql://liga:liga@db:5432/liga` |
| `NEXTAUTH_SECRET`                               | Zufälliger Secret für Session-Verschlüsselung (min. 32 Zeichen)                       | `openssl rand -base64 32`             |
| `NEXTAUTH_URL`                                  | Öffentliche URL der App                                                               | `https://liga.example.com`            |
| `SEED_ADMIN_EMAIL`                              | E-Mail des ersten Admin-Accounts (wird beim ersten Start angelegt)                    | `admin@example.com`                   |
| `SEED_ADMIN_PASSWORD`                           | Passwort des ersten Admin-Accounts (min. 12 Zeichen)                                  | sicheres Passwort                     |
| `UPLOAD_DIR`                                    | Pfad zum Upload-Verzeichnis im Container (Meyton PDFs)                                | `/app/uploads`                        |
| `DISPLAY_TIME_ZONE`                             | Anzeige-Zeitzone (IANA). DB speichert immer UTC. Default: `Europe/Berlin`             | `Europe/Berlin`                       |
| `AUTH_TRUST_PROXY_HEADERS`                      | Proxy-Header für Rate-Limiting vertrauen (nur hinter Reverse Proxy auf `true` setzen) | `false`                               |
| `AUTH_RATE_LIMIT_MAX_BUCKETS`                   | Maximale Rate-Limit-Einträge im Speicher                                              | `10000`                               |
| `PRISMA_AUTO_RESOLVE_FAILED_MIGRATIONS`         | Aktiviert automatische Recovery für fehlgeschlagene Migrationen                       | `true`                                |
| `PRISMA_AUTO_RESOLVE_UNKNOWN_FAILED_MIGRATIONS` | Fallback für unbekannte fehlgeschlagene Migrationen (`--rolled-back`)                 | `false`                               |
| `POSTGRES_USER`                                 | PostgreSQL-Benutzer (für `docker-compose.prod.yml`)                                   | `liga`                                |
| `POSTGRES_PASSWORD`                             | PostgreSQL-Passwort (für `docker-compose.prod.yml`)                                   | sicheres Passwort                     |
| `POSTGRES_DB`                                   | PostgreSQL-Datenbankname (für `docker-compose.prod.yml`)                              | `liga`                                |

**Entwicklung**: Werte sind direkt in `docker-compose.dev.yml` gesetzt — keine `.env`-Datei nötig.

**Lokale Prisma-CLI** (optional, z.B. für Prisma Studio):

```bash
npm ci
export DATABASE_URL=postgresql://liga:liga@localhost:5433/liga
npx prisma studio
```

Hinweis: Die DB ist in Dev auf Port `5433` gemappt (statt `5432`, um Konflikte mit parallelen Projekten zu vermeiden).

**Produktion**: `.env`-Datei anlegen und alle Werte ausfüllen:

```bash
cp .env.example .env
# .env editieren und echte Werte eintragen
```

---

## Produktions-Deployment (TrueNAS SCALE)

Die App läuft self-hosted via Docker Compose auf TrueNAS SCALE.

```bash
docker compose -f docker-compose.prod.yml up -d
```

Erfordert eine ausgefüllte `.env`-Datei.

Start-Reihenfolge der Services:

1. `db` — PostgreSQL 15, persistiert in Volume `postgres_data`
2. `migrate` — führt `prisma migrate deploy` aus (one-shot), mit optionaler Recovery
3. `app` — Next.js Produktions-Image, startet nach erfolgreichem `migrate`

Der erste Admin-Account wird beim ersten Request aus `SEED_ADMIN_EMAIL` + `SEED_ADMIN_PASSWORD` angelegt.

**Backup:** TrueNAS-Volume-Snapshots (`postgres_data` + `uploads_data`).

---

## Projektstruktur

```
src/
├── app/
│   ├── (public)/          # Öffentliche Seiten (Login)
│   ├── (app)/             # Geschützte Seiten (Auth-Guard im Layout)
│   └── api/               # NextAuth Route Handler + PDF-Export-Routen
├── proxy.ts               # Edge-Auth (Next.js 16 Middleware-Konvention)
├── components/
│   ├── ui/                # shadcn/ui Basiskomponenten (auto-generiert)
│   └── app/               # App-spezifische Komponenten
│       ├── leagues/       # Liga-Formular + Aktionen
│       ├── leagueParticipants/ # Einschreiben + Rückzug
│       ├── matchups/      # Spielplan-Generierung + Anzeige
│       ├── results/       # Ergebniserfassung (Dialog)
│       ├── standings/     # Tabellenanzeige
│       ├── playoffs/      # Playoff-Bracket + Duell-Karten
│       ├── auditLog/      # Protokoll-Liste (Liga + global)
│       ├── participants/  # Teilnehmerverwaltung
│       ├── disciplines/   # Disziplinverwaltung
│       ├── account/       # Passwort-Änderung
│       ├── users/         # Nutzerverwaltung
│       ├── shared/        # Wiederverwendbare App-Komponenten
│       └── shell/         # Navigation, Providers
└── lib/
    ├── db.ts              # Prisma Client Singleton
    ├── auth.ts            # NextAuth Konfiguration
    ├── auth-helpers.ts    # getAuthSession()
    ├── startup.ts         # Erstinitialisierung (Admin + Disziplinen)
    ├── types.ts           # Shared Types (ActionResult)
    ├── dateTime.ts        # UTC/Timezone-Helfer (getDisplayTimeZone, formatDateOnly)
    ├── auth-rate-limit/   # Login-Brute-Force-Schutz
    ├── leagues/           # Liga-Feature (actions, queries, types)
    ├── leagueParticipants/# Einschreiben + Rückzug
    ├── matchups/          # Spielplan-Generierung (Round-Robin, Circle-Method)
    ├── results/           # Ergebniserfassung (Ringteiler-Berechnung, Outcome)
    ├── standings/         # Tabellenberechnung (Punkte, direkter Vergleich, RT)
    ├── playoffs/          # Playoff-Phase (Bracket, Best-of-Five, Finale)
    ├── participants/      # Teilnehmerverwaltung
    ├── disciplines/       # Disziplinverwaltung
    ├── users/             # Nutzerverwaltung (Admin)
    ├── auditLog/          # Protokoll-Abfragen + Ereignistypen
    └── pdf/               # PDF-Export (Spielplan, Playoff-Bracket; react-pdf)
prisma/
├── schema.prisma          # Datenbankschema (alle Modelle)
└── migrations/            # Migrationsdateien (eingecheckt)
.claude/docs/              # Anforderungen und technische Dokumentation
scripts/                   # Docker-Startup- und Migrations-Scripts
```

---

## Tech Stack

| Bereich   | Technologie                 |
| --------- | --------------------------- |
| Framework | Next.js 16 (App Router)     |
| Datenbank | PostgreSQL 15 + Prisma 7    |
| Auth      | NextAuth.js v4              |
| UI        | shadcn/ui + Tailwind CSS 4  |
| Charts    | Recharts                    |
| Tests     | Vitest                      |
| Container | Docker + Docker Compose     |
| Hosting   | TrueNAS SCALE (self-hosted) |

---

## Lizenz

Dieses Projekt steht unter der [Apache License 2.0](LICENSE).

Copyright 2026 Christian Eiden
