# Validierungsreport — Phase 2: `packages/config`

- **Datum:** 2026-06-22
- **Branch:** `feat/packages-config` (6 Commits: Plan + 5 Tasks)
- **Plan:** [plans/2026-06-22-packages-config.md](../plans/2026-06-22-packages-config.md)
- **Scope:** tsconfig/eslint/prettier/postcss/next.config → `@vereinsheim/config`; `globals.css` +
  `components.json` app-lokal (Phase 4).
- **Verdikt:** ✅ **PASS** — alle Gates grün, Verhalten bestätigt, Deploy-Pfad verifiziert. Bereit für `/review`.

## 1. Gates (`pnpm check`)

`pnpm check` → **12 successful, 12 total — FULL TURBO** (alle 5 Gates × beide Apps: lint, format:check,
test, check-types, build). Dev-Postgres lief (`vereinsheim-dev-db-1`, healthy). Im Post-Reboot-Zustand
erneut bestätigt (turbo-Cache intakt, 332ms).

## 2. Empirischer Cross-Package-Beweis (der offene Punkt aus monorepo-plan §10)

Empirie-first wie geplant: **zuerst nur der tsconfig-Slice** (App-`tsconfig.json`
`extends "@vereinsheim/config/tsconfig/nextjs.json"` + Workspace-Dep `"@vereinsheim/config":
"workspace:*"`) → `pnpm check-types` grün für **beide** Apps. Damit ist bewiesen, dass pnpm
Cross-Package-`extends` unter strikter Isolation (kein Hoisting) auflöst. Symlink verifiziert:
`apps/ringwerk/node_modules/@vereinsheim/config → ../../../../packages/config`. Erst danach die übrigen
vier Configs.

## 3. Behavior / echter Lauf

| Check | Ergebnis | Was es beweist |
| --- | --- | --- |
| `pnpm dev` (beide Apps) | ringwerk `✓ Ready` (:3000), treffsicher `✓ Ready` (:3001) | **next.config-Factory lädt zur Laufzeit** — kaputte Factory ⇒ kein Boot |
| Dev-Log `· serverActions` | aktiv, beide Apps | `experimental.serverActions` aus der geteilten Factory greift |
| `curl http://localhost:3000/` | **HTTP 307 → /login?callbackUrl=%2F** | App serviert Requests, Auth-Middleware/Routing funktioniert |
| **Docker-Prune-Runner-Build (ringwerk)** | **grün**, Image gebaut | **Deploy-Pfad (Phase-3-Vertrag)** — siehe §4 |

## 4. Deploy-Pfad — Docker-Prune-Build (live-kritisch)

Der stärkste Behavior-Beweis, weil er den realen Produktions-/Deploy-Pfad ausführt:

- `pnpm exec turbo prune ringwerk --docker` → meldet **„Added @vereinsheim/config"**; das Paket landet in
  `out/json/packages/config/package.json` (Install-Layer), `out/full/packages/config/**` (Source, alle 8
  Dateien) und im pruned Lockfile (`out/pnpm-lock.yaml`).
- `docker buildx build --target runner --build-arg APP=ringwerk out` → **grün**. Die `builder`-Stage führt
  in-container `pnpm install --frozen-lockfile` (gegen das pruned Lockfile, inkl. `@vereinsheim/config` +
  transitiv `eslint-config-next`) + `turbo run build` (= `next build`) aus → löst tsconfig-`extends`,
  next.config-Factory und postcss-Re-Export **im Container** auf. Standalone-Image gebaut.
- Damit ist auch **postcss/Tailwind** end-to-end verifiziert (`next build` verarbeitet alle Routen inkl.
  `/login` durch die geteilte postcss-Config). Kein Push, kein Deploy (`--load`, lokal).

## 5. Drift-Gate

`bash scripts/consistency-check.sh` → **Exit 0, „RESULT: OK — keine Drift erkannt."** Die 5 Tooling-Configs
sind aus `MUST_MATCH` entfernt (Drift strukturell via Paket verhindert); `components.json` + `globals.css`
werden weiter geprüft (app-lokal, Phase 4). `bash -n` grün.

## 6. Notizen / offene Punkte

- **System-Reboot während des Dev-Smoke-Tests:** Beide Turbopack-Dev-Server gleichzeitig + ein verwaister
  `pnpm dev` (per `&` detached) trieben die Load-Average auf ~98 → die Maschine rebootete. **Kein
  Code-Bezug** — reines Ressourcen-/Tooling-Problem. Git-Stand + Commits unversehrt, Working Tree clean,
  Prozesse nach Reboot sauber. _Lesson:_ nicht beide schweren Dev-Server parallel zum `pnpm check`/Builds
  laufen lassen; Dev-Server via `Bash run_in_background` (harness-getrackt) statt `&` starten, damit kein
  Orphan entsteht.
- **Dev-Runtime-`/login`-Render (HTML+CSS):** nicht separat erfasst (der erste Route-Compile-Curl hing und
  trug zum Reboot bei). **Vollständig abgedeckt** durch den Docker-Build (§4), der postcss/Tailwind über
  alle Routen inkl. `/login` ausführt — stärkere Evidenz als ein Dev-Curl.
- **`treffsicher#test`-Ausfall — echte Wurzel (kein „Flake"):** vitest scannte die `next build`-Ausgabe
  `.next/standalone/` (die `output:"standalone"` kopiert `src/**` inkl. `*.test.ts` dorthin) und scheiterte
  am Laden der Kopien (53 Datei-Load-Fehler; die echten 307 Tests bestehen). Trat **deterministisch** auf,
  sobald `.next/standalone` nach einem Build existierte — die „grünen" Läufe waren Cache-Hits, der Reboot
  legte nur die parallele Dev-DB lahm. **Behoben** (separater Commit): `.next/**` in **beiden**
  `vitest.config.ts` ausgeschlossen (`configDefaults.exclude` + `.next` + Worktrees). Echte Zahlen mit
  präsentem `.next/standalone`: treffsicher 307/307, ringwerk 616/616. Die frühere „Oversubscription"-
  Vermutung war falsch.

## 7. Bewusste Abweichung vom Plan (dokumentiert)

next-Factory-`.d.ts` ist **selbst-enthalten** (kein `import from "next"`), `bodySizeLimit` als Literal
`"12mb"`: vermeidet Cross-Package-`next`-Typauflösung aus dem Paket-Kontext — nötig, weil `next build` die
`next.config.ts` (liegt in tsconfig-`include`) mit-typprüft, auch im geprunten Docker-Build. `string` wäre
nicht zu Next's `SizeLimit` (Template-Literal) zuweisbar. In monorepo-plan §8 + packages/config/CLAUDE.md
vermerkt.
