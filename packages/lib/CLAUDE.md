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
- `dateTime` (server-only) seit Juni 2026 ebenfalls geteilt via `@vereinsheim/lib/dateTime` — das Paket setzt dafür `types: ["node", "react"]` + devDeps `@types/node`/`server-only`.
- Nach Änderungen: `pnpm check` (alle 5 Gates über beide Apps) muss grün sein.

## Nachtrag (September 2026)

Zusätzlich hier: `format` (isomorphe Anzeige-Formatierung, **ohne** `server-only` — auch für
Client-Komponenten; `dateTime` re-exportiert `formatDateOnly` daraus) sowie der **reine Auth-Kern**:
`auth/validation` (Login-/Passwortregeln) und `auth/rate-limit/{config,limiter,normalization,types}`.
Am Prisma-Client hängende Teile bleiben app-lokal (`auth-rate-limit/store.ts`, `auth.ts`,
`auth-helpers.ts`, `startup.ts`) — der Store bekommt seinen Client von der App.
