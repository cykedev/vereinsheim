# Plan — Phase 2: `packages/config` (Konfig-Duplikate eliminieren)

> PIV-Handoff-Artefakt. Branch: `feat/packages-config` (ausgecheckt). Dieser Plan = erster Commit.
> Führt **ADR-015** aus (Monorepo, Drift strukturell lösen); kein neuer ADR nötig.
> Quelle: [monorepo-plan.md](../docs/monorepo-plan.md) §8 (Phase 2) + §9 (Gotchas) + §10.

## 1. Context (Warum)

Beide Apps tragen heute **fünf byte-identische Tooling-Configs** (empirisch verifiziert, `diff` = 0):
`tsconfig.json`, `eslint.config.mjs`, `.prettierrc`, `postcss.config.mjs`, `next.config.ts`.
Heute hält nur das Drift-Gate (`scripts/consistency-check.sh`, `MUST_MATCH`) sie reaktiv synchron.
Phase 2 zieht den **substanziellen** Teil dieser Configs in ein Workspace-Paket `@vereinsheim/config`,
sodass Drift **strukturell unmöglich** wird — pro App bleibt nur ein dünner Stub, der das Paket
`extends`/re-exportiert.

**Scope-Grenzen (vom User gesetzt):**
- **In Scope:** die 5 Configs oben → `@vereinsheim/config`.
- **App-lokal (Phase 4, NICHT anfassen):** `globals.css`, `components.json` (shadcn-CLI läuft im App-Kontext,
  ADR / monorepo-plan §9). Bleiben im Drift-Gate.
- **Empirie zuerst:** den tsconfig-Slice als Erstes bauen und die **pnpm-Cross-Package-Auflösung**
  (`extends` aus einem Workspace-Paket unter pnpm-Strenge) beweisen, *bevor* die anderen vier folgen.
  Das ist der offene Verifikationspunkt aus monorepo-plan §10 ("pnpm-Cross-Package in Phase 2 empirisch
  verifizieren").

## 2. Approach

Standard-Turborepo-Muster: **ein Config-Paket, dünne App-Stubs.** Alle fünf Tools (tsc, eslint, prettier,
next, postcss) entdecken ihre Config per Auto-Discovery aus dem App-Verzeichnis — die Stub-Datei MUSS
also im App-Root bleiben; sie referenziert nur das Paket.

```
packages/config/
├── package.json          # @vereinsheim/config, private, type:module, exports-Map, deps (eslint, eslint-config-next)
├── tsconfig/nextjs.json  # die compilerOptions (der driftende Kern)
├── eslint/index.mjs      # Flat-Config-Array (importiert eslint-config-next)
├── prettier/index.json   # Prettier-Optionen
├── postcss/index.mjs     # PostCSS-Objekt (default export)
├── next/index.mjs        # createNextConfig(appDir)-Factory
├── next/index.d.ts       # Typen für die Factory
└── CLAUDE.md             # Scope-Notiz (ADR-016: packages/* eigene CLAUDE.md)
```

**Pro Config — was ins Paket wandert, was app-lokal bleibt:**

| Config | Paket (`@vereinsheim/config`) | App-Stub bleibt |
| --- | --- | --- |
| **tsconfig** | `tsconfig/nextjs.json` = alle `compilerOptions` (target, lib, strict, module, moduleResolution, plugins:[next], …) | `extends` + `paths {"@/*"}` + `include`/`exclude` — **müssen** app-lokal bleiben: relative Pfade in `paths`/`include` lösen sonst gegen das Paket-Verzeichnis auf (TS ≥5.0) |
| **eslint** | `eslint/index.mjs` = ganzes Flat-Array | `export { default } from "@vereinsheim/config/eslint"` |
| **prettier** | `prettier/index.json` | `package.json`-Feld `"prettier": "@vereinsheim/config/prettier"`; `.prettierrc` **gelöscht** |
| **postcss** | `postcss/index.mjs` = Plugin-Objekt | `export { default } from "@vereinsheim/config/postcss"` |
| **next.config** | `next/index.mjs` = `createNextConfig(appDir)` | `createNextConfig(__dirname)` — App liefert `__dirname`, Factory baut `outputFileTracingRoot = join(appDir, "../../")` |

**Schlüssel-Entscheidungen (Begründung):**
- **tsconfig `paths`/`include`/`exclude` bleiben im Stub.** TS löst relative `paths` aus einer extended
  Config gegen die **definierende** Datei auf — lägen sie im Paket, würde `@/*` → `packages/config/src/*`.
  Der driftende Kern (compilerOptions) wandert, das Strukturelle (app-relativ per Natur) bleibt.
- **next.config als Factory mit `appDir`-Parameter** (nicht das Paket-`__dirname`): robust gegen die
  Verschachtelungstiefe des Pakets; im Host *und* im geprunten Docker-Kontext (`/app/apps/<app>` →
  `/app`) identisch. `.mjs` (kein Build-Step) → wird vom Next-Config-Loader nicht transpiliert.
- **`eslint-config-next` wandert app→Paket** (das Paket importiert es; der App-Stub nicht mehr).
  Aus den Apps entfernen **nur wenn `next build` grün bleibt** (Next 16 könnte beim Build linten) —
  sonst als App-devDep belassen (das Paket besitzt trotzdem die *Config*). `eslint` (Binary) bleibt in
  beiden Apps.
- **Workspace-Edge:** beide Apps bekommen `"@vereinsheim/config": "workspace:*"` in `devDependencies`.
  Dadurch sieht auch Turbo die Kante (Cache-Invalidierung bei Config-Änderung) und `turbo prune --docker`
  zieht das Paket automatisch in `out/json` + `out/full` (Docker-Build-Kontext, Phase-3-Vertrag).

**Bereits retired Risiken (während Exploration verifiziert):**
- **vitest bricht nicht:** beide `vitest.config.ts` redeklarieren den `@`-Alias manuell
  (`path.resolve(__dirname, "./src")`) — vitest liest tsconfig *nicht*. Test-Gate ist immun gegen die
  tsconfig-Extraktion.
- **Docker-Build:** `Dockerfile` macht `COPY json/ .` + `COPY full/ .` aus dem `turbo prune`-Output → das
  Config-Paket ist im Build-Kontext, sobald die Workspace-Dep deklariert ist. (Trotzdem als
  Verifikationsschritt mit lokalem `PUSH=0`-Build absichern.)

## 3. Tasks (empirie-first; ein fokussierter Commit pro Task)

**Task 1 — tsconfig-Slice = Cross-Package-Beweis** *(der Risiko-Retirer; allein lauffähig)*
- `packages/config/package.json` (name, private, `type:module`, exports-Map — zunächst tsconfig-Eintrag).
- `packages/config/tsconfig/nextjs.json` = compilerOptions aus dem heutigen tsconfig (inkl. `plugins:[{name:"next"}]`).
- Beide Apps: `"@vereinsheim/config": "workspace:*"` in `devDependencies`.
- Beide `apps/*/tsconfig.json` → Stub (`extends` + `paths` + `include`/`exclude`).
- `pnpm install` (Workspace-Links + Lockfile).
- **Beweis:** `pnpm check-types` grün für beide Apps → pnpm-Cross-Package-`extends` funktioniert.
- Commit: `feat(config): @vereinsheim/config + shared tsconfig base (pnpm cross-package proven)`

**Task 2 — eslint-Slice**
- `packages/config/eslint/index.mjs` (Flat-Array, importiert `eslint/config` + `eslint-config-next/*`).
- `packages/config`: `eslint` + `eslint-config-next` (`catalog:`) als deps; exports-`./eslint`.
- Beide `eslint.config.mjs` → Re-Export-Stub. `eslint-config-next` aus Apps entfernen *(konditional, s.o.)*.
- `pnpm install`; **Verify:** `pnpm lint` grün beide Apps.
- Commit: `feat(config): share eslint flat config via @vereinsheim/config`

**Task 3 — prettier-Slice**
- `packages/config/prettier/index.json`; exports-`./prettier`.
- Beide `package.json`: Feld `"prettier": "@vereinsheim/config/prettier"`; beide `.prettierrc` löschen.
- **Verify:** `pnpm format:check` grün beide Apps. (Fallback falls Prettier die JSON-Subpath-Exports nicht
  lädt: `prettier.config.mjs`-Re-Export-Stub statt package.json-Feld.)
- Commit: `feat(config): share prettier config via @vereinsheim/config`

**Task 4 — postcss + next.config-Slice** *(zusammen: beide nur via `next build` sinnvoll verifizierbar)*
- `packages/config/postcss/index.mjs` (default-export Objekt); `next/index.mjs` (Factory) + `next/index.d.ts`.
- exports-`./postcss` + `./next`.
- Beide `postcss.config.mjs` → Re-Export; beide `next.config.ts` → `createNextConfig(__dirname)`.
- **Verify:** `pnpm build` grün beide Apps (exerziert postcss/Tailwind + `outputFileTracingRoot`).
- Commit: `feat(config): share postcss + next config via @vereinsheim/config`

**Task 5 — Gate + Doc-Sync**
- `scripts/consistency-check.sh`: die 5 Configs aus `MUST_MATCH` entfernen (`components.json` bleibt),
  erklärenden Kommentar setzen (jetzt strukturell via Paket garantiert). `bash -n` + Gate laufen lassen.
- `docs/shared-conventions.md` §1: die 5 Configs als "shared via `@vereinsheim/config`" markieren;
  `components.json` + `globals.css` bleiben app-lokal-identisch. (Veraltete `Dockerfile`-Nennung in §1
  gleich mitkorrigieren — Root-Dockerfile seit Phase 3.)
- `docs/architecture.md`: Repo-Karte — `packages/config` existiert (war "geplant").
- `docs/monorepo-plan.md`: Status-Header (Zeile 7) + Phase-2-Tabellenzeile + neue Subsektion
  **"Phase 2 — Umsetzungsnotizen"** (Muster + bewiesene pnpm-Auflösung + vitest-Immunität + Docker-Verify).
- `CLAUDE.md` (Root): "Was wahrscheinlich als nächstes gefragt wird" → Phase 2 config erledigt, next = Phase 4.
- `packages/config/CLAUDE.md`: Scope-Notiz (neu, ADR-016).
- Commit: `docs(monorepo): Phase 2 packages/config notes + gate/doc sync`

## 4. Files to change

**Neu:** `packages/config/{package.json, tsconfig/nextjs.json, eslint/index.mjs, prettier/index.json,
postcss/index.mjs, next/index.mjs, next/index.d.ts, CLAUDE.md}`
**Geändert (je App ×2):** `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `next.config.ts`,
`package.json` (workspace-dep + prettier-Feld − eslint-config-next)
**Gelöscht (je App ×2):** `.prettierrc`
**Geändert (Root):** `pnpm-lock.yaml` (install), `scripts/consistency-check.sh`,
`docs/shared-conventions.md`, `docs/architecture.md`, `docs/monorepo-plan.md`, `CLAUDE.md`

## 5. Required Docs (Implementer vor Code lesen)

- [docs/monorepo-plan.md](../docs/monorepo-plan.md) §8 (Phasen-Tabelle + Phase-1/3-Notizen als Muster für §Phase-2), §9 (Gotchas: `"use server"` nie im Paket, Prisma-Pfad app-lokal), §10 (pnpm-Cross-Package-Verifikation).
- [docs/decisions.md](../docs/decisions.md) ADR-015 (Monorepo/Drift), ADR-016 (CLAUDE.md-Hierarchie für `packages/*`).
- [docs/shared-conventions.md](../docs/shared-conventions.md) §1 (byte-identische Schicht — die zu ändernde Liste) + §8 (Drift-Schutz-Prozess).
- `scripts/consistency-check.sh` `MUST_MATCH` (das Gate, das angepasst wird).

## 6. Test steps (Gates — Hooks erzwingen Grün)

Reihenfolge spiegelt die empirie-first-Tasks; jeder Gate läuft turbo-gecacht über **beide** Apps:

1. **Task 1:** `pnpm check-types` → grün (der pnpm-Cross-Package-Beweis).
2. **Task 2:** `pnpm lint` → grün.
3. **Task 3:** `pnpm format:check` → grün.
4. **Task 4:** `pnpm build` → grün (postcss/Tailwind + Standalone-Tracing).
5. **Task 5:** `bash -n scripts/consistency-check.sh` + `bash scripts/consistency-check.sh` → Exit 0.
6. **Gesamt (für /validate):** `pnpm check` (alle 5 Gates) → grün.

Keine neuen Unit-Tests nötig (reine Build-/Tooling-Config; kein Laufzeitverhalten geändert). Die
Gates *sind* der Test.

## 7. Verification (in /validate)

- [ ] `pnpm check` — alle 5 Gates grün, beide Apps.
- [ ] `bash scripts/consistency-check.sh` — Exit 0 (Gate kennt die 5 Configs nicht mehr, `components.json` weiter geprüft).
- [ ] **Docker-Prune-Build (live-kritisch, Phase-3-Vertrag):** lokaler `PUSH=0`-Build für *eine* App
      (`vereinsheim local-build` bzw. `PUSH=0 scripts/build-and-push.sh`) → bestätigt, dass `turbo prune`
      `packages/config` in `out/` legt und in-container `next build` (tsconfig-`extends` + next.config +
      postcss) auflöst. **Kein Push/Deploy.**
- [ ] `git grep -n "eslint-config-next" apps/` → kein direkter App-Import mehr (nur noch Paket); kein `.prettierrc` mehr in `apps/*`.
- [ ] Optional Smoke: `pnpm dev` beide Apps starten kurz (next.config/postcss laden auch im Dev).

## 8. Risiken & Fallbacks

| Risiko | Mitigation |
| --- | --- |
| pnpm löst `extends` aus Workspace-Paket nicht auf | **Task 1 beweist genau das vor allem anderen.** Bricht es → exports-Map + literaler Pfad doppelt absichern; TS 6 respektiert exports. |
| `next build` (Next 16) linted und braucht `eslint-config-next` in der App | `eslint-config-next` nur entfernen wenn Build grün; sonst als App-devDep belassen (Paket besitzt die Config trotzdem). |
| Prettier lädt JSON-Subpath-Export nicht | Fallback `prettier.config.mjs`-Re-Export-Stub. |
| `turbo prune` zieht `packages/config` nicht in den Docker-Kontext | Workspace-Dep-Deklaration erzwingt die Kante; per lokalem `PUSH=0`-Build verifiziert (Verification-Schritt). |
| Turbo-Cache-Staleness bei Config-Änderung | Workspace-Dep-Edge → Turbo hasht das Paket als Abhängigkeit; Build-Gate fängt Regressionen. |
