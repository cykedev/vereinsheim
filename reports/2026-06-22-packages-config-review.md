# Review-Report — Phase 2: `packages/config`

- **Datum:** 2026-06-22
- **Branch:** `feat/packages-config` (`git diff main...HEAD`, 11 Commits)
- **Reviewer:** `code-reviewer`-Sub-Agent (adversarial, codegraph-gestützt), delegiert via `/review`.
- **Verdikt:** ✅ **Keine BLOCKER, keine MAJOR.** Kern empirisch als korrekt bestätigt. 3 MINOR — adressiert.

## Reviewer-Verdikt (Kern)

Die zentrale Risikofrage (löst die Config-Extraktion unter pnpm-Strenge auf, bleibt der Phase-3-Deploy-Vertrag intakt) ist mit **echten Läufen** positiv beantwortet: ESLint/Prettier/tsc/`turbo prune` ausgeführt, `outputFileTracingRoot` als byte-identisch nachgerechnet (`/…/vereinsheim/`), Guard-Regex empirisch ausgelöst, `.d.ts`-Literaltyp via `@ts-expect-error` belegt. `eslint-config-next` in Paket-`dependencies` als korrekt verifiziert (Consumer-Resolution + Docker), `pnpm-lock.yaml`-Diff plausibel (nur `link:` neu + Dep-Verschiebung, kein Versions-Drift), Migrator-Stage braucht das Paket nicht, „kein `use server` im Paket" eingehalten, Doku-Sync stimmig, Commit-Hygiene ok.

## Findings & Dispositionen

| # | Severity | Finding | Disposition |
| --- | --- | --- | --- |
| 1 | MINOR | `pretool-guard.mjs`: Dev-Server-Guard scannte den ganzen Roh-Befehl → blockte auch Befehle, die `pnpm dev`+`&` nur **erwähnen** (Commit-Messages/echo/Test-Fixtures). Empirisch zweimal in dieser Session getroffen. | ✅ **FIXED** (`592757d`): Heredoc-Bodies + gequotete Strings werden vor der Prüfung ausgeblendet; nur reale unquoted Launches blocken. 18/18 Dry-Run-Tests (6 deny, 3 vormals-FP jetzt allow, 9 allow/Regression). End-to-End belegt: der gefixte Live-Hook ließ den eigenen Fix-Commit (Heredoc nennt das Pattern) durch. |
| 2 | MINOR | `next/index.d.ts`: `bodySizeLimit`-Literal `"12mb"` vs. `.mjs`-Wert nicht compilergesichert (stiller Drift bei Einzeländerung möglich). | ⏸️ **AKZEPTIERT**: niedriges Risiko (ein Wert, adjazent, in Kommentar + `packages/config/CLAUDE.md` als „in Sync halten" notiert). Der Härtungs-Fix (`.d.ts` leitet aus `.mjs` ab) würde die bewusst vermiedene Cross-Package-`next`-Typauflösung wieder hereinholen. Status quo vertretbar. |
| 3 | MINOR | `apps/treffsicher/docs/technical-constraints.md` „Linting & Formatierung" nannte noch `.prettierrc` + ein `FlatCompat`-ESLint-Beispiel als Konfig-Quelle (durch diesen Branch veraltet; FlatCompat war schon vorher stale). Außerhalb des Diffs, kein Blocker. | ✅ **TEILFIX** (`6e0b3e1`): Banner + Tools-Tabelle zeigen jetzt auf `@vereinsheim/config` als kanonische Quelle (App-Dateien = Stubs, `.prettierrc` entfernt). 🔵 **Tiefere Modernisierung** (Beispiel-Code auf echte `defineConfig`-Form bringen + Ringwerk-Parität) → separate Aufgabe `task_49111160` (Pre-existing Debt; historische `superpowers/`-Artefakte bewusst ausgelassen). |

## Nebenbefund → Wurzelursache + Fix (vitest)

- **vitest scannte die Build-Ausgabe `.next/standalone/`.** `output:"standalone"` kopiert `src/**` inkl.
  `*.test.ts` dorthin; **keine** App schloss `.next` aus → vitest lud die Kopien und scheiterte am
  Modul-Resolve. Das war die **echte, deterministische** Ursache der vermeintlichen `treffsicher#test`-
  „Flakes" (sichtbar erst bei Cache-Miss nach einem Build; der transiente 614-statt-307-Zähler war derselbe
  Effekt). **Behoben in beiden Apps** (`fix(test)`-Commit): `exclude: [...configDefaults.exclude,
  "**/.next/**", ".claude/worktrees/**"]` — angeglichen, Drift weg. Verifiziert mit präsentem
  `.next/standalone`: treffsicher **307/307**, ringwerk **616/616** grün. (Ringwerks Ausfall im Zwischenlauf
  war separat die nach dem Reboot abgestürzte Dev-DB — wieder hochgefahren.)

## Endzustand

- `pnpm check` → **12/12 grün** bei normaler Last (der wiederholte `treffsicher#test`-Ausfall war der bekannte Oversubscription-Flake unter Post-Reboot-Last, in Isolation 307/307 grün).
- Working Tree clean. Branch bereit für **ff-only-Merge nach `main`** (user-gated).
- **Offen:** GPG — die Commits seit dem Reboot (`df2de76`, `30bd40e`, `592757d`, `6e0b3e1` + dieser Report) sind unsigniert (`gpg-agent` ohne Passphrase-Cache); Re-Sign nach Agent-Entsperrung via `git rebase --exec 'git commit --amend --no-edit -S' <base>`.
