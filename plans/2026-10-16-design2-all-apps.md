# Plan: Design 2 für alle Apps — ein Konzept, Spiegel führt (SP-4.3)

Stand: 16. Oktober 2026 · Branch: `feat/design2-all-apps` · Roadmap: SP-4.3 ([[adr-030]])

## Kontext

Spiegel ist der Pilot von Design 2 ([[adr-030]]) und in Bedienung und Gestaltung führend. Ringwerk und Treffsicher
laufen noch auf `theme.css`: fest dunkel, Kopfzeile mit Hamburger, kein Hilfe-System, allgemeine Bestätigungen
(„Diese Aktion kann nicht rückgängig gemacht werden.“), Symbol-Knöpfe ab 40 px. Der User will **ein** Konzept für alle
drei Apps: schön, elegant, einfach richtig. Entschieden am 16. Oktober 2026:

1. **Darstellung wie Spiegel:** hell und dunkel, Wahl System / Hell / Dunkel im Gerät. Der feste Dark Mode von
   Ringwerk und Treffsicher entfällt ([[dark-mode-only]] wird abgelöst).
2. **Symbol-Knöpfe wie Spiegel:** 28–32 px mit Symbol, Name als Tooltip und für Screenreader. Die Gate-Regel
   „mindestens `h-10 w-10`“ entfällt; Untergrenze wird WCAG 2.2 AA (24 px).
3. **Navigation wie Spiegel:** untere Leiste am Telefon, schmale Leiste im Querformat, Seitenleiste ab 1024 px. Das
   Kopfzeilen-Schema ([[navigation-pattern]], conventions §5) entfällt.
4. **Drift-Gate über drei Apps:** Spiegel nimmt wieder teil, die geteilte Schicht ist Design 2.
5. **Treffsichers Statistik folgt Spiegel:** dieselbe Seite eines Zeitraums ([[spiegel-langzeit]]), dieselben
   Rechnungen aus `shot-core` und dieselben Regeln (Ø je Schuss, Urteil nur mit Test, „kein klarer Unterschied“),
   weniger Sonderwege (Teil G).

Dazu das Bedienkonzept von Spiegel für alle: Folgen vor dem Bestätigen (`DecisionDialog`), Schreibregeln, „Rückgängig“
nach dem Löschen, Hilfe an jeder Zahl als Blatt, „–“ mit Grund statt 0, drei Ebenen (Antwort, Belege, Werkzeug) und die
Skriptprüfung im Browser.

## Ansatz

Spiegels Bausteine sind heute teils app-lokal (`DecisionDialog`, `UndoBar`, `Page`, Theme) oder an den Fachkern
gebunden (`AppFrame` mit festen Bereichen in `shot-ui`, Hilfe an `shot-help`). Erst wandert das Allgemeine nach
`@vereinsheim/ui/design2/*`, ohne dass Spiegel sich sichtbar ändert (Teil A). Dann stellen beide Apps ihre Basis um
(Teil B), danach folgen Dialoge (C), Hilfe (D), Gate und Aufräumen (E) und die Statistik von Treffsicher auf Spiegels
Seite eines Zeitraums (G). Die Durchsicht nach drei Ebenen (F) misst zuerst am Telefon und bekommt danach einen
eigenen Plan, weil ihre Änderungen aus den Befunden folgen; sie läuft nach G, damit sie die neue Statistik misst.

**Abhängigkeit:** Der Branch `feat/spiegel-kleinkram` (andere Session, sieben Commits, noch nicht auf `main`) ändert
Dateien, die Teil A verschiebt oder anfasst: `apps/spiegel/src/components/shell/AppShell.tsx` (`isAdminPath`),
`apps/spiegel/tools/pruefen.ts` (Abschnitt „Admin ohne Rolle“), neu `packages/shot-ui/src/layout/bar.ts` (Höhe der
Leiste und Rand als eine Konstante), `shot-core` (`metrics.ts`, `stats.ts`: jede Regel einmal) und
`vault/spiegel/spiegel-roadmap.md`. **Er landet zuerst auf `main`**, danach wird dieser Branch vor Teil 0 auf `main`
gesetzt (`sync`/rebase). Erst dann beginnt Teil A.

**Jeder Teil endet grün und ist ein Merge-Punkt** (ff-only nach `main` mit User-OK). `/implement` läuft je Teil
(`/implement plans/2026-10-16-design2-all-apps.md` mit dem Teil als Argument).

**Festgelegt in diesem Plan** (beim Freigeben änderbar):

- **Akzent je App bleibt:** Spiegel Blau, Ringwerk Messing, Treffsicher Teal, über `data-app` am `<html>`, in beiden
  Themes. Hell: Ringwerk `#8a5a00` (5,9 : 1 auf Weiß), Treffsicher `#0a766b` (5,5 : 1). Dunkel: Ringwerk `#f5ae39`,
  Treffsicher `#4acaad` (heutige Werte aus `theme.css`, als Hex) mit dunkler Schrift darauf (≥ 9 : 1).
- **Ringwert-Farben von Spiegel überall:** 10 rot, 9 gold, 8 türkis, ≤ 7 violett (`score-*`). Treffsichers Skala in
  `statistics-charts/constants.ts` entfällt; damit ist die offene Frage in [[spiegel-open-questions]] beantwortet.
- **Treffsicher-Leiste:** Start · Tagebuch · **Neue Einheit** (Mitte, wie Scannen) · Statistik · Profil. Seitenleiste:
  Start, Tagebuch, Statistik, Ziele, Ablauf, Disziplinen, Pille „Neue Einheit“, Trenner, Profil, Admin. Am Telefon
  stehen Ziele, Ablauf, Disziplinen und Admin in Profil.
- **Ringwerk-Leiste:** Start · Wettbewerbe · Teilnehmer (nur ADMIN/MANAGER) · Profil, ohne Mitte. Seitenleiste:
  Start, Wettbewerbe, Teilnehmer, Disziplinen, Trenner, Profil, Admin. Am Telefon stehen Disziplinen und Admin in
  Profil.
- **„Konto“ heißt „Profil“** (`/profile`), wie in Spiegel; `/account` leitet dauerhaft weiter. Profil enthält
  Darstellung, Passwort, Abmelden und am Telefon die Bereiche, die nicht in der Leiste stehen.
- **Rückmeldung:** Löschen meldet „Gelöscht · Rückgängig“ (`UndoHost`), sonst Toasts (sonner) in Design 2.
- **PDFs** bleiben, wie sie sind (Druck, nicht Oberfläche).
- **Admin ohne Rolle** landet in allen Apps auf dem Start, nicht auf der Anmeldung (wie Spiegel nach
  `feat/spiegel-kleinkram`).
- **Treffsicher-Statistik:** die Zuordnung in Teil G („Abgleich“) ist der Vorschlag; G0 legt sie dir vor.

## Required Docs

- `vault/decisions/adr-030.md`, `vault/conventions.md` (§1–§5, §8, §10)
- `vault/spiegel/spiegel-ui-design.md`, `vault/spiegel/spiegel-mobile.md`, `vault/spiegel/spiegel-durchsicht.md`
- `vault/incidents/spiegel-dialog-texts-not-understood.md` (Textbuch, Schreibregeln)
- `vault/apps/treffsicher/dark-mode-only.md`, `vault/apps/ringwerk/color-semantics.md`, Notes
  `navigation-pattern`, `component-canon`, `drift-protection` (über `mcp__memory__open_nodes`)
- `apps/ringwerk/CLAUDE.md`, `apps/treffsicher/CLAUDE.md`, `apps/spiegel/CLAUDE.md`, `packages/ui/CLAUDE.md`,
  `packages/shot-ui/CLAUDE.md`, `packages/shot-core/CLAUDE.md`
- Für Teil G: `vault/spiegel/spiegel-langzeit.md`, `vault/spiegel/spiegel-metrics.md`, `vault/spiegel/spiegel-statistics.md`
  (Regeln, Katalog-IDs), `vault/apps/treffsicher/statistics-visualization.md`,
  `vault/apps/treffsicher/treffsicher-requirements.md` („Statistiken & Auswertung“), `vault/apps/treffsicher/wellbeing-tracking.md`

## Geschützte Schritte (Circuit-Breaker im autonomen Lauf)

Der Autopilot-Guard (ADR-023) sperrt `vault/decisions/`, `scripts/`, Schema/Migrationen und `.claude/`. Diese Tasks
laufen deshalb **in der Hauptsession mit dem User** oder per `/implement --step`, nicht autonom: **0.1–0.3** (ADR),
**E1–E3** (`scripts/consistency-check.sh`). Ebenso Haltepunkte für den User: **C0**, **D0** und **G8** (Textbuch freigeben), **G0** (Abgleich der Statistik).

**Reihenfolge der Teile:** 0 → A → B → C → D → G → E → F. E (Gate, `theme.css` weg) kommt nach G, damit die alte
Statistik mit ihren Hex-Farben vorher verschwunden ist.

---

## Teil 0 — Weichen (Hauptsession, vor Teil A)

- **0.1** `vault/decisions/adr-032.md` anlegen: „ADR-032 — Design 2 für alle Apps“, `status: Accepted`
  (16. Oktober 2026, User), `refines: ["[[adr-030]]"]`. Inhalt: die vier Entscheidungen aus „Kontext“, Akzent je App,
  Ringwert-Skala von Spiegel überall, Bedienkonzept für alle (Folgen, Schreibregeln, Rückgängig, Hilfe, „–“ mit Grund,
  drei Ebenen), Treffsichers Statistik folgt Spiegels Seite eines Zeitraums und rechnet mit `shot-core` (Hochrechnung,
  Radar und Meyton-Farben entfallen, Befinden und Qualität werden Vergleiche mit Urteil nur aus Test), `theme.css`
  entfällt nach Teil E. Alternativen: „Ringwerk/Treffsicher bleiben fest dunkel“ (gegen den
  Wunsch, verworfen), „nur Optik umziehen, Bedienkonzept später“ (zwei Welten länger, verworfen).
- **0.2** `vault/decisions/decisions.md` (MOC) und `vault/index.md` um ADR-032 ergänzen; in `adr-030.md` unter
  „Folgen“ einen Satz mit `[[adr-032]]`.
- **0.3** `vault/apps/treffsicher/dark-mode-only.md`: TL;DR auf „Abgelöst durch [[adr-032]]: hell und dunkel wie
  Spiegel“, Kante `governed_by: ["[[adr-032]]"]` (`supersedes` gibt es laut `vault/SCHEMA.md` nur zwischen
  Decisions); dasselbe für den Abschnitt „Design & UI“ in `treffsicher-technical-constraints`. `vault/spiegel/spiegel-roadmap.md`
  SP-4.3: **Status:** in Arbeit, Verweis auf diesen Plan. `/sync-graph`.

## Teil A — Gemeinsame Schicht in `@vereinsheim/ui/design2` (Spiegel sieht danach gleich aus)

- **A1 Tokens.** `packages/ui/design2.css`:
  - `--rank-1/-2/-3` (Gold/Silber/Bronze) und `--chart-1 … --chart-5` in `:root` und `.dark`, dazu
    `--color-rank-*` und `--color-chart-*` in `@theme inline`. `chart-1` = Akzent, `chart-2` = Orange (Vergleich B
    aus Spiegel), `chart-3 … -5` aus der geprüften Dataviz-Palette, auf Karte ≥ 3 : 1 in beiden Themes.
  - Akzent je App: `[data-app="ringwerk"]` und `[data-app="treffsicher"]` setzen `--primary`, `--primary-foreground`,
    `--ring`, `--accent`, `--accent-wash`, `--chart-1`; dieselben Selektoren mit `.dark` für dunkel (Werte siehe
    „Festgelegt“). Ohne `data-app` bleibt Spiegels Blau.
  - `.no-scrollbar` und die Regeln für `input[type=date]` aus `theme.css` übernehmen (Treffsicher braucht beide).
  - Test `packages/ui/src/design2/tokens.test.ts` erweitern: jede neue Farbe in beiden Blöcken; Kontrast
    `primary-foreground` auf `primary` ≥ 4,5 : 1 und `primary` auf `card` ≥ 4,5 : 1 je App und Theme (Kontrastformel
    WCAG 2.x im Test, Hex parsen); `chart-*` auf `card` ≥ 3 : 1.
- **A2 Darstellung.** `apps/spiegel/src/components/theme/{theme.ts,ThemeScript.tsx,ThemeProvider.tsx,ThemeSwitch.tsx}`
  nach `packages/ui/src/design2/theme/` verschieben. `THEME_KEY` wird Parameter: `themeScript(key)`,
  `<ThemeScript storageKey>`, `<ThemeProvider storageKey>`. Spiegel übergibt `"spiegel-theme"` (bestehende Wahl bleibt).
  Exporte `./design2/theme` und `./design2/theme-switch` in `packages/ui/package.json`. Test `ThemeScript.test.tsx`
  mitziehen, ein Fall für einen anderen Schlüssel ergänzen.
- **A3 Toasts.** `packages/ui/src/design2/toaster.tsx`: sonner mit `useTheme()` aus A2 (aufgelöst: `light`/`dark`),
  Stil aus den Design-2-Tokens (`card`, `line-strong`, `radius-xl`). Export `./design2/toaster`.
- **A4 Rahmen.** `packages/ui/src/design2/app-frame.tsx` aus `packages/shot-ui/src/layout/AppFrame.tsx`
  verallgemeinern:
  ```ts
  export interface FrameItem {
    key: string;
    label: string;
    short: string;
    Icon: LucideIcon;
    badge?: number;
    badgeLabel?: string;
  }
  export interface AppFrameProps {
    brand: string;
    primary: FrameItem[]; // Seitenleiste oben
    secondary: FrameItem[]; // Seitenleiste nach dem Trenner (Profil, Admin)
    bar: string[]; // Schlüssel in unterer und schmaler Leiste, höchstens fünf
    action?: FrameItem; // Mitte der Leiste und Pille in der Seitenleiste (Scannen, Neue Einheit)
    current: string | null;
    barCurrent?: string | null; // aktiver Eintrag der Leiste, wenn er vom Bereich abweicht (Admin → Profil)
    renderLink: (item: FrameItem, props: FrameLinkProps) => ReactNode;
    sidebarFooter?: ReactNode;
    children?: ReactNode;
  }
  ```
  Klassen, `--app-bar`, Safe-Area und Querformat-Regel wörtlich übernehmen. `shot-ui/layout/AppFrame.tsx` wird ein
  Adapter: `ITEMS`/`BAR` → `FrameItem`s, `renderLink` mit `RouteLink`; Spiegels `AppShell` behält `isAdminPath`
  (aus `feat/spiegel-kleinkram`) für `current`. `AppFrame.test.tsx` (shot-ui) bleibt grün
  unverändert; neuer Markup-Test `packages/ui/src/design2/app-frame.test.tsx`: Einträge, `aria-current`, Badge mit
  Namen, Leiste mit vier und fünf Feldern, Aktion in der Mitte.
- **A5 Seite.** `apps/spiegel/src/components/shell/Page.tsx` → `packages/ui/src/design2/page.tsx`
  (Export `./design2/page`); Spiegel importiert von dort.
- **A6 Folgen-Dialog.** `apps/spiegel/src/components/shell/DecisionDialog.tsx` samt Test und `interface Decision`
  (aus `apps/spiegel/src/lib/admin/consequences.ts`) → `packages/ui/src/design2/decision-dialog.tsx`
  (Export `./design2/decision-dialog`). `consequences.ts` importiert den Typ; alle Spiegel-Importe umstellen.
- **A7 Rückgängig.** `apps/spiegel/src/components/shell/UndoBar.tsx` samt Test → `packages/ui/src/design2/undo.tsx`.
  Statt `ActionResult` aus der App ein struktureller Typ im Paket:
  `type UndoResult = { success: true } | { error: string | Record<string, string[] | undefined> }`.
- **A8 Hilfe.** `HelpIcon`, `HelpButton`, `HelpBody` (mit `HELP_FIELDS`) aus `packages/shot-ui/src/help/` →
  `packages/ui/src/design2/help.tsx` mit dem Typ
  `HelpText = { title: string; short?: string; what?: string; read?: string; act?: string; caution?: string; minimum?: string; formula?: string }`;
  dazu `HelpSheet({ entry: HelpText | null, onClose })` auf `Sheet`. `shot-ui/help/*` re-exportiert bzw. reicht
  `helpEntry(id)` durch; `help.test.tsx` (shot-ui) bleibt grün, neuer Test im Paket für Felder und Reihenfolge.
- **A9 Schreibregeln.** `packages/lib/src/wording.ts`: `BASE_FORBIDDEN = /;|\.\.\.(?!\.)/` und
  `forbiddenIn(texts: string[], extra?: RegExp): string[]` (liefert die Texte mit Treffer). Export `./wording`.
  Spiegels `OLD_WORDS` setzt sich daraus zusammen; Test `packages/lib/src/wording.test.ts`.
- **A10 Prüf-Kit.** `apps/spiegel/tools/pruefen/{browser.ts,server.ts}` → neues Paket `packages/pruefen`
  (`@vereinsheim/pruefen`, ohne Build, Exporte `./browser`, `./server`; `startServer({ app, port })` statt fester
  Werte). `apps/spiegel/tools/pruefen.ts` importiert von dort. Dazu `packages/pruefen/src/common.ts` mit
  wiederverwendbaren Prüfungen aus `pruefen.ts`: `noSideScroll(page, widths)`, `barDoesNotCover(page)`,
  `themeNoFlash(page, key)`, `dialogFocus(page, opener)`.
- **A12 Leistenmaß.** `packages/shot-ui/src/layout/bar.ts` (`BAR_PX`, `EDGE_PX`, `BAR`-Klassen, aus
  `feat/spiegel-kleinkram`) samt `bar.test.ts` → `packages/ui/src/design2/bar.ts` (Export `./design2/bar`);
  `shot-ui` importiert von dort. Die klebenden Leisten in Ringwerk (B10) und Treffsicher (G) nutzen dieselben Klassen.
- **A11 Doku.** `packages/ui/CLAUDE.md` und conventions §10 („Allgemeine Bausteine“) um die neuen Bausteine;
  `vault/architecture/architecture.md` (Repo-Karte: `packages/pruefen`, `design2/*`).

**Prüfung Teil A:** `pnpm check` grün; `pnpm --filter spiegel pruefen --start` grün wie vorher; Bildschirmfotos von
Start, Scheibe, Profil, Admin bei 390 und 1280 px vor und nach Teil A gleich.

## Teil B — Basis beider Apps auf Design 2

Für **Treffsicher** (B1–B7) und **Ringwerk** (B8–B13); beide in einem Lauf, damit die geteilten Primitives nicht
eine App auf `theme.css` verstellen. Reihenfolge: B1, B8, B14, dann B2–B7, B9–B13, B15.

- **B1 Treffsicher Styles und Schrift.** `apps/treffsicher/src/app/globals.css`: `@import "tailwindcss"`,
  `tw-animate-css`, `shadcn/tailwind.css`, `@vereinsheim/ui/design2.css`, `@source "../"`, `@theme` mit den
  Schriftvariablen wie Spiegel. `apps/treffsicher/src/app/layout.tsx`: Archivo, Geist, Geist Mono wie Spiegel,
  `className="dark"` entfernen, `data-app="treffsicher"` bleibt, `suppressHydrationWarning`, `<ThemeScript
storageKey="treffsicher-theme">` im `<head>`, `<ThemeProvider>` um `Providers`, Toaster aus `design2/toaster`.
- **B2 Treffsicher Rahmen.** `apps/treffsicher/src/components/app/shell/AppShell.tsx` (neu) mit `AppFrame` laut
  „Festgelegt“, `renderLink` mit `next/link`, `current` aus `usePathname()` (`/dashboard` exakt, sonst
  `startsWith`), `sidebarFooter={<ThemeSwitch />}`, `UndoHost` um den Inhalt. `src/app/(app)/layout.tsx`: `AppShell`
  plus `Page` statt `Navigation` und `<main className="mx-auto max-w-6xl px-4 py-8">`. `Navigation.tsx` löschen.
  Test `AppShell.test.tsx` (Markup): Admin nur für Admins, aktiver Eintrag, „Neue Einheit“ zeigt auf `/sessions/new`.
  `src/proxy.ts`: angemeldete Nicht-Admins auf `/admin…` → `/` statt Anmeldung, wie Spiegels `proxy.ts` nach
  `feat/spiegel-kleinkram` (Prädikat `isAdminPath` je App, Test).
- **B3 Treffsicher Profil.** `src/app/(app)/profile/page.tsx` aus `account/page.tsx`: Darstellung (`ThemeSwitch`),
  Passwort, Abschnitt „Weitere Bereiche“ nur unter 1024 px (Ziele, Ablauf, Disziplinen, Admin), Abmelden.
  `account/page.tsx` → `permanentRedirect("/profile")`. Interne Links auf `/account` umstellen (`grep -rn
'"/account' apps/treffsicher/src`).
- **B4 Treffsicher Anmeldung.** `src/app/(auth)/login/page.tsx` im Aufbau der Spiegel-Anmeldung
  (`apps/spiegel/src/app/login/`): Marke in Archivo, Karte mit `radius-xl`, beide Themes.
- **B5 Treffsicher Farben.** Nur so weit, dass die heutige Statistik in beiden Themes lesbar ist; Teil G ersetzt sie.
  `src/components/app/statistics-charts/constants.ts`: Ringverteilung auf
  `var(--score-10)`, `var(--score-9)`, `var(--score-8)`, `var(--score-7)` (≤ 7), Hex-Skala entfernen; Trefferlage-Hex
  auf `var(--overlay)`, `var(--chart-*)`; `grep -rnE '#[0-9a-fA-F]{6}' apps/treffsicher/src --include='*.tsx'
--include='*.ts'` außerhalb `export/pdf` muss leer sein. Recharts-Achsen und -Gitter auf `var(--muted-foreground)`,
  `var(--border)`, Schrift 12 px wie Spiegels Diagramme.
- **B6 Treffsicher Zahlen.** Große Ergebnisse (Dashboard, Einheit, Serienergebnis) in `font-display` mit
  `tabular-nums`, Tabellen und Achsen `font-mono` (Liste der Stellen: `grep -rn 'text-2xl\|text-3xl\|text-4xl'
apps/treffsicher/src/components`).
- **B7 Treffsicher Prüfung.** `apps/treffsicher/tools/pruefen.ts` mit `@vereinsheim/pruefen`: Anmeldung mit dem
  Prüfkonto (B13), dann je Hauptseite `noSideScroll` bei 375/390/768/1280, `barDoesNotCover`, `themeNoFlash`,
  Fokus im Löschdialog; Skript `pruefen` in `package.json`.
- **B8 Ringwerk Styles und Schrift.** wie B1 mit `data-app="ringwerk"`, `storageKey="ringwerk-theme"`.
- **B9 Ringwerk Rahmen.** wie B2 laut „Festgelegt“ (Rolle aus der Session, Teilnehmer/Disziplinen für
  ADMIN/MANAGER, Admin für ADMIN); `Navigation.tsx` löschen; `src/app/(app)/admin/layout.tsx` prüfen, dass es kein
  eigenes Padding setzt. `src/proxy.ts` wie in B2. Die Tabellen der Ratenbegrenzung unter Admin bleiben in ihren
  Karten (`min-w-0` im Raster, wie Spiegels Fix in `feat/spiegel-kleinkram`).
- **B10 Ringwerk Wettbewerb-Unternavigation.** `components/app/shell/CompetitionDetailHeader.tsx`: Reiterleiste in
  einer Zeile, die in sich seitlich scrollt (`Segmented` ohne `wrap`, als Links), Name der Seite immer sichtbar
  (heute `hidden sm:inline`), Zurück-Link bleibt.
- **B11 Ringwerk Profil und Anmeldung.** wie B3/B4 (`src/app/(app)/profile/`, `(public)/login/page.tsx`); am Telefon
  Disziplinen und Admin in Profil.
- **B12 Ringwerk Tabellen und Ränge.** `components/ui/rank-badge.tsx` auf `rank-*`-Tokens in beiden Themes prüfen;
  Tabellen (`StandingsTable`, `BestOfStandingsTable`, `SeasonStandingsTable`, `EventRankingTable`,
  `EventTeamRankingTable`, `schedule-view/*Table.tsx`): Ergebnisse `font-mono tabular-nums`, Platz in
  `font-display`; ausgeblendete Spalten am Telefon bleiben (`HIDE_ON_MOBILE`). `PlayoffBracket` scrollt in sich, die
  Seite nie seitlich.
- **B13 Prüfkonto und Prüfung.** Je App `tools/pruefen-account.ts`: legt in der Dev-DB ein Konto
  `pruefen@<app>.test` an oder setzt sein Passwort, verweigert sich, wenn `DATABASE_URL` nicht auf `localhost`
  zeigt; Zugangsdaten als `PRUEFEN_EMAIL`/`PRUEFEN_PASSWORD` in `apps/<app>/.env` (gitignored), dokumentiert in der
  `CLAUDE.md` der App. `apps/ringwerk/tools/pruefen.ts` wie B7.
- **B14 Primitives in beiden Themes.** `card`, `table`, `tabs`, `select`, `dialog`, `alert-dialog`, `dropdown-menu`,
  `badge`, `slider`, `textarea`, `input`, `skeleton`, `empty-state` gegen die Spiegel-Optik halten (Radien, `surface-2`,
  `line-strong`, Fokusring). Änderungen nur in `packages/ui/src/ui/*`. `tabs` sieht danach aus wie Spiegels
  Reiterleiste (eine Zeile, scrollt in sich). Markup-Test je geänderter Komponente.
- **B15 Doku.** conventions §3 (Shell: `Page` statt `mx-auto max-w-6xl px-4 py-8`), §4 (Farben: Design-2-Tokens für
  alle, Akzent je App in beiden Themes, Ringwert-Skala), §5 neu („Navigation: `AppFrame`“, die beiden Leisten),
  `navigation-pattern`, `color-semantics`, `vault/apps/treffsicher/*` und `vault/apps/ringwerk/*` mit Navigation und
  Theme.

**Prüfung Teil B:** `pnpm check`; `pnpm --filter treffsicher pruefen --start`, `pnpm --filter ringwerk pruefen
--start`, `pnpm --filter spiegel pruefen --start` grün; Sichtprüfung im Browser bei 390 und 1280 px, hell und dunkel,
jede Hauptseite beider Apps, Bildschirmfotos für den User. Was die Dev-Daten nicht hergeben, steht im Bericht als
„nicht belegt“.

## Teil C — Folgen vor dem Bestätigen

- **C0 Textbuch (Haltepunkt).** Für jeden Dialog unten Titel, Worum, Vorher prüfen, Was passiert, Was nicht
  passiert, Rückgängig, Knopf nach den Schreibregeln (conventions §10) als „alt → neu“ in ein Textbuch
  `vault/_attachments/textbuch-ringwerk-treffsicher.md`. Die Folgen aus den Actions ablesen (was löscht `delete.ts`
  kaskadierend, was bleibt im Protokoll). **HALT:** Der User liest und gibt frei.
- **C1 Treffsicher Texte.** `apps/treffsicher/src/lib/consequences.ts` mit je einer reinen Funktion pro Dialog
  (Rückgabe `Decision`), Test `consequences.test.ts` hält den Wortlaut und `forbiddenIn(..., TREFFSICHER_OLD_WORDS)`.
- **C2 Treffsicher Dialoge.** `DecisionDialog` statt `AlertDialog` in `ArchiveDisciplineButton`,
  `DeleteDisciplineButton`, `GoalActions`, `AdminUsersTable`, `AttachmentSection`, `DeleteSessionButton`,
  `DeleteShotRoutineButton`; `DiscardChangesDialog` ebenso. Nach dem Löschen `useUndo` dort, wo die Action ein
  Rückgängig hat (heute keine: dann Toast wie bisher, Rückgängig kommt mit dem Papierkorb-Plan).
- **C3 Ringwerk Texte.** wie C1 in `apps/ringwerk/src/lib/consequences.ts`; `scheduleDialogText` dort aufnehmen.
- **C4 Ringwerk Dialoge.** `DecisionDialog` in `DeleteEventSeriesButton`, `DeleteSeasonSeriesButton`,
  `ParticipantDeleteDialog`, `ToggleActiveAction`, `ConfirmActions`, `DisciplineActions`, `CompetitionStatusActions`,
  `ForceDeleteCompetitionSection`, `CompetitionActions`, `StartPlayoffsButton`, `AdvanceRoundButton`,
  `DeleteDuelConfirm`, `EntryControls`, `UserRowActions`, `GenerateScheduleButton`, `CompetitionForm`.
- **C5 Aufräumen.** `packages/ui/src/shell/ConfirmDialog.tsx` und sein Export entfallen, wenn kein Import mehr
  bleibt; `useNavigationConfirm`-Aufrufer nutzen `DecisionDialog`.
- **C6 Doku.** conventions §2 („Bestätigungen: `DecisionDialog`“), §10 „Kein Knopf ohne Folge“ gilt für alle Apps;
  `component-canon`.

**Prüfung Teil C:** `pnpm check`; je App `pruefen`: Fokus beginnt auf „Abbrechen“, Escape schließt, Inhalt als
Beschreibung verknüpft; Sichtprüfung je Dialog hell und dunkel.

## Teil D — Hilfe an den Zahlen, „–“ mit Grund

- **D0 Textbuch (Haltepunkt).** Erklärungen im Format `HelpText` für: Treffsicher Prognose/Feedback und Befinden
  der Einheit; Ringwerk Teiler, Ringteiler, Sortierung der Tabelle, Best-of, Setzung und Runden der Playoffs. In das
  Textbuch aus C0. Die Statistik von Treffsicher bekommt ihre Hilfe in Teil G aus `shot-help`. **HALT:** Der User gibt
  frei.
- **D1 Themen.** `apps/treffsicher/src/lib/help/topics.ts` und `apps/ringwerk/src/lib/help/topics.ts`
  (`Record<string, HelpText>`), Test: jedes Thema hat `title`, `short`, `what`; `forbiddenIn` über alle Felder.
- **D2 Blatt in den Rahmen.** `HelpContext` (aus `apps/spiegel/src/components/shell/HelpContext.tsx`) nach
  `packages/ui/src/design2/help.tsx` (`HelpProvider`, `useHelp`); beide `AppShell`s hängen `HelpSheet` ein.
- **D3 „?“ an den Zahlen.** Treffsicher: `SessionPrognosisFeedbackComparisonCard` und Befinden auf der Seite einer
  Einheit; Ringwerk: Spaltenköpfe Teiler/Ringteiler und der Sortiersatz in
  `SeasonStandingsTable`, `PlayoffBracket`-Kopf. Schalter „Erklärungen“ zeigt `short` unter dem Titel, wie Spiegel.
- **D4 „–“ mit Grund.** Stellen, an denen heute `0`, leer oder ein Platzhaltertext für „kein Wert“ steht
  (`grep -rn '?? 0\|"—"\|Keine Daten' apps/treffsicher/src/components apps/ringwerk/src/components`), zeigen „–“ mit
  dem Grund aus der Logik („zu wenige Einheiten“, „noch kein Ergebnis“). Grund als reine Funktion, Test.
- **D5 Werte ohne Hover:** entfällt hier. Die Recharts-Diagramme der Statistik ersetzt Teil G durch Spiegels
  Diagramme mit Lineal und „Werte als Tabelle“. `ShotHistogram` auf der Einheit ersetzt G7.

**Prüfung Teil D:** `pnpm check`; `pruefen` je App: jedes Thema hat einen Knopf (`data-help`), das Blatt öffnet von
unten (390 px) und rechts (1280 px), Fokus kehrt zurück.

## Teil E — Gate über drei Apps, Aufräumen

- **E1 (geschützt)** `scripts/consistency-check.sh`: Apps `ringwerk treffsicher spiegel`; `MUST_MATCH` für
  `src/app/globals.css`, `src/app/error.tsx`, `src/app/(app)/error.tsx`, `src/app/not-found.tsx`,
  `components.json` über alle drei (vorher in den Apps angleichen: E4).
- **E2 (geschützt)** Regeln: Icon-Buttons unter 24 px statt unter `h-10 w-10` (`size-[1-5]\b|h-[1-5] w-[1-5]` an
  `size="icon"`-Buttons); `dark:` bleibt verboten mit neuer Begründung („Farbe aus den Tokens“); Ausnahme der
  Trefferlage-Hex-Skala entfernen; Palette-Klassen gelten jetzt auch für Spiegel. Gegen eine Probedatei mit Verstößen
  und gegen den grünen Ist-Zustand prüfen (conventions §8).
- **E3 (geschützt)** Kopfkommentar des Skripts auf drei Apps; `bash -n scripts/consistency-check.sh`.
- **E4 Angleichen.** `globals.css`, Error-Boundaries, `not-found.tsx`, `components.json` der drei Apps
  byte-gleich (Spiegels Fassung als Vorlage, `@source` für `packages/shot-ui/src` in allen).
- **E5 `theme.css` entfernen.** Datei und Export aus `packages/ui`; `grep -rn 'theme.css' apps packages` leer.
- **E6 Doku.** conventions §1 (geteilte Schicht = Design 2), §8 (Gate über drei Apps, neue Regeln), §10 wird
  „Design 2 (alle Apps)“ und rückt nach vorn; `drift-protection`, `vault/architecture/architecture.md`
  (Cross-App-Konsistenz), SP-4.3 **Status:** umgesetzt; `/sync-graph`.

**Prüfung Teil E:** `./scripts/consistency-check.sh` grün; mit Probedatei rot; `pnpm check`; alle drei `pruefen`.

## Teil G — Treffsichers Statistik wie Spiegels Fortschritt

Treffsicher hat heute eine eigene Welt: sechs Reiter, 18 Hooks in `statistics-charts/hooks`, eigene Trend- und
Normalisierungsrechnung, Hochrechnung, Radar, gestapelte Fläche, Meyton-Farben, Recharts. Spiegel beantwortet dieselbe
Frage („Werde ich besser?“) mit **einer** Seite eines Zeitraums und Regeln, die schon geprüft sind (Simulation B19).
Die Rechnungen in `shot-core/analysis/period.ts` (`periodTrend`, `periodBuckets`, `trainingVolume`, `comparePeriods`)
arbeiten bereits auf einem schlichten Wert je Scheibe (`CardValue { id, atMs, value, n }`); eine Einheit lässt sich
genauso abbilden. Gebunden an Spiegel sind nur `shot-ui/period/model.ts` (`ProjectedCard`) und die Links in
`CardList`/`CardReadout` (`RouteLink`).

**Abgleich (Vorschlag, in G0 zur Freigabe):**

| Treffsicher heute                               | künftig, wie Spiegel                                                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Zeiträume Monat, 3, 6 Monate, alles, frei       | Spiegels Zeitraum-Wahl (`PeriodPicker`), Vorgabe 90 Tage                                                                    |
| Filter Training/Wettkampf/beides, Disziplin     | Disziplin Pflicht (nie gemischt), Art als Chip im Blatt „Filter“                                                            |
| Ringe/Schuss oder Hochrechnung                  | Ø je Schuss; **Hochrechnung entfällt**; Ergebnis wie am Ausdruck steht auf der Einheit                                      |
| Ergebnisverlauf mit gleitendem Trend            | `PeriodChart`: Ø je Schuss, gleitender Schnitt, Formband, Lineal, Ablesung, Liste der Einheiten                             |
| Übersicht-Tabelle je Disziplin                  | Ergebnis-Box und Kacheln über den Zeitraum, Vergleich mit dem Zeitraum davor („deutlich besser“, „kein klarer Unterschied“) |
| Serienwertungen je Position                     | „Serien im Vergleich“ nach Spiegels Logik                                                                                   |
| Schussverteilung als gestapelte Fläche          | Zehnerquote und Ringverteilung als Kennzahl im Verlauf; Ringverteilung als Säulen auf der Einheit                           |
| Trefferlage (Wolke, Trend, mm aus dem Ausdruck) | Lage über Zeit (Katalog L7) im Stil von Spiegel                                                                             |
| Befinden gegen Ergebnis (Streudiagramm)         | Vergleich nach Merkmal: etwa „gut geschlafen“ gegen „schlecht geschlafen“, `comparePeriods`, Urteil ab 5 Einheiten je Seite |
| Ausführungsqualität gegen Ringe                 | ebenso: hohe gegen niedrige Qualität                                                                                        |
| Selbstbild-Radar (7 Dimensionen)                | eine Zeile je Dimension: Prognose, Feedback, Abstand; **kein Radar**                                                        |
| Meyton-Farbschema                               | `score-*` (Teil B)                                                                                                          |
| keine Rekorde                                   | Spiegels Rekorde, wo Einzelschüsse erfasst sind                                                                             |

- **G0 Abgleich (Haltepunkt).** Die Tabelle oben mit echten Zahlen aus der Dev-DB belegen (wie viele Einheiten mit
  Einzelschüssen, mit Trefferlage, mit Befinden, mit Qualität; nur Zählungen, keine Namen). **HALT:** Der User gibt die
  Zuordnung frei oder ändert sie.
- **G1 Eingabe verallgemeinern.** `packages/shot-ui/src/period/model.ts`: `periodModel` nimmt statt
  `ProjectedCard[]` eine schlanke Eingabe
  `PeriodItem { id: string; startedAtMs: number; kind: "training" | "match"; probeOnly: boolean; metrics: Record<string, { value: number; n: number } | null>; flags: readonly string[] }`.
  Spiegel bildet `ProjectedCard` in `apps/spiegel` (oder `shot-ui/period/fromProjection.ts`) darauf ab.
  Charakterisierung vorher: `model.test.ts` und ein neuer Test, der für `testSeason.ts` das ganze `PeriodModel` vor
  und nach dem Umbau gleich hält (Gegenprobe: Quelle vertauschen → rot, conventions §9).
- **G2 Links lösen.** `CardList` und `CardReadout` bekommen `renderLink(id, props)` statt `RouteLink`/`ListRoute`;
  Spiegel reicht `RouteLink` durch. Markup-Tests unverändert grün.
- **G3 Einheiten als Eingabe.** `apps/treffsicher/src/lib/statistics/periodItems.ts`: Einheit → `PeriodItem`
  (Ø je Schuss aus den Wertungsserien, Zehntel oder ganze Ringe wie heute in `statistics-charts/utils/displayScore.ts`, dessen Logik hierher zieht, weil G9
  den Ordner löscht; `n` = Wertungsschüsse;
  Zehnerquote, Innenzehner und Serien nur mit Einzelschüssen, sonst `null` mit Grund; Lage aus
  `hitLocation*Mm`/`*Direction`). Rechnungen nur aus `@vereinsheim/shot-core` (`stats.ts`, `metrics.ts`), keine eigene
  Mittelung. Test mit Fixtures, in denen eine falsche Quelle (Probe mitgezählt, Serien statt Schüsse gemittelt)
  ein anderes Ergebnis gibt.
- **G4 Seite.** `src/app/(app)/statistics/page.tsx`: `PeriodPage` mit `PeriodHeader`, `SectionNav`, `PeriodChart`,
  `VolumeChart`, `PeriodResult`, `CardReadout`, `CardList`, `PeriodTiles` wie Spiegels `ProgressScreen`
  (`apps/spiegel/src/components/progress/ProgressScreen.tsx`); Zustand in der Adresse über `shot-ui/period/state`.
  Rechnen auf dem Server, die Seite bekommt das fertige Modell. Lastgrenzen aus [[treffsicher-dos-protection]] bleiben.
- **G5 Einflüsse.** Ein Reiter „Einflüsse“ unter der Analyse: je Befinden-Wert (Schlaf, Energie, Stress,
  Motivation) und Ausführungsqualität zwei Gruppen (obere gegen untere Hälfte der eigenen Werte im Zeitraum),
  `comparePeriods` auf Ø je Schuss, Urteil in Alltagsworten; unter fünf Einheiten je Seite „zu wenige Einheiten“.
  Reine Funktion `influences(items)` in `apps/treffsicher/src/lib/statistics/influences.ts`, Test inklusive
  Mutationsprobe (Test als `true` → rot).
- **G6 Selbstbild.** Ein Reiter „Selbstbild“: je Dimension Ø Prognose, Ø Feedback, Abstand, als Zeilen mit
  Balken in Design 2 (kein Radar).
- **G7 Einheit.** `components/app/sessions/ShotHistogram.tsx` → Spiegels Ringverteilung
  (`shot-ui/analysis/charts/RingBars.tsx`), Farben `score-*`, „Werte als Tabelle“.
- **G8 Hilfe.** Kacheln und Karten holen ihre Erklärung über `helpForMetric`/`helpTopic` aus `shot-help` (gleiche
  Texte wie Spiegel). Neue Themen nur für „Einflüsse“ und „Selbstbild“, vorher ins Textbuch (Haltepunkt wie D0).
- **G9 Alte Statistik entfernen.** `components/app/statistics-charts/**`, `components/ui/chart.tsx` und `recharts`
  aus `apps/treffsicher/package.json`, wenn kein Import mehr bleibt (`pnpm install --frozen-lockfile` danach,
  conventions §9). PDF-Abschnitt `sessions/[id]/export/pdf/_lib/sections/hitLocation.ts` bleibt.
- **G10 Doku.** `vault/apps/treffsicher/statistics-visualization.md` neu (Seite eines Zeitraums, Abgleich, Einflüsse),
  `treffsicher-requirements.md` Abschnitt „Statistiken & Auswertung“ (Hochrechnung, Radar und Meyton-Farben gestrichen),
  `wellbeing-tracking.md`, `spiegel-langzeit.md` (Bausteine auch in Treffsicher), `packages/shot-ui/CLAUDE.md`.

**Prüfung Teil G:** `pnpm check`; Spiegel `pruefen` grün (die Verallgemeinerung ändert dort nichts); Treffsicher
`pruefen` mit Abschnitt „Statistik“: kein seitliches Scrollen, Lineal und „Werte als Tabelle“, Vergleich, Blatt
„Filter“. Abgleich der Zahlen: Ø je Schuss je Disziplin und Zeitraum auf der neuen Seite gleich der heutigen
Übersicht (vor G9 an der Dev-DB nebeneinander gemessen, Abweichungen erklärt im Bericht).

## Teil F — Durchsicht nach drei Ebenen (Messung, dann eigener Plan)

- **F1 Messung.** Wie [[spiegel-durchsicht]] am Telefon (390 px, 772 px Inhalt über der Leiste): je Hauptseite
  Länge in Bildschirmen, Bedienelemente und Zahlen (gesamt / erster Bildschirm), doppelte Zahlen, Fachbegriffe; die
  Kernfragen je App („Wie war meine letzte Einheit?“, „Werde ich besser?“, „Wo stehe ich in der Liga?“, „Wann
  schieße ich wieder?“) mit Urteil. Ergebnis als Note `vault/apps/treffsicher/treffsicher-durchsicht.md` und
  `vault/apps/ringwerk/ringwerk-durchsicht.md` mit Befunden B1 …
- **F2** `/plan` für die Umsetzung der Befunde (Antwort zuerst auf Dashboard, Statistik und Wettbewerbsseite, eine
  Zeile Bedienung vor dem Inhalt, Filter im Blatt).

## Nicht in diesem Plan (eigene Pläne)

- **Papierkorb für Treffsicher-Einheiten** (Schema `deletedAt`, Abfragen, Seite „Papierkorb“, Löschen nach 30 Tagen,
  `useUndo`): eigener Plan mit Migration (geschützt). Ringwerk danach prüfen.
- **SP-4.1** (Treffsicher ablösen oder behalten) bleibt offen; der Umzug lohnt sich unabhängig davon, weil Treffsicher
  bis dahin im Einsatz ist. Teil G macht beide Wege leichter: Mit derselben Seite und denselben Rechnungen kann
  Treffsicher später auch Spiegels Scheiben zeigen (ADR-026).
- PDFs in Design 2.

## Tests (Überblick)

- Neu: `design2/app-frame.test.tsx`, `design2/help.test.tsx`, `lib/wording.test.ts`, erweitert `tokens.test.ts`
  (Kontraste), `ThemeScript.test.tsx` (Schlüssel), `AppShell.test.tsx` je App, `consequences.test.ts` je App,
  `help/topics.test.ts` je App, Grund-Funktionen aus D4, `design2/bar.test.ts` (verschoben), `periodItems.test.ts` und
  `influences.test.ts` (Treffsicher), Charakterisierung des ganzen `PeriodModel` für `testSeason.ts` (G1).
- Unverändert grün: `shot-ui` `AppFrame.test.tsx`, `help.test.tsx`, `period/*.test.ts(x)`, Spiegels
  `DecisionDialog`-/`UndoBar`-Tests am neuen Ort.
- Mutationsprobe (conventions §9): in A1 eine Akzentfarbe auf zu hellen Wert setzen → Kontrasttest rot; in C1 ein
  Semikolon in einen Text → Wortlauttest rot.

## Verifikation

1. Je Teil `pnpm check` grün (alle fünf Gates, alle Apps) und `pnpm --filter <app> pruefen --start` für die
   betroffenen Apps.
2. Sichtprüfung im Browser je Teil: 390 × 844 und 1280 × 900, hell und dunkel, Bildschirmfotos an den User.
3. Nach Teil B und E: `tools/stack-e2e/run.sh` mit den echten Images (Schriften kommen aus `next/font`, kein Abruf
   zur Laufzeit).
4. `/validate` und `/review` je Teil, Merge nach `main` nur mit User-OK.
