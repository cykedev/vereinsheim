# Plan: Phase 4 / Zyklus 2 — `packages/ui` (geteilte UI-Schicht)

> PIV-Schritt 1. Handoff für `/implement`. Branch: `feat/packages-ui`.
> Phase 4 / Zyklus 2 der Monorepo-Migration ([docs/monorepo-plan.md](../docs/monorepo-plan.md) §8).
> Baut auf Zyklus 1 (`@vereinsheim/lib` live; `transpilePackages`-Mechanismus + peer-React bewährt;
> `cn` kommt schon aus `@vereinsheim/lib/utils`). **User-Entscheidungen (22.06.2026):**
> (1) globals.css **Hybrid** — Theme-Kern → `@vereinsheim/ui/theme.css`, App-globals.css wird Stub;
> (2) **ein Zyklus, Tailwind-`@source`-Smoke zuerst**.

## Kontext (warum)

Zyklus 1 hat die reine lib-Schicht geteilt; das Drift-Gate hält aber weiterhin die **UI-Schicht**
(17 `ui/*` + 4 `shell/*` + `globals.css`) byte-identisch zwischen beiden Apps reaktiv synchron. Zyklus 2
zieht diese Schicht echt nach `@vereinsheim/ui` → die substanzielle UI-Drift wird **strukturell
unmöglich**, das Gate schrumpft auf einen trivialen Konventions-Rest (siehe §Gate).

**Geteilt (byte-identisch, verifiziert):**
- 17 `ui/*`: `alert-dialog, badge, button, card, dialog, dropdown-menu, empty-state, field-error, input,
  label, select, selectable-row, separator, slider, sonner, tabs, textarea`
- 4 `shell/*`: `ConfirmDialog, DetailActionBar, PageHeader, Providers`
- `globals.css` (175 Z.) — Theme-Kern wird geteilt (Hybrid)

**App-lokal bleibt** (nie geteilt): treffsicher `chart/form/table`, ringwerk
`checkbox/rank-badge/skeleton`, `Navigation.tsx` (driftet — Logos/Routen), treffsicher
`DiscardChangesDialog`. Hinweis: treffsicher `form.tsx` importiert geteiltes `label` → wird mit
umgestellt (Datei bleibt app-lokal).

**Verzahnung (verifiziert):** Cross-Importe in der geteilten Schicht — `ui→ui`: `button` (3×), `card`
(1×); `shell→ui`: `ConfirmDialog`→`alert-dialog`. Die Error-Boundaries (`error.tsx`,
`(app)/error.tsx`, `not-found.tsx`) importieren `button` → werden mit umgestellt (Dateien bleiben
app-lokal, Next-Routen-Konvention).

**Externe Deps (verifiziert, grep außerhalb ui/shell):** `radix-ui`(+`@radix-ui/react-slider`),
`class-variance-authority`, `next-themes` = **nur** in ui → ganz ins Paket (aus Apps raus).
`lucide-react` (94 App-Dateien) + `sonner` (29) = auch App-Code → in **beiden**. `tw-animate-css` =
CSS-`@import` in globals.css → bleibt App-dep.

Import-Umfang (Rewrite): `@/components/ui/*` **188** (102 TS + 86 RW) · `@/components/app/shell/*` **44**
(26 + 18) → ~**232** Stellen, mechanische Präfix-Ersetzung.

## Ansatz

Gleiches JIT-Paket-Muster wie `packages/lib` (TS-Source via `transpilePackages`, Subpath-Exports,
`react`/`react-dom`/`next`/`next-auth` peer). Neu in Zyklus 2:

- **Tailwind v4 `@source`** (der Risikopunkt) — die App-`globals.css` scannt per default nur den
  App-Baum; die Paket-Komponenten in `packages/ui/src` müssen explizit ins Class-Scanning, sonst fehlen
  ihre Klassen im Build. **`@source`-Smoke ist Task 1**, vor allen Rewrites.
- **globals.css Hybrid:** der driftende Theme-Kern (`@custom-variant`, `@theme inline`, `:root`,
  `.dark`, `@layer base/utilities`, recharts-Tooltip — Z. 5–173) → `packages/ui/theme.css`. Die
  App-`globals.css` wird ein Stub: `@import "tailwindcss"` + `tw-animate-css` + `shadcn/tailwind.css` +
  `@import "@vereinsheim/ui/theme.css"`. shadcn-CLI behält seinen `components.json`-Anker (globals.css
  existiert app-lokal weiter).
- **Cross-Importe paket-intern relativ:** `ui→ui` (`./button`, `./card`), `shell→ui`
  (`../ui/alert-dialog`).
- **Subpath-Exports spiegeln die alten Pfade:** `@/components/ui/<x>` → `@vereinsheim/ui/<x>`,
  `@/components/app/shell/<x>` → `@vereinsheim/ui/shell/<x>` → mechanischer Rewrite.

### Paketstruktur
```
packages/ui/
├── package.json   # @vereinsheim/ui; exports ./<ui>, ./shell/<x>, ./theme.css
├── tsconfig.json  # extends @vereinsheim/config/tsconfig/nextjs.json
├── theme.css      # geteilter Theme-Kern (+ ggf. @source)
├── CLAUDE.md
└── src/
    ├── ui/        # 17 Komponenten
    └── shell/     # 4 Komponenten
```

## Zu ändernde / neue Dateien

**Neu:** `packages/ui/{package.json,tsconfig.json,theme.css,CLAUDE.md}` + `src/ui/*` (17) +
`src/shell/*` (4).
**Geändert:** beide `apps/*/package.json` (`@vereinsheim/ui` dep + dep-Split), beide
`src/app/globals.css` (→ Stub), beide `layout.tsx` (unverändert — `import "./globals.css"` bleibt),
~232 Importeure, Error-Boundaries (button-Import), `scripts/consistency-check.sh`,
`docs/shared-conventions.md` §1, `docs/architecture.md`, `docs/monorepo-plan.md` §8, `pnpm-lock.yaml`.
**Gelöscht (beide Apps):** `src/components/ui/{17}.tsx`, `src/components/app/shell/{4}.tsx`.

## Required Docs (vor dem Code lesen)
- [plans/2026-06-22-packages-lib.md](2026-06-22-packages-lib.md) — Zyklus-1-Muster (Exports, peer-React, transpile)
- [packages/lib/CLAUDE.md](../packages/lib/CLAUDE.md), [packages/config/CLAUDE.md](../packages/config/CLAUDE.md)
- [docs/shared-conventions.md](../docs/shared-conventions.md) §1 (geteilte Schicht), §2 (Komponenten-Kanon)
- [docs/monorepo-plan.md](../docs/monorepo-plan.md) §9 (Tailwind-`@source`-Gotcha, `"use server"`-Regel)

## Tasks (bite-sized)

### Task 1 — Paket-Skelett + **`@source`-Smoke** (Gate vor allen Rewrites)
1. `packages/ui/package.json`: name `@vereinsheim/ui`, `private`, `type: module`, exports
   `"./theme.css": "./theme.css"` + (vorerst) `"./button": "./src/ui/button.tsx"`; `dependencies`:
   `@vereinsheim/lib: workspace:*`, `radix-ui: catalog:`, `@radix-ui/react-slider: catalog:`,
   `class-variance-authority: catalog:`, `lucide-react: catalog:`, `next-themes: catalog:`,
   `sonner: catalog:`; `peerDependencies`: `react ^19.2.6`, `react-dom ^19.2.6`, `next ^16.2.6`,
   `next-auth ^4.24.13`; `devDependencies`: `@types/react`, `@types/react-dom`, `@vereinsheim/config`,
   `prettier`, `react`, `typescript`, `tailwindcss` (catalog:); `scripts`: `check-types`,
   `format:check`; `prettier`-Feld.
2. `packages/ui/tsconfig.json` (extends Base, `include ["src"]`), `CLAUDE.md` (Scope-Notiz).
3. `packages/ui/theme.css` = Z. 5–173 von `apps/ringwerk/src/app/globals.css` (`@custom-variant` …
   recharts) **byte-genau kopiert**.
4. `packages/ui/src/ui/button.tsx` = Kopie von `apps/ringwerk/src/components/ui/button.tsx` (cn-Import
   `@vereinsheim/lib/utils` bleibt).
5. `packages/config/next/index.mjs` + `.d.ts`: `transpilePackages` → `["@vereinsheim/lib",
   "@vereinsheim/ui"]`.
6. **Nur in ringwerk** (Smoke): `@vereinsheim/ui` als dep; `src/app/globals.css` → Stub (Z.1–3 +
   `@import "@vereinsheim/ui/theme.css"`); **`@source` setzen** — bevorzugt **in `theme.css`**
   paket-relativ (`@source "./src";`), Fallback **in `globals.css`** app-relativ
   (`@source "../../../../packages/ui/src";`); eine button-nutzende Datei (z.B.
   `src/app/error.tsx`) auf `@vereinsheim/ui/button` umstellen; `pnpm install`.

**Verifikation (der Gotcha):** `pnpm --filter ringwerk build`; im Output-CSS
(`apps/ringwerk/.next/**/*.css`) müssen button-spezifische Klassen vorhanden sein (z.B. nach einer
charakteristischen Utility aus `button.tsx` grep-en). **Klassen da → `@source` greift → weiter. Klassen
fehlen → @source-Variante wechseln/Pfad fixen, bis grün.** Erst danach Task 2.

### Task 2 — restliche `ui/*` (16) ins Paket
Die übrigen 16 `ui/*` nach `packages/ui/src/ui/` kopieren (byte-genau, `"use client"` erhalten).
**Cross-Importe relativ machen:** `@/components/ui/button` → `./button`, `@/components/ui/card` →
`./card` (innerhalb der ui-Dateien). exports-Map um alle 17 ergänzen
(`"./<name>": "./src/ui/<name>.tsx"`).

**Verifikation:** `pnpm --filter @vereinsheim/ui check-types` grün; kein verbleibender
`@/components/ui/`-Import in `packages/ui/src`.

### Task 3 — `shell/*` (4) ins Paket
Die 4 `shell/*` nach `packages/ui/src/shell/` (byte-genau, `"use client"` erhalten).
`ConfirmDialog`-Import `@/components/ui/alert-dialog` → `../ui/alert-dialog`. exports
`"./shell/<name>": "./src/shell/<name>.tsx"`.

**Verifikation:** `pnpm --filter @vereinsheim/ui check-types` grün.

### Task 4 — globals.css → Stub (beide Apps) + theme.css final
Beide `src/app/globals.css` auf den Stub reduzieren (Z. 1–3 + `@import "@vereinsheim/ui/theme.css";`
+ ggf. app-relativer `@source` falls Task-1-Smoke das ergab). Den Theme-Kern aus beiden Apps entfernen
(lebt jetzt in `packages/ui/theme.css`).

**Verifikation:** beide globals.css sind danach identisch + minimal; `diff` der zwei Stubs = identisch.

### Task 5 — Deps verdrahten + App-Deps bereinigen
- Beide `apps/*/package.json`: `"@vereinsheim/ui": "workspace:*"` ergänzen.
- **Ganz aus den Apps entfernen** (nur noch im Paket): `radix-ui`, `@radix-ui/react-slider`,
  `class-variance-authority`, `next-themes`. **Belassen:** `lucide-react`, `sonner` (App-Code),
  `tw-animate-css` (globals.css `@import`).
- `pnpm install`.

**Verifikation:** `apps/*/node_modules/@vereinsheim/ui` Symlink; `grep` bestätigt: kein direkter
`radix-ui`/`next-themes`/`cva`-Import außerhalb des Pakets.

### Task 6 — Import-Rewrite + alte Dateien löschen (Herzstück)
**Namensbasiert** (nicht pauschal-Präfix — sonst würde `@/components/ui/chart` etc. fälschlich
umgeschrieben, die es im Paket nicht gibt). macOS/BSD-`sed`; `app`/`name` als Variablen (nie `path`):
```bash
UI="alert-dialog badge button card dialog dropdown-menu empty-state field-error input label \
select selectable-row separator slider sonner tabs textarea"
SHELL="ConfirmDialog DetailActionBar PageHeader Providers"
for app in apps/ringwerk apps/treffsicher; do
  for name in $UI; do
    files=$(grep -rl "from \"@/components/ui/$name\"" "$app/src" 2>/dev/null || true)
    [ -n "$files" ] && echo "$files" | xargs sed -i '' "s#from \"@/components/ui/$name\"#from \"@vereinsheim/ui/$name\"#g"
  done
  for name in $SHELL; do
    files=$(grep -rl "from \"@/components/app/shell/$name\"" "$app/src" 2>/dev/null || true)
    [ -n "$files" ] && echo "$files" | xargs sed -i '' "s#from \"@/components/app/shell/$name\"#from \"@vereinsheim/ui/shell/$name\"#g"
  done
done
```
So bleibt `form`→`label` korrekt umgestellt, aber `@/components/ui/{chart,form,table,checkbox,rank-badge,skeleton}`
(app-spezifisch) **unberührt** (nicht in `$UI`). Dann die 21 gewanderten Dateien in **beiden** Apps
löschen (`src/components/ui/{17}.tsx`, `src/components/app/shell/{4}.tsx`).

**Verifikation:** `grep -rEn 'from "@/components/(ui|app/shell)/(<17+4 Namen>)"' apps/*/src` = 0;
die app-spezifischen `@/components/ui/{chart,form,table,checkbox,rank-badge,skeleton}`-Importe sind
**unberührt**; `pnpm check-types` (turbo) grün.

### Task 7 — Gate reduzieren + Doku-Sync
- `scripts/consistency-check.sh`: alle `ui/*`/`shell/*`-Logik + `globals.css` aus `MUST_MATCH` /
  der dynamischen ui-Diff-Schleife entfernen. **Verbleibend (Next/shadcn-erzwungen app-lokal,
  byte-identisch):** `components.json`, `src/app/error.tsx`, `src/app/(app)/error.tsx`,
  `src/app/not-found.tsx`, der `globals.css`-Stub. Entscheidung im Plan-Review: Gate auf genau diese
  fünf reduzieren **oder** ganz entfernen + Sync als Konvention in `shared-conventions.md` §1
  dokumentieren. **Default-Vorschlag:** auf die fünf reduzieren (Restschutz, ~0 Wartung).
- `docs/shared-conventions.md` §1: ui/shell/Theme → „geteilt via `@vereinsheim/ui`"; §1-Liste/§8
  nachziehen. `docs/architecture.md` (packages/ui), `docs/monorepo-plan.md` §8 (Zyklus 2 ✅ + Notiz),
  `packages/ui/CLAUDE.md`.

**Verifikation:** `bash scripts/consistency-check.sh` ohne FATAL.

### Task 8 — Vollverifikation (→ /validate)
- `pnpm check` (5 Gates, beide Apps) grün — **inkl. `next build`** (der echte `@source`/Bundle-Test).
- Geprunter Container-Build (`PUSH=0`, ringwerk runner) grün → `@source` greift auch im Docker-Kontext.
- Smoke (Browser): eine Seite mit geteilten ui-Komponenten + Dark-Mode rendert **gestylt** (Klassen
  da, kein doppelter React).

## Verification (DoD)
1. 5 Gates grün, beide Apps (`pnpm check`).
2. `@source`-Smoke (Task 1) + voller `next build` grün → Paket-Klassen werden gerendert.
3. Geprunter Container-Build grün.
4. `grep` der alten geteilten ui/shell-Importpfade = 0; app-spezifische ui-Importe unberührt; die 21
   App-Dateien gelöscht.
5. `consistency-check.sh` ohne FATAL; ui/shell/globals.css raus.
6. Beide globals.css = identischer Stub; `@vereinsheim/ui/theme.css` hält den Theme-Kern.
7. Browser-Smoke: gestylte UI im Dark-Mode.

## Risiken & Gotchas
- **Tailwind `@source` greift nicht** → ungestylte Paket-Komponenten. Mitigiert durch Task-1-Smoke
  **vor** den 232 Rewrites. `@source`-Pfad muss Host **und** geprunten Docker-Kontext treffen (beide
  behalten die `apps/*` + `packages/*`-Struktur).
- **Pauschaler Präfix-`sed`** würde app-spezifische ui-Importe (`chart/form/table/checkbox/…`)
  fälschlich umschreiben → **nur die 21 geteilten Namen** ersetzen (Task 6).
- **`"use client"`** muss erste Zeile bleiben (interaktive ui + shell).
- **Doppelter React/Radix** → eine Instanz: `react`/`react-dom` peer; `radix-ui` nur Paket-dep.
- **`"use server"`-Regel:** keine geteilte ui/shell-Datei ist Server-Action-Re-Export (`next build`
  fängt es).
- **next-themes ohne App-Provider:** verifiziert 0 Nutzer außerhalb ui → ganz ins Paket; falls
  `/implement` doch einen App-`ThemeProvider` findet, `next-themes` in beiden belassen.

## Folgearbeit (nicht in diesem Zyklus)
- Error-Boundaries/not-found als dünne Wrapper um geteilten `@vereinsheim/ui/shell`-Content (würde die
  letzten app-lokalen byte-identischen Dateien eliminieren) — optional, nach Zyklus 2.
- `dateTime.ts` angleichen → nach `@vereinsheim/lib` (offen aus Zyklus 1).
- Paket-eslint-Config (Nicht-Next-Flat) für `packages/*` (offen aus Zyklus 1).
