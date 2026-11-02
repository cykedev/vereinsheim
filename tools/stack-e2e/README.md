# Stack Ende zu Ende (lokal)

Prüft den ganzen Produktions-Stack auf dem eigenen Rechner, bevor etwas auf den VPS geht: die echten Images aus
dem Monorepo, `compose.yml` mit `compose.e2e.yml`, eine Wegwerf-Umgebung mit Zufallswerten.

```bash
tools/stack-e2e/run.sh
```

Das Skript baut die vier Images von Ringwerk und Spiegel als `vereinsheim-e2e/*`, startet das Compose-Projekt
`vereinsheim-e2e` und prüft:

- Ringwerk (`:18080`) und Spiegel (`:18082`) antworten über Caddy;
- die Hinweisseite von Treffsicher (`:18081`, ADR-033 Stufe 4): `/` und `/sessions/abc` antworten mit 200, mit
  Titel und Link auf den Host von Spiegel, ohne Platzhalter `{{`;
- die zwei Migratoren enden mit 0, kein Container von Treffsicher;
- drei Datenbanken mit eigenem Owner, `PUBLIC` ohne Rechte (die von Treffsicher bleibt bis zum Löschtermin);
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
| `--ops` | der Betrieb (`ops.sh`): `db-ensure` und `env-check` über das CLI, die Datenbank von Treffsicher mit einem Stand wie nach dem letzten Migrator (ohne App), Deploy von Ringwerk und Spiegel nacheinander mit Pre-Deploy-Backup und vier Tags in der Historie, Vorprüfung ohne Rolle, Backup ohne Datenbank `spiegel`, Backup mit drei Datenbanken, Restore-Probe (auch mit abgeschnittenem Dump), Restore von Spiegel (ein abgeschnittener Dump lässt die Datenbank unverändert; auf ein neueres Schema mit Fremdschlüssel auf eine Tabelle des Dumps steht danach genau der Stand des Dumps), Restore von Treffsicher samt Anhängen ohne Container, Rollback auf einen alten Eintrag ohne Spiegel-Tags |
| `--down` | einen mit `--keep` stehen gelassenen Stack entfernen |
| `--clean` | wie `--down`, dazu die `vereinsheim-e2e/*`-Images löschen (sie sammeln sich je Commit an) |

Was es nicht anfasst: `.env`, `.env.local`, die Volumes und Images des lokalen Stacks (`vereinsheim local-up`) und die
Images unter dem eigenen Docker-Hub-Namen. Belegte Ports: 18080 bis 18082, 15432.

`db-ensure` prüft man mit `--keep` von Hand: `ENV_FILE=<Umgebung> COMPOSE_PROJECT_NAME=vereinsheim-e2e
COMPOSE_FILE=compose.yml:tools/stack-e2e/compose.e2e.yml ./scripts/db-ensure.sh`.
