# Stack Ende zu Ende (lokal)

Prüft den ganzen Produktions-Stack auf dem eigenen Rechner, bevor etwas auf den VPS geht (P3, Plan
`plans/2026-10-14-spiegel-stack.md`): die echten Images aus dem Monorepo, `compose.yml` mit `compose.e2e.yml`, eine
Wegwerf-Umgebung mit Zufallswerten.

```bash
tools/stack-e2e/run.sh
```

Das Skript baut die sechs Images als `vereinsheim-e2e/*`, startet das Compose-Projekt `vereinsheim-e2e` und prüft:

- Ringwerk (`:18080`), Treffsicher (`:18081`) und Spiegel (`:18082`) antworten über Caddy;
- die drei Migratoren enden mit 0;
- drei Datenbanken mit eigenem Owner, `PUBLIC` ohne Rechte;
- Grenzen hinter Caddy (`pnpm --filter spiegel stack-probe`): 413 der App ab 4 MiB, 413 von Caddy ab 5 MiB, keine
  gefälschte Adresse in der Ratenbegrenzung;
- Speicher je Container seit dem Start, kein Abbruch wegen Speicher.

Danach entfernt es Stack, Volumes und Umgebung.

| Option | Wirkung |
| --- | --- |
| `--keep` | Stack und Umgebung bleiben stehen (Pfad steht am Ende); entfernen mit `--down` |
| `--no-build` | vorhandene `vereinsheim-e2e/*`-Images nehmen |
| `--bridge` | die echte Brücke gegen Spiegel (`bridge-e2e`, braucht Go) |
| `--load <min>` | Last auf Spiegel (`ingest-load`) und Speicher unter Last |
| `--down` | einen mit `--keep` stehen gelassenen Stack entfernen |

Was es nicht anfasst: `.env`, `.env.local`, die Volumes und Images des lokalen Stacks (`vereinsheim local-up`) und die
Images unter dem eigenen Docker-Hub-Namen. Belegte Ports: 18080 bis 18082, 15432.

`db-ensure` prüft man mit `--keep` von Hand: `ENV_FILE=<Umgebung> COMPOSE_PROJECT_NAME=vereinsheim-e2e
COMPOSE_FILE=compose.yml:tools/stack-e2e/compose.e2e.yml ./scripts/db-ensure.sh`.
