# Review: Lokaler Dev-Bootstrap

> PIV-Schritt 4. Adversarialer Review (`code-reviewer`-Sub-Agent) von `feat/dev-bootstrap`,
> Diff `main...HEAD`. Plan: [plans/2026-06-23-dev-bootstrap.md](../plans/2026-06-23-dev-bootstrap.md).
> Validierung: [reports/2026-06-23-dev-bootstrap.md](2026-06-23-dev-bootstrap.md).

## Verdikt des Reviewers

Kernskript solide, idempotent, konventionskonform. **Kein harter Correctness-Blocker** auf dem
Happy-Path. Ein echter Integrationslücken-Befund (MAJOR), drei Minors, zwei Nits. Alle bestätigt
am Code geprüft; Fixes in Commit `1524ed8`.

## Befunde & Behebung

| # | Sev | Befund | Behebung | Verifiziert |
| - | --- | ------ | -------- | ----------- |
| 1 | MAJOR | `dev-setup`-Menüeintrag liegt im Lokal-Menü, das nur bei vorhandener `.vereinsheim.local` erscheint — der frische-Clone-Nutzer (genau die Zielgruppe) sieht aber das VPS-Default-Menü und kann es dort nicht entdecken. | Hinweiszeile im Default-Menü, wenn weder Lokal-Config noch VPS-Env-Datei existiert (= frische Workstation). Auf echtem VPS existiert die Env-Datei → kein Hinweis. Lokal-Menüeintrag + mode-agnostischer Dispatch bleiben. | **PTY-Test** (`script`): „Frische Workstation? … dev-setup" erscheint vor dem VPS-Menü ✓ |
| 2 | minor | `npm install -g` schlägt auf System-Node (`/usr/local`) mit kryptischem EACCES fehl und bricht den Bootstrap ab. | `\|\| die` mit handlungsleitender Meldung (npm-Prefix user-schreibbar statt sudo). | `bash -n` ✓ (else-Zweig, Happy-Path unberührt) |
| 3 | minor | Re-Run nach `pg_restore` echter Prod-Daten kann bei `db push` hart abbrechen — überraschend für ein „idempotentes" Tool. **Kein** Datenverlust (Push ist non-destruktiv). | Kommentar am Schritt: `db push` non-destruktiv, bricht bei divergentem Schema kontrolliert ab. | Code-Kommentar |
| 4 | minor | DB-Readiness pollt `pg_isready -U postgres`, Schritt 7 verbindet als App-User. | **Kein Change** — Reviewer bestätigt: byte-identisches, bewährtes Muster aus `restore.sh` + `cmd_local_up`. | n/a |
| 5 | nit | Section-Kommentar nennt codegraph „Pflicht-Abhängigkeit", der zitierte Hook `codegraph-ensure.mjs` sagt „Dev-Komfort, keine Pflicht" (fail-open). | Umformuliert: Hook ist fail-open (→ lautlose Degradierung), darum installiert der Bootstrap es bewusst fest + gepinnt (User-Entscheidung). Kein Widerspruch mehr. | Code-Kommentar |
| 6 | nit | `node_major`-Arithmetikvergleich könnte unter `set -e` bei nicht-numerischer Eingabe mit rohem bash-Fehler abbrechen (praktisch unerreichbar, da `node -v` immer `vXX…`). | Belt-and-suspenders: `[[ ! "$node_major" =~ ^[0-9]+$ \|\| … ]]` deckt empty + non-numeric ab. | `bash -n` ✓ |

## Explizit als korrekt bestätigt (Reviewer)

`exec` aus dem Menü (wie `cmd_build`) · kein `require_local_config` in `cmd_dev_setup` (korrekt +
kommentiert) · `$SCRIPT_DIR`-Pathing · Dispatch-Arg-Passing · `seq`/Wait-Loop portabel · `pnpm
--filter`-Namen · `.env.example`→`.env` „nur wenn fehlend" · `codegraph init` im Hintergrund (kein
Orphan) · `.nvmrc` ↔ `engines.node` ↔ Pin `1.0.1` konsistent · README-Fallback spiegelt das Skript.

## Re-Validierung nach Fixes

- `bash -n` beide Skripte grün.
- Happy-Path-Bootstrap idempotent grün (alle Schritte, „Fertig").
- MAJOR-Fix per PTY bestätigt (Hinweis erscheint bei fresh workstation).
- `pnpm check`: 17/17 grün (FULL TURBO).

## Verdict

**Clean — merge-ready.** Alle Befunde adressiert oder begründet abgelehnt (#4). Nächster Schritt:
ff-only-Merge nach `main` nach User-OK.
