# vereinsheim — Agent Handoff

> Diese Datei richtet sich an einen KI-Coding-Agenten (z.B. Claude Code),
> der in einer Folgesession an diesem Repo weiterarbeitet. Sie ist die
> kürzeste Möglichkeit, einen produktiven Stand zu erreichen.

## Was dieses Repo ist

Production-Deployment für **zwei Next.js-Apps** (Ringwerk = Liga, 
Treffsicher = Training) auf einem einzelnen VPS, mit geteiltem 
Postgres-Container, Caddy als Reverse Proxy und einem einheitlichen 
Operations-CLI.

Seit **Monorepo-Phase 1** liegt der App-Code hier: [`apps/ringwerk`](apps/ringwerk)
und [`apps/treffsicher`](apps/treffsicher) (via `git filter-repo` integriert,
History erhalten; pnpm + Turborepo, Catalog für geteilte Versionen). Dev läuft
auf dem Host: `docker compose -f docker-compose.dev.yml up -d` + `pnpm dev`.

Seit **Phase 3** baut `vereinsheim build` **aus dem Monorepo** (`turbo prune`,
Root-`Dockerfile`) — Image-Namen/Tags + `compose.yml` unverändert, lokal voll
verifiziert. Die Standalone-Repos [`../ringwerk`](../ringwerk) /
[`../treffsicher`](../treffsicher) sind **keine Build-Quelle mehr** (History via
Tag `pre-monorepo-import` archiviert). Beide Apps werden weiter lokal gebaut
(`docker buildx`) und nach Docker Hub gepusht; der VPS pullt die Images. Der
erste Monorepo-Deploy auf den VPS ist **gelaufen** (Juni 2026).

## Lese-Reihenfolge bei Sessionstart

Primärer Einstieg ist der **Memory-Graph** (der Vault, ADR-025): `mcp__memory__search_nodes`
mit einer natürlichsprachlichen Frage (der SessionStart-Hook surface't ihn). Für sequenzielles
Onboarding in dieser Reihenfolge:

1. [`README.md`](README.md) — Status, Bedienkonzept, Quick Reference
2. [`vault/overview.md`](vault/overview.md) — Anforderungen, Zielarchitektur, Sizing
3. [`vault/decisions/`](vault/decisions) — **Wichtig**: alle ADRs (adr-001…adr-025) mit
   Begründung ([`decisions.md`](vault/decisions/decisions.md) als MOC). Bevor du etwas
   vorschlägst, das eine ADR berührt: prüfe, ob die ADR den Vorschlag schon adressiert.
4. [`vault/monorepo/monorepo.md`](vault/monorepo/monorepo.md) — Monorepo-Migration
   (ADR-015–018), Phasen 1–5.
5. [`vault/operations/operations.md`](vault/operations/operations.md) — Daily Ops mit dem
   Tool, Recovery-Pfade.

Nur wenn du Code änderst:
- [`scripts/vereinsheim`](scripts/vereinsheim) — das CLI (~900 Zeilen,
  klar nach Sections gegliedert)
- [`compose.yml`](compose.yml), [`Caddyfile`](Caddyfile),
  [`db-init/01-users-and-dbs.sh`](db-init/01-users-and-dbs.sh)

## Harness, Skills & Knowledge (ADR-016/017/018/023/025)

Eine geteilte Agent-Harness am Root — **ein Satz für beide Apps**:

- **Skills** (`.claude/skills/`, via `/<name>` oder modellgetriggert): `check`, `test`, `migrate`,
  `db-reset`, `seed`, `commit-msg`, `cleanup-todos`, `consolidate-lessons` (Lessons-Triage
  ENFORCE > DOCUMENT > REMEMBER, ADR-017; REMEMBER → `vault/incidents/`-Note, ADR-025), `sync-graph`
  (Vault validieren/aufräumen: `vault-lint` + Cross-Refs, ADR-025), `ingest` (externe Quellen →
  zitierte Vault-Notes) sowie der PIV-Workflow `plan → implement → validate → review` + `debug`
  (Root-Cause; Handoff über `plans/` + `reports/`). **`/implement` läuft autonom-by-default** über den
  freigegebenen Plan (task-by-task, Circuit-Breaker, Ledger; **ADR-023**) — die Plan-Freigabe ist die
  einzige Opt-in-Grenze, Merge bleibt user-gated.
- **Hooks** (`.claude/settings.json` + `.claude/hooks/`, Composite-Dispatcher `pretool.mjs`/`stop.mjs`):
  **Stop-Gate** blockt das Turn-Ende, bis `pnpm check` grün ist; **Stop-Graph-Sync** (`graph-sync.mjs`,
  ADR-025) validiert am Turn-Ende den Vault via `vault-lint.mjs` und **blockt** bei invalidem Vault
  (Schema/Anker/`keywords`); **PostToolUse-Lint** (eslint auf die editierte App-Datei);
  **PreToolUse-Security-Guard** (verweigert echte `.env`/`.vereinsheim.local` + katastrophale `rm -rf`;
  **nudged** einmalig pro Session Richtung CodeGraph bei `grep`/`find`); **Autopilot-Guard** (ADR-023, nur
  aktiv bei Marker `.claude/.autopilot-active`) verweigert im autonomen `/implement` geschützte Pfade
  (Deploy-Vertrag, Schema/Migrationen, ADR-Kanon `vault/decisions/`, Secrets, `.claude/`, `scripts/`) +
  push/merge/deploy/migrate. Greifen ab dem nächsten Claude-Code-Reload.
- **Sub-Agent** `code-reviewer` (`.claude/agents/`) — von `/review` gegen den Branch-Diff delegiert.
- **Knowledge-Graph** (`.mcp.json`): **CodeGraph-MCP** (Live-Symbol-/Call-Graph/Routen,
  `codegraph_explore` — Ground Truth über den Code, on-demand statt grep) + **Memory-MCP = der Vault**
  (**ADR-025**): der `vault/` aus Markdown-Notes **ist** der Graph — **kein Build-Schritt, kein Store**
  (löste den gebauten Doku-Index aus ADR-022 ab). `vault-loader.mjs` liest die Notes direkt; jede Note =
  eine Entity (Dateiname = id), flache typisierte Frontmatter-Kanten (`part_of`/`governed_by`/
  `documented_in`/…) = die Edges; Ordner = Topic mit MOC-Hub. ABFRAGEN vor breitem Explorieren:
  `mcp__memory__search_nodes` (natürlichsprachlich, DE/EN, BM25 — die Notes sind deutsch, eine deutsche
  Frage rankt am besten) → `document_map` → `section_read`; `open_nodes`/`backlinks`/`traverse` für den
  Graph. SessionStart-Hook `memory-surface.mjs` surface't den Vault. Schreiben: die **Note direkt
  editieren/anlegen** (live, kein Rebuild; Frontmatter gemäß `vault/SCHEMA.md`, kuratierte `keywords:`),
  via `/sync-graph` bzw. `/consolidate-lessons` gepflegt. Der `vault/` ist zugleich ein browsebarer
  Obsidian-Vault (Format-Eigenschaft, keine Laufzeit-Abhängigkeit). Abgrenzung zum nativen Auto-Memory:
  projekt-/via-git-geteiltes → Vault; maschinen-/ops-lokales → Auto-Memory.
- **CLAUDE.md-Hierarchie:** diese Datei = universelle Schicht; je App `apps/<app>/CLAUDE.md`
  (Claude lädt die nächstgelegene on-demand). Das **Doku-Wissen** (früher `apps/<app>/docs/`) liegt seit
  ADR-025 zentral im Vault (`vault/apps/<app>/…`) und wird via Memory-MCP gesucht statt per `@import`
  geladen. Karte + Konventionen werden mitgeladen:

@vault/architecture/architecture.md
@vault/conventions.md

## Hard Rules (übergeordnet)

Diese gelten zusätzlich zu denen aus
`/Users/christian/.claude/CLAUDE.md` und den App-Repos:

1. **Sprache**: User-Kommunikation auf **Deutsch**, Code/Commit-Messages
   auf **Englisch**, Doku auf Deutsch.
2. **Feature-Branches Pflicht**: jede Änderung auf `feat/<topic>`,
   ff-only-Merge nach `main` nur mit User-OK.
3. **Keine `Co-Authored-By`-Trailer** in Commit-Messages.
4. **Commit-Message als fenced code block** vor dem Commit anzeigen.
   _Ausnahme: im autonomen `/implement` (ADR-023) entfällt das — die Messages
   stehen im Ledger + `git log`, vor dem Merge revidierbar._
5. **Niemals Secrets committen**. `.env` und `.vereinsheim.local` sind
   gitignored.
6. **ADRs respektieren**: wenn ein Vorschlag einer ADR widerspricht, das
   im User-Gespräch explizit benennen ("ADR-X sagt, dass wir Y verworfen
   haben — willst du das wieder aufmachen?"), bevor du es umsetzt.
7. **PIV ist der Default-Workflow** (nicht pro Prompt mitzugeben): jede
   nicht-triviale Änderung läuft `/plan → /implement → /validate → /review`
   (Handoff über `plans/` + `reports/`); den Plan vor der ersten Code-Zeile
   dem User vorlegen. Nach der Freigabe läuft `/implement` **autonom** durch
   (ADR-023) und holt den User nur an Circuit-Breakern + am Merge zurück. Bugs
   zuerst über `/debug` (Root-Cause). Triviale/mechanische Fixes (Typo,
   One-Liner, reine Doku) dürfen direkt erfolgen.

## Bedienkonzept (kurz)

Ein Tool, zwei Modi. Erkennung: ist `.vereinsheim.local` da?

| Mode  | Trigger                         | Subcommands                              |
| ----- | ------------------------------- | ---------------------------------------- |
| Lokal | `.vereinsheim.local` existiert  | local-setup, build, release, ssh, remote |
| VPS   | Default                         | setup, deploy, backup, restore, migrations, status, cron, psql, logs, shell, env-check, up/down/restart |

Aufruf: `./scripts/vereinsheim` (Menü) oder `./scripts/vereinsheim <subcmd>`.
Volle Liste: `./scripts/vereinsheim help`.

## Was wahrscheinlich als nächstes gefragt wird

Die ursprüngliche Aufbau-Roadmap ist abgeschlossen; das System läuft
seit Ende Mai 2026 produktiv. **Das aktive Großvorhaben ist die Monorepo-Migration**
([`vault/monorepo/monorepo.md`](vault/monorepo/monorepo.md), ADR-015–018): treffsicher + ringwerk als `apps/*`
(pnpm/Turborepo, `turbo prune --docker`), inkl. geteilter `packages/*`, Knowledge-Graph (CodeGraph +
CLAUDE.md-Hierarchie + Memory-MCP) und Harness (Hooks/PIV).

**Phasen 1–4 sind erledigt**: Phase 1 = Apps via `git filter-repo` nach `apps/*` (History erhalten),
pnpm-Workspace + Turborepo + Catalog, geteilter Dev-Postgres. Phase 2 = Harness/Knowledge (ADR-016/017/
018/019) + `packages/config` (tsconfig/eslint/prettier/postcss/next.config als `@vereinsheim/config`,
Konfig-Duplikate weg). Phase 3 = Produktions-Build aus dem Monorepo via `turbo prune` (Deploy-Vertrag
bit-gleich, lokal voll verifiziert, auf VPS deployed). Phase 4 = `packages/lib` (Zyklus 1) + `packages/ui`
(Zyklus 2) echt geteilt (inkl. `theme.css`/`globals.css`) → Drift-Gate auf triviale Next/shadcn-Reste
geschrumpft. Alle 5 Gates grün.
**Offen nur Phase 5** (optional) — CI (GitHub Actions) + Turbo-Remote-Cache (supersedet ADR-006).
Schlüsselentscheidungen & Scope-Grenzen: [`vault/monorepo/monorepo.md`](vault/monorepo/monorepo.md) §8
(Umsetzungsnotizen Phase 1–4).

Weitere Folgearbeiten (nicht im aktuellen Scope): Off-Site-Backup, CI/Remote-Cache (Phase 5, supersedet
ADR-006).

## Wenn du etwas änderst

- **Skripte**: nach jeder Änderung `bash -n <skript>` für Syntax-Check;
  bei `compose.yml` zusätzlich `docker compose --env-file <test-env>
  config --quiet`; bei `Caddyfile` zusätzlich `docker run --rm -v
  $PWD/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2-alpine caddy validate
  --adapter caddyfile --config /etc/caddy/Caddyfile`. Validation-Befehle
  haben in dieser Session bereits funktioniert.
- **Doku/ADRs**: wenn du eine ADR superseded oder neu hinzufügst → eine Note unter
  `vault/decisions/adr-NNN.md` anlegen/ändern (Status + `supersedes`/`superseded_by`/`refines`-
  Kanten) und `vault/decisions/decisions.md` (MOC) + `vault/index.md` nachziehen; kein Store-Rebuild
  (ADR-025). Sonstiges Wissen: die passende Vault-Note editieren, dann `/sync-graph`.
- **CLI**: das Tool wrappt die per-Task-Skripte, dupliziert sie nicht.
  Neue Subcommands sollten dem gleichen Muster folgen (Validate Pre-
  Bedingungen → Confirm → existing script aufrufen).

## Branch-Status (zum Zeitpunkt dieses Stands)

Aktiver Branch: `main`. Monorepo-Phasen 1 + 2 + 3 sind nach `main` gemerged
(lineare History). Der **Monorepo-Build ist auf den VPS deployed** (Juni 2026,
über Docker Hub) — der Deploy-Pfad läuft über Image-Push/-Pull (lokaler Build →
Docker Hub → VPS pullt), **nicht** über Git. Offen ist nur der **`git push origin
main`** (Code-Backup nach GitHub, ~28 Commits voraus, deploy-irrelevant; user-gated).
Neue Änderungen laufen weiterhin über Feature-Branches (`feat/<topic>`) mit
ff-only-Merge nach `main` nach User-OK.

Verweis auf den ursprünglichen Plan-File:
`/Users/christian/.claude/plans/noch-eine-berlegung-ich-frolicking-dahl.md`
(historischer Kontext; alles relevante daraus ist nach `vault/overview.md`
und `vault/decisions/` migriert).
