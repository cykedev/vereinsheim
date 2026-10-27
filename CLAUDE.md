# vereinsheim — Agent Handoff

> Diese Datei richtet sich an einen KI-Coding-Agenten (z.B. Claude Code), der an diesem Repo arbeitet. Sie ist die
> kürzeste Möglichkeit, einen produktiven Stand zu erreichen.

## Was dieses Repo ist

Monorepo (pnpm + Turborepo, Catalog für geteilte Versionen) mit **drei Next.js-Apps** und ihrem Produktions-Deployment
auf einem einzelnen VPS:

- [`apps/ringwerk`](apps/ringwerk) — Liga und Wettkämpfe (:3000)
- [`apps/treffsicher`](apps/treffsicher) — Trainingstagebuch (:3001)
- [`apps/spiegel`](apps/spiegel) — Schussrohdaten aus der Meyton-Anlage (:3002), gefüttert von der Brücke
  [`apps/spiegel-bridge`](apps/spiegel-bridge) (Go, läuft im Schützenhaus)

Geteilter Code liegt in `packages/*`. Produktion: lokal gebaute Images (`turbo prune`, Root-`Dockerfile`) → Docker Hub
→ der VPS pullt; `compose.yml` mit Caddy, einem Postgres (eine DB und ein Owner je App) und je App einem Migrator vor
dem App-Container. Bedient wird alles über das Ops-CLI `scripts/vereinsheim`.

Dev auf dem Host: `./scripts/vereinsheim dev-setup` (einmalig, idempotent), dann `pnpm dev`. Dev-Postgres aus
`docker-compose.dev.yml`. Go ≥ 1.24 ist Pflicht, das Gate prüft auch die Brücke.

## Lese-Reihenfolge bei Sessionstart

Primärer Einstieg ist der **Memory-Graph** (der Vault, ADR-025): `mcp__memory__search_nodes` mit einer
natürlichsprachlichen Frage (der SessionStart-Hook surface't ihn). Für sequenzielles Onboarding:

1. [`README.md`](README.md) — die Apps, Einrichtung, Deploy in Kürze
2. [`vault/overview.md`](vault/overview.md) — Anforderungen, Zielarchitektur, Sizing
3. [`vault/decisions/`](vault/decisions) — **Wichtig**: alle ADRs mit Begründung
   ([`decisions.md`](vault/decisions/decisions.md) als MOC). Bevor du etwas vorschlägst, das eine ADR berührt: prüfe, ob
   die ADR den Vorschlag schon adressiert.
4. [`vault/operations/operations.md`](vault/operations/operations.md) — Betrieb mit dem CLI, Recovery-Pfade.
5. Für Spiegel: [`vault/spiegel/spiegel.md`](vault/spiegel/spiegel.md) (Lesereihenfolge) und
   [`vault/spiegel/spiegel-roadmap.md`](vault/spiegel/spiegel-roadmap.md) (Features `SP-x.y` mit Status).

Nur wenn du Code änderst:
- [`scripts/vereinsheim`](scripts/vereinsheim) — das CLI, nach Sections gegliedert; die Apps stehen einmal in
  `scripts/lib/apps.sh`
- [`compose.yml`](compose.yml), [`Caddyfile`](Caddyfile), [`db-init/01-users-and-dbs.sh`](db-init/01-users-and-dbs.sh)

## Harness, Skills & Knowledge (ADR-016/017/018/023/025/035)

Eine geteilte Agent-Harness am Root — **ein Satz für alle Apps**:

- **Skills** (`.claude/skills/`, via `/<name>` oder modellgetriggert): `check`, `test`, `migrate`, `db-reset`, `seed`,
  `commit-msg`, `consolidate-lessons` (Lessons-Triage ENFORCE > DOCUMENT > REMEMBER, ADR-017; REMEMBER →
  `vault/incidents/`-Note), `sync-graph` (Vault validieren/aufräumen: `vault-lint` + Cross-Refs), `ingest` (externe
  Quellen → zitierte Vault-Notes) sowie der PIV-Workflow `plan → implement → validate → review` + `debug` (Root-Cause;
  Handoff über `plans/` + `reports/`). **`/implement` läuft autonom-by-default** über den freigegebenen Plan
  (task-by-task, Circuit-Breaker, Ledger; **ADR-023**) — die Plan-Freigabe ist die einzige Opt-in-Grenze, Merge bleibt
  user-gated. **`coordinate`** ist die Ebene darüber (**ADR-035**): eine koordinierende Session im Haupt-Checkout
  plant die Teile eines Vorhabens, führt den Koordinationsplan als Ledger und übernimmt die Branches der
  Kindsessions, die je einen Teilplan in einem eigenen Worktree umsetzen.
- **`plans/`** enthält nur offene Pläne. Ist ein Plan umgesetzt, wird er gelöscht; was davon dauerhaft gilt, steht im
  Vault. `reports/` ist lokal (gitignored).
- **Hooks** (`.claude/settings.json` + `.claude/hooks/`, Composite-Dispatcher `pretool.mjs`/`stop.mjs`): **Stop-Gate**
  blockt das Turn-Ende, bis `pnpm check` grün ist; **Stop-Graph-Sync** (`graph-sync.mjs`) validiert am Turn-Ende den
  Vault via `vault-lint.mjs` und **blockt** bei invalidem Vault (Schema/Anker/`keywords`); **PostToolUse-Lint** (eslint
  auf die editierte App- oder Paket-Datei); **PreToolUse-Security-Guard** (verweigert echte `.env`/`.vereinsheim.local`
  + katastrophale `rm -rf`; **nudged** einmalig pro Session Richtung CodeGraph bei `grep`/`find`); **Autopilot-Guard**
  (ADR-023, nur aktiv bei Marker `.claude/.autopilot-active`) verweigert im autonomen `/implement` geschützte Pfade
  (Deploy-Vertrag, Schema/Migrationen, ADR-Kanon `vault/decisions/`, Secrets, `.claude/`, `scripts/`) +
  push/merge/deploy/migrate.
- **Sub-Agent** `code-reviewer` (`.claude/agents/`) — von `/review` gegen den Branch-Diff delegiert.
- **Knowledge-Graph** (`.mcp.json`): **CodeGraph-MCP** (Live-Symbol-/Call-Graph/Routen, `codegraph_explore` — Ground
  Truth über den Code, on-demand statt grep) + **Memory-MCP = der Vault** (**ADR-025**): der `vault/` aus
  Markdown-Notes **ist** der Graph — **kein Build-Schritt, kein Store**. `vault-loader.mjs` liest die Notes direkt;
  jede Note = eine Entity (Dateiname = id), flache typisierte Frontmatter-Kanten (`part_of`/`governed_by`/
  `documented_in`/…) = die Edges; Ordner = Topic mit MOC-Hub. ABFRAGEN vor breitem Explorieren:
  `mcp__memory__search_nodes` (natürlichsprachlich, DE/EN, BM25 — die Notes sind deutsch, eine deutsche Frage rankt am
  besten) → `document_map` → `section_read`; `open_nodes`/`backlinks`/`traverse` für den Graph. Schreiben: die **Note
  direkt editieren/anlegen** (live; Frontmatter gemäß `vault/SCHEMA.md`, kuratierte `keywords:`), via `/sync-graph`
  bzw. `/consolidate-lessons` gepflegt. Der `vault/` ist zugleich ein browsebarer Obsidian-Vault (Format-Eigenschaft,
  keine Laufzeit-Abhängigkeit). Abgrenzung zum nativen Auto-Memory: projekt-/via-git-geteiltes → Vault;
  maschinen-/ops-lokales → Auto-Memory.
- **CLAUDE.md-Hierarchie:** diese Datei = universelle Schicht; je App und Paket eine eigene `CLAUDE.md` (Claude lädt
  die nächstgelegene on-demand). Das Doku-Wissen liegt zentral im Vault (`vault/apps/<app>/…`, `vault/spiegel/…`) und
  wird via Memory-MCP gesucht. Karte + Konventionen werden mitgeladen:

@vault/architecture/architecture.md
@vault/conventions.md

## Hard Rules (übergeordnet)

Diese gelten zusätzlich zu denen aus `/Users/christian/.claude/CLAUDE.md`:

1. **Sprache**: User-Kommunikation auf **Deutsch**, Code/Commit-Messages auf **Englisch**, Doku auf Deutsch.
2. **Feature-Branches Pflicht**: jede Änderung auf `feat/<topic>`, ff-only-Merge nach `main` nur mit User-OK.
3. **Keine `Co-Authored-By`-Trailer** in Commit-Messages.
4. **Commit-Message als fenced code block** vor dem Commit anzeigen.
   _Ausnahme: im autonomen `/implement` (ADR-023) entfällt das — die Messages stehen im Ledger + `git log`, vor dem
   Merge revidierbar._
5. **Niemals Secrets oder Personendaten committen**. `.env` und `.vereinsheim.local` sind gitignored; keine echten
   Namen, Sportpassnummern oder Schussdaten von Personen in Code, Tests oder Doku (ADR-029).
6. **ADRs respektieren**: wenn ein Vorschlag einer ADR widerspricht, das im User-Gespräch explizit benennen ("ADR-X
   sagt, dass wir Y verworfen haben — willst du das wieder aufmachen?"), bevor du es umsetzt.
7. **PIV ist der Default-Workflow** (nicht pro Prompt mitzugeben): jede nicht-triviale Änderung läuft
   `/plan → /implement → /validate → /review` (Handoff über `plans/` + `reports/`); den Plan vor der ersten Code-Zeile
   dem User vorlegen. Nach der Freigabe läuft `/implement` **autonom** durch (ADR-023) und holt den User nur an
   Circuit-Breakern + am Merge zurück. Ein Vorhaben aus mehreren Teilplänen läuft koordiniert: eine koordinierende
   Session, je Teilplan eine Kindsession im eigenen Worktree (`/coordinate`, ADR-035). Bugs zuerst über `/debug`
   (Root-Cause). Triviale/mechanische Fixes (Typo, One-Liner, reine Doku) dürfen direkt erfolgen.
8. **Kommentare beschreiben den Code, nicht seine Geschichte**: was er tut und warum. Keine Verweise auf Pläne, Tasks,
   Reviews oder Feedback-Runden, kein „früher …, jetzt …“. ADR-Verweise, `[[vault-links]]`, Sonderfall-IDs (`SF-NN`)
   und Kennzahl-IDs aus dem Statistik-Katalog sind erlaubt.

## Bedienkonzept (kurz)

Ein Tool, zwei Modi. Erkennung: ist `.vereinsheim.local` da?

| Mode  | Trigger                        | Subcommands                                                                                                   |
| ----- | ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Lokal | `.vereinsheim.local` existiert | dev-setup, local-setup, build, release, ssh, remote, upload, download, local-build/-pull/-up/-down, dev-restore |
| VPS   | Default                        | setup, deploy, rollback, backup, restore, restore-probe, db-ensure, migrations, status, cron, psql, logs, shell, env-check, up/down/restart |

Aufruf: `./scripts/vereinsheim` (Menü) oder `./scripts/vereinsheim <subcmd>`. Volle Liste: `./scripts/vereinsheim help`.

## Woran gearbeitet wird

- **Spiegel** wird Feature für Feature nach [`vault/spiegel/spiegel-roadmap.md`](vault/spiegel/spiegel-roadmap.md)
  gebaut (ein Feature pro Session, je über `/plan`); Entscheidungen ADR-026–031, Meyton-Wissen unter
  [`vault/meyton/`](vault/meyton). Offene Einzelpunkte stehen am Ende der Roadmap.
- **Offen, optional:** CI (GitHub Actions) + Turbo-Remote-Cache (würde ADR-006 ablösen,
  [`vault/monorepo/monorepo.md`](vault/monorepo/monorepo.md)), Off-Site-Backup
  ([`off-site-backup-gap`](vault/operations/off-site-backup-gap.md)), ein schnellerer Release-Build
  ([`plans/2026-07-15-faster-release-build.md`](plans/2026-07-15-faster-release-build.md), Teile C und D).

## Wenn du etwas änderst

- **Skripte**: nach jeder Änderung `bash -n <skript>` für Syntax-Check; bei `compose.yml` zusätzlich
  `docker compose --env-file <test-env> config --quiet`; bei `Caddyfile` zusätzlich `docker run --rm -v
  $PWD/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2-alpine caddy validate --adapter caddyfile --config
  /etc/caddy/Caddyfile`. Den ganzen Stack mit den echten Images prüft `tools/stack-e2e/run.sh`.
- **Neue App im Stack**: in `scripts/lib/apps.sh`, `compose.yml`, `Caddyfile`, `.env.example` und `db-init/`
  eintragen; auf einem laufenden VPS legt `vereinsheim db-ensure` die Datenbank an.
- **Doku/ADRs**: wenn du eine ADR superseded oder neu hinzufügst → eine Note unter `vault/decisions/adr-NNN.md`
  anlegen/ändern (Status + `supersedes`/`superseded_by`/`refines`-Kanten) und `vault/decisions/decisions.md` (MOC) +
  `vault/index.md` nachziehen. Sonstiges Wissen: die passende Vault-Note editieren, dann `/sync-graph`.
- **CLI**: das Tool wrappt die per-Task-Skripte, dupliziert sie nicht. Neue Subcommands folgen dem gleichen Muster
  (Validate Pre-Bedingungen → Confirm → existing script aufrufen).
- **Deploy** läuft über Image-Push/-Pull, nicht über Git: `vereinsheim release` von der lokalen Maschine.
