# Treffsicher

Trainings-App für Schiesssportler: Trainingstagebuch, Ergebniserfassung, Mentaltraining und Statistiken in einer
Web-App, für Einzelne bis zum Verein, ausschliesslich im Dark Mode.

- **Einheiten** — Training, Wettkampf, Trockentraining und Mentaltraining, mit Favoriten
- **Ergebniserfassung** — Serien mit ganzen Ringen oder Zehnteln, optional Einzelschüsse; Import von Meyton-PDFs per
  Upload oder URL
- **Mentaltraining** — Befinden, Prognose, Feedback und Reflexion
- **Saisonziele und Schussablauf** — Ergebnis- und Prozessziele, ein Schussablauf je Disziplin
- **Statistiken** — Verlauf, Serien, Befinden im Vergleich, Schussverteilung
- **Anhänge und Export** — Bilder und PDFs zu Training und Wettkampf, PDF-Export je Einheit
- **Nutzerverwaltung** — Konten legt der Admin an; jeder sieht nur seine eigenen Daten

Teil des [`vereinsheim`](../../README.md)-Monorepos: Next.js 16, Prisma 7, NextAuth v4, PostgreSQL 15,
geteilte Pakete `@vereinsheim/config`, `@vereinsheim/lib` und `@vereinsheim/ui`.

## Entwickeln

Die Workstation richtet die Root-[`README.md`](../../README.md) ein (`./scripts/vereinsheim dev-setup`: Dev-Postgres
aus der Root-`docker-compose.dev.yml`, `.env` aus `.env.example`, Schema in die Dev-DB `treffsicher`). Danach von der
Repo-Wurzel:

```bash
pnpm --filter treffsicher dev     # http://localhost:3001
pnpm --filter treffsicher test    # Tests
pnpm check                        # alle Gates vor dem Commit
pnpm --filter treffsicher exec prisma migrate dev --name <name>   # Migration nach einer Schemaänderung
```

Beim ersten Request legt `src/lib/startup.ts` die Standarddisziplinen und, wenn noch kein Admin existiert, das erste
Admin-Konto aus `ADMIN_EMAIL` und `ADMIN_PASSWORD` an. Die Standarddisziplinen legt auch
`pnpm --filter treffsicher exec prisma db seed` an.

## Umgebungsvariablen

Vorlage: [`.env.example`](.env.example). In Produktion setzt die Root-`compose.yml` die Werte aus der Root-`.env`
(`TREFFSICHER_*`).

| Variable                                                                                 | Bedeutung                                                                                     |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                                           | PostgreSQL-Verbindung (lokal die Dev-DB `treffsicher`)                                        |
| `NEXTAUTH_SECRET`                                                                        | Secret der Sitzungen, mindestens 32 Zeichen (`openssl rand -base64 48`)                       |
| `NEXTAUTH_URL`                                                                           | öffentliche URL der App (lokal `http://localhost:3001`)                                       |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`                                                          | erstes Admin-Konto, nur wenn noch keines existiert                                            |
| `UPLOAD_DIR`                                                                             | Verzeichnis der Anhänge, Vorgabe `/app/uploads` (lokal `./uploads`, in Produktion ein Volume) |
| `DISPLAY_TIME_ZONE`                                                                      | Anzeige-Zeitzone (IANA), Vorgabe `Europe/Berlin`; die Datenbank speichert UTC                 |
| `AUTH_TRUST_PROXY_HEADERS`                                                               | Proxy-Header für die Ratenbegrenzung der Anmeldung vertrauen (nur hinter Caddy `true`)        |
| `AUTH_RATE_LIMIT_MAX_BUCKETS`                                                            | höchstens so viele Einträge der Ratenbegrenzung im Speicher (Vorgabe 10000)                   |
| `PRISMA_AUTO_RESOLVE_FAILED_MIGRATIONS`, `PRISMA_AUTO_RESOLVE_UNKNOWN_FAILED_MIGRATIONS` | Wiederherstellung fehlgeschlagener Migrationen im Migrator (`scripts/`)                       |

## Meyton-PDF-Import (Sicherheit)

Der Import per URL ist bewusst eingeschränkt:

- nur `http://` und `https://`, keine Weiterleitungen (`3xx` bricht ab)
- keine lokalen oder privaten Ziele (z.B. `localhost`, `127.0.0.1`, `10.x.x.x`, `192.168.x.x`, `fc00::/7`); bei
  Hostnamen wird auch die DNS-Auflösung geprüft
- die Antwort muss ein PDF sein (`Content-Type`, `%PDF-`-Kopf und `%%EOF`-Marker)

## Projektstruktur

```
src/
├── app/
│   ├── (auth)/            # Anmeldung
│   ├── (app)/             # geschützte Seiten: Dashboard, Einheiten, Ziele, Schussabläufe, Statistiken,
│   │                      # Disziplinen, Admin, Konto
│   └── api/               # NextAuth, Auslieferung der Anhänge
├── proxy.ts               # Routenschutz
├── components/
│   ├── ui/                # app-eigene shadcn-Komponenten (die geteilten liegen in @vereinsheim/ui)
│   └── app/               # Komponenten je Fachgebiet
└── lib/                   # Fachmodule (Actions, Queries, Typen, Berechnung): sessions, disciplines, goals,
                           # shot-routines, stats, dashboard, uploads, exports, account, admin;
                           # dazu auth, db, startup
prisma/
├── schema.prisma          # Datenbankschema
├── migrations/            # Migrationen (eingecheckt)
└── seed.ts                # Standarddisziplinen
scripts/                   # Migrator mit Wiederherstellung (Produktions-Image)
```

## Weiterlesen

- Fachdoku: [`vault/apps/treffsicher/`](../../vault/apps/treffsicher/) — Einstieg
  [`treffsicher.md`](../../vault/apps/treffsicher/treffsicher.md), Anforderungen in
  [`treffsicher-requirements.md`](../../vault/apps/treffsicher/treffsicher-requirements.md)
- Betrieb, Deploy, Backup: [`vault/operations/operations.md`](../../vault/operations/operations.md)
- Arbeitsregeln für Agenten: [`CLAUDE.md`](CLAUDE.md)

## Lizenz

Veröffentlicht unter der [Apache License 2.0](LICENSE).
