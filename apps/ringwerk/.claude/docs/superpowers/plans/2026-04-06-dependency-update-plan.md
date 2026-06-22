# Dependency Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle veralteten npm-Pakete aktualisieren — sichere Updates zuerst, dann Major-Upgrades in fünf gruppierten Commits.

**Architecture:** Jede Gruppe wird separat installiert, kompiliert und getestet bevor committet wird. Breaking Changes werden inline gefixed, bevor `/check` läuft. Kein Commit ohne grüne Quality Gates.

**Tech Stack:** Next.js 16, Prisma 7, TypeScript, ESLint, Vitest, lucide-react, recharts, shadcn CLI

---

## Required Docs

- `.claude/docs/code-conventions.md` — immer
- `.claude/docs/reference-files.md` — immer

---

## Files (potentially modified)

- `package.json` — Versions-Ranges anpassen
- `package-lock.json` — wird automatisch aktualisiert
- `eslint.config.mjs` — bei ESLint 10 Breaking Changes
- `vitest.config.ts` — bei @vitejs/plugin-react 6 Breaking Changes
- `tsconfig.json` — bei TypeScript 6 Breaking Changes
- `src/components/ui/chart.tsx` — bei recharts 3 Breaking Changes
- `src/**/*.tsx` (46 Dateien) — bei lucide-react 1.x Icon-Renames

---

## Task 1: Sichere Updates (npm update)

**Files:**

- Modify: `package-lock.json` (automatisch)

- [ ] **Step 1: npm update ausführen**

```bash
npm update
```

Erwartet: Pakete werden aktualisiert (Prisma 7.6.0, tailwindcss 4.2.2, vitest 4.1.2, etc.)

- [ ] **Step 2: Quality Gates prüfen**

```bash
/check
```

Erwartet: alle Gates grün (lint ✓, format ✓, tests ✓, tsc ✓)

- [ ] **Step 3: Commit**

```
chore: update dependencies to latest patch/minor versions

- prisma + @prisma/client + @prisma/adapter-pg: 7.4.2 → 7.6.0
- tailwindcss + @tailwindcss/postcss: 4.2.1 → 4.2.2
- @react-pdf/renderer: 4.3.2 → 4.3.3
- vitest: 4.0.18 → 4.1.2
- react + react-dom: 19.2.3 → 19.2.4
- dotenv, @types/pg: minor bumps
```

```bash
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
chore: update dependencies to latest patch/minor versions

- prisma + @prisma/client + @prisma/adapter-pg: 7.4.2 → 7.6.0
- tailwindcss + @tailwindcss/postcss: 4.2.1 → 4.2.2
- @react-pdf/renderer: 4.3.2 → 4.3.3
- vitest: 4.0.18 → 4.1.2
- react + react-dom: 19.2.3 → 19.2.4
- dotenv, @types/pg: minor bumps
EOF
)"
```

---

## Task 2: Next.js-Ökosystem (16.1.6 → 16.2.2)

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json` (automatisch)

- [ ] **Step 1: Versions-Pins in package.json anpassen**

In `package.json` folgende Werte ändern:

```json
"next": "16.2.2",
"eslint-config-next": "16.2.2",
```

(Beide sind exakt gepinnt, kein `^`-Präfix)

- [ ] **Step 2: Installieren**

```bash
npm install
```

Erwartet: next und eslint-config-next auf 16.2.2

- [ ] **Step 3: Quality Gates prüfen**

```bash
/check
```

Erwartet: alle Gates grün

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade next + eslint-config-next to 16.2.2"
```

---

## Task 3: Build-Toolchain (TypeScript 6, ESLint 10, @vitejs/plugin-react 6, shadcn 4)

**Files:**

- Modify: `package.json`
- Modify: `eslint.config.mjs` — falls ESLint 10 Config-Änderungen nötig
- Modify: `vitest.config.ts` — falls @vitejs/plugin-react 6 Breaking Changes
- Modify: `tsconfig.json` — falls TypeScript 6 stricter settings nötig
- Modify: `package-lock.json` (automatisch)

- [ ] **Step 1: Ranges in package.json anpassen**

```json
"typescript": "^6",
"@vitejs/plugin-react": "^6",
"eslint": "^10",
"shadcn": "^4"
```

- [ ] **Step 2: Installieren**

```bash
npm install
```

- [ ] **Step 3: TypeScript-Fehler prüfen und fixen**

```bash
npx tsc --noEmit
```

TypeScript 6 ist stricter bei:

- Impliziten `any`-Typen in Callbacks
- Module-Resolution-Änderungen
- Template-Literal-Typen

Jeden gemeldeten Fehler in der betroffenen Datei fixen.

- [ ] **Step 4: ESLint-Fehler prüfen und fixen**

```bash
npm run lint
```

ESLint 10 Breaking Changes:

- Veraltete Core-Rules wurden entfernt — falls verwendet, ersetzen oder Rule entfernen
- `eslint.config.mjs` bleibt im Flat Config Format (unverändert)

- [ ] **Step 5: Vitest-Konfiguration prüfen**

```bash
npm test
```

Falls Tests fehlschlagen wegen @vitejs/plugin-react 6: `vitest.config.ts` anpassen.
(Hinweis: @vitejs/plugin-react wird in dieser App nur von Vitest verwendet, nicht von Next.js selbst.)

- [ ] **Step 6: Quality Gates prüfen**

```bash
/check
```

Erwartet: alle Gates grün

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json eslint.config.mjs vitest.config.ts tsconfig.json
git commit -m "$(cat <<'EOF'
chore: upgrade build toolchain to major versions

- typescript: 5.x → 6.x
- @vitejs/plugin-react: 5.x → 6.x
- eslint: 9.x → 10.x
- shadcn CLI: 3.x → 4.x
EOF
)"
```

(Nur geänderte Dateien stagen — nicht alle aufgelisteten Dateien müssen zwingend geändert worden sein.)

---

## Task 4: lucide-react 1.x

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json` (automatisch)
- Modify: `src/**/*.tsx` — Icon-Import-Fixes falls nötig (46 Dateien nutzen lucide-react)

- [ ] **Step 1: Range in package.json anpassen**

```json
"lucide-react": "^1"
```

- [ ] **Step 2: Installieren**

```bash
npm install
```

- [ ] **Step 3: TypeScript-Fehler prüfen**

```bash
npx tsc --noEmit
```

Bekannte Breaking Changes in lucide-react 1.x:

- `LucideIcon` ist weiterhin als Typ exportiert — Import-Pfad bleibt gleich
- Einzelne Icon-Namen wurden in der 0.x-Serie deprecated und in 1.x entfernt
- Jeden TypeScript-Fehler nachschlagen: welches Icon fehlt, Ersatz suchen unter https://lucide.dev/icons

Für jeden `Module '"lucide-react"' has no exported member 'XyzIcon'`-Fehler:

1. Neuen Icon-Namen auf lucide.dev suchen
2. Import in der betroffenen Datei ersetzen

- [ ] **Step 4: Quality Gates prüfen**

```bash
/check
```

Erwartet: alle Gates grün

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/
git commit -m "chore: upgrade lucide-react to 1.x"
```

---

## Task 5: recharts 3.x

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json` (automatisch)
- Modify: `src/components/ui/chart.tsx` — falls recharts 3 API-Änderungen

- [ ] **Step 1: Range in package.json anpassen**

```json
"recharts": "^3"
```

- [ ] **Step 2: Installieren**

```bash
npm install
```

- [ ] **Step 3: TypeScript-Fehler in chart.tsx prüfen und fixen**

```bash
npx tsc --noEmit
```

`chart.tsx` importiert recharts als `import * as RechartsPrimitive from "recharts"` und nutzt:

- `RechartsPrimitive.ResponsiveContainer`
- `RechartsPrimitive.Tooltip`
- `RechartsPrimitive.Legend`
- `RechartsPrimitive.LegendProps`

Bekannte Breaking Changes in recharts 3.x:

- `ResponsiveContainer` wurde überarbeitet — Prop-Typen können sich geändert haben
- Einige deprecated Props wurden entfernt
- Jeden TypeScript-Fehler in `chart.tsx` anhand des recharts 3 Changelogs fixen

- [ ] **Step 4: Quality Gates prüfen**

```bash
/check
```

Erwartet: alle Gates grün

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/ui/chart.tsx
git commit -m "chore: upgrade recharts to 3.x"
```
