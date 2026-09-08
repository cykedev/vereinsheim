# Plan: App-Polish — Konsistenz, Theme, Korrektheit, Pakete, Dashboards (Ringwerk × Treffsicher)

## Context (warum)

Einschätzung vom 2026-09-08 (Code-Scan beider Apps gegen `vault/conventions.md`, beide Testsuiten
grün: 638 / 321 Tests). Die Codebasis ist solide; die Schwächen liegen fast alle auf einer Ebene:
**die Konventionen sind in Ringwerk nur teilweise angekommen**, und das gemeinsame Theme ist das
unveränderte shadcn-Grau ohne Identität. Konkret gemessen:

- **Layout:** 22 Ringwerk-Seiten setzen `mx-auto max-w-3xl|max-w-lg … px-4 py-8` **innerhalb** des
  App-Layouts, das schon `mx-auto max-w-6xl px-4 py-8` hat → doppeltes Padding, 768px statt 1152px
  Inhaltsbreite. Treffsicher nutzt in **0** Seiten einen eigenen Container.
- **Kanon-Verstöße Ringwerk:** Login-Logo `Target` statt `CircleDot` (§4) + `Anmelden...` (ASCII);
  12 inline-Leerzustände statt `EmptyState`; 4× „Details →“/„Rangliste →“-Buttons (§7 verbietet);
  7 Wettbewerbs-Unterseiten mit eigenem Header-Muster (Back-Button links + `outline`-Icon-Buttons
  `h-9 w-9`) statt `DetailActionBar`; h1 ohne `tracking-tight`. Treffsicher: `SessionDetailHeader`
  h1 `font-bold`; Tippfehler „temporaeres“ (Backlog T-10 offen).
- **Zeitzone/Locale (Bugs):** [AuditLogList.tsx:20](../apps/ringwerk/src/components/app/auditLog/AuditLogList.tsx:20)
  `toLocaleString("de-DE")` **ohne `timeZone`** → im Container (UTC) sind Protokoll-Zeiten um 1–2 h
  verschoben. 7 Ringwerk-PDF-Renderer (`toLocaleDateString` ohne TZ) → als Mitternacht-Berlin
  gespeicherte Termine kippen in UTC auf den Vortag. `AdminLoginRateLimitTable` (Ringwerk) hardcodet
  `timeZone: "Europe/Zurich"`. Insgesamt 12 (RW) + 22 (TS) inline-Formatter mit gemischten Locales
  `de-CH`/`de-DE`/`sv-SE`.
- **Theme:** `packages/ui/theme.css` = shadcn-Neutral (Chroma 0, Primary ≈ weiß, Shadows aus).
  Farbsemantik (Grün = Sieg, Gold/Silber/Bronze = Rang — dokumentiert in `color-semantics`) ist
  **hardcoded**: 86 Treffer in Ringwerk, 20 in Treffsicher (`text-emerald-600 dark:text-emerald-400`
  usw., `dark:`-Varianten greifen bei hartem `class="dark"` nie). Kontrast: `text-muted-foreground/60|70|80`
  + `text-[11px]`/`text-[10px]` (unter WCAG AA).
- **Duplikate:** `authValidation.ts` (byte-identisch), `auth-rate-limit/{config,limiter,normalization,types}.ts`
  (byte-identisch, Tests nur in Treffsicher), `AdminLoginRateLimitTable`/`-Insights` (~300 Zeilen,
  Ringwerk-Variante ohne `displayTimeZone`), Treffsicher-`Table`-Primitive vs. 9 rohe `<table>` in
  Ringwerk, Ringwerk-`Skeleton` vs. 0 `loading.tsx` in Treffsicher.
- **ActionResult:** Treffsicher hat 3× `type ActionResult = { error?; success? }` + `GoalActionResult`,
  `AdminActionResult`, `AccountActionResult` (Backlog T-08, Vault-Incident `treffsicher-actionresult-migration`).
- **Metadata/Icons:** nur der Root-Titel je App (kein `metadata` in 46 Seiten); Ringwerk **kein**
  Favicon, Treffsicher Next-Default-`favicon.ico` + 5 Vercel-Beispiel-SVGs in `public/` (0 Referenzen).
- **Dashboards:** Treffsicher = 6 Karten, die nur die Navigation wiederholen; Ringwerk = volle
  Tabellen untereinander + „Details →“.

## Entscheidungen (im Plan getroffen — vor Freigabe prüfen)

| # | Entscheidung | Begründung |
|---|---|---|
| E1 | **Locale `de-DE`** für alle Datums-/Zahlenformatierung (ein Konstante `APP_LOCALE`) | Default-TZ ist `Europe/Berlin`; Datumsausgabe ist mit `de-CH` identisch (`08.09.2026`, `14:05`), nur Tausender (`1.234` statt `1’234`) und Dezimal (`9,7`) ändern sich — Letzteres deckt sich mit der Ringwerk-Regel „`.toFixed()` → `.replace(".", ",")`“. |
| E2 | **Akzentfarbe je App** über `data-app` auf `<html>`, Palette **im Paket** (`theme.css`), nicht in der App | `src/app/globals.css` ist byte-identisch im Drift-Gate (`MUST_MATCH`); ein App-Override dort wäre Drift. Ringwerk = Messing/Amber `oklch(0.80 0.15 75)`, Treffsicher = Teal `oklch(0.76 0.12 175)`. |
| E3 | **Semantische Farb-Tokens** `success / warning / info / rank-1 / rank-2 / rank-3` in `theme.css`; alle Palette-Klassen in Komponenten werden darauf gemappt | Farbsemantik einmal definiert, `dark:`-Duplikate entfallen. |
| E4 | Ringwerk-Seiten: **Listen** ohne eigenen Container (volle 6xl wie Treffsicher), **Formular-Seiten** behalten `mx-auto max-w-lg` (ohne `px-4 py-8`) | Konvention §3: per-Seite `max-w` „bewusst“ erlaubt; Formulare bleiben lesbar schmal. |
| E5 | **Kein** neues `packages/auth`; nur die **reinen** Module wandern nach `packages/lib/src/auth/*` (Validation, Rate-Limit-Kern). `store.ts`, `auth.ts`, `auth-helpers.ts`, `startup.ts` bleiben app-lokal | Sie hängen am app-eigenen Prisma-Client (`@/lib/db`); Dependency-Injection des Clients wäre ein eigener Refactor. |
| E6 | Treffsicher-Dashboard bekommt **Inhalt** (letzte 5 Einheiten, aktive Ziele, 2 Kennzahlen); Ringwerk-Dashboard **Karten** mit Top-6-Zeilen + Titel-Link statt „Details →“ | §7: ganze Karte/Titel ist Link, keine „Details →“-Buttons. |
| E7 | **Nicht** im Scope: PDF-Stack-Vereinheitlichung (react-pdf vs. simple-pdf), Route-Angleichung `/` vs `/dashboard`, Umbenennung `ADMIN_*`/`SEED_ADMIN_*` (deploy-breaking, eigener Schritt laut Vault), Entfernen der Light-Palette, Orthografie ss/ß in Treffsicher-UI-Texten | Groß bzw. Deploy-Vertrag bzw. Geschmacksfrage — jeweils eigener Plan, falls gewünscht. |

## Approach

Sechs Phasen, **in dieser Reihenfolge** (jede Phase baut auf der vorigen; Phasen A–E laufen autonom,
Phase F ist manuell):

- **A — Quick wins (Ringwerk-Kanon, Treffsicher-Reste)**: Container, Login, EmptyState, DetailActionBar, Tippfehler, h1.
- **B — Formatierung & Zeitzone**: ein isomorphes `@vereinsheim/lib/format`, alle inline-Formatter ersetzen, Audit-Log- und PDF-TZ-Bugs fixen.
- **C — Theme**: semantische Tokens + App-Akzent, Palette-Klassen mappen, Kontrast, Recharts-Hack raus.
- **D — Struktur/Pakete**: `Table`/`Skeleton` → `@vereinsheim/ui`; Auth-Kern → `@vereinsheim/lib/auth`; gemeinsame Rate-Limit-Admin-UI; ActionResult-Kanon in Treffsicher; Navigation, Konto-Seite, Metadata, Favicons, `loading.tsx`.
- **E — Dashboards**.
- **F — Gates & Doku (manuell, geschützte Pfade)**: `scripts/consistency-check.sh` erweitern, `vault/conventions.md` + Vault-Notes nachziehen.

**Autopilot-Hinweis (ADR-023):** Alle Tasks in A–E liegen in `apps/*`, `packages/*` und `vault/` (nicht
`vault/decisions/`) → autonom lauffähig. **F1 berührt `scripts/`** (geschützt, `autopilot-guard`) → dort
HALTet `/implement` planmäßig; F1 wird danach mit `/implement --step` oder manuell umgesetzt
(siehe Incident `autopilot-guard-blocks-contract-only-plans`).

## Required Docs (vor dem ersten Task lesen)

- `vault/conventions.md` (§1–§9; besonders §2 Komponenten-Kanon, §3 Typografie, §4 Icons, §5 Navigation, §6 Formatierung, §7 Listen)
- `vault/domain/component-canon.md`, `vault/domain/navigation-pattern.md`, `vault/domain/typography-layout-rules.md`, `vault/domain/data-formatting-rules.md`
- `vault/apps/ringwerk/color-semantics.md` (Bedeutung der Farben — Grundlage für die Token-Zuordnung)
- `apps/ringwerk/CLAUDE.md` (Compliance Rules: kein `DropdownMenu` für Objektaktionen, `bg-card` bei `rounded-lg border`, Icon-Buttons min. `h-10 w-10`, kein bare `toLocaleDateString`)
- `apps/treffsicher/CLAUDE.md` + `vault/apps/treffsicher/treffsicher-code-conventions.md` (Dateigrößen-/Split-Regel, ActionResult)
- `packages/ui/package.json` + `packages/lib/package.json` (Export-Muster: jeder Subpath explizit in `exports`)
- `vault/incidents/treffsicher-actionresult-migration.md`, `vault/incidents/treffsicher-backlog-state.md` (T-08, T-10 werden hier erledigt)

## Dateien (Karte)

**Neu**
- `packages/lib/src/format.ts` + `format.test.ts` — isomorphe Formatter (kein `server-only`)
- `packages/lib/src/auth/validation.ts` (+ `.test.ts`), `packages/lib/src/auth/rate-limit/{config,limiter,normalization,types,adminTypes}.ts` (+ 3 Tests)
- `packages/ui/src/ui/table.tsx`, `packages/ui/src/ui/skeleton.tsx` (verschoben aus den Apps)
- `packages/ui/src/admin/LoginRateLimitTable.tsx`, `packages/ui/src/admin/LoginRateLimitInsights.tsx`
- `apps/ringwerk/src/components/app/shell/CompetitionDetailHeader.tsx`
- `apps/ringwerk/src/components/app/dashboard/DashboardCompetitionCard.tsx`
- `apps/treffsicher/src/lib/types.ts`, `apps/treffsicher/src/lib/dashboard/selectDashboardData.ts` (+ `.test.ts`)
- `apps/{ringwerk,treffsicher}/src/app/icon.svg`
- `apps/treffsicher/src/app/(app)/{dashboard,sessions,statistics,goals,shot-routines,disciplines}/loading.tsx`

**Geändert (Auswahl, vollständige Listen in den Tasks)**
- `packages/ui/theme.css`, `packages/ui/package.json`, `packages/lib/package.json`, `packages/lib/src/dateTime.ts`
- `apps/*/src/app/layout.tsx`, `apps/*/src/components/app/shell/Navigation.tsx`, `apps/*/src/app/(app)/**/page.tsx`
- Ringwerk: 22 Seiten (Container), 7 Wettbewerbs-Unterseiten (Header), 7 PDF-Renderer + 7 PDF-Routen, Tabellen-Komponenten, `AuditLogList`, `rank-badge`, Playoff-Konstanten
- Treffsicher: ~33 Dateien ActionResult, 14 Dateien Formatter, `presentation.ts`, `users-table/formatting.ts`, Favoriten-Buttons

**Gelöscht**
- `apps/treffsicher/src/components/ui/table.tsx`, `apps/ringwerk/src/components/ui/skeleton.tsx`
- `apps/*/src/lib/authValidation.ts` (+ Treffsicher-Test), `apps/*/src/lib/auth-rate-limit/{config,limiter,normalization,types}.ts` (+ Tests)
- `apps/treffsicher/src/app/favicon.ico`, `apps/treffsicher/public/{file,globe,next,vercel,window}.svg`
- `apps/treffsicher/src/components/app/goals/goal-card-section/format.ts` (Formatter-Teil; `GOAL_TYPE_LABELS` bleibt)

---

## Tasks

Jeder Task = ein Commit. Gate je Task: `pnpm check` (lint, format:check, test, tsc, `next build`).
Test-Regel: Logik/Actions/Bugfix **test-first**; reine UI/Config bringt keinen Test, aber `next build` grün.

### Phase A — Quick wins

**A1 · Ringwerk: doppelte Seiten-Container entfernen**
Dateien (22): alle `page.tsx` unter `apps/ringwerk/src/app/(app)/` außer `competitions/[id]/page.tsx`
(reiner Redirect) — Liste: `account`, `admin/audit-log`, `admin/users`, `admin/users/new`,
`admin/users/[id]/edit`, `competitions`, `competitions/new`, `competitions/[id]/{audit-log,edit,participants,playoffs,ranking,schedule,series,standings}`,
`disciplines`, `disciplines/new`, `disciplines/[id]/edit`, `participants`, `participants/new`,
`participants/[id]/edit`, `(app)/page.tsx`.
Änderung: Wurzel-`div`-Klasse
- `mx-auto max-w-3xl space-y-6 px-4 py-8` → `space-y-6`
- `mx-auto max-w-3xl space-y-8 px-4 py-8` → `space-y-8`
- `mx-auto max-w-lg px-4 py-8` (Formular-Seiten) → `mx-auto max-w-lg space-y-6`; dabei das
  innere `<div className="mb-6">` um `PageHeader` entfernen (Abstand kommt aus `space-y-6`).
Zusätzlich die 3 `loading.tsx` unter `competitions/[id]/{playoffs,ranking,standings}` gleich behandeln.
Test: `pnpm check`; Verifikation im Browser: oberer Abstand von Nav zu `PageHeader` = 32px (einmal `py-8`).

**A2 · Ringwerk: Login-Seite kanonisieren**
Datei: `apps/ringwerk/src/app/(public)/login/page.tsx`.
Änderung: `import { Target }` → `import { CircleDot }`, `<Target className="h-6 w-6 …" />` → `<CircleDot …/>`;
`"Anmelden..."` → `"Anmelden…"`. Danach ist die Datei bis auf Icon, Titel und Redirect-Ziel (`/` vs
`/dashboard`) identisch mit Treffsicher.
Test: `pnpm check`.

**A3 · Ringwerk: inline-Leerzustände → `EmptyState`**
Dateien + Ersatz (Import `import { EmptyState } from "@vereinsheim/ui/empty-state"`):
- `(app)/page.tsx:95` `<p …>Keine aktiven Wettbewerbe vorhanden.</p>` → `<EmptyState title="Keine aktiven Wettbewerbe" description="Aktive Wettbewerbe erscheinen hier mit Tabelle bzw. Rangliste." icon={Trophy} />` (wird in E2 erneut angefasst — hier trotzdem umstellen, damit A abgeschlossen ist)
- `(app)/admin/users/page.tsx:48` → `<EmptyState title="Keine Nutzer vorhanden" actionLabel="Neuer Nutzer" actionHref="/admin/users/new" />` (außerhalb des `rounded-lg border bg-card`-Wrappers rendern; der Wrapper nur bei `active.length > 0`)
- `(app)/competitions/[id]/series/page.tsx:94` und `:231`, `(app)/competitions/[id]/participants/page.tsx:149` → `<EmptyState title="Noch keine Teilnehmer eingeschrieben" description=… icon={Users} actionLabel="Teilnehmer einschreiben" actionHref={`/competitions/${id}/participants`} />` (in `participants/page.tsx` ohne Action)
- `components/app/auditLog/AuditLogList.tsx:45` → `<EmptyState title="Keine Protokolleinträge vorhanden" icon={ScrollText} />`
- `components/app/standings/StandingsTable.tsx:19`, `BestOfStandingsTable.tsx:30` → `<EmptyState title="Keine Teilnehmer eingeschrieben" />`
- `components/app/series/EventRankingTable.tsx:24`, `EventTeamRankingTable.tsx:13`, `SeasonStandingsTable.tsx:85` → `<EmptyState title="Noch keine Ergebnisse erfasst" />` bzw. „…Team-Ergebnisse…“ / „…Serien…“
Bewusst **nicht**: `BestOfEntryDialog.tsx:150` und `TeamSelectSection.tsx:51` (Text **innerhalb** eines Dialogs/Formulars, kein Seiten-Leerzustand) sowie die PDF-Renderer.
Test: `pnpm check`.

**A4 · Ringwerk: `CompetitionDetailHeader` + `DetailActionBar` auf den 7 Unterseiten**
Neu: `apps/ringwerk/src/components/app/shell/CompetitionDetailHeader.tsx`:
```tsx
import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import { DetailActionBar } from "@vereinsheim/ui/shell/DetailActionBar"

interface Props {
  title: string
  subtitle: string          // z.B. "Luftpistole · Spielplan & Tabelle"
  meta?: ReactNode          // optionale dritte Zeile (Datum, Badges)
  actions?: ReactNode       // fachliche Aktionen, Reihenfolge: fachlich → destruktiv (Zurück hängt die Komponente an)
}

// Kanonischer Kopf der Wettbewerbs-Unterseiten (shared-conventions §2: DetailActionBar + rohes h1).
export function CompetitionDetailHeader({ title, subtitle, meta, actions }: Props) {
  return (
    <div className="space-y-4">
      <DetailActionBar>
        {actions}
        <Button asChild variant="ghost" size="sm" className="px-2 sm:px-3">
          <Link href="/competitions" aria-label="Zurück zu Wettbewerbe">
            <ArrowLeft className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Zurück</span>
          </Link>
        </Button>
      </DetailActionBar>
      <div className="space-y-1">
        <h1 className="break-words text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
        {meta}
      </div>
    </div>
  )
}
```
Dateien (7): `competitions/[id]/{schedule,ranking,standings,playoffs,participants,series,audit-log}/page.tsx`.
Änderung je Seite: den Block `{/* Header */} <div> <Button … ArrowLeft …> … </div>` durch
`<CompetitionDetailHeader title={competition.name} subtitle={…} meta={…} actions={<>…</>} />` ersetzen.
Die bisherigen `outline`-Icon-Buttons (`h-9 w-9`, `title=`) werden `ghost`-`size="sm"`-Buttons **mit
Text** (`<Icon className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Teilnehmer</span>`,
`aria-label` = Text). Reihenfolge fachlich → destruktiv; `GenerateScheduleButton`, `PdfDownloadButton`
usw. bleiben eigene Komponenten, wandern in `actions`. `PdfDownloadButton`
(`components/app/shared/PdfDownloadButton.tsx`): `variant="ghost" size="sm"`, Icon + `<span className="hidden sm:inline">{label}</span>`
statt `size="icon" className="h-10 w-10"`. In `series/page.tsx` (zwei Rückgabepfade, Zeilen ~72 und ~209) beide Header ersetzen.
Test: `pnpm check`; im Browser: Aktionsleiste oben rechts, Zurück ganz rechts, h1 darunter (wie Treffsicher `disciplines/[id]`).

**A5 · Treffsicher: Backlog-Reste T-10 + h1-Kanon**
- `components/app/admin/AdminEditUserForm.tsx:107` `Neues temporaeres Passwort` → `Neues temporäres Passwort`
- `components/app/sessions/detail/SessionDetailHeader.tsx:36` `text-2xl font-bold` → `text-2xl font-semibold tracking-tight`
Test: `pnpm check`.

### Phase B — Formatierung & Zeitzone

**B1 · `@vereinsheim/lib/format` (isomorph) + `dateTime` darauf umstellen**
Neu `packages/lib/src/format.ts` (**ohne** `import "server-only"`, damit Client-Komponenten/Hooks es nutzen können):
```ts
export const APP_LOCALE = "de-DE"

function dt(opts: Intl.DateTimeFormatOptions, timeZone: string) {
  return new Intl.DateTimeFormat(APP_LOCALE, { ...opts, timeZone })
}

/** "08.09.2026" */
export function formatDateOnly(date: Date, timeZone: string): string {
  return dt({ day: "2-digit", month: "2-digit", year: "numeric" }, timeZone).format(date)
}
/** "08.09.2026, 14:05" */
export function formatDateTime(date: Date, timeZone: string): string {
  return dt({ day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }, timeZone).format(date)
}
/** "08.09.2026, 14:05:09" */
export function formatDateTimeSeconds(date: Date, timeZone: string): string {
  return dt({ day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }, timeZone).format(date)
}
/** "Dienstag, 8. September 2026 um 14:05" (Session-Detail) */
export function formatLongDateTime(date: Date, timeZone: string): string {
  return dt({ weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }, timeZone).format(date)
}
/** "08.09." (Chart-Achsen) */
export function formatShortDay(date: Date, timeZone: string): string {
  return dt({ day: "2-digit", month: "2-digit" }, timeZone).format(date)
}
/** "Sep. 2026" (Chart-Achsen, Monatsaggregation) */
export function formatMonthYear(date: Date, timeZone: string): string {
  return dt({ month: "short", year: "numeric" }, timeZone).format(date)
}
/** "2026-09-08" (Dateinamen) */
export function formatIsoDate(date: Date, timeZone: string): string {
  const parts = dt({ year: "numeric", month: "2-digit", day: "2-digit" }, timeZone).formatToParts(date)
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}`
}
/** Ganzzahl mit Tausenderpunkt: 1234 → "1.234" */
export function formatInteger(value: number): string {
  return new Intl.NumberFormat(APP_LOCALE, { maximumFractionDigits: 0 }).format(value)
}
```
`packages/lib/src/dateTime.ts`: eigene `formatDateOnly`-Implementierung entfernen, stattdessen
`export { formatDateOnly } from "./format"` (Rückwärtskompatibilität für die bestehenden Importe);
`getDisplayTimeZone` bleibt (`server-only`). `packages/lib/package.json` `exports` +
`"./format": "./src/format.ts"`. Bei Bedarf weiterer Muster: **neue Formatter nur in `format.ts`**, nie inline.
Test (**zuerst**, `packages/lib/src/format.test.ts`): festes Datum `new Date("2026-09-08T22:30:00Z")`;
`formatDateOnly(d, "Europe/Berlin") === "09.09.2026"` und `formatDateOnly(d, "UTC") === "08.09.2026"`
(genau der Vortag-Bug); `formatDateTime(d, "Europe/Berlin") === "09.09.2026, 00:30"`; `formatIsoDate(d, "Europe/Berlin") === "2026-09-09"`;
`formatInteger(1234) === "1.234"`; `formatLongDateTime` enthält `"Mittwoch"` und `"September"`.
`pnpm --filter @vereinsheim/lib test` + `pnpm check`.

**B2 · Ringwerk: Audit-Log-Zeitzone (Bug)**
Dateien: `components/app/auditLog/AuditLogList.tsx`, `app/(app)/admin/audit-log/page.tsx`, `app/(app)/competitions/[id]/audit-log/page.tsx`.
Änderung: Prop `displayTimeZone: string` ergänzen; lokale `formatDateTime` löschen, `formatDateTime(entry.createdAt, displayTimeZone)` aus `@vereinsheim/lib/format`; beide Seiten `const tz = getDisplayTimeZone()` (aus `@vereinsheim/lib/dateTime`) und `displayTimeZone={tz}` übergeben.
Test: durch B1 abgedeckt (UTC≠Berlin-Fall); `pnpm check`.

**B3 · Ringwerk: PDF-Datumsformatierung mit Zeitzone (Bug)**
Renderer (7): `lib/pdf/{SchedulePdf,BestOfSchedulePdf,SeasonStandingsPdf,PlayoffsPdf,EventRankingPdf,EventStarterListPdf,ParticipantListPdf}.tsx`
— lokale `formatDate(date)`-Funktionen löschen; Prop `displayTimeZone: string` in die Props-Interfaces;
Aufrufe → `formatDateOnly(date, displayTimeZone)` aus `@vereinsheim/lib/format`.
Routen (7): `app/api/competitions/[id]/pdf/{schedule,standings,ranking,playoffs}/route.ts`,
`app/api/competitions/[id]/starter-list/pdf/route.ts`, `app/api/participants/pdf/route.ts`,
`app/api/public/c/[slug]/pdf/route.ts` — `const displayTimeZone = getDisplayTimeZone()` und an jedes
`createElement(<Pdf>, { …, displayTimeZone })` übergeben.
Test: Kein Unit-Test der react-pdf-Renderer (kein Renderer-Test vorhanden); Absicherung durch `tsc`
(Pflicht-Prop) + B1-Test. Verifikation in `/validate`: `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/participants/pdf` (eingeloggt: 200; sonst 401/redirect, aber kein 500).

**B4 · Treffsicher: inline-Formatter → `@vereinsheim/lib/format`**
Dateien und Ziel-Formatter:
- `components/app/sessions/detail/SessionDetailHeader.tsx:14` → `formatLongDateTime`
- `components/app/sessions/list/sessionListItemModel.ts:32` → `formatDateTime` (Optionen prüfen; falls nur Datum: `formatDateOnly`)
- `components/app/shot-routines/ShotRoutineView.tsx:13` → `formatDateOnly`/`formatDateTime` gemäß Optionen
- `components/app/goals/goal-card-section/format.ts` → beide Funktionen löschen, Importe der Nutzer auf `@vereinsheim/lib/format` umbiegen; `GOAL_TYPE_LABELS` bleibt in der Datei
- `components/app/admin/users-table/formatting.ts:18,34` → `formatDateTime`, `formatInteger`
- `components/app/statistics-charts/hooks/{useResultTrendChartState,useAggregatedShotDistribution,useHitLocationTrendState,useStatisticsChartSeriesData}.ts`, `tabs/hit-location/{HitLocationTrendChart,HitLocationCloudChart}.tsx` → je nach Optionen `formatShortDay` / `formatMonthYear` / `formatDateOnly` (bestehende `useMemo`-Formatter-Instanzen ersetzen durch direkte Funktionsaufrufe; `displayTimeZone` wird in den Hooks bereits durchgereicht)
- `app/(app)/sessions/[id]/export/pdf/_lib/format.ts` → `formatDateTime` (de-CH-Teil) und `formatIsoDate` (sv-SE-Teil, Dateiname)
- `components/ui/chart.tsx:251` (`toLocaleString()` in shadcn-Generik) **bleibt** (Fremdcode, zahlenformatiert).
Danach: `grep -rn "new Intl\.\|toLocaleDateString\|toLocaleString(" apps/treffsicher/src --include='*.ts' --include='*.tsx' | grep -v chart.tsx` → **0 Treffer**.
Test: bestehende Tests (`sessionListItemModel`, Stats-Hooks) grün; `pnpm check`.

### Phase C — Theme

**C1 · `theme.css`: semantische Tokens + App-Akzent**
Datei: `packages/ui/theme.css`.
- `@theme inline` ergänzen: `--color-success: var(--success); --color-warning: var(--warning); --color-info: var(--info); --color-rank-1: var(--rank-1); --color-rank-2: var(--rank-2); --color-rank-3: var(--rank-3);`
- `:root` (Light, Vollständigkeit): `--success: oklch(0.55 0.15 160); --warning: oklch(0.65 0.16 75); --info: oklch(0.55 0.13 240); --rank-1: oklch(0.72 0.16 90); --rank-2: oklch(0.6 0.02 260); --rank-3: oklch(0.6 0.14 55);`
- `.dark`: `--success: oklch(0.74 0.16 160); --warning: oklch(0.82 0.16 80); --info: oklch(0.74 0.12 235); --rank-1: oklch(0.86 0.17 90); --rank-2: oklch(0.82 0.02 260); --rank-3: oklch(0.72 0.14 55);` sowie `--border: oklch(1 0 0 / 14%)` (statt 10 %).
- App-Akzent (nach `.dark { … }`):
```css
.dark[data-app="ringwerk"] {
  --primary: oklch(0.8 0.15 75);
  --primary-foreground: oklch(0.2 0.03 75);
  --ring: oklch(0.8 0.15 75 / 60%);
  --chart-1: oklch(0.8 0.15 75);
}
.dark[data-app="treffsicher"] {
  --primary: oklch(0.76 0.12 175);
  --primary-foreground: oklch(0.18 0.03 175);
  --ring: oklch(0.76 0.12 175 / 60%);
  --chart-1: oklch(0.76 0.12 175);
}
```
- Den Block `.dark .recharts-default-tooltip … !important` **entfernen** (0 rohe `<Tooltip>`-Nutzungen in Treffsicher; alle 20 Tooltips nutzen `ChartTooltipContent`).
Test: `pnpm check` (Tailwind kompiliert die neuen `text-success`-Utilities erst, wenn sie benutzt werden — C3/C4 folgen); Browser: Buttons/Logo in Akzentfarbe, Chart-Tooltip weiterhin dunkel.

**C2 · `data-app` in beiden Root-Layouts**
Dateien: `apps/ringwerk/src/app/layout.tsx`, `apps/treffsicher/src/app/layout.tsx`.
Änderung: `<html lang="de" className="dark" data-app="ringwerk" suppressHydrationWarning>` bzw. `data-app="treffsicher"`.
Test: `pnpm check`.

**C3 · Ringwerk: Palette-Klassen → Tokens**
Mapping (überall inkl. Entfernen der `dark:`-Zwillinge):
| alt | neu |
|---|---|
| `text-emerald-600 dark:text-emerald-400`, `text-emerald-400`, `text-emerald-500`, `text-emerald-700` | `text-success` |
| `bg-emerald-500/10` | `bg-success/10` |
| `bg-emerald-100 … text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400` (Pill) | `bg-success/15 text-success` |
| `text-amber-600 dark:text-amber-400`, `text-amber-700 dark:text-amber-400` | `text-warning` |
| `text-rose-500 dark:text-rose-400` | `text-destructive` |
| `bg-yellow-400/5` / `bg-slate-400/5` / `bg-orange-500/5` (Zeilen-Highlight Rang 1/2/3) | `bg-rank-1/10` / `bg-rank-2/10` / `bg-rank-3/10` |
| `rank-badge.tsx` Rang 1/2/3 | `bg-rank-1/20 text-rank-1` / `bg-rank-2/20 text-rank-2` / `bg-rank-3/20 text-rank-3` |
| `WINNER_STYLE` (`playoff-bracket/constants.ts`) / `ROUND_*` (`playoff-match-card/types.ts`): FINAL / SEMI / QUARTER / EIGHTH | `rank-1` / `rank-2` / `rank-3` / `info` (`bg-rank-1/10`, `text-rank-1`, `ring-rank-1`, `border-rank-1/60` …) |
| `AuditLogList` `CATEGORY_BADGE_CLASS`: participant / result / playoff / destructive / admin | `bg-warning/15 text-warning` / `bg-info/15 text-info` / `bg-chart-4/15 text-chart-4` / `bg-destructive/15 text-destructive` / `bg-success/15 text-success` |
| Rate-Limit-Typ-Badges `border-amber-800 bg-amber-950 text-amber-300` / `border-sky-800 bg-sky-950 text-sky-300` | `border-warning/40 bg-warning/10 text-warning` / `border-info/40 bg-info/10 text-info` (Dateien werden in D4 durch die geteilte Komponente ersetzt — hier nur, falls D4 noch nicht gelaufen ist, sonst überspringen) |
| Login `text-emerald-500` | `text-success` |
Dateien: `app/(public)/login/page.tsx`, `components/app/{auditLog/AuditLogList,competitions/competition-form/PublishSection,matchups/best-of-entry/RecordedDuelsList,matchups/best-of-entry/RunningScore,matchups/schedule-view/BestOfMatchupTable,matchups/schedule-view/ClassicLegTable,matchups/schedule-view/ParticipantResult,playoffs/PlayoffMatchCard,playoffs/playoff-bracket/constants,playoffs/playoff-match-card/DuelRows,playoffs/playoff-match-card/types,series/SeasonStandingsTable,standings/BestOfStandingsTable,standings/StandingsTable}.tsx|ts`, `components/ui/rank-badge.tsx`.
Danach: `grep -rnE "(text|bg|border|ring)-(emerald|amber|yellow|orange|sky|blue|green|red|rose|slate|zinc|gray|purple)-[0-9]" apps/ringwerk/src --include='*.tsx' --include='*.ts' | grep -v /pdf/` → **0 Treffer** (PDF-Renderer nutzen eigene Hex-Styles, bleiben).
Test: `pnpm check`; Browser: Tabelle mit Rang-Highlights, Playoff-Bracket, Audit-Log.

**C4 · Treffsicher: Palette-Klassen → Tokens**
Mapping:
| Datei | alt → neu |
|---|---|
| `lib/sessions/presentation.ts` `SESSION_TYPE_BADGE_CLASS` | TRAINING `border-info/40 bg-info/10 text-info`, WETTKAMPF `border-warning/40 bg-warning/10 text-warning`, TROCKENTRAINING `border-success/40 bg-success/10 text-success`, MENTAL `border-chart-4/40 bg-chart-4/10 text-chart-4` |
| `components/app/admin/users-table/formatting.ts` | amber → warning, sky → info, emerald → success, `border-zinc-700 bg-zinc-900 text-zinc-300` → `border-border bg-muted text-muted-foreground` |
| `app/(app)/disciplines/page.tsx:72`, `components/app/disciplines/FavouriteDisciplineButton.tsx:48` `text-yellow-500` | `text-warning` |
| `components/app/sessions/FavouriteButton.tsx:44` `fill-red-500 text-red-500` | `fill-destructive text-destructive` |
| `ReflectionSection.tsx:92`, `FeedbackSection.tsx:107` `bg-green-500` / `bg-amber-500` | `bg-success` / `bg-warning` |
| `SessionPrognosisFeedbackComparisonCard.tsx:30 ff.` `text-emerald-400` (+ rotes Gegenstück) | `text-success` / `text-destructive` |
| `shared/ActionFormMessages.tsx:12` `text-green-600`, `admin/AdminCreateUserForm.tsx:42` `text-emerald-500`, `app/(auth)/login/page.tsx` `text-emerald-500` | `text-success` |
| `AdminLoginRateLimit*.tsx` | entfällt durch D4 |
Danach: gleicher `grep` wie C3 auf `apps/treffsicher/src` → 0 Treffer (Ausnahme `components/ui/chart.tsx` und `statistics-charts/constants.ts` Hex-Grauskala für die Trefferlage: **bleibt**, ist Datenvisualisierungs-Skala, keine UI-Semantik).
Test: bestehende Tests zu `presentation.ts` (falls Klassen geprüft werden) anpassen; `pnpm check`.

**C5 · Kontrast: Opazitäts-Stapel und Mini-Schrift entfernen**
Dateien: `apps/ringwerk/src/components/app/competitions/CompetitionListCard.tsx`, `apps/ringwerk/src/components/app/playoffs/playoff-bracket/BracketDiagram.tsx`, `apps/treffsicher/src/components/app/sessions/SessionSeriesResultCard.tsx`, `apps/treffsicher/src/components/app/sessions/list/SessionListItemCard.tsx`.
Änderung: `text-muted-foreground/60|/70|/80` → `text-muted-foreground`; `text-[11px]`, `text-[10px]` → `text-xs`.
Danach: `grep -rnE "text-muted-foreground/(60|70|80)|text-\[1[01]px\]" apps/*/src` → 0 Treffer.
Test: `pnpm check`.

### Phase D — Struktur & Pakete

**D1 · `Table` + `Skeleton` nach `@vereinsheim/ui`**
- `apps/treffsicher/src/components/ui/table.tsx` → `packages/ui/src/ui/table.tsx` (Inhalt unverändert); `packages/ui/package.json` `exports` + `"./table": "./src/ui/table.tsx"`; Importe in `statistics-charts/tabs/overview/{DisciplineOverviewTable,SeriesGroupRows,overviewCells}.tsx` → `@vereinsheim/ui/table`; App-Datei löschen.
- `apps/ringwerk/src/components/ui/skeleton.tsx` → `packages/ui/src/ui/skeleton.tsx`; Export `"./skeleton"`; Importe in den 3 `loading.tsx` umbiegen; App-Datei löschen.
- `scripts/consistency-check.sh`-Kommentar zu app-lokalen `ui/*` wird in F1 aktualisiert (nicht hier — geschützter Pfad).
Test: `pnpm check`.

**D2 · Ringwerk: rohe `<table>` → `@vereinsheim/ui/table`-Primitives**
Dateien (7): `components/app/standings/{StandingsTable,BestOfStandingsTable}.tsx`, `components/app/series/{EventRankingTable,EventTeamRankingTable,SeasonStandingsTable}.tsx`, `components/app/matchups/schedule-view/{ClassicLegTable,BestOfMatchupTable}.tsx`.
Änderung: `<table className="w-full text-sm">` → `<Table>`, `<thead>` → `<TableHeader>`, `<tr>` → `<TableRow>`, `<th>` → `<TableHead>`, `<tbody className="divide-y">` → `<TableBody>`, `<td>` → `<TableCell>`; die bestehenden Utility-Klassen (Ausrichtung, `hidden sm:table-cell`, Rang-Highlight) auf die Primitives übernehmen; äußerer Wrapper `overflow-hidden rounded-lg border bg-card` bleibt.
Test: Snapshot-freie Prüfung über `pnpm check`; Browser: Tabellen-Layout unverändert (Spaltenbreiten, Highlights).

**D3 · Auth-Kern nach `@vereinsheim/lib/auth`**
- `apps/*/src/lib/authValidation.ts` (byte-identisch) → `packages/lib/src/auth/validation.ts`; Test `apps/treffsicher/src/lib/authValidation.test.ts` → `packages/lib/src/auth/validation.test.ts`; Export `"./auth/validation"`.
- `apps/*/src/lib/auth-rate-limit/{config,limiter,normalization,types}.ts` (byte-identisch) → `packages/lib/src/auth/rate-limit/`; Tests `config.test.ts`, `limiter.test.ts`, `normalization.test.ts` aus Treffsicher mitnehmen; interne Importe `@/lib/auth-rate-limit/x` → relative `./x`; Exports `"./auth/rate-limit/config"`, `"./auth/rate-limit/limiter"`, `"./auth/rate-limit/normalization"`, `"./auth/rate-limit/types"`. `normalization.ts` importiert `node:net` → `packages/lib` hat `@types/node` bereits als devDependency.
- App-seitig bleiben: `auth-rate-limit/store.ts` (+ `store.test.ts` in Treffsicher), `auth-rate-limit/index.ts` (Ringwerk) bzw. `auth-rate-limit.ts` (Treffsicher) — Importe auf das Paket umbiegen. Alle Importe von `@/lib/authValidation` (Ringwerk: `login/page.tsx`, `lib/admin/actions.ts`, `lib/users/{_shared,manage,password}.ts`; Treffsicher: `login/page.tsx`, `AccountPasswordForm.tsx`, `AdminCreateUserForm.tsx`, `AdminEditUserForm.tsx`, `lib/account/actions.ts`, `lib/admin/actions/{shared,userMutations}.ts`, `lib/auth.ts`) → `@vereinsheim/lib/auth/validation`.
Test: verschobene Tests grün unter `pnpm --filter @vereinsheim/lib test`; App-Tests grün; `pnpm check`.

**D4 · Gemeinsame Rate-Limit-Admin-UI**
- Typen `AdminLoginRateLimitBucket`, `AdminLoginRateLimitInsights` → `packages/lib/src/auth/rate-limit/adminTypes.ts` (Export `"./auth/rate-limit/adminTypes"`); `apps/*/src/lib/admin/types.ts` re-exportieren sie von dort (`export type { … } from "@vereinsheim/lib/auth/rate-limit/adminTypes"`).
- Neu `packages/ui/src/admin/LoginRateLimitTable.tsx` (`"use client"`, Basis: Treffsicher-Variante) mit Props
  `{ buckets: AdminLoginRateLimitBucket[]; displayTimeZone: string; onClear: (bucketKey: string) => Promise<{ error?: string }> }`;
  Formatierung via `formatDateTimeSeconds`/`formatInteger` aus `@vereinsheim/lib/format`; Typ-Badges mit `warning`/`info`-Tokens; Entsperr-Button `size="icon"` (`size-9`, kein `h-8 w-8`).
- Neu `packages/ui/src/admin/LoginRateLimitInsights.tsx` mit Props `{ insights: AdminLoginRateLimitInsights; displayTimeZone: string }` (Basis Treffsicher).
- Exports `"./admin/LoginRateLimitTable"`, `"./admin/LoginRateLimitInsights"`.
- App-Wrapper (Server Actions dürfen nur app-seitig importiert werden): `apps/*/src/components/app/admin/AdminLoginRateLimitTable.tsx` wird ein dünner Client-Wrapper:
```tsx
"use client"
import { LoginRateLimitTable } from "@vereinsheim/ui/admin/LoginRateLimitTable"
import { clearLoginRateLimitBucket } from "@/lib/admin/actions"
import type { AdminLoginRateLimitBucket } from "@/lib/admin/types"

export function AdminLoginRateLimitTable(props: { buckets: AdminLoginRateLimitBucket[]; displayTimeZone: string }) {
  return (
    <LoginRateLimitTable
      {...props}
      onClear={async (key) => {
        const r = await clearLoginRateLimitBucket(key)
        // Ringwerk: ActionResult-Union; Treffsicher nach D5 ebenfalls
        return "error" in r ? { error: typeof r.error === "string" ? r.error : "Fehler beim Entsperren." } : {}
      }}
    />
  )
}
```
  `AdminLoginRateLimitInsights.tsx` in beiden Apps löschen; Seiten importieren `LoginRateLimitInsights` direkt aus dem Paket. Ringwerk `admin/users/page.tsx` übergibt `displayTimeZone={getDisplayTimeZone()}` (behebt das hartkodierte `Europe/Zurich`).
Test: `pnpm check`; Browser (Admin): Login-Sperren-Karte in beiden Apps identisch.

**D5a · Treffsicher ActionResult-Kanon: Typ + Disziplinen**
Neu `apps/treffsicher/src/lib/types.ts` (identisch zu Ringwerk):
```ts
export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { error: string | Record<string, string[] | undefined> }
```
`lib/disciplines/types.ts`: lokales `ActionResult` löschen, `export type { ActionResult } from "@/lib/types"` als Übergang; `lib/disciplines/actions.ts` + `actions/{favouriteDiscipline,hideDiscipline,mutateDiscipline}.ts`: Rückgaben `{ success: true }` / `{ error }` (nie beides, kein `success: false`); Konsument `components/app/disciplines/DisciplineForm.tsx`: `state?.success` → `state && "success" in state`, `state?.error` → `getGeneralError(state)`/`getFieldError(state, …)` aus `@vereinsheim/lib/forms/fieldErrors` (prüfen, dass die Helfer die Union akzeptieren — Ringwerk nutzt sie so).
Test (**zuerst**): `lib/disciplines/actions.test.ts` — Erwartungen auf `{ success: true }` bzw. `{ error: … }` umstellen (kein `success: false`); `pnpm check`.

**D5b · Treffsicher ActionResult-Kanon: Sessions**
`lib/sessions/actions/types.ts:58` lokales `ActionResult` löschen → `@/lib/types`; `lib/sessions/actions.ts`, `actions/{attachmentActions,mentalActions,scoringMentalActions}.ts`, `actions/session/{createSession,deleteSession,toggleFavourite,updateSession}.ts` auf die Union; Konsumenten `components/app/sessions/{FeedbackForm,PrognosisForm,ReflectionForm,WellbeingForm}.tsx`, `components/app/session-form/useSessionFormSubmit.ts`, `AttachmentSection`, `FavouriteButton`, Delete-Buttons: `result.error` → `"error" in result`, `result.success` → `"success" in result`.
Test (**zuerst**): `lib/sessions/actions.test.ts`, `actions/*.test.ts` umstellen; `pnpm check`.

**D5c · Treffsicher ActionResult-Kanon: Goals, Shot-Routines**
`lib/goals/types.ts:30` `GoalActionResult` → `ActionResult` (Alias entfernen, Importe umbiegen: `lib/goals/actions.ts`, `actions/mutateGoals.ts`, `components/app/goals/GoalCardSection.tsx` + `goal-card-section/*`); `lib/shot-routines/actions.ts:10` lokales `ActionResult` löschen → `@/lib/types`; Konsument `components/app/shot-routines/ShotRoutineEditor.tsx`.
Test (**zuerst**): `lib/goals/actions.test.ts`, `lib/shot-routines/actions.test.ts`; `pnpm check`.

**D5d · Treffsicher ActionResult-Kanon: Admin, Account**
`lib/admin/types.ts:4` `AdminActionResult` → `ActionResult`; `lib/admin/actions.ts`, `actions/{loginRateLimit,userMutations}.ts`; `lib/account/actions.ts:8` `AccountActionResult` → `ActionResult`; Konsumenten `components/app/admin/{AdminCreateUserForm,AdminEditUserForm}.tsx`, `AdminLoginRateLimitTable.tsx` (Wrapper aus D4: Union-Zweig greift jetzt), `components/app/account/AccountPasswordForm.tsx`.
Abschluss: `grep -rn "type .*ActionResult = {" apps/treffsicher/src` → 0 Treffer; `grep -rn "success: false" apps/treffsicher/src` → 0 Treffer.
Test (**zuerst**): `lib/admin/actions.test.ts`, `lib/account/actions.test.ts`; `pnpm check`.

**D6 · Navigation vereinheitlichen**
Dateien: `apps/ringwerk/src/components/app/shell/Navigation.tsx`, `apps/treffsicher/src/components/app/shell/Navigation.tsx`. Zielbild (für beide):
- `<header className="border-b border-border bg-card">` (Treffsicher: `border-border/50 bg-background` → so).
- Logo = `<Link href={homeHref} className="flex shrink-0 items-center gap-2 font-semibold tracking-tight">` mit `<CircleDot className="h-5 w-5 text-primary" />` (Ringwerk) bzw. `<Crosshair …/>` (Treffsicher); Ringwerk: die `h-8 w-8 rounded-lg bg-secondary`-Box entfällt. `homeHref` = `/` (Ringwerk) bzw. `/dashboard` (Treffsicher).
- Admin-Eintrag **als letzter Haupt-Nav-Link** mit `Shield`-Icon (Ringwerk: `Settings` → `Shield`, aus dem rechten Bereich in `visibleNavItems` verschieben, nur `isAdmin`; Label „Admin“, Ziel `/admin/users`).
- Rechts: Konto-Dropdown in `<div className="hidden md:block">` (Ringwerk: bisher immer sichtbar → verstecken auf Mobil); Hamburger `md:hidden`.
- Mobil-Panel: Haupt-Links + `Konto` (`UserCircle`, `/account`) + `Abmelden`-Button (Treffsicher-Muster) — Ringwerk übernimmt beides.
- Aktiv-Logik bleibt je App (Ringwerk: exakter Match für `/`).
Test: `pnpm check`; Browser Desktop + Mobil (375px) in beiden Apps: gleiche Header-Struktur.

**D7 · Ringwerk Konto-Seite wie Treffsicher**
Datei: `apps/ringwerk/src/app/(app)/account/page.tsx` → `PageHeader title="Konto" description="Ändere dein Passwort. Nach dem Speichern wirst du aus Sicherheitsgründen abgemeldet."`, Formular in `<Card><CardHeader><CardTitle className="text-base">Passwort ändern</CardTitle></CardHeader><CardContent>…</CardContent></Card>`; Navigation-Dropdown-Label bleibt „Mein Konto“ (beide Apps).
Test: `pnpm check`.

**D8 · Seiten-Metadata**
- Root-Layouts: `metadata.title` → `{ default: "Ringwerk", template: "%s · Ringwerk" }` bzw. Treffsicher.
- Statische Seiten: `export const metadata: Metadata = { title: "…" }` — Ringwerk: Dashboard, Wettbewerbe, „Neuer Wettbewerb“, Teilnehmer, „Neuer Teilnehmer“, Disziplinen, „Neue Disziplin“, Konto, Nutzer, „Neuer Nutzer“, Protokoll; Unterseiten `competitions/[id]/*`: Spielplan, Rangliste, Tabelle, Playoffs, Teilnehmer, Serien, Protokoll, Bearbeiten (statisch, ohne Wettbewerbsname); `[id]/edit`-Seiten: „Bearbeiten“. Treffsicher: Dashboard, Tagebuch, „Neue Einheit“, Einheit, Bearbeiten, Statistiken, Saisonziele, „Neues Ziel“, Ziel, Abläufe, „Neuer Ablauf“, Ablauf, Disziplinen, „Neue Disziplin“, Disziplin, Konto, Nutzerverwaltung, „Neuer Nutzer“, Passwort.
- Client-Seiten (`"use client"`, Login) bekommen kein `metadata` (Next verbietet es dort) — Root-Default reicht.
Test: `pnpm check`; Browser-Tab zeigt „Tagebuch · Treffsicher“.

**D9 · Favicons + Aufräumen `public/`**
- Neu `apps/ringwerk/src/app/icon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#1c1917"/><g fill="none" stroke="#e0b25a" stroke-width="2" stroke-linecap="round"><circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="1.5" fill="#e0b25a"/></g></svg>
```
- Neu `apps/treffsicher/src/app/icon.svg` (Crosshair): gleicher Rahmen, Stroke `#5fc9b0`, `<circle cx="16" cy="16" r="10"/><path d="M26 16h-4M10 16H6M16 6v4M16 26v-4"/>`.
- Löschen: `apps/treffsicher/src/app/favicon.ico`, `apps/treffsicher/public/{file,globe,next,vercel,window}.svg` (0 Referenzen im Code, geprüft).
Test: `pnpm check`; `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/icon.svg` → 200.

**D10 · Treffsicher `loading.tsx`**
Neu unter `apps/treffsicher/src/app/(app)/{dashboard,sessions,statistics,goals,shot-routines,disciplines}/loading.tsx`, Muster:
```tsx
import { Skeleton } from "@vereinsheim/ui/skeleton"
export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2"><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-72" /></div>
      <div className="space-y-2"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
    </div>
  )
}
```
(Statistik: statt der drei Zeilen ein `h-72`-Block für den Chart.)
Test: `pnpm check`.

### Phase E — Dashboards

**E1 · Treffsicher-Dashboard mit Inhalt**
Neu `apps/treffsicher/src/lib/dashboard/selectDashboardData.ts` (reine Funktion, testbar):
```ts
import type { SessionWithDiscipline } from "@/lib/sessions/actions"
import type { GoalWithAssignments } from "@/lib/goals/types"

export type DashboardData = {
  recentSessions: SessionWithDiscipline[]   // neueste 5 nach date desc
  activeGoals: GoalWithAssignments[]         // dateFrom <= now <= dateTo, nach dateTo asc, max 3
  sessionsLast30Days: number
  sessionsTotal: number
}
export function selectDashboardData(sessions: SessionWithDiscipline[], goals: GoalWithAssignments[], now: Date): DashboardData
```
Seite `app/(app)/dashboard/page.tsx`: `quickActions`-Grid entfernen; Daten `Promise.all([getSessions(), getGoalsWithAssignments()])`; Aufbau:
1. `PageHeader title="Dashboard" description={`Willkommen, ${displayName}`} action={<CreateItemLinkButton href="/sessions/new" label="Neue Einheit" />}`
2. Kennzahlen: `grid gap-4 sm:grid-cols-2` mit zwei `Card`s (`CardContent`: `text-sm text-muted-foreground` Label + `text-2xl font-semibold tabular-nums` Wert): „Einheiten in 30 Tagen“, „Einheiten gesamt“.
3. Abschnitt „Letzte Einheiten“ (`h2 className="text-lg font-semibold tracking-tight"`) → `SessionsList sessions={recentSessions}`; bei 0 → `EmptyState title="Noch keine Einheiten vorhanden" description="Starte mit deiner ersten Einheit." icon={BookOpen} actionLabel="Neue Einheit" actionHref="/sessions/new"`. Unterhalb ein Text-Link `Alle Einheiten` nach `/sessions` als `Button variant="link" asChild` (kein „Details →“).
4. Abschnitt „Aktive Ziele“ nur wenn `activeGoals.length > 0`: Karten wie auf `/goals` (ganze Karte = Link).
Test (**zuerst**): `selectDashboardData.test.ts` — Sortierung/Limit 5, 30-Tage-Fenster (Grenzfall exakt 30 Tage), aktive Ziele (Grenzen `dateFrom`/`dateTo` inklusiv), max 3. `pnpm check`.

**E2 · Ringwerk-Dashboard als Karten, ohne „Details →“**
Neu `apps/ringwerk/src/components/app/dashboard/DashboardCompetitionCard.tsx`:
Props `{ title: string; href: string; badges: ReactNode; children: ReactNode; moreCount?: number }` →
`<Card><CardHeader className="flex flex-row flex-wrap items-center gap-2"><CardTitle className="text-lg"><Link href={href} className="hover:underline">{title}</Link></CardTitle>{badges}</CardHeader><CardContent className="space-y-2">{children}{moreCount ? <p className="text-sm text-muted-foreground">+ {moreCount} weitere</p> : null}</CardContent></Card>`.
Seite `app/(app)/page.tsx`: die drei Blöcke (Liga/Event/Saison) nutzen die Karte; Tabellen bekommen `rows.slice(0, 6)` (bzw. `entries.slice(0, 6)`), `moreCount = Math.max(0, rows.length - 6)`; `href` = kanonische Route (`/schedule` bzw. `/playoffs` wenn gestartet, `/ranking`, `/standings`); alle vier `Button … →`-Blöcke entfernen; Leerzustand aus A3 bleibt. Playoff-Bracket bleibt `compact`.
Test: `pnpm check`; `grep -n "→" "apps/ringwerk/src/app/(app)/page.tsx"` → 0 Treffer.

### Phase F — Gates & Doku (manuell / `--step`, geschützter Pfad)

**F1 · `scripts/consistency-check.sh` erweitern** (nur außerhalb des Autopiloten)
- Kommentar zu app-lokalen `ui/*` aktualisieren (`table`/`skeleton` sind jetzt im Paket).
- Anti-Pattern **FATAL** (bisher WARN → hochstufen): ASCII-`...` in Pending-Texten, `text-2xl font-bold`, inline `new Intl.` **überall** in `src/` (Ausnahme entfällt — Formatter liegen jetzt in `packages/lib`), `toLocale(Date|Time)?String(` (ausgenommen `components/ui/chart.tsx`).
- Neu **FATAL**: Palette-Klassen `grep -rnE "(text|bg|border|ring|fill)-(emerald|amber|yellow|orange|sky|blue|green|red|rose|slate|zinc|gray|purple)-[0-9]" $repo/src --include='*.tsx' --include='*.ts' | grep -vE "/pdf/|statistics-charts/constants.ts|components/ui/chart.tsx"`; Opazitäts-Stapel `text-muted-foreground/(60|70|80)`; Mini-Schrift `text-\[1[01]px\]`; Icon-Buttons `h-8 w-8` in `src/components`; `Details →`/`→</Link>` in `src/app`; Seiten-Container `mx-auto max-w-[0-9a-z]+ .*px-4 py-8` in `src/app/(app)/**/page.tsx`.
- `bash -n scripts/consistency-check.sh` + einmal ausführen → `RESULT: OK`.

**F2 · Vault nachziehen**
- `vault/conventions.md`: §1 (`@vereinsheim/ui/table`, `skeleton`, `admin/*`; `@vereinsheim/lib/format`, `auth/validation`, `auth/rate-limit/*`), §3 (neu: „Seiten setzen **keinen** eigenen `px-/py-`-Container; `max-w` pro Seite erlaubt“; „kein Opazitäts-Modifier auf `text-muted-foreground`, keine Schrift unter `text-xs`“), §4 (neu: semantische Farb-Tokens `success/warning/info/rank-1..3`, keine Palette-Klassen), §5 (Header `bg-card`, Logo = Link mit `text-primary`, Admin = letzter Nav-Link mit `Shield`, Mobil-Panel mit Konto + Abmelden), §6 (`@vereinsheim/lib/format`, Locale `de-DE`, Zeitzone immer als Parameter), §8 (neue fatale Checks).
- Notes: `vault/domain/data-formatting-rules.md`, `vault/domain/navigation-pattern.md`, `vault/domain/typography-layout-rules.md`, `vault/apps/ringwerk/color-semantics.md` (Token-Namen), `vault/incidents/treffsicher-backlog-state.md` (T-08, T-10 erledigt), `vault/incidents/treffsicher-actionresult-migration.md` (Status: erledigt, Datum), `vault/architecture/architecture.md` (Repo-Karte: `packages/ui` + `admin/`, `packages/lib` + `format`/`auth`).
- `/sync-graph` ausführen (vault-lint grün).

---

## Verification (für `/validate`)

1. `pnpm check` grün (alle 5 Gates, beide Apps + Pakete).
2. `./scripts/consistency-check.sh` → `RESULT: OK — keine Drift erkannt.` (nach F1 mit den neuen fatalen Checks).
3. Grep-Nullstellen (aus den Tasks): Palette-Klassen, `new Intl.`/`toLocale*` außer `chart.tsx`, `text-muted-foreground/60|70|80`, `text-[11px]`, `h-8 w-8`, `→` in `(app)/page.tsx`, `type .*ActionResult = {` in Treffsicher, `success: false` in Treffsicher, `px-4 py-8` in `apps/ringwerk/src/app/(app)/**/page.tsx`.
4. Zeitzone: `pnpm --filter @vereinsheim/lib test` enthält den UTC-vs-Berlin-Vortag-Fall; im Browser Audit-Log-Zeit = lokale Uhrzeit des Eintrags.
5. Browser (Dev-Server via `.claude/launch.json`, beide Apps, Desktop + 375px): Login (Akzent-Button, `CircleDot`/`Crosshair`), Header identisch aufgebaut, Dashboard (Treffsicher: Kennzahlen + letzte Einheiten; Ringwerk: Karten ohne „→“), eine Wettbewerbs-Unterseite (DetailActionBar rechts, Zurück ganz rechts), Admin (Login-Sperren-Karte identisch), Favicon im Tab, Tab-Titel mit Template.
6. PDF-Route antwortet ohne 500 (eingeloggt): `/api/participants/pdf`, `/api/competitions/<id>/pdf/schedule`.
7. Lighthouse/axe-Stichprobe Kontrast auf `/sessions` (Treffsicher) und `/competitions` (Ringwerk): keine Kontrast-Fehler unter AA für Fließtext.
