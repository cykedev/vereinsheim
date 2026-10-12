# Vitest-Grundkonfiguration nach `@vereinsheim/config`

## Kontext

Offen laut [[conventions]] §1 und den „Offenen Einzelpunkten“ der Spiegel-Roadmap: Ringwerk, Treffsicher und Spiegel
haben je eine eigene `vitest.config.ts` mit denselben Teilen (Umgebung `node`, `maxWorkers: "50%"`, Ausschluss von
`.next` und Worktrees, Alias `@`, Alias `server-only` auf `test/server-only-stub.ts`). Der Stub steht deshalb in
`MUST_MATCH` von `scripts/consistency-check.sh`.

## Entscheidungen

- **Factory wie bei `next`:** `createVitestConfig(appDir)` in `packages/config/vitest/index.mjs`, Export
  `@vereinsheim/config/vitest`. Die App übergibt `__dirname` für den Alias `@`.
- **Der Stub liegt im Paket** (`vitest/server-only-stub.mjs`), der Alias zeigt über `import.meta.url` darauf. Die
  Stubs in den Apps und ihr Eintrag im Gate entfallen.
- **`index.d.ts` selbst-enthalten** (kein `import from "vitest"`), wie bei `next`: `next build` prüft die
  `vitest.config.ts` der App mit.
- **`vitest` als devDependency von `@vereinsheim/config`**, weil die Factory `configDefaults` braucht.
- **Eigenheiten bleiben in der App**, per `mergeConfig`: Ringwerk `dotenv` und `passWithNoTests`, Spiegel `dotenv`,
  `DATABASE_URL`-Vorgabe und `fileParallelism: false`. Treffsicher exportiert die Basis unverändert.

## Aufgaben

1. `packages/config`: `vitest/index.mjs`, `vitest/index.d.ts`, `vitest/server-only-stub.mjs`, Export und devDependency
   in `package.json`, Tabelle und Regel in `packages/config/CLAUDE.md`.
2. Die drei `vitest.config.ts` auf die Factory, `test/server-only-stub.ts` löschen, `pnpm install`.
3. `scripts/consistency-check.sh`: Eintrag und Kommentar zum Stub entfernen.
4. Doku: [[conventions]] §1, Punkt in der Spiegel-Roadmap streichen.

## Prüfung

`pnpm check` vom Root (46/46) und `scripts/consistency-check.sh` grün. Gegenprobe: Ohne den Alias fällt ein Test, der
`server-only` lädt (z.B. über `@vereinsheim/lib/dateTime`).
