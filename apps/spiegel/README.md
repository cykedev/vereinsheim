# Spiegel

Spiegel zeigt Schützen ihre Scheiben aus der Meyton-Anlage des Vereins: jeden Schuss mit Lage, Ring, Zehntel, Teiler
und Zeit. Daraus werden Schussbild, Serien, Kennzahlen, der Verlauf über Wochen und Vergleiche zwischen Scheiben. Die
Daten kommen über die [Brücke](../spiegel-bridge) im Schützenhaus. Zugeordnet wird eine Scheibe über die
Sportpassnummer, wenn der Schütze in Spiegel zugestimmt hat.

Fachdoku im Vault: Einstieg [`vault/spiegel/spiegel.md`](../../vault/spiegel/spiegel.md), Entscheidungen
[ADR-026](../../vault/decisions/adr-026.md) bis [ADR-031](../../vault/decisions/adr-031.md).

## Was die App kann

- **Start:** der letzte Trainingsabend mit Ergebnis und Einordnung, offene Scheiben zum Bestätigen.
- **Scheiben:** Liste nach Abend, Filter nach Art (Training, Wettkampf), Meyton-Liste und Merkmal.
- **Seite einer Scheibe:** Scheibe mit allen Schüssen, Serien, Schusstabelle, Wertung und eine Analyse in sechs
  Reitern (Lage, Streuung, Zeit, Verlauf und mehr), jede Kennzahl mit Hilfe in einfacher Sprache.
- **Fortschritt:** ein Zeitraum mit Verlauf, Umfang, Trainingskalender, Vergleich und Rekorden.
- **Profil:** Sportpassnummer, Zustimmung zur Zuordnung, Darstellung.
- **Admin:** Konten, Anlage und Brücke (verbinden, trennen, Zustand), Zuordnung der Meyton-Listen, offene
  Entscheidungen. Jede Aktion mit Folgen fragt vorher und sagt, was passiert.
- **Ingest-API v1** für die Brücke: Kopplung, Geräte-Token, Zustand, Stapel von Snapshots, Heartbeat
  (`/api/ingest/v1/*`, Vertrag in [`packages/ingest-contract`](../../packages/ingest-contract)).

Die Rechnungen stecken in den Paketen [`shot-core`](../../packages/shot-core) (Wertung wie Meyton, Kennzahlen,
Projektion je Scheibe) und [`shot-ui`](../../packages/shot-ui) (Bausteine der Oberfläche, Design 2).

## Entwickeln

Einrichtung des Monorepos siehe [Root-README](../../README.md) (`./scripts/vereinsheim dev-setup`). Danach:

```bash
pnpm --filter spiegel dev          # http://localhost:3002, Dev-DB "spiegel"
pnpm --filter spiegel test         # Vitest, braucht die Dev-Datenbank
pnpm --filter spiegel pruefen      # Bedienung im Browser (Headless-Chrome) gegen den Dev-Server
```

| Skript                       | Zweck                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `seed:own`                   | Scheiben in die Dev-DB, dem Admin aus `.env` zugeordnet: eigene aus `tools/private/own-cards.json` (gitignored), sonst erfundene |
| `measure`                    | Ladezeiten von Liste, Fortschritt und Scheibe gegen die Dev-DB messen                                                            |
| `bridge-e2e`                 | Brücke Ende zu Ende gegen einen lokalen Build (vorher `pnpm --filter spiegel build`)                                             |
| `ingest-load`, `stack-probe` | Last und Grenzen hinter Caddy, aufgerufen von `tools/stack-e2e/run.sh`                                                           |

Schemaänderungen: `apps/spiegel/prisma/schema.prisma`, Migration über den Skill `/migrate`.

## Konfiguration

`apps/spiegel/.env.example` nach `.env` kopieren (macht `dev-setup`):

| Variable                                  | Bedeutung                                                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`                            | Postgres-Verbindung, lokal `postgresql://spiegel:spiegel@localhost:5432/spiegel` |
| `NEXTAUTH_SECRET`, `NEXTAUTH_URL`         | Sitzungen; in Produktion geheim, mindestens 32 Zeichen                           |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | erstes Admin-Konto, angelegt beim Start, solange es keinen Admin gibt            |
| `DISPLAY_TIME_ZONE`                       | Anzeigezeitzone, Vorgabe `Europe/Berlin`                                         |
| `AUTH_TRUST_PROXY_HEADERS`                | `true` hinter Caddy, lokal `false`                                               |
| `AUTH_RATE_LIMIT_MAX_BUCKETS`             | Größe des Speichers der Anmeldesperren                                           |

In Produktion setzt `compose.yml` diese Werte aus der Root-`.env` (`SPIEGEL_*`).

## Betrieb

Spiegel läuft im selben Stack wie Ringwerk und Treffsicher (eigene Datenbank, eigener Migrator, Caddy mit
`SPIEGEL_HOST`). Bauen, Deploy, Backup und Restore: [`vault/operations/operations.md`](../../vault/operations/operations.md).
Die Brücke im Schützenhaus einrichten: [`apps/spiegel-bridge/README.md`](../spiegel-bridge/README.md).
