# Design: Dependency-Update

**Datum:** 2026-04-06
**Scope:** Alle veralteten npm-Pakete auf aktuelle Versionen bringen — sichere Updates und Major-Upgrades in getrennten, gruppierten Commits.

---

## Ziel

Alle `npm outdated`-Pakete aktualisieren. Sichere Patch/Minor-Updates zuerst, dann Major-Upgrades nach Risikograd gruppiert — jede Gruppe als eigener Commit, damit bei Problemen gezielt revertiert werden kann.

---

## Commit-Strategie

### Commit 1 — Sichere Updates (npm update)

`npm update` innerhalb der bestehenden semver-Ranges:

| Paket                | Von    | Nach   |
| -------------------- | ------ | ------ |
| @prisma/adapter-pg   | 7.4.2  | 7.6.0  |
| @prisma/client       | 7.4.2  | 7.6.0  |
| prisma               | 7.4.2  | 7.6.0  |
| @react-pdf/renderer  | 4.3.2  | 4.3.3  |
| @tailwindcss/postcss | 4.2.1  | 4.2.2  |
| tailwindcss          | 4.2.1  | 4.2.2  |
| @types/pg            | 8.18.0 | 8.20.0 |
| dotenv               | 17.3.1 | 17.4.1 |
| react                | 19.2.3 | 19.2.4 |
| react-dom            | 19.2.3 | 19.2.4 |
| vitest               | 4.0.18 | 4.1.2  |

**Vorgehen:** `npm update` → `/check` → commit.
**Erwartete Breaking Changes:** keine.

---

### Commit 2 — Next.js-Ökosystem

| Paket              | Von    | Nach   | package.json-Range               |
| ------------------ | ------ | ------ | -------------------------------- |
| next               | 16.1.6 | 16.2.2 | `"16.1.6"` → `"16.2.2"` (pinned) |
| eslint-config-next | 16.1.6 | 16.2.2 | `"16.1.6"` → `"16.2.2"` (pinned) |

**Vorgehen:** Pins in package.json anpassen → `npm install` → `/check` → commit.
**Erwartete Breaking Changes:** keine (minor bump).

---

### Commit 3 — Build-Toolchain

| Paket                | Von    | Nach | package.json-Range  |
| -------------------- | ------ | ---- | ------------------- |
| typescript           | 5.9.3  | 6.x  | `"^5"` → `"^6"`     |
| @vitejs/plugin-react | 5.1.4  | 6.x  | `"^5.1.4"` → `"^6"` |
| eslint               | 9.39.4 | 10.x | `"^9"` → `"^10"`    |
| shadcn               | 3.8.5  | 4.x  | `"^3.8.5"` → `"^4"` |

**Vorgehen:** Ranges in package.json anpassen → `npm install` → Fehler beheben → `/check` → commit.

**Mögliche Breaking Changes:**

- TypeScript 6: stricter type checking, neue Fehler möglich
- ESLint 10: Config-Format kann sich geändert haben (`eslint.config.*`)
- @vitejs/plugin-react 6: vitest-Konfiguration kann betroffen sein
- shadcn 4: CLI-Tool, kein Runtime-Impact

---

### Commit 4 — lucide-react 1.x

| Paket        | Von     | Nach | package.json-Range    |
| ------------ | ------- | ---- | --------------------- |
| lucide-react | 0.575.0 | 1.x  | `"^0.575.0"` → `"^1"` |

**Vorgehen:** Range anpassen → `npm install` → alle Icon-Usages scannen → Fixes → `/check` → commit.

**Bekannte Breaking Changes in 1.x:**

- `LucideIcon` TypeAlias umbenannt zu `LucideIcon` (Typ-Import-Pfad geändert)
- Einzelne Icon-Namen wurden umbenannt oder entfernt
- Alle `import { XyzIcon } from 'lucide-react'` im Codebase prüfen

---

### Commit 5 — recharts 3.x

| Paket    | Von    | Nach | package.json-Range   |
| -------- | ------ | ---- | -------------------- |
| recharts | 2.15.4 | 3.x  | `"^2.15.4"` → `"^3"` |

**Vorgehen:** Range anpassen → `npm install` → alle Chart-Usages scannen → Fixes → `/check` → commit.

**Bekannte Breaking Changes in 3.x:**

- Einige Chart-Props umbenannt oder entfernt
- `CartesianAxis`-API-Änderungen
- Default-Werte für Animation geändert
- Alle `recharts`-Importe und Component-Props im Codebase prüfen

---

## Qualitätssicherung

Nach jeder Gruppe: `/check` muss grün sein (lint + format + tests + TypeScript) bevor committet wird. Fixes für Breaking Changes werden inline in der jeweiligen Gruppe gemacht.
