# Validierung: Lokaler Dev-Bootstrap

> PIV-Schritt 3. Branch `feat/dev-bootstrap` (Worktree `.claude/worktrees/dev-bootstrap`).
> Plan: [plans/2026-06-23-dev-bootstrap.md](../plans/2026-06-23-dev-bootstrap.md).
> Alle Belege stammen aus dem Validierungslauf vom 23.06.2026 (diese Session).

## Umfang

5 Commits auf dem Branch: Plan + 4 Tasks (`.nvmrc`, `scripts/bootstrap-dev.sh`,
`vereinsheim dev-setup`-Wrapper, Doku README + architecture.md).

## Gates

`pnpm check` (lint, format:check, test, check-types, build über alle Workspaces):

```
 Tasks:    17 successful, 17 total
Cached:    17 cached, 17 total
  Time:    1.277s >>> FULL TURBO
```

→ **17/17 grün.** Cache-Hit ist korrekt: die Änderung berührt nur `scripts/*`, `.nvmrc`
und `*.md` — keine Turbo-Task-Inputs. Der Cache stammt vom merge-ready `main`, von dem der
Branch abzweigt. (Konsequenz: die DB-Tests wurden gecacht, nicht neu ausgeführt — für eine
Non-Code-Änderung die richtige Aussage.)

## Syntax

```
✓ bash -n bootstrap-dev.sh grün
✓ bash -n vereinsheim grün
```

`shellcheck` ist auf dieser Maschine nicht installiert (im Plan als optional vorgesehen).

## Verhalten

### End-to-end-Lauf (frische Worktree-Umgebung, 1. Lauf) — EXIT=0

Alle 8 Schritte liefen durch: node v24.12.0 ✓, docker ✓, corepack/pnpm 10.33.0 ✓,
pnpm install ✓, codegraph 1.0.1 „bereits installiert" ✓, Index-Build im Hintergrund
gestartet (`.codegraph/` fehlte im frischen Worktree), Dev-Postgres recreated + bereit ✓,
`apps/{ringwerk,treffsicher}/.env` aus `.env.example` **angelegt** ✓, `prisma db push` für
beide → „already in sync" ✓.

Der Hintergrund-`codegraph init` hat sich **selbst beendet** (kein laufender Prozess danach,
`.codegraph/` vorhanden) — endlicher Batch-Job, kein Orphan; `nohup &` ist hier sicher.

### Idempotenz (2. Lauf + CLI-Wrapper-Lauf) — vollständig grün

```
✓ codegraph 1.0.1 bereits installiert
✓ codegraph-Index vorhanden (.codegraph/)
✓ apps/ringwerk/.env vorhanden — unverändert
✓ apps/treffsicher/.env vorhanden — unverändert
The database is already in sync with the Prisma schema.   (×2)
✓ Schema synchronisiert
Fertig. Die Workstation ist arbeitsfähig.
```

Vorhandene `.env` wird nicht überschrieben, kein Reinstall, kein erneuter Index-Build.

### CLI-Wrapper-Pfad

`./scripts/vereinsheim dev-setup` exec't `scripts/bootstrap-dev.sh` und läuft bis zur letzten
Skript-Zeile („Fertig. Die Workstation ist arbeitsfähig.") durch → Wrapper, Dispatch und
`require_local_config`-Bypass funktionieren.

### Verdrahtung (statisch verifiziert)

`cmd_dev_setup()` @258 · Lokal-Menü `d | D) cmd_dev_setup` @1466 · Dispatch
`dev-setup) cmd_dev_setup "$@"` @1615 · `./scripts/vereinsheim help` listet den Block
„── ENTWICKLUNGSUMGEBUNG" mit `dev-setup`.

## Offen / bewusste Grenzen

- **Fehlerpfade nicht laufzeit-getriggert**: die Abbrüche bei fehlendem/zu altem node bzw.
  fehlendem/nicht laufendem docker sind nur code-verifiziert (`bash -n` + Review), nicht zur
  Laufzeit ausgelöst — diese Maschine erfüllt die Vorbedingungen.
- **Worktree × docker compose**: Der Dev-DB-Container (`vereinsheim-dev`, geteilter
  project-name) wird beim Wechsel zwischen Worktree- und Haupt-Tree-Pfad „recreated"
  (unterschiedlicher `./dev/db-init`-bind-mount-Pfad). Inhärentes Worktree-Verhalten, kein
  Skript-Defekt; das Volume `postgres_dev_data` und damit die Daten bleiben erhalten.

## Verdict

**Merge-ready.** Gates grün, Verhalten end-to-end + idempotent + über den CLI-Wrapper
bestätigt. Nächster Schritt: `/review` (adversarial), dann ff-Merge nach `main` nach User-OK.
