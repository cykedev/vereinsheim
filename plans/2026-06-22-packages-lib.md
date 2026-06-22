# Plan: Phase 4 / Zyklus 1 — `packages/lib` (geteilte Utils + Hooks)

> PIV-Schritt 1 (plan). Handoff-Artefakt für `/implement`. Branch: `feat/packages-lib`.
> Teil der Monorepo-Migration Phase 4 ([docs/monorepo-plan.md](../docs/monorepo-plan.md) §3/§8/§9).
> **Schnitt bewusst klein gewählt** (User-Entscheid 2026-06-22): lib-first als Pilot, der den
> Workspace-Paket-Mechanismus (pnpm `workspace:*` + TS-Source + `"use client"` + `transpilePackages`)
> end-to-end durch alle 5 Gates **und** den geprunten Docker-Build beweist. `packages/ui` ist der
> separate Zyklus 2 danach.

## Kontext (warum)

Heute hält das Drift-Gate `scripts/consistency-check.sh` eine byte-identische UI-/Lib-Schicht zwischen
den beiden Apps reaktiv synchron. Phase 4 ersetzt das durch **echtes Teilen** in `packages/*` → Drift
wird strukturell unmöglich, das Gate überflüssig. `packages/config` (Phase 2) ist das Vorbild; dieser
Pilot überträgt das Muster erstmals auf **echten Laufzeit-Code** (inkl. Client-Hooks), nicht nur
Tooling-Configs.

Vier Module sind heute byte-identisch und **autark** (keine internen `@/`-Importe — verifiziert):

| Modul | Heute (beide Apps) | Inhalt | `"use client"` |
| --- | --- | --- | --- |
| cn | `src/lib/utils.ts` | `cn()` über clsx + tailwind-merge | nein |
| fieldErrors | `src/lib/forms/fieldErrors.ts` | `getFieldError`, `getGeneralError` (+ `FieldErrorSource`-Typ) | nein |
| useUnsavedChangesGuard | `src/lib/hooks/useUnsavedChangesGuard.ts` | beforeunload-Guard, importiert nur `react` | **ja** |
| useNavigationConfirm | `src/lib/hooks/useNavigationConfirm.ts` | Confirm-Flow, importiert nur `react` | **ja** |

`dateTime.ts` **driftet** zwischen den Apps → **bewusst NICHT in diesem Zyklus** (erst angleichen,
separater Schritt; vgl. monorepo-plan §12 ActionResult-/dateTime-Angleichung).

Import-Umfang (exakte Pfade, über beide Apps, gemessen):
`@/lib/utils` 38 · `@/lib/forms/fieldErrors` 15 · `@/lib/hooks/useUnsavedChangesGuard` 3 ·
`@/lib/hooks/useNavigationConfirm` 3 → ~59 Stellen, reine Präfix-Ersetzung. Tests: nur
`apps/treffsicher/src/lib/utils.test.ts` (cn) — wandert ins Paket.

## Ansatz

**Just-in-time internes Paket** (Turborepo-Standard, wie `packages/config`): das Paket exportiert
**TS-Source direkt** (kein Build-Step), Next transpiliert es via `transpilePackages`. **Subpath-Exports**
(kein Barrel), die die heutigen `@/lib/*`-Pfade exakt spiegeln → der Import-Rewrite ist eine mechanische
Präfix-Ersetzung und vorwärtskompatibel zu Zyklus 2 (die `ui`-Komponenten importieren `cn` dann
sauber cross-package aus `@vereinsheim/lib/utils`).

Schlüsselpunkte:
- **`transpilePackages` in die `createNextConfig`-Factory** (`packages/config/next`) → gilt automatisch
  für beide Apps; `"use client"` in den Hooks bleibt erhalten. **Ohne das scheitert `next build`** an
  TS-Source aus `node_modules`.
- **`react` als peerDependency** (App liefert die Instanz — keine doppelte React-Instanz, sonst
  Hook-Invariants-Crash) + devDependency (für das Paket-eigene `tsc`/`vitest`).
- **Bewusste Scope-Grenzen Pilot:** (a) `packages/lib` bekommt **kein** `lint`-Script — die geteilte
  eslint-Config ist `eslint-config-next`, für ein Nicht-Next-Paket unpassend; eine Paket-eslint-Config
  ist Folgearbeit (Zyklus 2, wo mehr Code wandert). turbo läuft `lint` nur, wo das Script existiert →
  `pnpm check` bleibt grün. (b) `clsx`/`tailwind-merge` bleiben vorerst in den App-`package.json`
  (catalog-gepinnt, harmlos; Aufräumen optional/später).

## Zu ändernde / neue Dateien

**Neu (`packages/lib/`):**
- `package.json`, `tsconfig.json`, `vitest.config.ts`, `CLAUDE.md`
- `src/utils.ts`, `src/forms/fieldErrors.ts`, `src/hooks/useUnsavedChangesGuard.ts`,
  `src/hooks/useNavigationConfirm.ts`, `src/utils.test.ts`

**Geändert:**
- `packages/config/next/index.mjs` + `index.d.ts` + `CLAUDE.md` (transpilePackages)
- `apps/ringwerk/package.json` + `apps/treffsicher/package.json` (`@vereinsheim/lib` dep)
- ~59 Importeure in beiden Apps (Pfad-Rewrite)
- `scripts/consistency-check.sh` (MUST_MATCH bereinigen)
- `docs/shared-conventions.md` §1, `docs/architecture.md`, `docs/monorepo-plan.md` §8

**Gelöscht (beide Apps):** `src/lib/utils.ts`, `src/lib/forms/fieldErrors.ts`,
`src/lib/hooks/useUnsavedChangesGuard.ts`, `src/lib/hooks/useNavigationConfirm.ts` +
`apps/treffsicher/src/lib/utils.test.ts` + die dann leeren Verzeichnisse `src/lib/forms`, `src/lib/hooks`.

## Required Docs (vom Implementer vor dem Code zu lesen)

- [docs/monorepo-plan.md](../docs/monorepo-plan.md) §3 (Zielstruktur), §8 (Phasennotizen Phase 2), §9 (Risiken)
- [packages/config/CLAUDE.md](../packages/config/CLAUDE.md) — Paket-Muster, Stub-/Factory-Regeln, „kein `use server`"
- [docs/shared-conventions.md](../docs/shared-conventions.md) §1 (Liste der geteilten Schicht), §8 (Gates)

## Tasks (bite-sized, je mit Verifikation)

### Task 1 — Paket-Skelett `packages/lib`
Anlegen:

`packages/lib/package.json`:
```json
{
  "name": "@vereinsheim/lib",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./utils": "./src/utils.ts",
    "./forms/fieldErrors": "./src/forms/fieldErrors.ts",
    "./hooks/useUnsavedChangesGuard": "./src/hooks/useUnsavedChangesGuard.ts",
    "./hooks/useNavigationConfirm": "./src/hooks/useNavigationConfirm.ts"
  },
  "scripts": {
    "check-types": "tsc --noEmit",
    "test": "vitest run",
    "format:check": "prettier --check ."
  },
  "prettier": "@vereinsheim/config/prettier",
  "dependencies": {
    "clsx": "catalog:",
    "tailwind-merge": "catalog:"
  },
  "peerDependencies": {
    "react": "^19.2.6"
  },
  "devDependencies": {
    "@types/react": "catalog:",
    "@vereinsheim/config": "workspace:*",
    "prettier": "catalog:",
    "react": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

`packages/lib/tsconfig.json`:
```json
{
  "extends": "@vereinsheim/config/tsconfig/nextjs.json",
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

`packages/lib/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
  },
})
```

`packages/lib/CLAUDE.md`: kurze Scope-Notiz analog `packages/config/CLAUDE.md` — exportiert geteilte
reine Utils + Client-Hooks als Subpaths; Regel „kein `use server`"; `react` ist peer; Verhalten ändert
man hier, nicht in den Apps.

**Verifikation:** `pnpm install` an der Wurzel läuft durch; `pnpm --filter @vereinsheim/lib check-types`
ist grün (noch leeres `src` → ok).

### Task 2 — Quell-Dateien ins Paket
`apps/ringwerk` ist die Quelle (byte-identisch zu treffsicher). Inhalte **unverändert** kopieren,
`"use client"`-Direktiven der Hooks **erhalten**:
- `apps/ringwerk/src/lib/utils.ts` → `packages/lib/src/utils.ts`
- `apps/ringwerk/src/lib/forms/fieldErrors.ts` → `packages/lib/src/forms/fieldErrors.ts`
- `apps/ringwerk/src/lib/hooks/useUnsavedChangesGuard.ts` → `packages/lib/src/hooks/useUnsavedChangesGuard.ts`
- `apps/ringwerk/src/lib/hooks/useNavigationConfirm.ts` → `packages/lib/src/hooks/useNavigationConfirm.ts`
- `apps/treffsicher/src/lib/utils.test.ts` → `packages/lib/src/utils.test.ts`, dabei den Import auf den
  **relativen** Paket-Pfad umstellen: `from "@/lib/utils"` → `from "./utils"`.

**Verifikation:** `pnpm --filter @vereinsheim/lib test` (cn-Test grün) **und**
`pnpm --filter @vereinsheim/lib check-types` grün.

### Task 3 — `transpilePackages` in der next-Factory
`packages/config/next/index.mjs` — dem zurückgegebenen Objekt hinzufügen:
```js
    // Geteilte Workspace-Pakete liefern TS/TSX-Source (kein Build-Step) → Next muss
    // sie transpilieren; "use client" in @vereinsheim/lib/hooks/* bleibt erhalten.
    // Phase 4 Zyklus 2 ergänzt "@vereinsheim/ui".
    transpilePackages: ["@vereinsheim/lib"],
```
`packages/config/next/index.d.ts` — Rückgabetyp um `transpilePackages: string[]` erweitern (in Sync mit
`index.mjs` halten, wie der bestehende `bodySizeLimit`-Hinweis).
`packages/config/CLAUDE.md` — eine Zeile: die Factory transpiliert jetzt die geteilten Pakete.

**Verifikation:** greift gebündelt in Task 6 (`next build`).

### Task 4 — App-Deps verdrahten
In **beiden** `apps/*/package.json` zu `dependencies` hinzufügen: `"@vereinsheim/lib": "workspace:*"`
(alphabetisch einsortiert). Danach `pnpm install`.

**Verifikation:** `apps/ringwerk/node_modules/@vereinsheim/lib` ist ein Symlink ins Paket (pnpm).

### Task 5 — Import-Rewrite + alte Dateien löschen (Herzstück)
**macOS/BSD-`sed`** (`-i ''`). **Nicht** `path` als Shell-Variable verwenden (zsh koppelt `$path` an
`$PATH`). Für jede App und jeden der vier exakten Pfade:
```bash
for app in apps/ringwerk apps/treffsicher; do
  for mod in \
    "@/lib/utils" \
    "@/lib/forms/fieldErrors" \
    "@/lib/hooks/useUnsavedChangesGuard" \
    "@/lib/hooks/useNavigationConfirm"; do
    grep -rl "from \"$mod\"" "$app/src" \
      | xargs sed -i '' "s#from \"$mod\"#from \"@vereinsheim/lib${mod#@/lib}\"#g"
  done
done
```
(Ergibt z.B. `@/lib/utils` → `@vereinsheim/lib/utils`, `@/lib/forms/fieldErrors`
→ `@vereinsheim/lib/forms/fieldErrors`.)

Dann die nun ins Paket gewanderten Dateien in **beiden** Apps löschen:
`src/lib/utils.ts`, `src/lib/forms/fieldErrors.ts`, `src/lib/hooks/useUnsavedChangesGuard.ts`,
`src/lib/hooks/useNavigationConfirm.ts`; zusätzlich `apps/treffsicher/src/lib/utils.test.ts`. Die dann
leeren Verzeichnisse `src/lib/forms` + `src/lib/hooks` (beide Apps) entfernen.

**Verifikation:** `grep -rEn 'from "@/lib/(utils|forms/fieldErrors|hooks/useUnsavedChangesGuard|hooks/useNavigationConfirm)"' apps/*/src`
liefert **0 Treffer**; `pnpm check-types` (turbo, beide Apps) grün.

### Task 6 — Gate bereinigen + Doku-Sync
- `scripts/consistency-check.sh`: aus `MUST_MATCH` entfernen: `src/lib/forms/fieldErrors.ts`,
  `src/lib/hooks/useUnsavedChangesGuard.ts`, `src/lib/hooks/useNavigationConfirm.ts`. Den Kommentar
  (Zeilen ~26-29) ergänzen: lib-Utils/Hooks seit Phase 4/Zyklus 1 in `@vereinsheim/lib` → Drift dort
  strukturell unmöglich. (Die `ui/*`/`shell/*`/`error.tsx`/`globals.css`/`components.json`-Einträge
  **bleiben** — Zyklus 2.)
- `docs/shared-conventions.md` §1: den Hooks/Forms-Punkt von „byte-identisch" auf „geteilt via
  `@vereinsheim/lib` (nicht mehr im Gate)" umstellen — analog zur bestehenden `@vereinsheim/config`-Zeile.
- `docs/architecture.md`: `packages/lib` von „geplant — Phase 4" auf vorhanden (cn/forms/hooks; dateTime
  noch app-lokal, da Drift).
- `docs/monorepo-plan.md` §8: Phase-4-Tabellenzeile ergänzen (Zyklus 1 lib ✅, Zyklus 2 ui offen) +
  kurze „Phase 4 — Umsetzungsnotizen (Zyklus 1)".

**Verifikation:** `bash scripts/consistency-check.sh` endet ohne `FATAL` (RESULT: OK, ggf. mit den
bestehenden Dependency-/Anti-Pattern-Warnungen).

### Task 7 — Vollverifikation (Übergabe an /validate)
- `pnpm check` (turbo: lint, format:check, test, check-types, **next build** — alle 5, beide Apps) grün.
- **Geprunter Docker-Build** ohne Push: `PUSH=0 ./scripts/build-and-push.sh ringwerk` (bzw.
  `vereinsheim local-build`) baut durch → beweist, dass `transpilePackages` + Subpath-Exports im
  `turbo prune --docker`-Kontext greifen. (Mindestens eine App; idealerweise beide.)
- Smoke (CodeGraph-Impact: **genau** die Hook-Caller): `pnpm dev`, dann die drei Formulare, die
  `useUnsavedChangesGuard` + `useNavigationConfirm` nutzen — **ringwerk** Wettbewerbs-Formular
  (`useCompetitionFormState`), **treffsicher** Session-Formular (`useSessionFormDirtyGuard`) +
  Shot-Routine-Editor (`ShotRoutineEditor`): je ein Feld ändern → Unsaved-Guard + Abbrechen-Confirm
  greifen, kein doppelter-React-Crash, keine Konsolen-Fehler. **Diese Hooks haben laut CodeGraph keine
  Unit-Tests** — der Smoke-Test ist ihre einzige Absicherung.

## Verification (Definition of Done)

1. Alle 5 Gates grün über beide Apps (`pnpm check`).
2. Geprunter Docker-Build grün (mind. eine App, `PUSH=0`).
3. `grep` nach den vier alten `@/lib/*`-Importpfaden = 0 Treffer; die vier App-Dateien + der treffsicher-
   Test sind gelöscht; `packages/lib` ist die einzige Quelle.
4. `consistency-check.sh` ohne FATAL; die drei lib-Einträge sind aus `MUST_MATCH` entfernt.
5. Doku (shared-conventions §1, architecture, monorepo-plan §8) spiegelt den neuen Stand.
6. Smoke-Test der drei Hook-Caller (CodeGraph-Impact): ringwerk Wettbewerbs-Formular, treffsicher
   Session-Formular + Shot-Routine-Editor rendern fehlerfrei; Unsaved-Guard + Abbrechen-Confirm greifen.

## Risiken & Gotchas

- **Doppelte React-Instanz** → Hook-Crash. Gegenmaßnahme: `react` als **peerDependency** im Paket, nicht
  als reguläre dependency.
- **`transpilePackages` vergessen** → `next build` scheitert an TS-Source aus `node_modules`. Pflicht
  in der Factory (Task 3), nicht pro App.
- **`"use client"`** muss in den beiden Hook-Dateien die **erste Zeile** bleiben (Kopier-Task 2).
- **zsh `$path`** ist an `$PATH` gekoppelt — im Rewrite-Skript `mod`/`app` als Variablen nutzen, nie `path`.
- **BSD sed** auf macOS braucht `-i ''` (leeres Backup-Argument).
- **Subpath-Exports müssen die alten Pfade exakt spiegeln**, sonst ist der Rewrite nicht rein mechanisch.
- **Base-tsconfig** enthält ein `next`-Plugin — beeinflusst `tsc --noEmit` nicht (tsc ignoriert
  `plugins`); das Paket typecheckt damit sauber. Falls wider Erwarten nicht: minimale eigene
  `compilerOptions` statt `extends`.

## Folgearbeit (NICHT in diesem Zyklus)
- `packages/ui` (Zyklus 2): 17 `ui/*` + 4 `shell/*`, Tailwind-v4-`@source`, `globals.css`-Strategie,
  ~232 Import-Rewrites, dann entfällt das Gate ganz.
- `dateTime.ts` angleichen → danach auch nach `@vereinsheim/lib`.
- Paket-eslint-Config (Nicht-Next-Flat-Config) für `packages/*`.
- `clsx`/`tailwind-merge` aus den App-`package.json` entfernen, falls nicht mehr direkt importiert.
