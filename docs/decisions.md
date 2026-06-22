# Architektur-Entscheidungen — vereinsheim

Architecture Decision Records (ADRs). Format pro Entscheidung:

- **Status** — Accepted / Superseded / Proposed
- **Kontext** — Warum kam die Frage auf?
- **Entscheidung** — Was wurde gewählt?
- **Alternativen** — Was wurde verworfen, und warum?
- **Folgen** — Was ergibt sich daraus (gut + schlecht)?

Diese Datei ist die kanonische Quelle für „Warum ist das so?". Wenn etwas
geändert wird, **alten ADR auf `Superseded` setzen** und neuen ADR
darunter anlegen — keine schweigende Revision.

---

## ADR-001 — Eigenes Repo `vereinsheim` für Deployment

**Status**: Superseded (durch ADR-015, Juni 2026)

**Kontext**: Das gemeinsame Deployment für Ringwerk + Treffsicher
braucht Compose-Dateien, Secrets-Templates, Skripte. Wo lebt das?

**Entscheidung**: Eigenes Git-Repo `vereinsheim` (frei nach „Vereinsheim
der SG Taufkirchen"), das beide App-Repos referenziert, aber nicht in sie
integriert ist.

**Alternativen**:
- *In Ringwerk integrieren*: vermischt App-Code und Deployment-Konfig,
  und Treffsicher müsste auf Ringwerks Repo-Struktur verweisen. Verworfen.
- *Ungit, nur lokal auf VPS*: kein Replay, kein Code-Review, keine
  Reproduzierbarkeit. Verworfen.

**Folgen**:
- Klare Trennung „App-Code" vs „Deployment".
- Beide App-Repos bleiben bei ihrem eigenen `docker-compose.dev.yml`
  (Dev-Workflow unverändert).
- Treffsichers vorhandenes `docker-compose.prod.yml` bleibt als
  Standalone-Variante erhalten, wird aber im `vereinsheim`-Setup
  **nicht** verwendet.

---

## ADR-002 — 1 Postgres-Container, 2 Datenbanken, 2 User

**Status**: Accepted

**Kontext**: Beide Apps brauchen Postgres 15. Wie isolieren wir sie?

**Entscheidung**: Ein Postgres-Container, zwei separate Datenbanken
(`ringwerk`, `treffsicher`), zwei separate Datenbank-User mit
Owner-Rechten **ausschließlich auf der eigenen DB**. Bootstrap via
`db-init/01-users-and-dbs.sh`, das beim ersten Container-Start
automatisch ausgeführt wird (`/docker-entrypoint-initdb.d/`).

**Alternativen**:
- *Schemas im selben User-Scope*: gleicher User hätte Zugriff auf beide
  Schemas → keine technische Isolation. Verworfen.
- *Zwei Postgres-Container*: ~250 MB RAM-Verschwendung für ein Setup
  ohne Performance-Bedarf, doppelter Backup-Aufwand, doppelte Wartung.
  Verworfen.

**Folgen**:
- Cross-DB-Zugriffe sind technisch unmöglich (verifizierbar via
  `docker compose exec db psql -U treffsicher -d ringwerk` → permission denied).
- Backup/Restore brauchen den postgres-Superuser via local socket
  (`docker compose exec`), App-Container nutzen ihren limitierten User
  via TCP.
- `db-init/01-users-and-dbs.sh` läuft nur beim **ersten** Start.
  Passwort-Wechsel müssen manuell mit `ALTER USER` gefahren werden.

---

## ADR-003 — Network-Split: `web` und `data`

**Status**: Accepted

**Kontext**: Caddy ist im Internet erreichbar. Was darf es alles?

**Entscheidung**: Zwei Docker-Networks.

| Network | Members                                          |
| ------- | ------------------------------------------------ |
| `web`   | `caddy`, `app-ringwerk`, `app-treffsicher`       |
| `data`  | `db`, `app-*`, `migrate-*`                       |

`db` ist **nicht** in `web`. Caddy kann die DB nicht direkt erreichen,
selbst bei einer Caddy-Compromise.

**Alternativen**: Single Network. Verworfen — verkleinerter Blast-Radius
ist hier kostenlos zu haben.

**Folgen**:
- Backups laufen über den `db`-Container selbst (nicht über externes
  `psql`), weil `caddy` und Host-Netz `db` nicht erreichen.
- Tools, die DB-Zugriff brauchen (`vereinsheim psql`), nutzen
  `docker compose exec db psql …` statt TCP.

---

## ADR-004 — Caddy 2 als Reverse Proxy

**Status**: Accepted

**Kontext**: Reverse Proxy mit automatischen Let's-Encrypt-Zertifikaten
nötig für zwei Subdomains.

**Entscheidung**: Caddy 2-alpine, Konfiguration via Caddyfile (kein
Web-UI). ACME ist in Caddy eingebaut, HTTP→HTTPS-Redirect ist Default,
`X-Forwarded-*`-Header werden automatisch gesetzt.

**Alternativen**:
- *Traefik v3*: mächtiger, aber Konfigurations-Overhead und ~100 MB RAM
  (Caddy: ~50 MB). Für zwei statische Hosts overkill.
- *Nginx Proxy Manager*: Web-UI bedeutet zusätzliche DB + Login-Schicht
  als Angriffsfläche, und der User hat „explizit keine GUI" verlangt.
- *Nginx + Certbot*: zwei moving parts statt einem.

**Folgen**:
- ~10 Zeilen Config für beide Hosts.
- Zertifikate persistent in Volume `caddy_data` — bei VPS-Neuaufbau
  Volume kopieren, sonst neue ACME-Anforderung (Rate-Limit-relevant).
- HTTP/3 (UDP 443) ist out-of-the-box aktiv.

---

## ADR-005 — Docker Hub mit public Images

**Status**: Accepted

**Kontext**: Wo werden die App-Images gehostet?

**Entscheidung**: Docker Hub, **public** Repositories
(`<DOCKER_USER>/ringwerk` und `…/treffsicher`).

**Alternativen**:
- *GitHub Container Registry (ghcr.io)*: gleicher Komfort, aber kein
  klarer Zusatz-Vorteil hier; Docker Hub ist die universellere Default.
- *Self-hosted Registry (`registry:2`)*: extra moving part, Auth + TLS
  selbst lösen, Bootstrapping-Henne-Ei-Problem.
- *Docker Hub mit privaten Images*: 1 freies privates Repo / Account →
  hier wären 2 nötig → Pro-Plan oder workaround.

**Begründung public**: Source-Code beider Apps ist sowieso public auf
GitHub. In keinem Dockerfile werden Build-Time-Secrets via `--build-arg`
injiziert (alle Secrets kommen zur Runtime aus env vars). Damit gibt es
keinen praktischen Sicherheitsverlust.

**Folgen**:
- Pull vom VPS funktioniert ohne `docker login`.
- Pull-Rate-Limits sind höher für authentifizierte Pulls — auf dem VPS
  einmal `docker login` verbessert das.
- Image-Layers sind öffentlich einsehbar — keine versehentlichen Leaks
  möglich, aber Software-Stack & Versionen sind transparent.

---

## ADR-006 — Lokales Build statt CI

**Status**: Accepted (für MVP); kann später durch CI ersetzt werden

**Kontext**: Wo werden die Images gebaut?

**Entscheidung**: `docker buildx --platform linux/amd64` läuft lokal
auf der Arbeitsmaschine des Maintainers. Push von dort in Docker Hub.

**Alternativen**:
- *Build auf dem VPS*: bräuchte ~1.5 GB RAM zusätzlich → größerer
  VPS-Tarif → mehr Kosten ohne Mehrwert.
- *GitHub Actions → GHCR*: maximale Reproduzierbarkeit, aber Setup-
  Overhead und für ein Vereins-Setup mit 1 Maintainer übertrieben.
  Nachrüstbar, sobald wir mehrere Maintainer oder höhere Frequenz haben.

**Folgen**:
- VPS muss nicht für Builds dimensioniert sein → `VPS S+/M` reicht.
- `vereinsheim build` weigert sich, mit uncommitteten App-Repo-
  Änderungen zu bauen → Image-Tag enthält **immer** eine eindeutige
  Git-SHA.
- Wenn ein zweiter Maintainer dazukommt, ist CI der nächste logische
  Schritt (siehe „Mögliche Folge-ADRs" am Ende).

**Nachtrag (Phase 3, ADR-015)**: Der lokale Build bleibt (Entscheidung
unverändert), kommt aber seit Phase 3 **aus dem Monorepo** via `turbo prune`
statt aus den Standalone-Repos. Uncommitted-Check + `<sha>` beziehen sich jetzt
auf das Monorepo (beide Apps teilen den SHA).

---

## ADR-007 — Separates Migrator-Image pro App (eigener Tag)

**Status**: Accepted

**Kontext**: Beide App-Dockerfiles haben eine `migrator`-Stage und eine
`runner`-Stage. Die `runner`-Stage enthält **bewusst kein** Prisma-CLI
(nur Next.js standalone — das ist eine Source-Repo-Entscheidung der
App-Maintainer, nicht von vereinsheim getroffen). Wir können also nicht
ein Image für beides verwenden.

**Entscheidung**: Pro App **zwei** Image-Tags je Build:

- `<user>/<app>:<sha>` + `:latest` — `target=runner` (für `app-*`-Service)
- `<user>/<app>:<sha>-migrator` + `:latest-migrator` — `target=migrator`
  (für `migrate-*`-Service)

`scripts/build-and-push.sh` baut beide in Folge.

**Alternativen**:
- *Ein Image, beide Stages combined*: hätte einen Patch in den App-Repos
  bedeutet, der den `runner`-Slimming-Effekt zerstört. Verworfen.
- *Migrator nur lokal bauen, nicht pushen*: Migrationen müssten auf dem
  VPS gebaut werden → widerspricht ADR-006. Verworfen.

**Folgen**:
- Build-Zeit verdoppelt sich pro App (gemeinsame Layer werden gecacht).
- Storage: ein Migrator-Image ist deutlich kleiner als der Runner
  (kein .next/standalone), aber inkl. Prisma-CLI + node_modules.
- `compose.yml` referenziert beide via getrennter env vars
  (`RINGWERK_TAG` und `RINGWERK_MIGRATOR_TAG`).
- Falls die App-Repos jemals den Runner so umbauen, dass Prisma-CLI
  enthalten ist, kann diese ADR superseded werden — dann reicht ein Tag.

**Nachtrag (Phase 3, ADR-015)**: Aus den zwei per-App-Dockerfiles wurde **ein
parametrisiertes Root-`Dockerfile`** (`--build-arg APP`, Targets
`runner`/`migrator`), gebaut aus dem `turbo prune`-Kontext. Die
Zwei-Tags-pro-App-Entscheidung ist unverändert; das runner-ohne-Prisma-CLI ist
jetzt vereinsheims eigene Dockerfile-Entscheidung. Der Migrator installiert
prisma+pg+dotenv via npm (flaches node_modules; umgeht das pnpm-10-Build-Gate).

---

## ADR-008 — Konservative Migrations-Recovery-Konfiguration

**Status**: Accepted

**Kontext**: Die App-Repos liefern bereits ein zweistufiges
Recovery-System (`scripts/run-migrations-with-recovery.sh` +
`scripts/resolve-failed-migrations.mjs`) mit zwei Schaltern:

| Variable                                          | Effekt                                              |
| ------------------------------------------------- | --------------------------------------------------- |
| `PRISMA_AUTO_RESOLVE_FAILED_MIGRATIONS`           | Recovery-Skript wird automatisch ausgeführt          |
| `PRISMA_AUTO_RESOLVE_UNKNOWN_FAILED_MIGRATIONS`   | Unbekannte Fehler werden als rolled-back markiert    |

**Entscheidung**: In `compose.yml`:

```yaml
PRISMA_AUTO_RESOLVE_FAILED_MIGRATIONS: "true"          # bekannte Fälle: ja
PRISMA_AUTO_RESOLVE_UNKNOWN_FAILED_MIGRATIONS: "false" # unbekannte: stop
```

Bekannte Fälle (im `KNOWN_RECOVERY_HANDLERS`-Objekt der App-Repos
deklariert) heilen sich selbst beim nächsten `up -d`. Unbekannte
stoppen den Migrate-Container, die App startet nicht, und wir greifen
manuell ein (siehe `operations.md` „Recovery von fehlgeschlagenen
Migrationen").

**Alternativen**:
- *Beide auf `true`*: Migrationen würden bei beliebigen Fehlern als
  rolled-back markiert und immer wieder versucht — Risiko schweigender
  Datenkorruption.
- *Beide auf `false`*: jede neue failed-Migration bräuchte manuellen
  Eingriff, auch wenn der Fall identisch zu früher ist.

**Folgen**:
- Bei einer ungewöhnlichen Migrationsänderung: max. 30 Min Downtime mit
  Mensch-im-Loop, statt eventuell Stunden Datenforensik.
- Pflege: jeder neue Eintrag in `KNOWN_RECOVERY_HANDLERS` muss im
  jeweiligen App-Repo dokumentiert werden (Kommentar im Code) — sonst
  weiß in 6 Monaten niemand mehr, warum dort `--applied` markiert wird.

---

## ADR-009 — `pg_dump`-Cutover, gleiche Mechanik als Backup

**Status**: Accepted

**Kontext**: Bestehende Daten beider Apps müssen einmalig auf den VPS
migriert werden. Außerdem brauchen wir eine laufende Backup-Strategie.

**Entscheidung**: `pg_dump -Fc` (custom format) plus `tar czf` für die
Upload-Volumes. Einmaliger Cutover läuft mit denselben Befehlen wie das
nightly Backup. `scripts/backup.sh` und `scripts/restore.sh` decken
beide Use-Cases.

**Alternativen**:
- *Logical Replication*: ermöglicht Live-Migration ohne Downtime,
  Setup-Aufwand aber erheblich. Für ein Vereins-Setup mit weichen
  Uptime-Anforderungen nicht gerechtfertigt.

**Folgen**:
- Maintenance-Fenster pro App ~30 Min während Cutover.
- Ein Mechanismus für zwei Aufgaben → weniger zu lernen, weniger zu
  warten, gleicher Code-Pfad ist häufiger getestet.
- Backups landen auf demselben VPS → schützt vor Software-Fehlern, nicht
  vor Hardware-Verlust. Off-Site-Backup ist explizit out-of-MVP-scope
  (siehe „Mögliche Folge-ADRs").

---

## ADR-010 — Pre-Deploy-Backup als Default

**Status**: Accepted

**Kontext**: Ein Deploy kann eine destruktive Migration enthalten. Ohne
Backup direkt davor ist ein Rollback im Zweifel auf das nightly Backup
angewiesen → bis zu 24 h Datenverlust.

**Entscheidung**: `scripts/deploy.sh` ruft `scripts/backup.sh` als ersten
Schritt auf, wenn der `db`-Service bereits läuft. Override:
`SKIP_BACKUP=1` für Notfall-Redeploys nach gescheiterter Migration, wo
sich der DB-State zwischen den Versuchen nicht geändert hat.

**Alternativen**:
- *Nur nightly Backup*: bis zu 24 h Datenverlust beim Worst-Case.
- *Pre-Deploy-Snapshot via VM-Provider*: an IONOS gebunden, langsamer,
  Granularität schlechter (whole-VM statt DB-Tabelle).

**Folgen**:
- Jeder Deploy erzeugt einen frischen Restore-Punkt.
- Backup-Ordner wächst schneller → 14-Tage-Rolling-Retention bleibt,
  ältere Pre-Deploy-Backups verschwinden automatisch.
- Beim allerersten Deploy ist `db` noch nicht da → Skript überspringt
  das Backup transparent.

---

## ADR-011 — `vereinsheim`-CLI als einziges Tool, Lokal-/VPS-Mode

**Status**: Accepted

**Kontext**: Über die Zeit gibt es viele kleine Operationen (Build,
Deploy, Backup, Restore, Migration-Recovery, Logs, psql, …). Wenn jede
einzeln dokumentiert wird, vergisst man die selteneren.

**Entscheidung**: Ein einziges Skript `scripts/vereinsheim`, das alle
Operations bündelt. Es erkennt automatisch den Modus:

- **Lokal-Mode** (Trigger: `.vereinsheim.local` existiert auf der
  Arbeitsmaschine) — Subcommands
  `local-setup`, `build`, `release`, `ssh`, `remote`.
- **VPS-Mode** (Default) — Subcommands `setup`, `deploy`, `backup`,
  `restore`, `migrations`, `status`, `cron`, `psql`, `logs`, `shell`,
  `up`/`down`/`restart`, `env-check`.

Ohne Argument: passendes interaktives Menü. Mit Subcommand:
nicht-interaktiv (für SSH, Cron, Skripte).

**Alternativen**:
- *Zwei separate Tools (lokal + VPS)*: doppelte Flag-Konventionen,
  doppelte Hilfe-Texte. Verworfen.
- *Reines Subcommand-CLI ohne Menü*: schlechter für Selten-Anwender, die
  nicht alle Subcommands im Kopf haben. Menü ist add-on.

**Folgen**:
- Eine Doku-Quelle für die ganze CLI (`vereinsheim help`).
- Die per-Task-Skripte (`deploy.sh`, `backup.sh`, `restore.sh`,
  `build-and-push.sh`) bleiben als „Backend" — `vereinsheim` ruft sie
  auf, statt sie zu duplizieren. Das Tool kann ohne Risiko erweitert
  werden, ohne die Backend-Skripte zu berühren.
- `vereinsheim remote <subcmd>` ermöglicht lokale Aufrufe ohne SSH-Login-
  Ceremony (`./scripts/vereinsheim remote status` reicht).

---

## ADR-012 — `.vereinsheim.local` für lokale Konfig, getrennt von `.env`

**Status**: Accepted

**Kontext**: Lokal-Mode braucht Konfiguration (`VPS_HOST`, `VPS_REPO_PATH`,
`DOCKER_USER`). Wo soll die liegen?

**Entscheidung**: Eigene Datei `.vereinsheim.local` (gitignored,
chmod 600), nicht in `.env` mischen.

**Alternativen**:
- *In `.env` mit zusätzlichen Variablen*: `.env` ist semantisch die
  Production-Konfig für Compose. Lokale Konfig würde sie verschmutzen,
  und lokale Klone hätten eine `.env`, die mit dem VPS-Setup nichts zu
  tun hat.
- *In `~/.vereinsheim.rc` (User-global)*: schlecht, wenn es mehrere
  Klone des Repos auf einer Maschine gibt (z.B. main + worktree).

**Folgen**:
- Klare Trennung: `.env` ↔ VPS, `.vereinsheim.local` ↔ lokal.
- `vereinsheim local-setup` legt sie interaktiv an (mit Defaults).
- Mode-Detection ist trivial: Datei vorhanden = Lokal-Mode.

---

## ADR-013 — `bootstrap-vps.sh` ohne automatischen SSH-Lockdown

**Status**: Accepted

**Kontext**: Initial-Setup eines neuen VPS: Docker installieren,
Deploy-User anlegen, Repo klonen. Sollte das Skript auch
gleich `PermitRootLogin no` in `sshd_config` setzen?

**Entscheidung**: **Nein.** Das Skript zeigt am Ende den Befehl zum
Lockdown (`sudo sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/'
/etc/ssh/sshd_config && sudo systemctl reload ssh`), führt ihn aber
nicht aus.

**Alternativen**:
- *Lockdown automatisch*: ein einziger Konfig-Fehler kann den User
  aussperren, bevor er testen konnte, ob deploy@ funktioniert.

**Folgen**:
- Zwei Schritte statt einem für den User — bewusst gewählter
  Zeitkostenkonflikt.
- Skript ist auch dann sicher, wenn der User keinen zweiten SSH-Schlüssel
  oder Console-Access bereitgestellt hat.

---

## ADR-014 — Firewall via IONOS Cloud-Panel, kein UFW im OS

**Status**: Accepted

**Kontext**: Der initial geplante `bootstrap-vps.sh` installierte und
aktivierte `ufw` mit Regeln für 22/80/443. IONOS VPS bringen jedoch eine
**externe Firewall** im Cloud-Panel mit, die ausserhalb des OS läuft
(vor dem Hypervisor). Zwei aktive Firewalls hintereinander bedeuten:
doppelte Pflegestelle, doppelter Fehlerort beim Debugging, und ein
fehlkonfiguriertes UFW kann den User aussperren — während die externe
FW sich nicht in den OS-Stack einbringt.

**Entscheidung**: Firewall **ausschliesslich** im IONOS Cloud-Panel
konfigurieren. UFW wird nicht installiert. Regelwerk identisch zur
früheren UFW-Konfig: nur 22/80/443 inbound erlaubt, alles andere
denied.

**Alternativen**:
- *UFW zusätzlich zur IONOS-FW*: defense-in-depth, aber für ein
  Single-VPS-Vereinssetup unverhältnismässig — der Schutz greift erst
  bei kompromittierter IONOS-Ebene, was ein deutlich grösseres Problem
  ist als ein offener Port.
- *Nur UFW, IONOS-FW deaktiviert*: würde funktionieren, vergibt aber
  den Vorteil eines vor-dem-OS gezogenen Schutzes (DDoS-Mitigation,
  Schutz auch bei abgestürztem OS).

**Folgen**:
- `bootstrap-vps.sh` installiert/konfiguriert kein `ufw` mehr.
- Firewall-Änderungen passieren im IONOS-Panel, nicht via SSH.
- Bei VPS-Wechsel zu einem Provider ohne externe FW: ADR neu bewerten
  und UFW-Block ggf. wieder einführen.

---

## ADR-015 — Monorepo: Apps in `vereinsheim` integrieren (supersedes ADR-001)

**Status**: Accepted (Juni 2026)

**Kontext**: Ringwerk und Treffsicher teilen eine wachsende, bewusst byte-identische UI-/Lib-Schicht.
Bei getrennten Repos driftet sie auseinander (nur durch ein Drift-Gate reaktiv gehalten), Build und
Dev-Workflow sind dupliziert, und jeder Release baut beide Apps komplett neu. Ein Monorepo löst Drift
strukturell und ermöglicht inkrementelle, gecachte Builds.

**Entscheidung**: Beide Apps werden als `apps/treffsicher` und `apps/ringwerk` in `vereinsheim`
integriert; geteilter Code wandert nach `packages/{ui,lib,config}`. Werkzeuge: **pnpm Workspaces +
Turborepo**. Docker-Build pro App via **`turbo prune --docker`**. Git-History beider Apps wird per
einmaligem `git filter-repo`-Import erhalten (**kein** laufender Subtree-Sync). Der Deploy-Vertrag
(Image-Namen/Tags, `compose.yml`, Caddy, `db-init`, Backup/Restore, getrennte DBs/Migrations) bleibt
**unverändert** — die Migration ist rein build-seitig. Umsetzungsplan: `docs/monorepo-plan.md`.

**Alternativen**:

- _Getrennte Repos + Drift-Gate beibehalten (ADR-001)_: hält Konsistenz nur reaktiv, dupliziert
  Build/Dev, keine geteilten Pakete. Verworfen zugunsten der strukturellen Lösung.
- _git subtree als laufender Sync_: vom Nutzer explizit verworfen (Sync-Overhead, kein echtes Monorepo).
- _Nx statt Turborepo_: mächtiger, aber für 2 Apps + wenige Libs Overkill; Turborepo ist einfacher und
  Next-nah.

**Folgen**:

- ADR-001 abgelöst; `vereinsheim` ist jetzt Deploy- **und** Code-Monorepo.
- Drift-Gate (`consistency-check.sh`) wird nach Phase 4 (`packages/ui`) überflüssig.
- Migration npm → pnpm; jede App behält eigenes Prisma-Schema/Migrations/generierten Client.
- ADR-006 (lokaler Build) bleibt vorerst gültig; CI + Turbo-Remote-Cache ist optionale Folge-ADR.
- ADR-002/003/004/007/009/010 (DBs, Netze, Caddy, Migrator-Image, Backup/Restore) bleiben unberührt.

---

## ADR-016 — Knowledge Graph für Claude Code (3 Schichten)

**Status**: Accepted (Juni 2026)

**Kontext**: Im Monorepo (ADR-015) sollen Claude Code und Menschen Struktur, Konventionen und das
„Warum" schnell und korrekt erfassen, ohne alles neu zu durchsuchen. Drei komplementäre Bedürfnisse:
(a) immer-aktuelle Faktenstruktur, (b) scope-spezifischer Kontext/Konventionen, (c) dauerhaftes,
abfragbares Projektgedächtnis über Sessions hinweg.

**Entscheidung**: Drei sich ergänzende Schichten:

1. **Code-Graph via CodeGraph MCP (Ground Truth)**: `@colbymchenry/codegraph` läuft als lokaler
   MCP-Server (SQLite + FTS5) und indexiert Symbole, Call-Graph, Referenzen und Framework-Routen
   inkrementell (File-Watcher hält ihn aktuell). Agenten nutzen `codegraph_explore`/`codegraph_node`:
   Entry-Points + Call-Pfade + verbatim Quelle in EINEM Aufruf statt vieler grep/read. Eintrag im
   eingecheckten `.mcp.json` (Project-Scope, **manuell** — nicht der personal-config-Installer);
   `.codegraph/`-Index ist gitignored (lokal re-buildbar); Telemetrie aus (`CODEGRAPH_TELEMETRY=0`).
   Eine kleine, hand-gepflegte `docs/architecture.md` ergänzt das um die High-Level-Karte
   (apps↔packages). Empirisch auf ringwerk validiert (löst gesplittete Actions, Barrel-Re-Exports und
   Call-Graph sauber auf).
2. **Hierarchische CLAUDE.md (Kontext/Navigation)**: Root-`CLAUDE.md` (universelle Regeln + `@import`
   von `docs/architecture.md`, `docs/shared-conventions.md`, `docs/decisions.md`); je App
   (`apps/*/CLAUDE.md`) und je geteiltem Paket (`packages/*/CLAUDE.md`) scope-spezifische Regeln (Claude
   Code lädt die nächstgelegene on-demand). Projekt-Skills unter `.claude/skills/` (path-scoped) für
   Monorepo-Aufgaben (`check`, `graph`, `db-restore`, `release`).
3. **MCP-Knowledge-Graph (persistentes Gedächtnis)**: offizieller `@modelcontextprotocol/server-memory`
   in `.mcp.json` (Project-Scope, eingecheckt; stdio via `npx`), Store unter
   `.claude/knowledge-graph.json` (`MEMORY_FILE_PATH`). Ein Seed-Skript speist Schicht 1 + ADRs als
   Entities/Relations/Observations ein; danach wächst der Graph mit über Sessions aufgezeichneten
   Entscheidungen/Gotchas.

Schicht 1 (CodeGraph) = „was der Code _ist_" (live, auto-aktuell, on-demand abgefragt). Schicht 3 =
„was wir _entschieden/gelernt_ haben" (aus ADRs/Konventionen geseedet, wächst über Sessions) —
**nicht** Struktur-Autorität. Beide sind orthogonal; Schicht 2 (CLAUDE.md) macht beide auffindbar.

**Alternativen**:

- _Eigenbau-Graph-Generator (pnpm/turbo + AST-Extractor)_: ursprünglich geplant; verworfen, da
  CodeGraph dasselbe reifer, auto-gepflegt und ohne eigenen Wartungscode liefert.
- _Nur CLAUDE.md/Docs_: einfachste Lösung, aber kein maschinenlesbarer Code-Graph und kein
  Cross-Session-Gedächtnis.
- _Nur MCP-Memory_: dauerhaft, aber driftet ohne Code-Faktenbasis.
- _Neo4j / schwerer Graph-DB-MCP_: mächtiger, aber externe Infra; CodeGraphs lokales SQLite reicht.

**Folgen**:

- **Kein** eigener Graph-Generator-Code mehr (Schicht 1 = fertiges Tool). Neuer Eigencode beschränkt
  sich auf das Seed-Skript für Schicht 3 (Memory aus ADRs/Konventionen) + `docs/architecture.md`.
- CodeGraph ist Dev-Werkzeug (global via npm bzw. `codegraph install`), lokal, MIT, **keine**
  Build-Abhängigkeit (meldet sich ohne Index inaktiv; in headless/CI optional).
- **Offen (Phase 2):** pnpm-Monorepo-Cross-Package-Auflösung empirisch bestätigen (innerhalb eines
  Repos fehlerfrei getestet).
- `.mcp.json` und `.claude/knowledge-graph.json` eingecheckt (keine Secrets; Memory-Server braucht
  keine); `.codegraph/` gitignored.
- Bestehende `.claude/commands/check.md` wandern auf das neue Skills-Format
  (`.claude/skills/check/SKILL.md`, `invocation: [user, Claude]`).
- Schichten landen in Phase 1/2 der Migration (siehe `monorepo-plan.md` §10).

---

## ADR-017 — Lessons/Wissens-Capture: stärkste Permanenz zuerst

**Status**: Accepted (Juni 2026)

**Kontext**: Das bestehende `/consolidate-lessons` (ringwerk) promotet Session-Learnings in Docs. Docs
sind aber weich (verlassen sich auf Befolgung). Der `"use server"`-Build-Fehler zeigte: die wirksamste
Form einer Lektion ist ein **erzwungener Check** (Gate/Lint/Test), nicht eine Doku-Zeile.

**Entscheidung**: `/consolidate-lessons` triagiert jede Lektion auf die **höchste erreichbare
Permanenzstufe** (prefer enforcement):

1. **ENFORCE** (stärkste): automatisierter Check — eslint-Regel, `/check`-Gate (inkl. `next build`),
   Anti-Pattern-Grep in `consistency-check.sh`, Unit-Test, oder ein Fix, der den Fehlermodus beseitigt.
   Wird umgesetzt und dem User als **konkrete Aktion** vorgelegt, nie still nur dokumentiert.
2. **DOCUMENT**: generische Regel in eine immer-geladene Doc (CLAUDE.md/Konventionen/ADR).
3. **REMEMBER**: projektspezifischer Kontext → abrufbares Gedächtnis (heute `lessons.md`; im Monorepo
   der Layer-3-Memory-Graph, ADR-016).

**Alternativen**:

- _Nur Docs (Status quo)_: weich; wirksame Lektionen (Build-/Compile-Regeln) bleiben unerzwungen.
- _Alles in den Memory-Graph_: abfrage-abhängig + mutierbar; harte Regeln gehören in erzwungene
  Gates/Docs.

**Folgen**:

- `/consolidate-lessons`-Skill um die ENFORCE-Stufe + das Triage-Prinzip erweitert (ringwerk; dient als
  Monorepo-Vorlage).
- Der Memory-Graph (ADR-016) ist die REMEMBER-Stufe — er ersetzt den `lessons.md`-Buffer, **nicht** die
  Promotion-Disziplin.
- Im Monorepo ein einziges `/consolidate-lessons` für beide Apps.

---

## ADR-018 — Harness Engineering: Hooks, PIV-Workflow, Sub-Agents

**Status**: Accepted (Juni 2026)

**Kontext**: Erkenntnisse aus `coleam00/harness-engineering-demo`. „Harness Engineering" = Kontext +
Workflows um den Agenten so bauen, dass er „wie ein weiterer Entwickler im Team" arbeitet — Prozesse
erzwungen, Standards angewandt. Mehrere Praktiken ergänzen unsere Schichten (ADR-016/017) substanziell.
(Deren Codebase-Search-MCP ist überflüssig — CodeGraph deckt `where_is`/`find_references`/`outline` +
Call-Graph/Routen bereits ab.)

**Entscheidung**: Folgende Praktiken übernehmen, auf unseren Stack zugeschnitten:

1. **Hooks (Enforcement auf Harness-Ebene)**, verdrahtet in eingechecktem `.claude/settings.json`:
   - **Stop-Gate (selbst-validierend)**: blockt das Turn-Ende, bis die Gates grün sind — im Monorepo
     via `turbo check` (gecacht, billig): lint/format/tsc/test/**`next build`**. Damit wird „ENFORCE"
     (ADR-017) zur Harness-Ebene: ein Agent **kann nicht** mit rotem/nicht-baubarem Stand aufhören.
     Adressiert direkt die Lücke dieser Session (vergessenes Gate, Build-only-Fehler). `stop_hook_active`
     gegen Endlosschleifen.
   - **PostToolUse-Lint (non-blocking)**: nach Edits eslint/tsc auf die betroffene App, Befund surfacen.
   - **PreToolUse-Security-Guard**: verweigert Lesen/Schreiben echter `.env`/`.vereinsheim.local` +
     rekursives Löschen; erlaubt `.env.example`/`.template`. Greift auch unter
     `--dangerously-skip-permissions` (unbeaufsichtigte/parallele Läufe); fail-open (deny statt Brick).
2. **PIV-Workflow als Skills**: `/plan → /implement → /validate → /review`, Handoff über `plans/` +
   `reports/`-Markdown; `/review` delegiert an einen committed `code-reviewer`-Sub-Agenten. Das ist die
   konkrete, geteilte Dev-Tooling-Baseline (§12) — vereinheitlicht Superpowers (treffschers
   brainstorm/plan/spec) und gilt für beide Apps.
3. **Committed Sub-Agents** (`.claude/agents/*.md`): wiederverwendbar/spezialisiert (z.B. code-reviewer,
   der Diffs gegen Konventionen prüft und CodeGraph für Impact nutzt) — statt ad-hoc.
4. **On-Demand-Context-Module** (`.claude/context/*.md`, von Skills geladen): token-effizient im großen
   Monorepo (Ergänzung zu Schicht 2).
5. **Autonomous-Loop-Driver (Ralph-artig)** mit **Worktree- + DB-Isolation** für parallele/unbeaufsichtigte
   Läufe (formalisiert das Über-Nacht-Muster; sicher für mehrere parallele Agenten/Devs); Commit-pro-
   Iteration (reversibel), nie auf `main`.

**Alternativen**:

- _Deren Codebase-Search-MCP übernehmen_: nicht nötig — CodeGraph (ADR-016) deckt es ab + mehr.
- _Nur Docs/Gates ohne Hooks_: weich; der Stop-Hook ist der Unterschied zwischen „soll `/check` laufen"
  und „kann nicht rot aufhören".

**Folgen**:

- Der Stop-Gate braucht `turbo check` (gecacht), damit er pro Turn billig ist → landet in Phase 2/3
  (nach pnpm/turbo). Eine leichte Vorstufe (nur lint/tsc, ohne Docker-Vollgate) ist schon vorher möglich.
- `.claude/{settings.json,agents,skills,context}` + `plans/`/`reports/` eingecheckt → team-geteilt (§11).
- Der Stop-Hook ist die Harness-Realisierung von ADR-017 (ENFORCE-first); `next build` bleibt Pflichtgate.
- Quelle: `coleam00/harness-engineering-demo`.

---

## Mögliche Folge-ADRs (out-of-scope, aber vorgesehen)

Wenn eines dieser Themen aktuell wird, neuer ADR (ADR-019+):

- **Off-Site-Backup-Strategie**: rclone → S3-compatible, borg auf NAS,
  IONOS Snapshot. Trade-offs: Kosten, RPO, Restore-Granularität.
- **CI/CD-Migration**: GitHub Actions baut und pusht, optional auch
  deploy-Trigger via SSH oder Webhook. Macht ADR-006 obsolet.
- **Monitoring/Alerting**: Uptime-Kuma, Prometheus + Grafana, oder
  hosted Service. Bisher nur Caddy-Logs + manuelles `vereinsheim
  status`.
- **Staging-Umgebung**: zweiter VPS oder zweites Compose-Project mit
  anderen Subdomains. Macht Schema-Migrations-Tests vor Prod möglich.
- **WAF/Fail2ban**: Caddy + NextAuth-Rate-Limit reichen für Vereinsbetrieb,
  bei höherer Exposition könnten Fail2ban-Regeln auf SSH und Caddy-Logs
  sinnvoll werden.
- **Mehr als 2 Apps im Stack**: ab ~3-4 Apps wird `compose.yml` zu
  redundant. Dann lohnt sich ein generisches App-Template (env-driven).
