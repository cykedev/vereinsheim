# vereinsheim — Agent Handoff

> Diese Datei richtet sich an einen KI-Coding-Agenten (z.B. Claude Code),
> der in einer Folgesession an diesem Repo weiterarbeitet. Sie ist die
> kürzeste Möglichkeit, einen produktiven Stand zu erreichen.

## Was dieses Repo ist

Production-Deployment für **zwei Next.js-Apps** (Ringwerk = Liga, 
Treffsicher = Training) auf einem einzelnen VPS, mit geteiltem 
Postgres-Container, Caddy als Reverse Proxy und einem einheitlichen 
Operations-CLI.

Die App-Source liegt **nicht** hier — sondern in:
- `../ringwerk`
- `../treffsicher`

Beide Apps werden lokal gebaut (`docker buildx`) und nach Docker Hub
gepusht. Der VPS pullt die Images.

## Lese-Reihenfolge bei Sessionstart

Lade die folgenden Dateien in dieser Reihenfolge — sie bauen aufeinander
auf:

1. [`README.md`](README.md) — Status, Bedienkonzept, Quick Reference
2. [`docs/spec.md`](docs/spec.md) — Anforderungen, Zielarchitektur, Sizing
3. [`docs/decisions.md`](docs/decisions.md) — **Wichtig**: alle ADRs mit
   Begründung. Bevor du etwas vorschlägst, das eine ADR berührt: prüfe,
   ob die ADR den Vorschlag schon adressiert.
4. [`docs/plan.md`](docs/plan.md) — Roadmap: was ist erledigt, was kommt
   als nächstes.
5. [`docs/operations.md`](docs/operations.md) — Daily Ops mit dem Tool,
   Recovery-Pfade.

Nur wenn du Code änderst:
- [`scripts/vereinsheim`](scripts/vereinsheim) — das CLI (~900 Zeilen,
  klar nach Sections gegliedert)
- [`compose.yml`](compose.yml), [`Caddyfile`](Caddyfile),
  [`db-init/01-users-and-dbs.sh`](db-init/01-users-and-dbs.sh)

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

Verbleibende Roadmap: siehe [`docs/plan.md`](docs/plan.md). Aktuell
offen sind Phase 5 (VPS-Provisioning) und Phase 6 (Cutover).

Plausible Folgearbeiten (alle *nicht* im aktuellen Scope):

- `vereinsheim rollback` als eigener Subcommand (heute manuell via
  `setup` → einzelne Werte ändern + `deploy`).
- Off-Site-Backup-Subcommand (`vereinsheim backup-offsite`).
- CI-Migration → GitHub Actions, würde ADR-006 supersden.

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

Aktiver Branch: `feat/vereinsheim-bootstrap` mit 4-5 Commits seit `main`.
Inhaltlich: alles aus Phasen 1-3 inklusive dieser
Konsolidierungs-/Doku-Welle. Bereit für ff-Merge nach `main`, sobald der
User OK gibt.

Verweis auf den ursprünglichen Plan-File:
`/Users/christian/.claude/plans/noch-eine-berlegung-ich-frolicking-dahl.md`
(historischer Kontext; alles relevante daraus ist nach `docs/spec.md`
und `docs/decisions.md` migriert).
