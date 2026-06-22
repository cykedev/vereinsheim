# @vereinsheim/config — Claude Scope-Notiz

Geteilte **Tooling-Configs** für beide Apps (Phase 2, ADR-015/016). Eliminiert die früher
byte-identischen Config-Duplikate; Drift ist damit **strukturell unmöglich** (die fünf Configs sind
nicht mehr im `consistency-check.sh`-Gate).

## Was hier liegt

| Export | Datei | App-Stub |
| --- | --- | --- |
| `@vereinsheim/config/tsconfig/nextjs.json` | `tsconfig/nextjs.json` | `tsconfig.json` `extends` (App behält nur `paths`/`include`/`exclude`) |
| `@vereinsheim/config/eslint` | `eslint/index.mjs` | `eslint.config.mjs` re-exportiert |
| `@vereinsheim/config/prettier` | `prettier/index.json` | `package.json`-Feld `"prettier"` |
| `@vereinsheim/config/postcss` | `postcss/index.mjs` | `postcss.config.mjs` re-exportiert |
| `@vereinsheim/config/next` | `next/index.mjs` (+ `index.d.ts`) | `next.config.ts` ruft `createNextConfig(__dirname)` |

## Regeln

- **Verhalten/Regeln ändert man HIER**, nicht in den App-Stubs — sonst entsteht wieder Drift.
- **tsconfig `paths`/`include`/`exclude` bleiben app-lokal**: relative Pfade aus einer extended Config
  lösen gegen die *definierende* Datei auf (TS ≥5.0) — lägen sie hier, zeigte `@/*` aufs Paket.
- **next-Factory braucht `appDir`** (die App übergibt `__dirname`) → `outputFileTracingRoot` zeigt robust
  auf die Monorepo-Wurzel (Host + geprunter Docker-Kontext identisch). Die `.d.ts` bleibt selbst-enthalten
  (bewusst **kein** `import from "next"`), damit `next build` die `next.config.ts` ohne Cross-Package-
  „next"-Auflösung typprüfen kann.
- **Kein `"use server"`** in diesem Paket (geteilte Dateien dürfen keine Server-Action-Re-Exports sein,
  monorepo-plan §9).
- `globals.css` + `components.json` sind **app-lokal** (Phase 4) — gehören NICHT hierher.
- Nach Änderungen: `pnpm check` (alle 5 Gates über beide Apps) muss grün sein.
