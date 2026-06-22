# Review-Report: Phase 4 / Zyklus 1 — `packages/lib`

> PIV-Schritt 4 (review). Branch `feat/packages-lib`, Diff `git diff main...HEAD` (gemeinsamer Vorfahre
> `84180bb`, 6 Commits). Delegiert an den `code-reviewer`-Sub-Agent, 22.06.2026.

## Verdict: **clean — merge-ready** (keine Blocker / Major / Minor; 1 optionale Nit)

Alle sechs Prüf-Schwerpunkte wurden **real** (mit Befehlsausgabe, nicht nur gedanklich) verifiziert:

1. **Byte-Identität** — alle vier Module via `diff` gegen `84180bb` für **beide** Apps: 8/8 IDENTICAL.
   Renames `similarity index 100%` (`utils.test.ts` 90 %, nur Import-Pfad geändert). `"use client"` ist
   in beiden Hook-Dateien die erste Zeile. `packages/lib/src/utils.test.ts` importiert relativ `./utils`
   und läuft real grün (1 file / 1 test) — `passWithNoTests` verschluckt ihn nicht.
2. **Import-Rewrite** — `grep` über `apps/*/src`: 0 verbleibende alte `@/lib/{…}`-Importe; alle neuen
   `@vereinsheim/lib/*` treffen nur die vier Subpaths; die unberührten `@/lib/*` (`auth` 150×, `db` 108×,
   `types` 41×, `dateTime` 15×) intakt — kein Falsch-Treffer.
3. **`transpilePackages` + `.d.ts`** — `index.mjs` (`["@vereinsheim/lib"]`) und `index.d.ts`
   (`transpilePackages: string[]`) synchron; `outputFileTracingRoot`/`bodySizeLimit` unverändert.
4. **`react` peerDependency** — `peerDependencies.react ^19.2.6` + `devDependencies.react catalog:`,
   keine reguläre `react`-dep, keine doppelte Instanz. Exports-Map deckt sich 1:1 mit den Dateipfaden.
   `clsx`/`tailwind-merge` nur noch via `cn` genutzt.
5. **Drift-Gate** — `bash scripts/consistency-check.sh` real: `RESULT: OK — keine Drift erkannt`,
   `EXIT=0`. Drei lib-Einträge sauber raus; `ui/*`/`shell/*`/`error.tsx`/`globals.css`/`components.json`
   bleiben byte-identisch — der `cn`-Rewrite hat keine Drift eingeschleppt.
6. **Doku-Sync** — `architecture.md`, `shared-conventions.md` §1, `monorepo-plan.md` §8,
   `packages/lib/CLAUDE.md`, `packages/config/CLAUDE.md` konsistent.

## Nit (optional, kein Merge-Blocker — keine Aktion)

- `packages/lib` hat bewusst **kein** `lint`-Script (`eslint-config-next` passt nicht auf ein
  Nicht-Next-Paket; turbo überspringt fehlende Scripts → `pnpm check` bleibt grün). Dokumentierte
  Scope-Grenze; Folgearbeit für Zyklus 2 (Nicht-Next-Flat-eslint-Config für `packages/*`) ist bereits im
  Plan §Folgearbeit + `monorepo-plan.md` vermerkt.

## Zweiter, unabhängiger Review (auf `/review`-Wiederholung)

Ein zweiter `code-reviewer`-Durchgang (ohne Kenntnis des ersten Verdicts, mit Fokus auf das, was ein
erster Durchgang übersieht) bestätigte das saubere Gesamtbild — **keine Blocker, keine Major** — prüfte
zusätzlich empirisch die Konsumenten-Kontexte (vitest löst `@vereinsheim/lib/*` über den node_modules-
Symlink auf, obwohl die App-`vitest.config.ts` nur den `@`-Alias kennt; `next build` ohne
`"use server"`-Verletzung; eine React-Instanz; exports-Map vollständig) und fand **ein echtes Minor**:

### Behobenes Minor — tote direkte Deps `clsx` + `tailwind-merge`

Nach der Extraktion importierte **keine** App-Source mehr `clsx`/`tailwind-merge` direkt (verifiziert:
`grep` über `apps/*/src` + config/scripts → 0 Treffer); einziger Nutzer ist `cn` in `@vereinsheim/lib`,
das beide selbst als `dependencies` deklariert. **Fix:** beide aus `apps/ringwerk/package.json` **und**
`apps/treffsicher/package.json` entfernt (gleichzeitig — keine Cross-App-Asymmetrie), `pnpm install`
(Lockfile −12 Zeilen). **Re-validate:** `pnpm check` 15/15 grün, `next build` beider Apps grün → `cn`
löst weiterhin über das Paket auf.

Die beiden Nits (kein `lint`-Script im Paket → dokumentierte Scope-Grenze/Zyklus-2-Folgearbeit;
`.turbo`-Logs → verifiziert gitignored, 0 getrackt) bleiben ohne Aktion.

## Konsequenz

Zwei unabhängige Reviews, das eine Minor behoben + re-validiert. Branch ist aus Review-Sicht
freigegeben; Merge nach `main` (`--ff-only`, nach Rebase auf aktuelles `main`) steht auf User-OK.
