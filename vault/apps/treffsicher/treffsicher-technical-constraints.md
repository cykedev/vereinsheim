---
id: treffsicher-technical-constraints
type: guide
title: "Treffsicher — Technische Rahmenbedingungen"
aliases: ["Technische Rahmenbedingungen — Verbindliche Regeln"]
keywords: [treffsicher, technische, rahmenbedingungen, verbindliche, regeln, compose.yml, Dockerfile, pnpm, Migrations-Job, Upload-Volume, Dateistruktur]
part_of: ["[[treffsicher]]"]
governed_by: ["[[adr-032]]"]
---

**TL;DR** Dieses Dokument definiert verbindliche technische Entscheidungen für das Projekt.

# Technische Rahmenbedingungen — Verbindliche Regeln

Dieses Dokument definiert verbindliche technische Entscheidungen für das Projekt.
Diese Regeln dürfen nicht ohne explizite Überprüfung und Begründung geändert werden.

**Weitere verbindliche Constraint-Dokumente:**

- Code-Stil, TypeScript, Zod, Testing: [[treffsicher-code-conventions]]
- Datenmodell, Env-Vars, Disziplinen, Ergebniserfassung: [[treffsicher-data-model]]

## Index

- **Hosting / Entwicklungsumgebung** — Docker Compose im Monorepo (Root-`compose.yml`, Dev-Postgres aus Root-`docker-compose.dev.yml`), Node.js 26
- **Persistenz** — PostgreSQL + Named Volumes, Upload-Volume `/app/uploads`, Dateinamen als UUID
- **Datenbank-Migrationen** — Prisma Migrate deploy im Migrations-Job vor dem App-Start, P3009-Recovery-Script, kein Datenverlust
- **Tech Stack + Prisma 7** — Verbindliche Versionen; Prisma 7 breaking changes (Client-Pfad, Adapter, Config)
- **Daten- und Aktionsarchitektur** — Server Actions, Zod, useActionState, serverseitige Konsistenzregeln
- **Authentifizierung & Sicherheit + DoS-Schutz** — NextAuth v4, bcrypt, Session-Invalidierung, Rate-Limits
- **Linting + Dateistruktur** — ESLint v9 Flat Config, Prettier, verbindliche Verzeichnisstruktur
- **Modularität & Wartbarkeit** — Dateigrössen-/Split-Regel, Props-Budget, Feature-Struktur, Duplikationsregel
- **Design & UI** — hell und dunkel nach [[adr-032]] (bis zum Umzug fest dunkel), 8 verbindliche UI-Konsistenzregeln
- **Betrieb / Sprache / Versionskontrolle** — Fehlerfälle, Sprachmatrix, Git-Regeln

---

## Hosting & Betrieb

- **Zielplattform**: Self-hosted via Docker Compose (Produktion: VPS, im `vereinsheim`-Monorepo, Root-`compose.yml`)
- **Portabilität**: Kein plattformspezifischer Code — die App muss auf jeder Docker-Compose-Umgebung lauffähig sein
- **Konfiguration**: Alle umgebungsabhängigen Werte (DB-URL, Secrets, Pfade) über Umgebungsvariablen in `.env` — niemals hart im Code verdrahtet
- **Node.js-Version**: 26, Active LTS ab 28. Oktober 2026 (im Root-`Dockerfile`: `FROM node:26-alpine`)

---

## Entwicklungsumgebung

- **Lokale Entwicklung**: PostgreSQL aus der Root-`docker-compose.dev.yml` (ein geteilter Container, je App eine Dev-DB); die App läuft auf dem Host mit Hot-Reload (`pnpm dev`, Port 3001)
  - Start an der Repo-Wurzel: `docker compose -f docker-compose.dev.yml up -d`, dann `pnpm dev` (oder `pnpm dev --filter treffsicher`)
- **Produktionsumgebung**: Root-`compose.yml`
  - Enthält: `app-treffsicher` (Image aus dem Root-`Dockerfile`), den Migrations-Job `migrate-treffsicher`, den geteilten PostgreSQL-Container und das Upload-Volume
- **Kein Mischen**: Dev- und Prod-Konfigurationen sind strikt getrennt (eigener Compose-Projektname, eigene Volumes)

---

## Persistenz

### Datenbank

- **System**: PostgreSQL (geteilter Container im Monorepo-Stack, eigene Datenbank `treffsicher` mit eigener Rolle)
- **Volume**: Named Docker Volume für Datenbankdaten (`postgres_data`)
- **Kein Datenverlust** durch Container-Neustart oder Image-Updates

### Datei-Uploads

- **Speicherort**: Lokales Docker Volume, gemountet in den App-Container
- **Pfad im Container**: `/app/uploads`
- **Volume-Name**: `uploads_treffsicher`
- **Kein Cloud-Dienst** — volle Kontrolle, keine externe Abhängigkeit
- **Maximale Dateigrösse**: 10 MB pro Datei
- **Erlaubte Dateitypen**: JPEG, PNG, WebP (Bilder) und PDF
- **Dateinamen**: Werden serverseitig durch eine zufällige UUID ersetzt (kein Originalname im Filesystem)

---

## Datenbank-Migrationen

- **Tool**: Prisma Migrate
- **Strategie**: `prisma migrate deploy` läuft **automatisch vor dem App-Start** im One-shot-Job `migrate-treffsicher` (Image-Target `migrator`, `scripts/run-migrations-with-recovery.sh`); die App startet erst nach dessen erfolgreichem Abschluss
- **Recovery bei P3009**: Wenn ein Migrationseintrag in `_prisma_migrations` als fehlgeschlagen markiert ist,
  startet ein Recovery-Script automatisch. Bekannte, explizit freigegebene Fälle werden aufgelöst und
  `prisma migrate deploy` wird erneut ausgeführt.
- **Sicherheitsgrenze**: Unbekannte fehlgeschlagene Migrationen werden standardmässig **nicht**
  automatisch aufgelöst (`PRISMA_AUTO_RESOLVE_UNKNOWN_FAILED_MIGRATIONS=false`).
- **Regel**: Jede Schemaänderung erzeugt eine neue Migration via `prisma migrate dev` (lokal)
- **Keine destructiven Migrationen** ohne expliziten Kommentar und Backup-Hinweis
- **Migrationsdateien** werden im Repository eingecheckt (`apps/treffsicher/prisma/migrations/`)
- **Garantie**: Datenverlust durch Schemaänderungen ist ein kritischer Fehler und muss verhindert werden

---

## Tech Stack (verbindlich)

| Bereich         | Technologie             | Version      |
| --------------- | ----------------------- | ------------ |
| Framework       | Next.js (App Router)    | 16.x         |
| Runtime         | React                   | 19.x         |
| Sprache         | TypeScript              | 6.x          |
| Datenbank       | PostgreSQL              | 15.x         |
| ORM             | Prisma                  | 7.x          |
| Auth            | NextAuth.js             | 4.x (stabil) |
| UI-Komponenten  | shadcn/ui               | aktuell      |
| Styling         | Tailwind CSS            | 4.x          |
| Charts          | SVG aus `@vereinsheim/shot-ui` (wie Spiegel) | -            |
| Package Manager | pnpm (Workspace)        | 10.x         |
| Container       | Docker + Docker Compose | -            |

---

### Prisma 7 — wichtige Abweichungen von früheren Versionen

Prisma 7 hat breaking changes, die die Implementierung betreffen:

- **Client-Generierung**: In `src/generated/prisma/` (konfiguriert in `schema.prisma` via `output`), nicht in `node_modules/@prisma/client`. Import immer via `@/generated/prisma/client`.
- **Datenbankverbindung**: Kein `url`-Feld in `datasource db` von `schema.prisma`. Stattdessen `prisma.config.ts` im App-Root (`apps/treffsicher/`) für Migrations-CLI. Application-Code nutzt `@prisma/adapter-pg` mit `pg.Pool`.
- **Zusätzliche Pakete**: `@prisma/adapter-pg`, `pg`, `@types/pg`, `dotenv` werden benötigt.

`src/lib/db.ts` mit Prisma 7 Adapter:

```typescript
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

function createPrismaClient(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }
export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}
```

---

## Daten- und Aktionsarchitektur

- **Server Actions** statt API Routes für alle Formular-Aktionen und Datenbankoperationen
- Server Actions laufen serverseitig, werden direkt aus React-Komponenten aufgerufen
- Kein separates API-Layer nötig — weniger Boilerplate, einfacher zu verstehen
- Validierung via **Zod** (serverseitig in jeder Server Action)
- Formulare nutzen den React `useActionState` Hook für Fehler-Feedback

### Verbindliche Konsistenzregeln (fachlich + technisch)

1. **Fachregeln werden serverseitig erzwungen** (nicht nur im UI):
   - Attachments sind nur bei `TRAINING` und `WETTKAMPF` erlaubt.
   - Prognose und Feedback sind nur bei `TRAINING` und `WETTKAMPF` erlaubt.
2. **Fehlerpfade sind immer explizit und nutzerführend**:
   - Server Actions liefern strukturierte Rückgaben (ActionResult-Stil) statt stillen Abbrüchen.
   - Es gibt kein "silent fail": Jede Aktion liefert für die UI ein klares Erfolg-/Fehlersignal.
3. **Upload-Whitelist ist verbindlich**:
   - Erlaubte MIME-Typen sind ausschliesslich `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
4. **Interne Benennung bleibt konsequent englisch**:
   - Komponenten, Funktionen, Dateinamen und Routen/URL-Segmente sind intern englisch.
   - Neue interne deutsche Benennungen oder deutsche URL-Segmente sind nicht erlaubt.

---

## Authentifizierung & Sicherheit

- **Methode**: Email + Passwort via NextAuth.js v4
- **Passwörter**: Gehasht mit bcrypt, niemals im Klartext gespeichert
- **Sessions**: Server-seitig via NextAuth.js Session-Tokens
- **Datenisolation**: Jeder Datenbankzugriff filtert zwingend nach `userId` — kein Nutzer sieht fremde Daten
- **Kein E-Mail-Versand** im ersten Schritt — kein Mail-Reset-Flow
- **Passwortwechsel (Self-Service)**: Nur im eingeloggten Zustand mit aktuellem Passwort (`/profile`)
- **Passwort vergessen**: Reset weiterhin nur durch Admin
- **Session-Invalidierung bei Passwortwechsel**: Passwortwechsel/-Reset erhöht `sessionVersion`; alte JWT-Sessions werden dadurch serverseitig ungültig
- **HTTPS**: In Produktion zwingend (via Reverse Proxy — Caddy auf dem VPS)
- **Secrets**: `NEXTAUTH_SECRET` und Datenbank-Credentials nur via Umgebungsvariablen

### DoS-Schutz (verbindlich)

- **Login-Rate-Limit**: Buckets pro E-Mail und pro IP in der Datenbank (`LoginRateLimitBucket`, in Tests im Speicher; `maxAttemptsPerEmail=5`, `maxAttemptsPerIp=30`, Fenster/Blockdauer je 15 Minuten). Anmeldeablauf, Store und Admin-Auswertung aus `@vereinsheim/lib/auth/*` (gemeinsam mit Ringwerk und Spiegel)
- **Gleich lange Antwort**: Eine unbekannte oder deaktivierte E-Mail kostet so viel Zeit wie eine bekannte (bcrypt gegen einen festen Hash, `authorizeCredentials`), die Antwortzeit verrät keine Konten
- **Login-Rate-Limit Speichergrenze**: Maximale Anzahl Buckets konfigurierbar (`AUTH_RATE_LIMIT_MAX_BUCKETS`, Standard 10'000), älteste Buckets werden bei Erreichen der Grenze verdrängt
- **Proxy-Header-Vertrauen**: IP-basierte Limits nutzen `x-real-ip`/`x-forwarded-for` nur wenn `AUTH_TRUST_PROXY_HEADERS=true` gesetzt ist (sicherer Default: aus)
- **Meyton-URL-Import**:
  - `fetch` mit `AbortController` (Timeout 15 Sekunden)
  - Keine Redirects (`redirect: "manual"`)
  - `Content-Length` Vorab-Prüfung auf 10 MB
  - Streaming-Download mit hartem Abbruch > 10 MB (kein ungebremstes `arrayBuffer()`)
- **Meyton-PDF-Parsing** (pdf.js via `unpdf`; alle Grenzen greifen während des Parsens, Details [[treffsicher-meyton-import]]):
  - Maximal 20 Seiten
  - Maximal 50'000 Textitems und 200'000 Zeichen extrahierter Text
  - Maximal 15 Sekunden Parse-Zeit
- **Session-FormData (Server Action)**:
  - Maximal 120 Serien pro Request
  - Maximal 120 Schusswerte pro Serie (beim JSON-Array)
  - Maximal 16 KB JSON-Text pro `shots`-Feld
  - Maximal 100 Ziel-IDs (`goalIds`) pro Request
- **Statistik-Abfragen**:
  - Harte Server-Caps pro Request: max. 1'200 Sessions bzw. 12'000 Serienpunkte
  - Ergebnisdarstellung bleibt chronologisch (intern `desc` + Reverse)

---

## Linting & Formatierung

> **Monorepo:** ESLint-, Prettier-, tsconfig-, PostCSS- und Next-Config liegen in
> `@vereinsheim/config` (`packages/config`) — die App-Dateien sind dünne Stubs
> (`eslint.config.mjs` re-exportiert; Prettier kommt über das `package.json`-Feld `"prettier"`, eine
> `.prettierrc` gibt es nicht). **Kanonische Quelle ist das Paket**, nicht die App — Verhalten und
> Regeln ändert man dort, nicht in den Apps. Die Snippets zeigen den Paketstand (`packages/config`).

### Tools

| Tool     | Zweck                        | Konfiguration (Quelle)                                   |
| -------- | ---------------------------- | -------------------------------------------------------- |
| ESLint   | Code-Qualität, Fehler finden | `@vereinsheim/config/eslint` (Stub: `eslint.config.mjs`) |
| Prettier | Code-Formatierung            | `@vereinsheim/config/prettier` (Feld in `package.json`)  |

### ESLint-Konfiguration

ESLint v9 Flat Config. Die geteilte Config liegt in `@vereinsheim/config`
(`packages/config/eslint/index.mjs`) und nutzt `defineConfig`/`globalIgnores` (kein `.eslintrc.json`,
kein `FlatCompat`):

```js
// packages/config/eslint/index.mjs — kanonisch; Regeln hier ändern, nicht in der App
import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    rules: {
      // Ungenutzte Variablen sind ein Fehler — verhindert toten Code
      "no-unused-vars": "off",
      // ausgenommen Geschwister eines Rests: `const { a: _a, ...rest } = x` lässt bewusst `a` weg
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
      // console.log() ist verboten im Code, console.error/warn erlaubt für Fehlerlogging
      "no-console": ["warn", { allow: ["error", "warn"] }],
      // any-Typen verbieten — lieber unknown mit expliziter Prüfung
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
])

export default eslintConfig
```

Die App-Datei `eslint.config.mjs` ist ein Re-Export-Stub:

```js
// eslint.config.mjs
export { default } from "@vereinsheim/config/eslint"
```

### Prettier-Konfiguration

Die Optionen liegen in `@vereinsheim/config` (`packages/config/prettier/index.json`) und werden über
das `package.json`-Feld `"prettier": "@vereinsheim/config/prettier"` eingebunden — eine eigene
`.prettierrc` hat die App **nicht**. Inhalt des Pakets:

```json
{
  "semi": false,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Regeln

- **Vor jedem Commit**: `pnpm check` an der Repo-Wurzel (lint, format:check, test, check-types, build) muss fehlerfrei durchlaufen
- **Hinweis**: Next.js 16 hat kein `next lint` — das `lint`-Script nutzt direkt `eslint src`
- **Kein Auto-Fix beim Commit** (kein Husky/lint-staged — zu viel Setup-Aufwand)
- **`no-console`**: `console.log()` ist verboten, `console.error()` und `console.warn()` erlaubt
- **`no-unused-vars`**: Ungenutzte Variablen sind ein Fehler, nicht nur eine Warnung
- **Keine `any`-Typen**: ESLint-Fehler bei `any` (`@typescript-eslint/no-explicit-any`)

### Paket-Scripts (verbindlich)

`apps/treffsicher/package.json`; an der Repo-Wurzel ruft Turborepo dieselben Scripts für alle Apps auf (`pnpm lint`, `pnpm test`, `pnpm check` …).

```json
{
  "scripts": {
    "dev": "next dev --webpack -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "eslint src",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "check-types": "tsc --noEmit",
    "db:generate": "prisma generate"
  }
}
```

---

## Dateistruktur (verbindlich)

```
apps/treffsicher/
├── src/
│   ├── app/              # Next.js App Router (Seiten, Layouts, Route Handler)
│   ├── components/
│   │   ├── ui/           # app-eigene shadcn/ui-Komponenten (chart, form); geteilte aus @vereinsheim/ui
│   │   └── app/[feature]/ # Feature-spezifische Komponenten
│   ├── lib/              # Geschäftslogik, Server Actions, Datenbankzugriff, Hilfsfunktionen
│   │   ├── db.ts         # Prisma Client (Singleton)
│   │   ├── auth.ts       # NextAuth Konfiguration
│   │   └── [feature]/    # Feature-spezifische Logik
│   ├── generated/prisma/ # generierter Prisma Client (nicht eingecheckt)
│   └── types/            # Gemeinsame TypeScript-Typen
├── prisma/
│   ├── schema.prisma     # Datenbankschema
│   ├── seed.ts
│   └── migrations/       # Migrationsdateien (eingecheckt!)
├── scripts/              # Migrations-Recovery (run-migrations-with-recovery.sh, resolve-failed-migrations.mjs)
├── public/               # Statische Dateien
├── prisma.config.ts
└── .env.example          # Vorlage für Umgebungsvariablen (niemals echte Werte!)
```

An der Repo-Wurzel: `compose.yml` (Produktion), `docker-compose.dev.yml` (Dev-Postgres), `Dockerfile`
(Image aller Apps), `scripts/vereinsheim` (Betriebs-CLI); die Projektdoku liegt in `vault/`.

---

## Modularität & Wartbarkeit (verbindlich)

Diese Regeln sind verbindlich für **neuen Code** und für **wesentlich geänderte** bestehende Dateien.
Bestandsdateien werden schrittweise bei fachlichen Änderungen in Richtung dieser Regeln refaktoriert.

### 1) Dünne Orchestrator-Dateien

- `page.tsx`, `route.ts` und Action-Einstiegspunkte orchestrieren nur:
  - Auth/Param-Handling
  - Aufruf von Feature-Logik
  - Zusammenbau der Antwort/Komposition
- Fachlogik, Datenaufbereitung und Mapping gehören in dedizierte Module (`lib/`, Feature-`_lib/`, Hooks, View-Models).

### 2) Dateigröße und Split-Regel

- Zielbereich je Datei: **80–180 Zeilen**.
- Ab **>220 Zeilen** ist ein Split verpflichtend, wenn kein klarer technischer Ausnahmegrund vorliegt.
- Ausnahmen: generierter Code (`src/generated/*`) und externe Basisbibliotheken (`src/components/ui/*`).
- Hotfix-Ausnahme: Bei kritischen Fixes darf temporär darüber hinaus gearbeitet werden; der Split folgt im nächsten Wartungs-PR.

### 3) Props-Budget und Kopplung

- Komponenten sollen im Regelfall maximal **6 Top-Level-Props** haben.
- Bei größerem Datenbedarf: auf `model` + `actions` oder Feature-Hook aufteilen.
- Prop-Drilling über mehr als zwei Ebenen ist zu vermeiden; stattdessen Komposition, lokale Container-Komponente oder dedizierter Hook.
- Komponenten erhalten keine unstrukturierten Setter-Sammlungen mehrerer Domänen.

### 4) Einheitliche Feature-Struktur

- Komponenten-Dateien bleiben `PascalCase`; Hook-/Utility-Dateien bleiben `camelCase`; Ordnernamen bleiben `kebab-case`.
- Nicht-triviale Bereiche werden in einen Feature-Unterordner gruppiert:

```text
components/app/<feature>/<module>/
  index.ts
  <ModuleRoot>.tsx
  <SubPart>.tsx
  use<ModulePart>.ts
  types.ts
```

- Imports innerhalb desselben Feature-Unterordners nutzen relative Pfade (`./`, `../`); Alias-Imports (`@/...`) sind für feature-übergreifende Abhängigkeiten.

### 5) Duplikationsregel

- Logik, die an mehreren Stellen identisch oder nahezu identisch auftritt, wird in ein gemeinsames Modul extrahiert.
- Spätestens beim dritten Vorkommen ist ein Split in Shared-Utility/Helfer verpflichtend.
- Bewusste Duplikate müssen mit kurzem Kommentar begründet werden.

### 6) Refactor-Sicherheitsnetz

- Struktur-Refactors dürfen kein Verhalten ändern.
- Pflicht vor Merge: `pnpm check` grün.
- Bei UI-Refactors ist die visuelle Konsistenz (Layout/Alignment) manuell zu prüfen.

---

## Design & UI

- **Responsiv**: Mobile und Desktop gleichwertig
- **Sprache**: Deutsch
- **Darstellung**: Abgelöst durch [[adr-032]]: hell und dunkel wie Spiegel, Wahl System, Hell oder Dunkel je Gerät. Umgesetzt, siehe [[treffsicher-design2]].
- **Offline**: Kein Offline-Support (offen, [[treffsicher-backlog]] T-06)

### Verbindliche UI-Konsistenzregeln

1. **Einheitliches Komponenten-System**:
   - Interaktive UI-Elemente (Dialoge, Auswahlen, Bestätigungen, Eingaben) nutzen durchgängig `shadcn/ui`.
   - Native Browser-Dialoge (`alert`, `confirm`) werden in App-Flows nicht verwendet.
2. **Einheitliches Auswahlmuster**:
   - Boolesche und Modus-Auswahlen nutzen ein konsistentes, klickbares Row-Muster.
   - Das gilt auch für "Leistungsziel erreicht", "Probe/Wertung" und analoge Umschalter.
3. **Konsistente Flows für Anlegen und Löschen/Archivieren**:
   - "Neu anlegen"-Aktionen folgen durchgängig demselben Muster (Bezeichnung, Platzierung, Route `/.../new`).
   - Destruktive Aktionen fragen über `DecisionDialog` und nennen ihre Folgen in Alltagsworten (Wortlaut in `src/lib/consequences.ts`, [[treffsicher-design2]]).
4. **Mobil ist gleichwertig, nicht reduziert**:
   - Navigation und zentrale Aktionen bleiben auf Mobilgeräten textlich verständlich.
   - Das Interaktionsverhalten ist auf Desktop und Mobil konsistent.
5. **Detailnavigation folgt dem Einheiten-Muster (Referenz)**:
   - Detailseiten nutzen eine obere Action-Leiste rechts und darunter die inhaltlichen Metadaten.
   - Aktionsreihenfolge: zuerst fachliche/sekundäre Aktionen, danach destruktive Aktion, "Zurück" am Ende.
   - Dieses Muster gilt durchgängig für Einheiten, Ziele, Abläufe und Disziplinen.
6. **Listen-/Detail-Flow ist einheitlich**:
   - Verwaltungslisten zeigen kompakte Karten; die ganze Karte öffnet die jeweilige Detailseite.
   - Zusätzliche "Details/Anzeigen"-Buttons in Listen werden vermieden.
7. **Reine Icon-Aktionen ohne Outline**:
   - Reine Icon-Buttons verwenden `ghost` (borderlos), nicht `outline`.
   - `outline` ist für textliche oder gemischte (Icon+Text) Aktionen vorgesehen.
8. **Terminologie in der UI**:
   - In nutzerseitigen Texten wird "Probe" verwendet (nicht "Probeschuss"), z.B. "Probe-Serie".

---

## App-Name

**Treffsicher** — Docker Image: `treffsicher`, App-Port im Container: `3000`, Dev-Port auf dem Host: `3001`

---

## Datensicherung & Import

- **Backup**: über das Monorepo-Tooling (`vereinsheim backup`, täglicher Cron auf dem VPS) — kein app-seitiger Mechanismus nötig
- **Import**: Kein Massenimport von Bestandsdaten; einzige Ausnahme ist der manuelle Meyton-PDF-Import pro einzelner Einheit

---

## Betrieb & Fehlerfälle (verbindlich)

- Betriebsdokumentation: Deployment/Backup/Restore laufen im Monorepo über `./scripts/vereinsheim` (siehe [[operations]]).
- Für kritische Fehlerfälle (DB nicht erreichbar, Migration fehlgeschlagen, Upload-Volume nicht verfügbar, fehlende Secrets) gibt es dokumentierte Diagnose- und Wiederanlauf-Schritte.
- Nutzer erhalten in der UI klare deutsche Fehlermeldungen; technische Details bleiben im Server-Log.
- Wiederherstellbarkeit von Datenbank **und** Uploads muss regelmässig praktisch geprüft werden (Restore-Test).

---

## Sprache

- **UI-Sprache**: Deutsch
- **Code-Sprache (Identifier)**: Englisch (Variablennamen, Funktionsnamen, Komponenten-Namen, Dateinamen, Routen/URL-Segmente)
- **Code-Kommentare**: Deutsch
- **Dokumentation**: Deutsch (`vault/`, README)
- **Fehlermeldungen für Nutzer**: Deutsch
- **Commit-Messages**: Englisch

---

## Versionskontrolle

- **Migrationsdateien** werden immer eingecheckt
- **`.env`** niemals eingecheckt
- **`node_modules/`** niemals eingecheckt
- **Uploads-Verzeichnis** niemals eingecheckt
