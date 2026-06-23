# Plan: Lokaler Dev-Bootstrap (`scripts/bootstrap-dev.sh` + `.nvmrc`)

> PIV-Schritt 1. Handoff für `/implement`. Branch: `feat/dev-bootstrap` (in isoliertem Worktree
> `.claude/worktrees/dev-bootstrap`, damit parallele Arbeit im Haupt-Tree ungestört bleibt).
> **User-Entscheidungen (23.06.2026):** (1) **voller Bootstrap + `.nvmrc`**; (2) **codegraph =
> gepinnte Pflicht-Abhängigkeit**.

## Kontext (warum)

Heutiger Stand des Bootstraps, in drei Schichten:

- **VPS/Server — vollständig.** [`scripts/bootstrap-vps.sh`](../scripts/bootstrap-vps.sh): apt, Docker,
  deploy-User, SSH-Key, Repo-Clone. One-shot, sauber.
- **Lokale Dev-Toolchain — nur Doku.** Die Schritte stehen als manuelle Liste im
  [`README.md`](../README.md) („Monorepo-Entwicklung (lokal)"): `corepack enable` → `pnpm install` →
  Dev-Postgres → `.env` kopieren → `prisma db push` → `pnpm dev`. Kein ausführbares Skript; setzt
  Node ≥24 + Docker als vorhanden voraus; Node ist nirgends gepinnt (keine `.nvmrc`, nur `engines`
  in `package.json` — das *warnt* nur). `vereinsheim local-setup` klingt nach Dev-Setup, schreibt
  aber nur die **VPS-Verbindungs**-Config (`.vereinsheim.local`).
- **Claude-Harness — eine lautlose Lücke.** Eingecheckt und damit per `git clone` vorhanden:
  `.mcp.json`, `.claude/settings.json`, Hooks, Skills, Agents, `knowledge-graph.json`. Der
  Memory-MCP installiert sich selbst (`npx -y @modelcontextprotocol/server-memory`). **Aber** das
  `codegraph`-Binary (`@colbymchenry/codegraph@1.0.1`) ist nur **global via npm** installiert —
  steht in **keiner** `package.json`, **keinem** Skript, **keiner** Doku. Auf einer frischen
  Maschine fehlt es; der Ausfall ist lautlos, weil [`codegraph-ensure.mjs`](../.claude/hooks/codegraph-ensure.mjs)
  bewusst fail-open ist → ohne Binary kein `.codegraph/`, keine `codegraph_explore`-Tools, die in
  [`CLAUDE.md`](../CLAUDE.md)/[`architecture.md`](../docs/architecture.md) als „Ground Truth"
  verankerte Knowledge-Schicht ist weg, ohne Fehlermeldung.

Ziel: **clone → ein Befehl → arbeitsfähig**, inklusive der Claude-Harness (codegraph nicht mehr
lautlos fehlend).

## Bewusste Scope-Grenze

`node` und `docker` werden **geprüft, nicht installiert**. Begründung: `bootstrap-vps.sh` läuft auf
einem definierten OS (Debian/Ubuntu) und darf `apt`/`docker` installieren; die Dev-Workstation ist
heterogen (macOS/Linux × nvm/brew/system-node) — ein invasiver Auto-Install wäre fragil. Stattdessen:
präziser Check + klare Anleitung (für Node verweist die Meldung auf die neue `.nvmrc` →
`nvm install`) + `exit 1`. **Alles Projektspezifische** (pnpm-Deps, codegraph-Binary + Index,
`.env`, DB-Schema) wird installiert/konfiguriert.

## Ansatz

- **Träger:** neues standalone `scripts/bootstrap-dev.sh` (parallel zu `bootstrap-vps.sh`, gleicher
  schlichter Stil: `set -euo pipefail`, `echo "==> …"`, keine Abhängigkeit vom CLI — es bootstrappt
  ja erst die Toolchain).
- **Dünner CLI-Wrapper:** `vereinsheim dev-setup` → `exec scripts/bootstrap-dev.sh` (Auffindbarkeit
  via `help`/Menü; folgt exakt dem `cmd_build` → `build-and-push.sh`-Muster; CLAUDE.md: „das Tool
  wrappt die per-Task-Skripte, dupliziert sie nicht"). Der Wrapper ruft **nicht** `require_local_config`
  (Henne-Ei: dev-setup läuft auf frischem Clone, bevor VPS-Config existiert).
- **`.nvmrc`** mit Major-Pin `24` (matcht `engines: node >=24`).
- **Idempotent** — sicher mehrfach ausführbar (`.env` nur kopieren wenn fehlend; `db push` synct;
  codegraph nur (neu)installieren wenn Version abweicht; `docker compose up -d` idempotent).

### Ablauf von `scripts/bootstrap-dev.sh` (8 Schritte, in dieser Reihenfolge)

1. **Vorbedingungen prüfen** (kein Install):
   - Node: `node_major="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/')"`; wenn leer oder
     `< 24` → Fehlermeldung mit Hinweis „Node ≥24 nötig — via nvm: `nvm install && nvm use` (nutzt
     die `.nvmrc`)" + `exit 1`.
   - Docker: `command -v docker` **und** `docker info >/dev/null 2>&1` (Daemon erreichbar), sonst
     `exit 1` mit Hinweis.
2. **corepack enable** — aktiviert pnpm gemäß `packageManager`-Pin (`pnpm@10.33.0`).
3. **pnpm install** — Workspace-Deps (`pnpm install` im Repo-Root).
4. **codegraph (Pflicht):** aktuelle Version ermitteln (`codegraph --version`), und wenn Binary fehlt
   **oder** Version ≠ `1.0.1` → `npm install -g @colbymchenry/codegraph@1.0.1`. Danach: wenn
   `.codegraph/` fehlt → `codegraph init` anstoßen (detached, Hinweis „Index wird im Hintergrund
   gebaut"), damit der Graph sofort entsteht statt erst beim nächsten Claude-Reload.
5. **Dev-Postgres:** `docker compose -f docker-compose.dev.yml up -d`, dann auf Bereitschaft warten —
   Loop `docker compose -f docker-compose.dev.yml exec -T db pg_isready -U postgres` bis OK oder
   Timeout (~30×1s), sonst `exit 1`.
6. **`.env` je App:** für `ringwerk` und `treffsicher`: wenn `apps/<app>/.env` **fehlt** →
   `cp apps/<app>/.env.example apps/<app>/.env`. (Die `.env.example` sind bereits dev-tauglich:
   `DATABASE_URL` → `localhost:5432`, gültiges Dev-`NEXTAUTH_SECRET`, Admin-Defaults — **kein**
   Secret-Generieren nötig.) Vorhandene `.env` wird **nie** überschrieben.
7. **Schema je App:** `pnpm --filter <app> exec prisma db push` (synct Schema in die Dev-DB; ruft
   `prisma generate` mit auf).
8. **Abschluss:** „Fertig" + nächste Schritte (`pnpm dev` → :3000/:3001, `pnpm check`) + Hinweis,
   dass `vereinsheim local-setup` separat nur für VPS-Deploy nötig ist.

## Dateien

| Datei | Änderung |
| --- | --- |
| `scripts/bootstrap-dev.sh` | **NEU** — der Bootstrap (8 Schritte oben), `chmod +x` |
| `.nvmrc` | **NEU** — Inhalt: `24` |
| `scripts/vereinsheim` | `cmd_dev_setup()` (`exec "$SCRIPT_DIR/bootstrap-dev.sh" "$@"`) + dispatch-`case`-Eintrag (`dev-setup) cmd_dev_setup "$@" ;;`, bei ~Z.1616) + Eintrag in `cmd_help`/usage + im Lokal-Menü |
| `README.md` | Dev-Setup-Block: One-Command (`./scripts/vereinsheim dev-setup` bzw. `bash scripts/bootstrap-dev.sh`) voranstellen, manuelle Schritte als „macht intern / Fallback" behalten; Subcommand-Liste (`dev-setup`) ergänzen |
| `docs/architecture.md` | Repo-Karte: Zeile `scripts/bootstrap-dev.sh` (Dev-Onboarding) ergänzen |

## Required Docs (vor `/implement` lesen)

- [`CLAUDE.md`](../CLAUDE.md) → „Wenn du etwas änderst" (Skript-Validierung: `bash -n`).
- [`docs/shared-conventions.md`](../docs/shared-conventions.md) → §8 (Drift-Schutz; hier keine
  Gate-Dateien betroffen, aber Kenntnis der Konventionen).
- [`scripts/bootstrap-vps.sh`](../scripts/bootstrap-vps.sh) → Stil-Referenz (schlichte echos, Header-
  Kommentar, set -euo pipefail).
- Diese Plan-Datei.

## Tasks (bite-sized — ein fokussierter Commit pro Task)

1. **`.nvmrc`** anlegen (Inhalt `24`).
2. **`scripts/bootstrap-dev.sh`** schreiben (alle 8 Schritte, idempotent), `chmod +x`, `bash -n` grün.
3. **`scripts/vereinsheim`**: `cmd_dev_setup`-Wrapper + dispatch + help + Lokal-Menü, `bash -n` grün.
4. **Doku**: `README.md` (Dev-Block + Subcommand-Liste) + `docs/architecture.md` (Repo-Karte).

## Test-Schritte (für `/validate`)

- `bash -n scripts/bootstrap-dev.sh` **und** `bash -n scripts/vereinsheim` → beide grün.
- `shellcheck scripts/bootstrap-dev.sh scripts/vereinsheim` (falls installiert) → keine neuen Fehler.
- **Idempotenz-Lauf:** `bash scripts/bootstrap-dev.sh` auf der aktuellen (bereits eingerichteten)
  Maschine → läuft grün durch, erkennt vorhandenes node/docker/codegraph@1.0.1, überschreibt keine
  `.env`, `db push` = no-op-Sync. (Im Worktree legt Schritt 6 `.env` im Worktree-Pfad an — erwartet
  und harmlos; der Memory-Hinweis zu turbo-env/DB-Tests betrifft `pnpm test`, **nicht** diesen Lauf.
  Bei Bedarf zusätzliche Idempotenz-Probe im Haupt-Tree.)
- **Dispatch:** `./scripts/vereinsheim help` listet `dev-setup`; `./scripts/vereinsheim dev-setup`
  startet das Skript (kein `require_local_config`-Abbruch).

## Verifikation (Definition of Done)

- Frischer-Maschine-Pfad logisch vollständig: clone → (node ≥24 + docker vorhanden) →
  `bash scripts/bootstrap-dev.sh` → arbeitsfähig (`pnpm dev` startet, `.codegraph/` wird gebaut).
- **codegraph nicht mehr lautlos fehlend**: Bootstrap installiert es gepinnt (`1.0.1`) und stößt den
  Index an.
- Beide Skripte `bash -n` grün; Bootstrap idempotent (zweiter Lauf ohne Schaden/Überschreiben).
- README + architecture.md spiegeln den neuen One-Command-Weg.
