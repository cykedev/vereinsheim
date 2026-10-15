---
id: ringwerk-worktrees
type: guide
title: "Ringwerk — Git Worktrees – Bekannte Einschränkungen"
aliases: ["Git Worktrees – Bekannte Einschränkungen"]
keywords: [ringwerk, worktrees, bekannte, einschränkungen]
part_of: ["[[ringwerk]]"]
---

**TL;DR** Ob in einem Worktree unter `.claude/worktrees/<name>/` gearbeitet wird, entscheidet die Hauptsession ([[adr-024]]). Die Gates laufen dort wie im Hauptverzeichnis auf dem Host (`pnpm check`); die DB-Tests brauchen die `.env` der App, die im frischen Worktree fehlt. Vitest schließt `.claude/worktrees/**` aus.

# Git Worktrees – Bekannte Einschränkungen

## Gates im Worktree

Die Gates laufen auf dem Host (`pnpm check` von der Wurzel des Worktrees) gegen den geteilten Dev-Postgres aus der Root-`docker-compose.dev.yml`. Der Worktree braucht eigene `node_modules` (`pnpm install`) und die `.env` der App (`apps/ringwerk/.env`): Sie ist gitignored und fehlt im frischen Worktree, ohne sie scheitern die DB-Tests ([[adr-024]]).

## Vitest + Worktrees

Ohne Ausschluss pickt Vitest alle Testdateien aus `.claude/worktrees/**` auf und führt sie doppelt aus — die Duplikate schlagen fehl, weil Mock-Imports im Worktree-Kontext anders auflösen.

Die geteilte Vitest-Config (`createVitestConfig` in `packages/config/vitest`) schließt sie aus:

```ts
exclude: [...configDefaults.exclude, "**/.next/**", ".claude/worktrees/**"]
```
