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
(`docker buildx`) und nach Docker Hub gepusht; der VPS pullt die Images.
**Ausstehend:** der erste echte VPS-Deploy aus dem Monorepo (user-gated).

## Lese-Reihenfolge bei Sessionstart

Lade die folgenden Dateien in dieser Reihenfolge — sie bauen aufeinander
auf:

1. [`README.md`](README.md) — Status, Bedienkonzept, Quick Reference
2. [`docs/spec.md`](docs/spec.md) — Anforderungen, Zielarchitektur, Sizing
3. [`docs/decisions.md`](docs/decisions.md) — **Wichtig**: alle ADRs mit
   Begründung. Bevor du etwas vorschlägst, das eine ADR berührt: prüfe,
   ob die ADR den Vorschlag schon adressiert.
4. [`docs/monorepo-plan.md`](docs/monorepo-plan.md) — **AKTIVER Plan**: Monorepo-Migration
   (ADR-015–018), Phasen 1–5. Das nächste große Werk.
5. [`docs/plan.md`](docs/plan.md) — historische Aufbau-Roadmap (Phasen 1–6 erledigt; Betrieb läuft).
6. [`docs/operations.md`](docs/operations.md) — Daily Ops mit dem Tool,
   Recovery-Pfade.

Nur wenn du Code änderst:
- [`scripts/vereinsheim`](scripts/vereinsheim) — das CLI (~900 Zeilen,
  klar nach Sections gegliedert)
- [`compose.yml`](compose.yml), [`Caddyfile`](Caddyfile),
  [`db-init/01-users-and-dbs.sh`](db-init/01-users-and-dbs.sh)

## Harness, Skills & Knowledge (ADR-016/017/018)

Eine geteilte Agent-Harness am Root — **ein Satz für beide Apps**:

- **Skills** (`.claude/skills/`, via `/<name>` oder modellgetriggert): `check`, `test`, `migrate`,
  `db-reset`, `seed`, `commit-msg`, `cleanup-todos`, `consolidate-lessons` (Lessons-Triage
  ENFORCE > DOCUMENT > REMEMBER → Memory-Graph, ADR-017) sowie der PIV-Workflow
  `plan → implement → validate → review` (Handoff über `plans/` + `reports/`).
- **Hooks** (`.claude/settings.json` + `.claude/hooks/`): **Stop-Gate** blockt das Turn-Ende, bis
  `pnpm check` grün ist; **PostToolUse-Lint** (eslint auf die editierte App-Datei); **PreToolUse-
  Security-Guard** (verweigert echte `.env`/`.vereinsheim.local` + katastrophale `rm -rf`). Greifen ab
  dem nächsten Claude-Code-Reload.
- **Sub-Agent** `code-reviewer` (`.claude/agents/`) — von `/review` gegen den Branch-Diff delegiert.
- **Knowledge-Graph** (`.mcp.json`): **CodeGraph-MCP** (Live-Symbol-/Call-Graph/Routen,
  `codegraph_explore` — Ground Truth, on-demand statt grep) + **Memory-MCP** (Cross-Session-Gedächtnis,
  Store `.claude/knowledge-graph.json`, aus ADRs/Konventionen geseedet).
- **CLAUDE.md-Hierarchie:** diese Datei = universelle Schicht; je App `apps/<app>/CLAUDE.md` +
  `apps/<app>/docs/` (Claude lädt die nächstgelegene on-demand). Karte + Konventionen werden mitgeladen:

@docs/architecture.md
@docs/shared-conventions.md

## Hard Rules (übergeordnet)

Diese gelten zusätzlich zu denen aus
`/Users/christian/.claude/CLAUDE.md` und den App-Repos:

1. **Sprache**: User-Kommunikation auf **Deutsch**, Code/Commit-Messages
   auf **Englisch**, Doku auf Deutsch.
2. **Feature-Branches Pflicht**: jede Änderung auf `feat/<topic>`,
   ff-only-Merge nach `main` nur mit User-OK.
3. **Keine `Co-Authored-By`-Trailer** in Commit-Messages.
4. **Commit-Message als fenced code block** vor dem Commit anzeigen.
5. **Niemals Secrets committen**. `.env` und `.vereinsheim.local` sind
   gitignored.
6. **ADRs respektieren**: wenn ein Vorschlag einer ADR widerspricht, das
   im User-Gespräch explizit benennen ("ADR-X sagt, dass wir Y verworfen
   haben — willst du das wieder aufmachen?"), bevor du es umsetzt.

## Bedienkonzept (kurz)

Ein Tool, zwei Modi. Erkennung: ist `.vereinsheim.local` da?

| Mode  | Trigger                         | Subcommands                              |
| ----- | ------------------------------- | ---------------------------------------- |
| Lokal | `.vereinsheim.local` existiert  | local-setup, build, release, ssh, remote |
| VPS   | Default                         | setup, deploy, backup, restore, migrations, status, cron, psql, logs, shell, env-check, up/down/restart |

Aufruf: `./scripts/vereinsheim` (Menü) oder `./scripts/vereinsheim <subcmd>`.
Volle Liste: `./scripts/vereinsheim help`.

## Was wahrscheinlich als nächstes gefragt wird

Die ursprüngliche Aufbau-Roadmap ([`docs/plan.md`](docs/plan.md)) ist abgeschlossen; das System läuft
seit Ende Mai 2026 produktiv. **Das aktive Großvorhaben ist die Monorepo-Migration**
([`docs/monorepo-plan.md`](docs/monorepo-plan.md), ADR-015–018): treffsicher + ringwerk als `apps/*`
(pnpm/Turborepo, `turbo prune --docker`), inkl. geteilter `packages/*`, Knowledge-Graph (CodeGraph +
CLAUDE.md-Hierarchie + Memory-MCP) und Harness (Hooks/PIV).

**Phasen 1 + 3 sind erledigt**: Phase 1 = Apps via `git filter-repo` nach `apps/*` (History erhalten),
pnpm-Workspace + Turborepo + Catalog, geteilter Dev-Postgres. Phase 3 = Produktions-Build aus dem
Monorepo via `turbo prune` (Deploy-Vertrag bit-gleich, lokal voll verifiziert). Alle 5 Gates grün.
**Nächster Schritt: Phase 2** — `packages/config` (Konfig-Duplikate weg) + die Knowledge-/Harness-Schichten
(ADR-016/017/018); danach Phase 4 (`packages/ui`, Drift-Gate entfällt). Schlüsselentscheidungen &
Scope-Grenzen: [`docs/monorepo-plan.md`](docs/monorepo-plan.md) §8 (Umsetzungsnotizen Phase 1 + 3).

Weitere Folgearbeiten (nicht im aktuellen Scope): Off-Site-Backup, CI/Remote-Cache (Phase 5, supersedet
ADR-006).

## Wenn du etwas änderst

- **Skripte**: nach jeder Änderung `bash -n <skript>` für Syntax-Check;
  bei `compose.yml` zusätzlich `docker compose --env-file <test-env>
  config --quiet`; bei `Caddyfile` zusätzlich `docker run --rm -v
  $PWD/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2-alpine caddy validate
  --adapter caddyfile --config /etc/caddy/Caddyfile`. Validation-Befehle
  haben in dieser Session bereits funktioniert.
- **Doku**: wenn du eine ADR superseded oder neu hinzufügst → `decisions.md`
  als kanonische Quelle aktualisieren, nicht nur an einer Stelle ändern.
- **CLI**: das Tool wrappt die per-Task-Skripte, dupliziert sie nicht.
  Neue Subcommands sollten dem gleichen Muster folgen (Validate Pre-
  Bedingungen → Confirm → existing script aufrufen).

## Branch-Status (zum Zeitpunkt dieses Stands)

Aktiver Branch: `main`. Monorepo-Phasen 1 + 3 sind nach `main` gemerged
(lineare History), aber **`main` ist noch nicht nach `origin` gepusht** — der
VPS läuft weiter mit den alten Images (`origin/main` unverändert). Erster Push +
Deploy aus dem Monorepo stehen noch aus (user-gated). Neue Änderungen laufen
weiterhin über Feature-Branches (`feat/<topic>`) mit ff-only-Merge nach `main`
nach User-OK.

Verweis auf den ursprünglichen Plan-File:
`/Users/christian/.claude/plans/noch-eine-berlegung-ich-frolicking-dahl.md`
(historischer Kontext; alles relevante daraus ist nach `docs/spec.md`
und `docs/decisions.md` migriert).
