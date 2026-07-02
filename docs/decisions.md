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

**Nachtrag (Juni 2026)**: `.mcp.json` startet den codegraph-Server über das installierte
`codegraph`-Binary (`codegraph serve --mcp`) statt `npx -y @colbymchenry/codegraph …` — dasselbe
Paket (`@colbymchenry/codegraph@1.0.1`), aber konsistent mit dem Index-Builder und ohne
npx-Auflösung pro Start; `CODEGRAPH_TELEMETRY=0` bleibt gesetzt. `codegraph init` pflegt zusätzlich
einen auto-managed Block in `.claude/CLAUDE.md` + die MCP-Tool-Permissions. Die Index-Existenz wird
per `SessionStart`-Hook (`.claude/hooks/codegraph-ensure.mjs`, fail-open + detached) automatisch
sichergestellt (realisiert das reproduzierbare Onboarding aus §11; User-Präferenz „immer
indizieren, nicht selbst steuern").

**Nachtrag (Juni 2026, ADR-021)**: Schicht 3 (Memory-Graph) war faktisch ein **No-Op** —
`MEMORY_FILE_PATH` in `.mcp.json` war relativ und wurde gegen das npx-dist-Verzeichnis des Servers
aufgelöst, daher leerer Graph + ENOENT bei Writes. Gefixt (projekt-relativer Pfad), um einen
SessionStart-**Lese-Hook** (`memory-surface.mjs`) ergänzt und die REMEMBER-Schreibdisziplin geschärft.
Details + Abgrenzung zum nativen Auto-Memory: **ADR-021**.

**Nachtrag (Juni 2026, ADR-022)**: Schicht 3 wird vom Hand-pflege-Modell auf einen **gebauten Doku-Index**
umgestellt — der Store ist ein deterministisch aus Quellen (`decisions.md` + Manifest + Captured) gebautes
Artefakt mit Fragment-Pointern (`→ datei#slug`) + Fragment-Reader (`doc.mjs`). Schicht 3 bleibt Layer 3
(macht Docs auffindbar, ist nicht ihre Wahrheit). Details: **ADR-022**.

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

**Nachtrag (Juni 2026, ADR-021)**: Die REMEMBER-Stufe (Schicht-3-Memory-Graph) war wegen eines
Pfad-Bugs nicht beschreibbar und blieb ungenutzt. Mit dem Fix (ADR-021) ist REMEMBER konkretisiert:
geschärfter Scope (Incident-Provenance/Zustand/Relationen statt Regeln), echte `mcp__memory__*`-Calls
und ein Commit-Schritt für den in-repo-Store. Siehe **ADR-021**.

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

**Nachtrag (Juni 2026, ADR-020)**: Das **Superpowers-Plugin** wurde wieder entfernt;
seine wertvollen Disziplinen (brainstorming, TDD, verification-before-completion, receiving-review,
systematic-debugging) sind **nativ** in die PIV-Skills + ein neues `/debug` geharvestet. Hooks,
PIV-Workflow, Sub-Agents und On-Demand-Context (Punkte 1–4) bleiben unverändert; nur die
„Superpowers-als-Baseline"-Annahme (Punkt 2 + §12) ist abgelöst.

**Nachtrag (Juli 2026)**: `reports/` ist ab sofort **lokal-only**, nicht mehr team-geteilt — die
ursprüngliche „`plans/`/`reports/` eingecheckt"-Folge (§11 oben) gilt nur noch für `plans/`.
Begründung: Validate-/Review-Berichte sind Wegwerf-Artefakte einer einzelnen PIV-Runde (im Gegensatz
zu `plans/`, das als Umsetzungs-Vertrag/Handoff für `/implement` gebraucht wird); ihr Wert für andere
Teammitglieder ist gering, ihr Volumen wächst mit jeder `/validate`/`/review`-Runde unkontrolliert im
Repo. `reports/` steht jetzt in `.gitignore`; bereits eingecheckte Berichte wurden aus dem Git-Tracking
entfernt (Dateien bleiben lokal liegen). Bereits **gepushte** History (vor Juli 2026) enthält sie
weiterhin — das wurde bewusst nicht per History-Rewrite/Force-Push bereinigt (separate, deutlich
invasivere Entscheidung, hier nicht getroffen).

---

## ADR-019 — App-Root-`.claude`-Layout + geteilte Root-Harness (realisiert ADR-016/017/018)

**Status**: Accepted (Juni 2026)

**Kontext**: Nach dem Monorepo-Import hatten die Apps uneinheitliche Agent-Tooling-Layouts (ringwerk:
`.claude/CLAUDE.md` + `.claude/docs/` + 8 Commands + `settings.json`; treffsicher: Root-`CLAUDE.md` +
`docs/` + 3 Commands, kein `settings.json`), und die Repo-Wurzel hatte gar keine Harness. Die
per-App-Commands referenzierten das in Phase 1 gelöschte per-App `docker-compose.dev.yml` und waren
**kaputt**. ADR-016/018 verlangen eine hierarchische CLAUDE.md + eine geteilte Harness — das Layout
musste vereinheitlicht werden.

**Entscheidung**:

- **App-Root-Layout** für beide Apps: `apps/<app>/CLAUDE.md` (scope-spezifische Regeln) +
  `apps/<app>/docs/` (Domänen-Docs). ringwerks `.claude/CLAUDE.md` + `.claude/docs/*` wandern an die
  App-Wurzel (`git mv`, History erhalten).
- **Geteilte Harness am Repo-Root** (`.claude/`): **ein** Satz Skills (`SKILL.md`, pnpm/turbo, app-aware)
  statt der per-App-Commands; Hooks (Stop-Gate = `pnpm check`, PostToolUse-Lint, PreToolUse-Security-
  Guard); `code-reviewer`-Sub-Agent; PIV-Skills; Superpowers-Plugin; `.mcp.json` (CodeGraph + Memory).
- `shared-conventions.md` wird **eine** Quelle am Root (`docs/shared-conventions.md`), nicht mehr pro App
  dupliziert (raus aus `consistency-check.sh` MUST_MATCH).

**Alternativen**:

- _Alles unter `apps/<app>/.claude/`_ (ringwerk-Layout): verworfen — App-Root-`CLAUDE.md` ist die
  Claude-Code-Konvention (nächstgelegene Datei wird geladen) und macht Domänen-Docs sichtbar.
- _Per-App-Commands behalten_: verworfen — sie waren kaputt (gelöschtes dev-compose) und dupliziert.

**Folgen**:

- Realisiert ADR-016 (Hierarchie + Knowledge-Layers), ADR-017 (`consolidate-lessons` app-agnostisch →
  Memory-Graph) und ADR-018 (Hooks/PIV/Sub-Agents).
- superpowers-Archive (dated plans/specs) bleiben unverändert in `apps/<app>/docs/superpowers/`.
- Hooks + MCP greifen ab dem nächsten Claude-Code-Reload (Hinweis im Root-`CLAUDE.md`).
- **Offen** (neue Session, ADR-016 §2): pnpm-Cross-Package-Auflösung empirisch in Phase-2-`packages/config`
  bestätigen.

**Nachtrag (Juni 2026, ADR-020)**: Das in der Entscheidung gelistete **Superpowers-Plugin** ist
entfernt; der native PIV-Workflow ersetzt es (das App-Root-`.claude`-Layout selbst bleibt unberührt).
Die datierten `apps/<app>/docs/superpowers/`-Archive bleiben als Historie.

---

## ADR-020 — Nativer PIV-Workflow; Superpowers-Plugin entfernt (supersedet Superpowers-Teil von ADR-018/019)

**Status**: Accepted (Juni 2026)

**Kontext**: ADR-018/019 hatten das Superpowers-Plugin als geteilte Dev-Tooling-Baseline übernommen,
parallel zu den eigenen PIV-Skills. Damit liefen **zwei** Top-Level-Workflows nebeneinander (Root-
`CLAUDE.md` → PIV; `apps/ringwerk/CLAUDE.md` → „Superpowers MANDATORY GATE"). Widersprüchliche
Anweisungen verschlechtern die Ergebnisse; der eigene PIV ist zudem tailored (kennt pnpm/turbo, zwei
Apps, Gates, codegraph, Deploy-Vertrag) und steckt in die Enforcement (Stop-Gate), die Superpowers
generisch nicht hat.

**Entscheidung**: **Ein** tailored Spine — der native PIV-Workflow. Die wertvollen Superpowers-
*Disziplinen* werden **nativ** in die PIV-Skills geharvestet, das Plugin **entfernt**:

- `/plan`: brainstorming-Front-End (unscharfer Scope), writing-plans-Rigor (bite-sized, no placeholders, Self-Review).
- `/implement`: **pragmatisches** test-first-TDD (Logik/Server-Actions/Bugfixes; nicht reine UI/Config); optional Subagent-pro-Task für große, unabhängige Task-Sets.
- `/validate`: evidence-before-claims (Gate-Teil ist via Stop-Gate ohnehin erzwungen).
- `/review`: receiving-review-Disziplin (Findings verifizieren, kein performatives Zustimmen).
- **`/debug`** (neu): systematic-debugging (4 Phasen, kein Fix ohne Root-Cause, 3+ Fixes → Architektur).
- **Hard Rule 7** (Root-`CLAUDE.md`) verankert PIV als Default (nicht-trivial → PIV; Bug → `/debug`; trivial → direkt).
- Plugin raus aus `.claude/settings.json` (`enabledPlugins`); `apps/ringwerk/CLAUDE.md`-Superpowers-Sektionen → Verweis auf Root-PIV.

**Alternativen**:

- _Superpowers als Bibliothek behalten + Disziplinen aufrufen_: weniger Eigenpflege, aber externe
  Abhängigkeit + generisch; der User wählte explizit „nativ nachbauen, dann ganz raus" (volle Kontrolle).
- _Beide Workflows nebeneinander (Status quo)_: verworfen — der Auslöser dieses ADRs.

**Folgen**:

- Keine externe Plugin-Abhängigkeit mehr; ein konsistenter, tailored Workflow für beide Apps.
- Die datierten `apps/<app>/docs/superpowers/`-Archive bleiben als **Historie** (keine neuen Artefakte
  dort; neue Plans/Reports → Root-`plans/` + `reports/`).
- ADR-018 Punkte 1–4 (Hooks/PIV/Sub-Agents/On-Demand-Context) bleiben gültig; nur die
  Superpowers-Baseline ist abgelöst.
- Der globale Plugin-Cache (`~/.claude/plugins/`) ist user-/maschinen-weit und bleibt unberührt — bei
  Bedarf separat deinstallierbar.

---

## ADR-021 — Memory-Graph operationalisiert: Pfad-Fix, Lese-Hook, Schreib-Disziplin, Abgrenzung natives Auto-Memory

**Status**: Accepted (Juni 2026)

**Kontext**: ADR-016 Schicht 3 (MCP-Knowledge-Graph, `@modelcontextprotocol/server-memory`, Store
`.claude/knowledge-graph.json`) war faktisch ein **No-Op seit Tag 1**. Empirisch belegt (Session
2026-06-22): `read_graph` liefert `{entities:[],relations:[]}` trotz 24 geseedeter Zeilen, und
`create_entities` scheitert mit `ENOENT: …/server-memory/dist/.claude/knowledge-graph.json`. Ursache:
`MEMORY_FILE_PATH` in `.mcp.json` war **relativ** und wurde vom Server gegen sein **eigenes
npx-Installationsverzeichnis** aufgelöst, nicht gegen die Repo-Wurzel → der Server las nie die getrackte
Datei (leerer Graph) und konnte nie schreiben (ENOENT). Der Seed-Inhalt existierte nur, weil der
Seed-Commit die Datei direkt schrieb. Sekundär: es fehlte eine **Lese-Seite** (nichts surface'te den
Graphen) und die **Schreib-Seite** war schwach (REMEMBER, die schwächste Triage-Stufe, kaum gefüttert).
Der Graph blieb leer *und* ungenutzt.

**Entscheidung**: Den Memory-Graphen funktionsfähig, auffindbar und nicht-redundant machen:

1. **Pfad-Fix** (entscheidend): `MEMORY_FILE_PATH` → `${CLAUDE_PROJECT_DIR:-.}/.claude/knowledge-graph.json`.
   Claude Code expandiert `${VAR}`/`${VAR:-default}` in `.mcp.json`-`env`; `CLAUDE_PROJECT_DIR` wird im
   Server-Env gesetzt (projekt-scoped braucht den `:-.`-Fallback). Portabel, kein hartkodierter Pfad.
2. **Lese-Pfad**: SessionStart-Hook `.claude/hooks/memory-surface.mjs` (fail-open) liest die JSONL-Store-
   Datei **direkt** (unabhängig vom MCP-Server) und injiziert eine kompakte Übersicht (Entity-Zähler nach
   Typ + Relationen) + Abfrage-/Capture-Hinweis als `additionalContext` — analog zum CodeGraph-Onboarding.
   Memory-MCP-Tools (Lesen + additive Writes) sind allowlisted, damit Nutzung ohne Friktion läuft.
3. **Schreib-Disziplin**: `/consolidate-lessons` REMEMBER konkretisiert — echte `mcp__memory__*`-Calls
   (Entity + Relation), geschärfter Scope (Incident-Provenance, sich ändernder Zustand, Relationen —
   **nicht** wiederverwendbare Regeln, die nach DOCUMENT gehen) und der zuvor fehlende **Commit-Schritt**
   (der in-repo-Store muss committet werden, sonst geht der Write beim nächsten Clone verloren). Beide
   App-CLAUDE.md verweisen darauf (Session-Start-Abfrage, Session-Ende-Capture).
4. **Re-Seed** (nicht-redundant): ADR-Backbone aktuell (019–021) + Incident/State-Entities mit Provenance
   (`stechschuss-modell-flip`, `ruleset-lock-granularity`, `treffsicher-actionresult-migration`) +
   Relationen — Dinge, die **nicht** in den immer-geladenen Docs stehen.
5. **Abgrenzung** zum nativen Claude-Code-Auto-Memory (`~/.claude/.../memory/`): **Maschinen-/User-/Ops-
   lokales** (VPS-Status, Dev-Server-Disziplin) → natives Auto-Memory (persistiert automatisch, nicht via
   git geteilt). **Projekt-/Domänen-/via-git-geteiltes** (Domänen-Incidents, ADR-Relationen, Architektur-
   Provenance) → Memory-MCP-Graph (im Repo, jeder Clone bekommt ihn). Code-Struktur → CodeGraph;
   erzwingbare Regeln → Docs/Gates.

**Alternativen**:

- _Memory-Graph stilllegen, alles aufs native Auto-Memory_: das native System macht den Cross-Session-Job
  bereits. Verworfen — der User will den geteilten, via-git-versionierten Projekt-Graphen (Clones/Team,
  abfragbare Relationen). Stattdessen klare Aufgabenteilung (Punkt 5).
- _Hartkodierter absoluter Pfad_: funktioniert, aber bricht bei `git clone` auf anderer Maschine/Pfad.
  Verworfen zugunsten der `${CLAUDE_PROJECT_DIR:-.}`-Expansion.
- _Schreiben per Hook erzwingen_: ein Hook kann semantisches Capture nicht sinnvoll erzeugen. Stattdessen
  Surface (macht Vernachlässigung sichtbar) + Skill-Disziplin + Checkliste.

**Folgen**:

- `.mcp.json`-Änderungen greifen erst nach Claude-Code-**Reload**; die Round-Trip-Verifikation (liest/
  schreibt der gefixte MCP die getrackte Datei?) ist ein **Akzeptanz-Gate nach Reload**, nicht im selben
  Lauf erzwingbar. Der Re-Seed lief daher per direktem JSONL-Edit, nicht via Live-MCP.
- Schreiben bleibt **modellgetrieben** (kein Hard-Enforcement möglich); der SessionStart-Surface macht
  einen leeren/vernachlässigten Graphen aber sofort sichtbar.
- ADR-016 §3 und ADR-017 §3 erhalten Nachtrag-Verweise hierher.

**Nachtrag (2026-06-23) — Pfad-Fix war unzureichend; korrigiert via Launcher-Wrapper**

Das oben als Akzeptanz-Gate vermerkte Round-Trip-nach-Reload wurde am 2026-06-23 gefahren und **schlug
fehl**: `read_graph` lieferte weiter leer, `create_entities` → `ENOENT:
…/server-memory/dist/.claude/knowledge-graph.json`. Befund:

- Die Annahme in Punkt 1 (»`CLAUDE_PROJECT_DIR` wird im Server-Env gesetzt«) ist **falsch**: Claude Code
  expandiert `${CLAUDE_PROJECT_DIR:-.}` zwar, aber die Variable ist im **MCP-Server-Env leer** → Fallback
  auf `.`. (Im *Hook*-Env ist sie gesetzt — deshalb funktionierte der Surface-Hook, der MCP-Server nicht.)
- Tiefere Ursache: `server-memory` löst einen **relativen** `MEMORY_FILE_PATH` gegen sein **eigenes
  dist-Verzeichnis** auf (`import.meta.url`), nicht gegen die CWD. Ein relativer Pfad kann also prinzipiell
  **nie** auf die Repo-Datei zeigen — nur ein **absoluter** funktioniert.

**Korrektur**: schlanker, committeter Launcher `.claude/hooks/memory-server.mjs`, der den **absoluten**
Store-Pfad aus seiner eigenen Lage ableitet (`<repo>/.claude/knowledge-graph.json`) und ihn per Env an
`npx @modelcontextprotocol/server-memory` übergibt (stdio 1:1 durchgereicht). `.mcp.json` ruft jetzt `node
.claude/hooks/memory-server.mjs` statt `npx …` mit `${CLAUDE_PROJECT_DIR}`-Env. Das vereint **Absolutheit**
(server-memory-Anforderung) mit **Portabilität** (kein hartkodierter Pfad — die in »Alternativen«
verworfene Option) und ist damit der eigentliche Pfad-Fix.

**Verifikation**: anders als der ursprüngliche Fix **ohne Reload bestätigt** — ein direkter MCP-Round-Trip
gegen den Launcher liefert die 27 Entities / 9 Relationen aus der getrackten Datei (2026-06-23). Die
*laufende* Session nutzt bis zum Reload weiter den alten Server; der Mechanismus ist aber bewiesen.

**Nachtrag (Juni 2026, ADR-022)**: Die hier etablierte Schreib-Mechanik (Live-`mcp__memory__*`-Writes +
Commit des Stores) wird durch **ADR-022** abgelöst: der Store ist ab jetzt ein **gebautes Artefakt** aus
eingecheckten Quellen, neues Wissen wird in die **Quelle** (`graph-projection.mjs`/`graph-captured.mjs`)
geschrieben + neu gebaut. Der Launcher + die Lese-Seite (`memory-surface.mjs`) bleiben unverändert gültig.

---

## ADR-022 — Memory-Graph als gebauter, relationenreicher Doku-Index (Builder + Manifest + Captured + Fragment-Pointer)

**Status**: Accepted (Juni 2026)

**Kontext**: Der Memory-Graph (ADR-016 Schicht 3, operationalisiert in ADR-021) wurde **von Hand** gepflegt
(Live-`mcp__memory__*`-Writes). Drei Schwächen: (a) **nicht selbstaktualisierend** — wächst nur, wenn ein
Agent daran denkt (war faktisch No-Op); (b) **Doppelpflege/Drift** — Volltext im Graphen *und* in den Docs;
(c) **Token-Verschwendung beim Einstieg** — Pointer zeigten auf ganze Dateien, der Agent las viel „umsonst".
Gewünscht: ein schneller, token-sparsamer Einstieg, bei dem der Graph als **angereicherter Index über die
gesamte Dokumentation** dient (das Gegenstück zu CodeGraph für den Code).

**Entscheidung**: Der Store `.claude/knowledge-graph.json` ist **kein handgepflegtes Artefakt mehr**, sondern
**deterministisch gebaut** aus drei eingecheckten Quellen:

1. **`docs/decisions.md`** → ADR-Entities + `supersedes`-Relationen, **deterministisch geparst**
   (`## ADR-NNN — Titel`, `**Status**`, `(supersedes ADR-X)`). ADR-Observations = Essenz + Fragment-Pointer.
2. **`.claude/graph-projection.mjs`** (Manifest) → kuratierte `project`/`app`/`feature`/`subsystem`/
   `domain-rule`/`operation`/`ops-constraint`-Entities (Essenz + `→ datei#slug`-Pointer) + deren Relationen.
3. **`.claude/graph-captured.mjs`** → Session-Provenance (`incident`/`state`), die in **keiner** Doc steht
   und jeden Rebuild **überlebt**.

`.claude/build-graph.mjs` mergt sie und **validiert** Integrität (keine Dup-Namen/Dangling/leere Entities)
**und jeden `→ datei#slug`-Pointer** (toter Pointer = Build-Fehler → der Index kann nicht still verrotten).
`.claude/doc.mjs` ist der **Fragment-Reader** (`node .claude/doc.mjs datei#slug` druckt nur den Abschnitt) —
so wird aus „Pointer auf 600-Zeilen-Datei" „lies 20 Zeilen". Der `/sync-graph`-Skill zieht bei Doc-Änderungen
das Manifest nach und baut neu (**modellgetrieben**, da Prosa keine AST-Struktur hat).

**Determinismus-Grenze (bewusst):** `Manifest+ADRs+Captured → Graph` ist **deterministisch** (idempotent,
hook-/CI-fähig, kein Modell); `Docs → Manifest` ist **modellgetrieben** (`/sync-graph`). Voll-automatisches
„Doc ändert sich → Graph baut sich ohne Modell neu" ist nicht erreichbar und wird nicht versprochen.

**Schreib-Mechanik (löst ADR-021 ab):** neues Projektgedächtnis wird in die passende **Quelle** geschrieben
(`graph-captured.mjs` für Incidents/State, `graph-projection.mjs` für abgeleitete Topics) + Rebuild + Commit —
**nicht** mehr als Live-`mcp__memory__*`-Write (den ein Rebuild überschriebe). Der MCP-Server bleibt **lesend**
(liest die Datei pro Operation, ADR-021 — Builds sind sofort sichtbar).

**Alternativen**:

- _Hand-gepflegter Graph (Status quo, ADR-021)_: nicht selbstaktualisierend, doppelte Pflege, Drift. Verworfen.
- _Docs in viele Fragment-Dateien splitten_ (für Token-Granularität): zerstückelt die für Menschen lesbare
  Doku. Verworfen zugunsten **Heading-Pointer + Fragment-Reader** (Docs bleiben ganze Dateien).
- _Vektor-RAG über Doc-Chunks_: externe Infra, weniger präzise/kuratiert als ein relationenreicher Graph;
  für dieses Doku-Volumen überdimensioniert. Verworfen.
- _Pure Determinismus (Docs→Graph ohne Modell)_: bei Prosa nicht erreichbar; ehrlich als modellgetriebene
  Manifest-Stufe ausgewiesen.

**Folgen**:

- Der Graph wird der **Index über das gesamte lebende Doku-Korpus** (decisions/spec/operations/
  shared-conventions/architecture/monorepo-plan + `apps/*/docs/*` + `packages/*/CLAUDE.md` + README), mit
  dichtem Relationsvokabular (`governed_by`/`contrasts_with`/`see_also`/`relates_to` neben den bestehenden).
- ADR-016 §3 + ADR-021 erhalten Nachtrag-Verweise; ADR-016 (Graph = Layer 3, **nicht** Struktur-Autorität)
  bleibt gewahrt — der Index macht Docs *auffindbar*, ist nicht ihre Wahrheit.
- `/consolidate-lessons` REMEMBER schreibt künftig in die Quelle + baut neu (statt Live-Write).
- Die immer-geladene `@import`-Schicht kann schrumpfen (kleiner „Rules of the road"-Kern bleibt; Detail wird
  indiziert) — separater, letzter Schritt, da Konventions-Treue **nicht** gate-erzwingbar ist.
- **Out of scope (vorgesehen):** die spätere Frage, ob der Index immer-geladene Docs ganz ablösen kann.

**Nachtrag (Juni 2026) — Stop-Hook erzwingt den Sync am Turn-Ende.** Das oben als out-of-scope notierte
Build-Enforcement ist umgesetzt: `.claude/hooks/graph-sync.mjs` (Stop-Hook, neben dem `pnpm check`-Stop-Gate)
synct den Index am Ende jedes Turns — exakt entlang der Determinismus-Grenze:
1. **Deterministisch erzwungen:** `build-graph.mjs` läuft; schlägt die Validierung fehl (toter Pointer/
   Dangling/Dup), **blockt** der Hook das Turn-Ende (`exit 2`) — der Index kann nicht invalide aufhören. Der
   Build hält den Store frisch (idempotent → still bei unveränderten Quellen).
2. **Modellgetrieben genudged:** wurden indizierte Docs geändert, aber das Manifest nicht, gibt es einen
   **nicht-blockierenden** Hinweis Richtung `/sync-graph` (ein Hook kann den semantischen Docs→Manifest-Sync
   nicht selbst erzeugen; ein Hard-Block würde bei Typo-Fixes einsperren). Fail-open bei Infra-Fehlern.

Damit ist „Agenten syncen am Task-Ende" Harness-erzwungen für den deterministischen Teil und sichtbar-
genudged für den Modell-Teil — nichts Automatisches täuscht über die Grenze hinweg.

---

## ADR-023 — Implement-Phase autonom-by-default (realisiert ADR-018 §5, schärft ADR-020)

**Status**: Accepted (Juni 2026)

**Kontext**: ADR-018 §5 sah einen „Autonomous-Loop-Driver (Ralph-artig) mit Worktree-Isolation,
Commit-pro-Iteration, nie auf `main`" vor — bislang unrealisiert. Der klassische Ralph-Loop
(`while :; do cat PROMPT.md | claude; done`) ist für sich unsicher: nichts stoppt ihn, wenn er Mist
baut, und sein Gedächtnis ist eine formlose Datei. Dieses Repo hat die Zutaten für eine *sichere*
Variante aber bereits: das **Stop-Gate** (ADR-018, kann nicht rot „fertig" sein) als Selbstkorrektur-
Substrat, `plans/` + `reports/` als persistentes Gedächtnis und `/implement` (ADR-020) als Loop-Body —
heute nur *manuell getaktet*. Der User will den Autopilot-Vorteil **nicht pro Lauf aktiv wählen**
müssen, sondern **immer** davon profitieren; ein zweites Opt-in-Kommando (`/auto-implement`, `/loop …`)
wäre eine redundante Entscheidung neben der Plan-Freigabe, die er ohnehin gibt.

**Entscheidung**: Die **`/implement`-Phase wird autonom-by-default** — kein separates Skill, sondern
das vorhandene `/implement` grindet einen **bereits freigegebenen** Plan task-by-task durch, statt
zwischen Tasks zu pausieren. Eingebettet in PIV, nicht als Ersatz:

1. **Plan-Freigabe = die einzige Opt-in-Grenze** (Struktur-Invariante): Autonomie greift **nur** über
   einen per `/plan` freigegebenen Plan (Plan-als-Spec = Sicherheitsfundament; „autonom ohne Plan"
   gibt es bewusst nicht). **Merge/Push/Deploy nach `main` bleiben user-gated** (Hard Rule 2).
2. **Eine Iteration = ein Plan-Task**: implementieren → `pnpm check` (Stop-Gate-Kriterium) → ein
   fokussierter Commit → Ledger-Eintrag (`reports/<plan-stem>-autopilot.md`, der Audit-Trail).
3. **Fünf Circuit-Breaker → HALT + Meldung an den User**: (a) Task mehrdeutig/unterspezifiziert,
   (b) Gate nach 3 Selbstheil-Versuchen rot (WIP verwerfen, Branch bleibt grün), (c) geschützter
   Pfad, (d) Scope über Plan hinaus, (e) Plan abgearbeitet (→ FINALIZE → `/validate`).
4. **Erzwungene Schutz-Schicht** (`autopilot-guard.mjs`, PreToolUse, ADR-017 ENFORCE > DOCUMENT): nur
   aktiv bei Marker `.claude/.autopilot-active`, DENY auf geschützte Pfade (Deploy-Vertrag, Schema/
   Migrationen, ADRs, Secrets, `.claude/`, `scripts/`) + Kommandos (`git push/merge/rebase/reset
   --hard`, `vereinsheim deploy|build|release|backup|restore`, `docker push`, `prisma migrate`). Eine
   *weiche* Regel ist genau das, was unter unbeaufsichtigtem Grinden versagt.
5. **Worktree-Pflicht** (`feat/`-Branch im `.claude/worktrees/`) + **Iterations-Cap 20** (Runaway-
   Backstop) + Marker entfernen bei jedem HALT/FINALIZE (re-armt interaktives Editieren).
6. **Hard-Rule-4-Ausnahme im autonomen Modus**: das „Commit-Message als fenced block *vor* dem Commit"
   entfällt (es würde die Autonomie zunichtemachen); die Messages stehen im Ledger + `git log`, **vor
   dem Merge revidierbar**. Interaktiv gilt Hard Rule 4 unverändert.
7. **Escape-Hatch** `/implement --step` für bewussten Task-für-Task-Betrieb (kein Marker → Hook
   No-Op). Triviale Fixes (Hard Rule 7) laufen wie bisher direkt, ohne Plan/Autopilot.

**Alternativen**:

- _Separates Opt-in-Skill `/auto-implement`_ (erster Planentwurf): verworfen — der User müsste sich pro
  Lauf „dafür" entscheiden; das widerspricht „immer profitieren". Autonomie als Default von `/implement`
  nutzt die Plan-Freigabe als ohnehin vorhandene Einwilligung.
- _Voller Ralph (kein Plan, kein Gate, kein Guard)_: verworfen — unsicher, kein Scope-Anker.
- _Reines manuelles PIV (Status quo)_: die Fleißarbeit (z.B. ActionResult-Vereinheitlichung) bleibt
  per-Task-babysittet; genau die Reibung, die der User weghaben will.
- _Schutz-Schicht nur als Skill-Anweisung (DOCUMENT)_: verworfen — weiche Regeln versagen autonom;
  ENFORCE via Hook (ADR-017).

**Folgen**:

- `/implement` (`SKILL.md`) überarbeitet (autonom-by-default, Preflight + Task-Iteration, Breaker,
  Ledger, Cap, Worktree-Pflicht, `--step`); neuer Hook `autopilot-guard.mjs` + Verdrahtung in
  `.claude/settings.json`; Marker `.claude/.autopilot-active` gitignored.
- Realisiert ADR-018 §5 (als Default von `/implement` statt separater Driver) und **schärft ADR-020**
  (PIV-Default): die Implement-Phase pausiert nicht mehr per Default zwischen Tasks.
- Der built-in `/loop` bleibt unverändert; er ist intern als Pacing-Mechanik für sehr lange Pläne
  nutzbar, aber **kein vom User getipptes Kommando**.
- Der Hook ist interaktiv ein No-Op (marker-gated) → keine Regression für normales Arbeiten.

**Nachtrag (Juli 2026, ADR-018-Nachtrag „reports/ lokal-only")**: Das Ledger
(`reports/<plan-stem>-autopilot.md`) ist davon **mit erfasst**, nicht ausgenommen — auch das Ledger ist
jetzt lokal-only, nicht mehr team-geteilt. Die obige „persistentes Gedächtnis"/„Audit-Trail"-Formulierung
ist entsprechend überholt: der tatsächliche, git-persistente Audit-Trail eines Autopilot-Laufs sind die
einzelnen fokussierten Task-Commits selbst (Conventional-Commits-Historie), nicht die Ledger-Datei. Das
Ledger bleibt als **Laufzeit-Zustand** bestehen (Resume nach HALT, Fortschritts-Checkliste innerhalb
eines laufenden `/implement`), verliert aber seine Rolle als geteiltes Nachschlage-Artefakt danach.

---

## ADR-024 — Worktree-Wahl ist Hauptsession-Vorab-Entscheidung (schärft ADR-023 §5)

**Status**: Accepted (Juni 2026)

**Kontext**: ADR-023 §5 schrieb eine **Worktree-*Pflicht*** für den autonomen `/implement` fest, und
das Preflight **HALTET**, wenn es nicht in `/.claude/worktrees/` auf einem `feat/`-Branch läuft. Drei
Schwächen dieser Pflicht:

1. **Erzeuger-Lücke**: Den Worktree *erstellt* kein Schritt. `/plan` schlägt nur einen `feat/`-Branch
   vor (keinen Worktree), und der Autopilot kann sich nicht selbst in einen Worktree „umziehen". Die
   Pflicht prüft also eine Vorbedingung, für deren Herstellung niemand zuständig ist.
2. **Gate-Konflikt**: Das Autopilot-Gate ist `pnpm check` (inkl. `test`). DB-Tests scheitern im
   frischen Worktree ohne `.env` (gitignored → nicht mit ausgecheckt) — die Pflicht macht das Gate für
   DB-nahe Pläne also unerfüllbar, statt zu schützen.
3. **Falsche Verortung**: Ob isoliert gearbeitet wird, ist eine Umgebungs-/Workflow-Entscheidung, die
   naturgemäß **vor** dem Lauf fällt — beim Menschen in der Hauptsession, nicht im Autopilot.

**Entscheidung**: Der Worktree ist **keine Pflicht** mehr, sondern eine **Vorab-Entscheidung der
Hauptsession** — der User entscheidet vor `/implement`, ob isoliert gearbeitet wird. Gewählte Mechanik
(User, 24.06.2026): **die Skills bleiben worktree-agnostisch**.

1. **Skills erstellen/erzwingen keinen Worktree** und fragen nicht aktiv danach. Wer Isolation will,
   richtet den Worktree vorab selbst ein (Harness/`git worktree`).
2. **`/implement`-Preflight prüft nur noch den Branch**: `git branch --show-current` muss mit `feat/`
   beginnen (nie autonom auf `main`/Default — Hard Rule 2). Sonst **HALT**. Es arbeitet im
   vorgefundenen Tree — Worktree oder Haupt-Tree, das ist nicht seine Entscheidung.
3. **Alle übrigen ADR-023-Sicherungen bleiben unverändert**: Plan-Freigabe als einzige Opt-in-Grenze,
   Merge/Push/Deploy user-gated, `autopilot-guard` (geschützte Pfade/Kommandos), Iterations-Cap 20,
   Marker. Der Worktree war stets *zusätzliche* Isolation (defense-in-depth), nie die einzige
   Leitplanke — sein Wegfall als Pflicht senkt das Sicherheitsniveau nicht.

**Alternativen**:

- _`/plan` fragt aktiv „Worktree ja/nein?"_ (geführter Schritt): verworfen — der User will keinen
  „Magie-Schritt" im Skill, sondern die Wahl selbst in der Hand.
- _Worktree als abwählbarer Default_: verworfen — behält die Pflicht-Optik; die Skills müssten ihn
  doch wieder erstellen/prüfen.
- _Pflicht beibehalten (ADR-023 §5 unverändert)_: verworfen — Erzeuger-Lücke + Gate-Konflikt (s.o.).

**Folgen**:

- `/implement` (`SKILL.md`): Preflight-„Worktree-Pflicht" → reiner `feat/`-Branch-Check. `/plan`
  (`SKILL.md`): ein Hinweis, dass die Worktree-Wahl beim User liegt (kein aktiver Schritt).
- `docs/architecture.md`: ADR-Liste um ADR-024 ergänzt.
- **Relativiert ADR-018 §5** („Autonomous-Loop-Driver … mit Worktree-Isolation"): die Isolation wird
  von *Pflicht* zu *Option* (ADR-018 bleibt als historische Vision unangetastet).
- Diese Umsetzung lief bewusst **interaktiv**: sie berührt geschützte Pfade (`.claude/`,
  `docs/decisions.md`), die der `autopilot-guard` blockt — die Harness ändert ihre eigenen Leitplanken
  nur unter menschlicher Aufsicht.

---

## Mögliche Folge-ADRs (out-of-scope, aber vorgesehen)

Wenn eines dieser Themen aktuell wird, neuer ADR (ADR-021+):

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
