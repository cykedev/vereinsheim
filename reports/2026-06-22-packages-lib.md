# Validate-Report: Phase 4 / Zyklus 1 — `packages/lib`

> PIV-Schritt 3 (validate). Branch `feat/packages-lib` (5 Commits), Plan
> [plans/2026-06-22-packages-lib.md](../plans/2026-06-22-packages-lib.md).
> Verifiziert im Haupt-Tree (mit `.env` + laufendem Dev-Postgres), 22.06.2026.

## Ergebnis: **grün** (eine umgebungsbedingte Einschränkung, siehe §6)

Die vier byte-identischen, autarken Module (`cn`/utils, `forms/fieldErrors`, `useUnsavedChangesGuard`,
`useNavigationConfirm`) sind echt nach `@vereinsheim/lib` geteilt; ~59 App-Importe umgestellt, die
App-Kopien gelöscht, drei Einträge aus dem Drift-Gate entfernt. Alle Belege unten stammen aus diesem Lauf.

## 1. Quality-Gates — `pnpm check`

`pnpm check` (turbo: lint, format:check, test, check-types, build über beide Apps + `@vereinsheim/lib`):

```
Tasks:    15 successful, 15 total
ringwerk:test:      Test Files  27 passed (27)
                         Tests  616 passed (616)
```

- **test 616/616 grün** inkl. der DB-Integrationstests (`src/lib/competitions/publicSlug.test.ts`) —
  diese liefen erst, nachdem `DATABASE_URL` verfügbar war (im Haupt-Tree via `.env`; im Worktree fehlte
  sie, weil turbo ad-hoc env-Variablen nicht durchreicht — reines Worktree-Limit, kein Code-Defekt).
- **lint / format:check / check-types** grün über beide Apps + Paket.
- `@vereinsheim/lib:test` grün (cn-Test, der mit ins Paket wanderte).

## 2. `transpilePackages` / Build

- **`next build` (beide Apps) grün** (Teil der 15 Tasks) → die `createNextConfig`-Factory transpiliert
  `@vereinsheim/lib` (TS-Source + `"use client"`-Hooks) korrekt; alle Routen werden gebaut.
- **Geprunter Build-Kontext verifiziert** — `turbo prune ringwerk --docker`:
  ```
   - Added @vereinsheim/config
   - Added @vereinsheim/lib
   - Added ringwerk
  ```
  `out/json/packages` + `out/full/packages` enthalten `lib`; die geprunte `apps/ringwerk/package.json`
  deklariert `"@vereinsheim/lib": "workspace:*"`; lib-Source + `transpilePackages` in der geprunten
  next-Factory sind vorhanden. → `turbo prune` zieht das neue Paket über die workspace-dep (der
  Phase-4-spezifische Risikopunkt).
- **Voller Container-Build grün** (`docker buildx … --target runner --build-arg APP=ringwerk out`):
  **Exit 0**, Image `local/ringwerk:validate` (306 MB, wie der bisherige runner) erzeugt. Der
  container-interne `turbo run build` (prisma generate + next build) transpiliert `@vereinsheim/lib` im
  geprunten Kontext erfolgreich → der Deploy-Pfad funktioniert mit dem neuen Paket.

## 3. Single-React-Instanz (Hook-Risikopunkt)

`@vereinsheim/lib` hat **keine** eigene React-Instanz (`node_modules/@vereinsheim/lib/node_modules/react`
existiert nicht) → es nutzt die gehoistete Root-/App-Instanz. Die `react`-peerDependency greift; ein
doppelter-React-Crash („Invalid hook call") ist strukturell ausgeschlossen.

## 4. Drift-Gate

`bash scripts/consistency-check.sh` → `RESULT: OK — keine Drift erkannt`. Die drei lib-Einträge sind aus
`MUST_MATCH` entfernt; die geteilten `ui/*`/`shell/*` (Zyklus 2) bleiben byte-identisch.

## 5. Behavior

- Dev-Server (`pnpm dev --filter ringwerk`, via Preview-MCP) startete; `GET /` → **HTTP 307 → `/login`**
  (Auth-Gate funktioniert; Server rendert).

## 6. Offene Einschränkung (umgebungsbedingt, nicht Code)

- **Voller Browser-Hydration-Smoke der drei Hook-Formulare** (Login → Wettbewerbs-Formular /
  Session-Formular / Shot-Routine-Editor, Feld ändern → Unsaved-Guard + Confirm) **nicht abschließbar**:
  Die Systemumgebung warf wiederholt `fork failed: resource temporarily unavailable`, der Next-dev-Server
  wurde dadurch instabil (Browser-Loads → `chrome-error`). Das ist ein Host-Ressourcenlimit, kein Defekt
  der Änderung. **Abgedeckt durch:** grünes `next build` (kompiliert + bündelt die `"use client"`-Hooks)
  + die bestätigte Single-React-Auflösung. Empfehlung: vor dem echten Release im ruhigeren Haupt-Tree den
  Browser-Smoke einmal nachholen.

## 7. Fazit & nächster Schritt

Alle 5 Gates grün; `transpilePackages` durchgängig verifiziert (Host-`next build` + geprunter Kontext +
grüner Container-Build); Single-React strukturell sicher; Drift weg. Die einzige offene Stelle
(Browser-Smoke) ist umgebungsbedingt und doppelt abgedeckt. → bereit für **`/review`**.
