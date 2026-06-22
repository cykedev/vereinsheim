# @vereinsheim/lib — Claude Scope-Notiz

Geteilte **reine Utils + Client-Hooks** für beide Apps (Phase 4 / Zyklus 1, ADR-015/016). Ersetzt die
früher byte-identischen Kopien in `apps/*/src/lib/*` — Drift ist damit **strukturell unmöglich** (die
Module sind nicht mehr im `consistency-check.sh`-Gate).

## Was hier liegt (Subpath-Exports, spiegeln die alten `@/lib/*`-Pfade)

| Export                                          | Datei                                 | Inhalt                             |
| ----------------------------------------------- | ------------------------------------- | ---------------------------------- |
| `@vereinsheim/lib/utils`                        | `src/utils.ts`                        | `cn()` (clsx + tailwind-merge)     |
| `@vereinsheim/lib/forms/fieldErrors`            | `src/forms/fieldErrors.ts`            | `getFieldError`, `getGeneralError` |
| `@vereinsheim/lib/hooks/useUnsavedChangesGuard` | `src/hooks/useUnsavedChangesGuard.ts` | `"use client"`                     |
| `@vereinsheim/lib/hooks/useNavigationConfirm`   | `src/hooks/useNavigationConfirm.ts`   | `"use client"`                     |

## Regeln

- **Just-in-time-Paket**: exportiert **TS-Source direkt** (kein Build-Step); Next transpiliert via
  `transpilePackages` (gesetzt in `@vereinsheim/config/next`). `"use client"` bleibt in den Hook-Dateien.
- **`react` ist peerDependency** — die App liefert die Instanz (keine doppelte React-Instanz → sonst
  Hook-Invariants-Crash). Im Paket nur devDependency für das eigene `tsc`/`vitest`.
- **Kein `"use server"`** (geteilte Dateien dürfen keine Server-Action-Re-Exports sein, monorepo-plan §9).
- **Verhalten/Logik ändert man HIER**, nicht in App-Kopien — sonst entsteht wieder Drift.
- `dateTime.ts` bleibt vorerst **app-lokal** (driftet zwischen den Apps) — Angleichung ist Folgearbeit.
- Nach Änderungen: `pnpm check` (alle 5 Gates über beide Apps) muss grün sein.
