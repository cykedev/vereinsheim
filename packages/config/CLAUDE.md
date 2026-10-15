# @vereinsheim/config — Claude Scope-Notiz

Geteilte **Tooling-Configs** für alle drei Apps und die Pakete (ADR-015/016). Jede Config gibt es nur
einmal; Drift ist damit **strukturell unmöglich**, `consistency-check.sh` prüft sie deshalb nicht.

## Was hier liegt

| Export | Datei | App-Stub |
| --- | --- | --- |
| `@vereinsheim/config/tsconfig/nextjs.json` | `tsconfig/nextjs.json` | `tsconfig.json` `extends` (App behält nur `paths`/`include`/`exclude`) |
| `@vereinsheim/config/eslint` | `eslint/index.mjs` | `eslint.config.mjs` re-exportiert |
| `@vereinsheim/config/eslint/package` | `eslint/package.mjs` | `eslint.config.mjs` jedes Pakets (ohne Next-Seiten, React fest 19.2, `children` als Prop in Tests erlaubt) |
| `@vereinsheim/config/prettier` | `prettier/index.json` | `package.json`-Feld `"prettier"` |
| `@vereinsheim/config/postcss` | `postcss/index.mjs` | `postcss.config.mjs` re-exportiert |
| `@vereinsheim/config/next` | `next/index.mjs` (+ `index.d.ts`) | `next.config.ts` ruft `createNextConfig(__dirname)` |
| `@vereinsheim/config/vitest` | `vitest/index.mjs` (+ `index.d.ts`, `server-only-stub.mjs`) | `vitest.config.ts` ruft `createVitestConfig(__dirname)`, Eigenheiten per `mergeConfig` |

## Regeln

- **Verhalten/Regeln ändert man HIER**, nicht in den App-Stubs — sonst entsteht wieder Drift.
- **tsconfig `paths`/`include`/`exclude` bleiben app-lokal**: relative Pfade aus einer extended Config
  lösen gegen die *definierende* Datei auf (TS ≥5.0) — lägen sie hier, zeigte `@/*` aufs Paket.
- **next-Factory braucht `appDir`** (die App übergibt `__dirname`) → `outputFileTracingRoot` zeigt robust
  auf die Monorepo-Wurzel (Host + geprunter Docker-Kontext identisch). Die `.d.ts` bleibt selbst-enthalten
  (bewusst **kein** `import from "next"`), damit `next build` die `next.config.ts` ohne Cross-Package-
  „next"-Auflösung typprüfen kann.
- **next-Factory setzt `transpilePackages`** für die Source-Pakete aller Apps (`@vereinsheim/lib`,
  `@vereinsheim/ui`): sie liefern TS/TSX-Source ohne Build-Step, Next transpiliert sie just-in-time. Ein neues
  Paket für alle Apps hier eintragen und die `.d.ts` (`transpilePackages: string[]`) in Sync halten; ein Paket nur
  für eine App ergänzt deren `next.config.ts` (Spiegel: `shot-core`, `shot-ui`, `shot-help`, `ingest-contract`).
- **vitest-Factory** setzt Umgebung, Worker-Cap, Ausschlüsse (`.next`, Worktrees) und die Aliase `@` (aus `appDir`)
  und `server-only` (leerer Stub im Paket). Eigenheiten der App (`dotenv`, `passWithNoTests`, `fileParallelism`)
  bleiben im App-Stub. Die `.d.ts` ist selbst-enthalten wie bei `next` (kein `import from "vitest"`); `vitest` ist
  devDependency, weil die Factory `configDefaults` liest.
- **Kein `"use server"`** in diesem Paket (geteilte Dateien dürfen keine Server-Action-Re-Exports sein,
  `vault/monorepo/monorepo.md`).
- `globals.css` + `components.json` sind **app-lokal** — gehören NICHT hierher.
- Nach Änderungen: `pnpm check` (alle 5 Gates über alle Apps und Pakete) muss grün sein.
