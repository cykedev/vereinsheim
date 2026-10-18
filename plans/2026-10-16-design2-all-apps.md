# Plan: Design 2 für alle Apps — ein Konzept, Spiegel führt (SP-4.3)

Stand: 18. Oktober 2026 · Branch: `feat/design2-all-apps` · Roadmap: SP-4.3 ([[adr-030]])

## Kontext

Spiegel ist der Pilot von Design 2 ([[adr-030]]) und in Bedienung und Gestaltung führend. Ringwerk und Treffsicher
laufen noch auf `theme.css`: fest dunkel, Kopfzeile mit Hamburger, kein Hilfe-System, allgemeine Bestätigungen
(„Diese Aktion kann nicht rückgängig gemacht werden.“), Symbol-Knöpfe ab 40 px. Der User will **ein** Konzept für alle
drei Apps: schön, elegant, einfach richtig. Entschieden vom User am 16. und 18. Oktober 2026:

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
6. **Trefferfarben wie Spiegel, überall:** 10 rot `#e5484d`, 9 gold `#e9b10c`, 8 türkis `#1fa3c8`, ≤ 7 violett
   `#7c5cd6` (`score-*`, farbenblind geprüft), mit dunklem 1-px-Rand. Das gilt für jede Darstellung eines Treffers oder
   Ringwerts: Statistik, Ringverteilung der Einheit, Schusswerte und das PDF der Einheit. Treffsichers Meyton-Skala
   (Rot, Gelb, Graustufen) entfällt. Damit ist die offene Frage in [[spiegel-open-questions]] beantwortet.
7. **Ringwerk trägt den Wettkampfbetrieb:** Es wird produktiv für die Durchführung von Wettkämpfen genutzt. Es muss in
   jedem Fall weiter perfekt funktionieren, bedienbar bleiben und darf keine Daten verlieren. Daraus folgen der
   Abschnitt „Ringwerk: Betrieb sichern“ und Teil R.
8. **Ringwerk wird vollständig geprüft,** jede Art von Wettbewerb in jeder Phase bis zu den Brackets und PDFs, mit
   **erfundenen** Testdaten. Die echten Daten enthalten nicht alle Phasen aller Wettbewerbe.

Dazu das Bedienkonzept von Spiegel für alle: Folgen vor dem Bestätigen (`DecisionDialog`), Schreibregeln, „Rückgängig“
nach dem Löschen, Hilfe an jeder Zahl als Blatt, „–“ mit Grund statt 0, drei Ebenen (Antwort, Belege, Werkzeug) und die
Skriptprüfung im Browser.

## Ansatz

Spiegels Bausteine sind heute teils app-lokal (`DecisionDialog`, `UndoBar`, `Page`, Theme) oder an den Fachkern
gebunden (`AppFrame` mit festen Bereichen in `shot-ui`, Hilfe an `shot-help`). Erst wandert das Allgemeine nach
`@vereinsheim/ui/design2/*`, ohne dass Spiegel sich sichtbar ändert (Teil A). Dann entsteht der Prüfbestand für
Ringwerk und sein Ausgangsstand (Teil R), bevor irgendetwas an Ringwerk geändert wird. **Treffsicher zieht zuerst
um** (Teile T und G) und läuft eine Weile produktiv. **Ringwerk folgt zuletzt** (Teil W), mit eigenen Merges und
Releases und dem Abgleich aus Teil R vor jedem Release. Danach das Gate über drei Apps (E) und die Durchsicht nach
drei Ebenen (F), die zuerst misst und dann einen eigenen Plan bekommt.

**Reihenfolge:** 0 → A → R → T → G → W → E → F. **Jeder Teil endet grün und ist ein Merge in den
Integrationsbranch `feat/design2-all-apps`** (mit User-OK, nicht nach `main`; nur Fast-Forward oder Rebase, keine
Merge-Commits). Teil 0 und A liegen direkt auf ihm; R, T, G, W, E und F arbeiten auf eigenen `feat/design2-<teil>`-Branches,
die von `feat/design2-all-apps` abzweigen und dorthin zurückgehen. `/implement` läuft je Teil (`/implement plans/2026-10-16-design2-all-apps.md` mit dem Teil als
Argument); jeder Teil ist so geschrieben, dass eine frische Sitzung ihn mit den Docs aus „Required Docs“ allein
umsetzen kann.

**Vor Teil 0:** Branch auf `main` rebased (18. Oktober 2026, ohne Konflikte). `main` war um 68 Commits weiter, darunter `feat/spiegel-kleinkram` (`isAdminPath`, `JUMP_BAR`, „jede Regel einmal“ im Fachkern),
Disziplinen im Admin von Spiegel samt Wertung je Disziplin, eine Scheibe je Probe-Block und die Rekorde R10/R11.
Die betroffenen Tasks unten sind darauf schon angepasst (A4, A6, A12, G1, G3).

**Festgelegt in diesem Plan** (beim Freigeben änderbar):

- **Akzent je App bleibt:** Spiegel Blau, Ringwerk Messing, Treffsicher Teal, über `data-app` am `<html>`, in beiden
  Themes. Hell: Ringwerk `#8a5a00` (5,9 : 1 auf Weiß), Treffsicher `#0a766b` (5,5 : 1). Dunkel: Ringwerk `#f5ae39`,
  Treffsicher `#4acaad` (heutige Werte aus `theme.css`, als Hex) mit dunkler Schrift darauf (≥ 9 : 1).
- **Treffsicher-Leiste:** Start · Tagebuch · **Neue Einheit** (Mitte, wie Scannen) · Statistik · Profil. Seitenleiste:
  Start, Tagebuch, Statistik, Ziele, Ablauf, Disziplinen, Pille „Neue Einheit“, Trenner, Profil, Admin. Am Telefon
  stehen Ziele, Ablauf, Disziplinen und Admin in Profil.
- **Ringwerk-Leiste:** Start · Wettbewerbe · Teilnehmer (nur ADMIN/MANAGER) · Profil, ohne Mitte. Seitenleiste:
  Start, Wettbewerbe, Teilnehmer, Disziplinen, Trenner, Profil, Admin. Am Telefon stehen Disziplinen und Admin in
  Profil.
- **„Konto“ heißt „Profil“** (`/profile`), wie in Spiegel; `/account` leitet dauerhaft weiter. Profil enthält
  Darstellung, Passwort, Abmelden und am Telefon die Bereiche, die nicht in der Leiste stehen.
- **Rückmeldung:** Löschen meldet „Gelöscht · Rückgängig“ (`UndoHost`), sonst Toasts (sonner) in Design 2.
- **PDFs** bleiben, wie sie sind (Druck, nicht Oberfläche). Einzige Ausnahme sind die Trefferfarben im PDF der
  Treffsicher-Einheit (Punkt 6). **Ringwerks PDFs ändern sich gar nicht** (Teil R prüft das Wort für Wort).
- **Admin ohne Rolle** landet in allen Apps auf dem Start, nicht auf der Anmeldung (wie Spiegel). Läuft dafür vorher
  die eigene Aufgabe „Ringwerk/Treffsicher: Nicht-Admin auf /admin zum Start“, prüfen T2 und W2 nur noch.
- **Treffsicher-Statistik:** die Zuordnung in Teil G („Abgleich“) ist der Vorschlag; G0 legt sie dir vor.
- **Geteilte Primitives** (`packages/ui/src/ui/*`, `packages/ui/src/shell/*`) ändern sich erst in Teil W, zusammen mit
  Ringwerks Umzug. Bis dahin nutzt Treffsicher dort, wo es eine andere Form braucht, die Bausteine aus `design2/*`.
  So ändert sich Ringwerk vor Teil W an keiner Stelle.

## Ringwerk: Betrieb sichern

Gilt für jeden Teil, der Ringwerk oder etwas berührt, das Ringwerk importiert.

1. **Nur Oberfläche.** Keine Schema-Änderung, keine Migration, keine Änderung an Server-Actions oder an
   `apps/ringwerk/src/lib/**` außer den neuen Dateien `lib/consequences.ts` und `lib/help/topics.ts`. `/review` prüft
   das am Diff: `git diff --stat main -- apps/ringwerk/prisma apps/ringwerk/src/lib` zeigt nur diese Dateien.
2. **Formulare verlieren nichts.** Kein Formularfeld wird durch das neue Layout bedingt gerendert (ein fehlendes Feld
   fehlt in der FormData, das Update löscht dann lautlos, [[deadline-wipe-on-hidden-form-fields]]); Ausblenden nur per
   CSS. Felder bleiben gesteuert (conventions §9), der Schutz vor ungespeicherten Änderungen bleibt.
3. **Erst Charakterisierung, dann Umbau.** Bevor ein Dialog, eine Ergebnis-Eingabe oder ein Formular neu verdrahtet
   wird, hält ein Test fest, welche Action mit welchen Werten genau einmal läuft; er bleibt danach unverändert grün.
4. **Abgleich vor jedem Merge und jedem Release:** `pnpm --filter ringwerk pruefen:vergleichen` (Teil R) ohne
   Abweichung bei Zahlen, Reihenfolge, Plätzen und PDF-Text; Abläufe (R5) grün; die Bilder sieht der User durch.
5. **Release mit Netz:** vorher `vereinsheim backup` und `vereinsheim restore-probe`; ausgeliefert nur an einem Tag
   ohne Wettkampf, den der User bestimmt; `vereinsheim rollback` steht bereit. Ringwerk geht allein raus, nicht im
   selben Release mit Treffsicher.
6. **Seitenabläufe ändert niemand automatisch.** Die Durchsicht (Teil F) schlägt für Ringwerk nur vor; jede Änderung
   am Ablauf einer Seite gibt der User einzeln frei.

## Required Docs

Immer: `vault/conventions.md` (§1–§5, §8, §9, §10), `vault/decisions/adr-030.md` (ab Teil 0 auch `adr-032.md`),
`packages/ui/CLAUDE.md`. Dazu je Teil:

- **A:** `vault/spiegel/spiegel-ui-design.md`, `vault/spiegel/spiegel-mobile.md`, `apps/spiegel/CLAUDE.md`,
  `packages/shot-ui/CLAUDE.md`.
- **R:** `apps/ringwerk/CLAUDE.md`, Vault-Notes `competition-types`, `league-mode`, `best-of-single`,
  `playoffs-knockout-system`, `event-mode`, `event-teams`, `season-mode`, `factor-correction`,
  `best-of-standings-direct-comparison-tiebreak`, `ruleset-lock-granularity` (über `mcp__memory__open_nodes`),
  `apps/ringwerk/prisma/schema.prisma`, ADR-029 (keine echten Personendaten).
- **T, G:** `apps/treffsicher/CLAUDE.md`, `vault/apps/treffsicher/dark-mode-only.md`,
  `vault/incidents/spiegel-dialog-texts-not-understood.md` (Textbuch, Schreibregeln); für G zusätzlich
  `vault/spiegel/spiegel-langzeit.md`, `spiegel-metrics.md`, `spiegel-statistics.md`,
  `vault/apps/treffsicher/statistics-visualization.md`, `treffsicher-requirements.md` („Statistiken & Auswertung“),
  `wellbeing-tracking.md`, `packages/shot-core/CLAUDE.md`.
- **W:** wie R, dazu `vault/apps/ringwerk/color-semantics.md`, Notes `navigation-pattern`, `component-canon`, und der
  Abschnitt „Ringwerk: Betrieb sichern“ oben.
- **E:** Note `drift-protection`, `scripts/consistency-check.sh`.

## Geschützte Schritte und Haltepunkte

Der Autopilot-Guard (ADR-023) sperrt `vault/decisions/`, `scripts/`, Schema/Migrationen, `migrate`-Kommandos und
`.claude/`. Diese Tasks laufen **in der Hauptsession mit dem User** oder per `/implement --step`: **0.1–0.3** (ADR),
**R1** (Prüfdatenbank anlegen und migrieren), **E1–E3** (`scripts/consistency-check.sh`). Haltepunkte für den User:
**TC0**, **TD0**, **WC0**, **WD0** und **G8** (Textbuch freigeben), **G0** (Abgleich der Statistik), **R4**
(Ausgangsstand ansehen), jeder Ringwerk-Release (Termin).

---

## Teil 0 — Weichen (Hauptsession)

- **0.1** `vault/decisions/adr-032.md` anlegen: „ADR-032 — Design 2 für alle Apps“, `status: Accepted`
  (16. und 18. Oktober 2026, User), `refines: ["[[adr-030]]"]`. Inhalt: die acht Entscheidungen aus „Kontext“, Akzent
  je App, Bedienkonzept für alle (Folgen, Schreibregeln, Rückgängig, Hilfe, „–“ mit Grund, drei Ebenen), Treffsichers
  Statistik folgt Spiegels Seite eines Zeitraums und rechnet mit `shot-core` (Hochrechnung, Radar und Meyton-Farben
  entfallen, Befinden und Qualität werden Vergleiche mit Urteil nur aus Test), Ringwerk zuletzt mit Prüfbestand,
  `theme.css` entfällt nach Teil E. Alternativen: „Ringwerk/Treffsicher bleiben fest dunkel“ (gegen den Wunsch,
  verworfen), „nur Optik umziehen, Bedienkonzept später“ (zwei Welten länger, verworfen), „beide Apps in einem
  Release“ (Risiko für den Wettkampfbetrieb, verworfen).
- **0.2** `vault/decisions/decisions.md` (MOC) und `vault/index.md` um ADR-032 ergänzen; in `adr-030.md` unter
  „Folgen“ einen Satz mit `[[adr-032]]`.
- **0.3** `vault/apps/treffsicher/dark-mode-only.md`: TL;DR auf „Abgelöst durch [[adr-032]]: hell und dunkel wie
  Spiegel“, Kante `governed_by: ["[[adr-032]]"]` (`supersedes` gibt es laut `vault/SCHEMA.md` nur zwischen
  Decisions); dasselbe für den Abschnitt „Design & UI“ in `treffsicher-technical-constraints`.
  `vault/spiegel/spiegel-roadmap.md` SP-4.3: **Status:** in Arbeit, Verweis auf diesen Plan. `/sync-graph`.

## Teil A — Gemeinsame Schicht in `@vereinsheim/ui/design2` (Spiegel sieht danach gleich aus)

Teil A ändert keine Datei unter `apps/ringwerk`, `apps/treffsicher`, `packages/ui/src/ui`, `packages/ui/src/shell`,
`packages/ui/theme.css` oder eine bestehende Datei unter `packages/lib/src` (nur neue). `/review` prüft das am Diff.

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
- **A3 Toasts.** `packages/ui/src/design2/toaster.tsx` (neu, `src/ui/sonner.tsx` bleibt unverändert): sonner mit
  `useTheme()` aus A2 (aufgelöst: `light`/`dark`), Stil aus den Design-2-Tokens (`card`, `line-strong`, `radius-xl`).
  Export `./design2/toaster`.
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
  Adapter: `ITEMS`/`BAR` → `FrameItem`s, `renderLink` mit `RouteLink`; Spiegels `AppShell` behält `isAdminPath` für
  `current`. `AppFrame.test.tsx` (shot-ui) bleibt unverändert grün; neuer Markup-Test
  `packages/ui/src/design2/app-frame.test.tsx`: Einträge, `aria-current`, Badge mit Namen, Leiste mit vier und fünf
  Feldern, Aktion in der Mitte.
- **A5 Seite.** `apps/spiegel/src/components/shell/Page.tsx` → `packages/ui/src/design2/page.tsx`
  (Export `./design2/page`); Spiegel importiert von dort.
- **A6 Folgen-Dialog.** `apps/spiegel/src/components/shell/DecisionDialog.tsx` samt Test und `interface Decision`
  (aus `apps/spiegel/src/lib/admin/consequences.ts`) → `packages/ui/src/design2/decision-dialog.tsx`
  (Export `./design2/decision-dialog`). `consequences.ts` importiert den Typ. Alle Importe umstellen
  (`grep -rn "DecisionDialog\|admin/consequences" apps/spiegel/src`; seit `main` vom 18. Oktober auch in
  `DisciplineList`, `DisciplineForm`, `FamilyForms`).
- **A7 Rückgängig.** `apps/spiegel/src/components/shell/UndoBar.tsx` samt Test → `packages/ui/src/design2/undo.tsx`.
  Statt `ActionResult` aus der App ein struktureller Typ im Paket:
  `type UndoResult = { success: true } | { error: string | Record<string, string[] | undefined> }`.
- **A8 Hilfe.** `HelpIcon`, `HelpButton`, `HelpBody` (mit `HELP_FIELDS`) aus `packages/shot-ui/src/help/` →
  `packages/ui/src/design2/help.tsx` mit dem Typ
  `HelpText = { title: string; short?: string; what?: string; read?: string; act?: string; caution?: string; minimum?: string; formula?: string }`;
  dazu `HelpSheet({ entry: HelpText | null, onClose })` auf `Sheet` und `HelpProvider`/`useHelp` (aus
  `apps/spiegel/src/components/shell/HelpContext.tsx`). `shot-ui/help/*` re-exportiert bzw. reicht `helpEntry(id)`
  durch; `help.test.tsx` (shot-ui) bleibt grün, neuer Test im Paket für Felder und Reihenfolge.
- **A9 Schreibregeln.** `packages/lib/src/wording.ts` (neu): `BASE_FORBIDDEN = /;|\.\.\.(?!\.)/` und
  `forbiddenIn(texts: string[], extra?: RegExp): string[]` (liefert die Texte mit Treffer). Export `./wording`.
  Spiegels `OLD_WORDS` setzt sich daraus zusammen; Test `packages/lib/src/wording.test.ts`.
- **A10 Prüf-Kit.** `apps/spiegel/tools/pruefen/{browser.ts,server.ts}` → neues Paket `packages/pruefen`
  (`@vereinsheim/pruefen`, ohne Build, Exporte `./browser`, `./server`, `./common`, `./pdf`;
  `startServer({ app, port })` statt fester Werte). `apps/spiegel/tools/pruefen.ts` importiert von dort.
  `common.ts` mit wiederverwendbaren Prüfungen aus `pruefen.ts`: `noSideScroll(page, widths)`, `barDoesNotCover(page)`,
  `themeNoFlash(page, key)`, `dialogFocus(page, opener)`, `pageText(page, selector)` (Text einer Tabelle oder Liste
  als Zeilen). `pdf.ts`: `pdfText(buffer)` über `pdftotext -layout` und `pdfPages(buffer, dir)` über `pdftoppm -png
-r 100` (Poppler; fehlt es, bricht das Skript mit einem Satz ab, wie es zu installieren ist).
- **A11 Leistenmaß.** `packages/shot-ui/src/layout/bar.ts` (`BAR_PX`, `EDGE_PX`, `JUMP_BAR`) samt `bar.test.ts` →
  `packages/ui/src/design2/bar.ts` (Export `./design2/bar`); `CardPage`, `PeriodPage`, `SectionBlock`, `SectionNav`,
  `useActiveSection`, `useReturnJump`, `useTargetFit` importieren von dort. Die klebenden Leisten in Ringwerk (W4) und
  Treffsicher (G4) nutzen dieselben Klassen.
- **A12 Trefferfarben als eine Quelle.** `packages/ui/src/design2/score-colors.ts`:
  `SCORE_HEX = { 10: "#e5484d", 9: "#e9b10c", 8: "#1fa3c8", 7: "#7c5cd6" } as const` und `scoreKey(ring)` (≥ 10 → 10,
  ≤ 7 → 7) für Orte ohne CSS-Variablen (PDF). Test: die Werte gleichen `--score-*` in `design2.css` (der Test liest die
  Datei wie `tokens.test.ts`); Export `./design2/score-colors`.
- **A13 Doku.** `packages/ui/CLAUDE.md` und conventions §10 („Allgemeine Bausteine“) um die neuen Bausteine;
  `vault/architecture/architecture.md` (Repo-Karte: `packages/pruefen`, `design2/*`).

**Prüfung Teil A:** `pnpm check` grün; `pnpm --filter spiegel pruefen --start` grün wie vorher; Bildschirmfotos von
Start, Scheibe, Profil, Admin bei 390 und 1280 px vor und nach Teil A gleich; der Diff berührt keine der oben
ausgeschlossenen Dateien.

## Teil R — Prüfbestand Ringwerk (vor jeder Änderung an Ringwerk)

Ziel: Jede Art von Wettbewerb in jeder Phase liegt als erfundener Datensatz vor. Seiten, Brackets und PDFs werden
**vorher** aufgenommen und nach jedem Ringwerk-Teil verglichen; jeder Ablauf läuft über die Oberfläche und wird in der
Datenbank nachgeprüft. Teil R ändert keine bestehende Datei in `apps/ringwerk/src` (nur neue Dateien unter
`apps/ringwerk/tools/`, `package.json`-Skripte und Doku).

- **R1 Prüfdatenbank (geschützt).** Eigene Datenbank `ringwerk_pruef` im Dev-Postgres (`docker-compose.dev.yml`), nie
  die Dev-DB mit der Kopie der echten Daten. `apps/ringwerk/tools/pruefdaten/db.ts`: legt sie an (`CREATE DATABASE`,
  Owner wie die Dev-DB), wendet die Migrationen an (`prisma migrate deploy` mit `DATABASE_URL` auf `ringwerk_pruef`)
  und verweigert sich, wenn die URL nicht auf `localhost` zeigt oder der Name nicht auf `_pruef` endet. Jeder Lauf
  beginnt mit einer frischen Datenbank (löschen und neu anlegen).
- **R2 Erfundene Testdaten.** `apps/ringwerk/tools/pruefdaten/`:
  - `names.ts`: erfundene Namen (Vornamen aus einer festen Liste, Nachnamen aus Baum- und Flussnamen, dazu lange Namen
    und Umlaute: „Ännchen Überlinger-Großkopf“), keine echten Personen (ADR-029, CLAUDE.md Regel 5).
  - `random.ts`: Zufall mit festem Startwert (Mulberry32), damit jeder Lauf dieselben Daten ergibt; Ergebnisse
    plausibel (Ringe je Disziplin, Teiler, Ringteiler über Ringwerks `lib/scoring`).
  - `scenarios.ts`: die Matrix unten als Daten, je Szenario ein Wettbewerb mit sprechendem Namen
    („L-DRR-6 · L2 Hinrunde läuft“).
  - `build.ts`: legt Disziplinen (ganze Ringe und Zehntel, mit Faktor), Konten (je eines ADMIN, MANAGER, USER;
    Passwörter erzeugt und nur in `apps/ringwerk/.env` als `PRUEF_*`), Teilnehmer und Wettbewerbe an. **Spielpläne,
    Setzungen, Playoff-Runden und Wertungen entstehen über Ringwerks eigene Funktionen** (`lib/matchups/roundRobin.ts`,
    die Funktionen hinter den Actions für Spielplan, Playoff-Start und Weiterschalten, `lib/scoring/*`), nicht als
    zusammengesetzte Zeilen. Wo eine Action ihre Logik nicht als Funktion ohne Sitzung anbietet, schreibt `build.ts`
    exakt die Zeilen, die die Action schreibt, und R5 belegt denselben Weg über die Oberfläche.
  - Skript `pnpm --filter ringwerk pruefdaten` (R1 + R2).
- **R3 Phasen-Matrix** (je Zeile ein eigener Wettbewerb; Phasen wie im echten Ablauf nacheinander erzeugt):

  **Liga, je Format Hin- und Rückrunde (`DOUBLE_ROUND_ROBIN`) und Best-of (`BEST_OF_SINGLE`, `groupBestOf` 3 und 5):**

  | Phase                       | Inhalt                                                                                                                                                                                 |
  | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | L0 Entwurf                  | ohne Teilnehmer; mit Teilnehmern ohne Spielplan                                                                                                                                        |
  | L1 Spielplan, kein Ergebnis | gerade (6) und ungerade (5, Freilos) Zahl; „Spielplan neu generieren“ sichtbar; Tabelle ohne Podium                                                                                    |
  | L2 Hinrunde läuft           | Teilergebnisse, Freilos, Kampflos-Sieg, ein Zurückgezogener mit offenen Paarungen, Abgabefristen; Best-of: eine Paarung 1:0 offen, ein Stechschuss                                     |
  | L3 Rückrunde läuft          | nur Hin- und Rückrunde                                                                                                                                                                 |
  | L4 Gruppenphase fertig      | „Playoffs starten“ sichtbar; Best-of: Direktvergleich „offen“ und „ausgeglichen“ (Dreier-Kreis)                                                                                        |
  | L5 Playoffs laufen          | Bracket mit Achtelfinale (16), Viertelfinale (8) und nur Halbfinale (4); je mitten in einer Runde und Runde fertig, noch nicht weitergeschaltet; öffentliches PDF zeigt jetzt Playoffs |
  | L6 Finale                   | läuft; entschieden über die Hauptwertung; über ein Stichkriterium; in der Verlängerung („Verl.“)                                                                                       |
  | L7 Ende                     | abgeschlossen mit und ohne Playoffs; archiviert                                                                                                                                        |

  Dazu: Liga ohne Playoffs; öffentliches PDF mit und ohne Passwort; Gleichstand auf Platz 1 und 3.

  **Event:** je Wertungsart (`RINGTEILER`, `RINGS`, `RINGS_DECIMAL`, `TEILER`, `DECIMAL_REST`) und je Zielwert-Modus
  (`TARGET_ABSOLUTE`, `TARGET_UNDER`, `TARGET_OVER`) mit je Bezug (`TEILER`, `RINGS`, `RINGS_DECIMAL`); Phasen Entwurf
  mit Starterliste, teilweise gewertet, fertig; Gastschützen; Teams mit `SUM` und `BEST`, Teamgröße 2 und 3; geteilte
  Plätze.

  **Saison:** klassisch nach Ringen, Teiler und Ringteiler; `ALT_RINGS_FIRST` und `ALT_TEILER_FIRST`; Mindestserien
  erreicht, nicht erreicht, ohne Serie; Faktor-Korrektur; Phasen wenige Serien, gemischt, fertig.

  **Ränder:** leerer Wettbewerb, 16 Teilnehmer mit langen Namen, Disziplin archiviert, Wettbewerb archiviert;
  Teilnehmer-Liste mit inaktiven Teilnehmern.

- **Stand R1–R3 (18. Oktober 2026, Branch `feat/design2-ringwerk-pruefbestand`):**
  `pnpm --filter ringwerk pruefdaten` baut die Matrix in rund 30 s als 92 Wettbewerbe auf, prüft jedes erwartete
  Merkmal an der Datenbank (`verify.ts`) und schließt mit einer Prüfsumme über alle Tabellen (`checksum.ts`, IDs durch
  Ordnungsnummern ersetzt; `--pruefsumme` nur prüfen, `--zeilen <ordner>` kanonische Zeilen zum Vergleich zweier
  Läufe). Abweichend vom Text oben:
  - `build.ts` ruft **die Server-Actions selbst** auf, nicht nur die Funktionen dahinter: `tools/pruefdaten/tsconfig.json`
    ersetzt `next-auth`, `next/cache` und `server-only` durch Stellvertreter (`stubs/`), `getAuthSession` läuft echt
    gegen das Konto in der Datenbank. Konten: `pruef-admin|manager|user@example.test`, Passwörter in
    `apps/ringwerk/.env` (`PRUEF_*`), dazu `PRUEF_PUBLIC_PASSWORD` für öffentliche PDFs mit Passwort.
  - **Einzige direkte Schreibung:** der Kampflos-Sieg (`Matchup.status = WALKOVER`). Keine Action setzt ihn; Spielplan
    und PDF zeigen ihn nur an. R5 kann diesen Weg über die Oberfläche nicht belegen, es gibt keinen.
  - „L0 Entwurf“ ist ein aktiver Wettbewerb ohne Teilnehmer bzw. ohne Spielplan: `createCompetition` legt immer `ACTIVE`
    an, den Status `DRAFT` erreicht keine Action.
  - „Direktvergleich offen“ liegt in L2 (Best-of), nicht in L4: In einer fertigen Gruppenphase ist jeder direkte
    Vergleich gespielt. L4 Best-of zeigt „ausgeglichen“ (Dreier-Kreis).
  - **Befund für R4/R6:** `advanceRound` setzt die Finalisten in der Reihenfolge, in der `findMany` (ohne `orderBy`) die
    Halbfinals liefert. Welche Seite A ist, hängt damit an der physischen Zeilenfolge in Postgres. Die Prüfdatenbank
    läuft deshalb ohne Autovacuum (`db.ts`); in Produktion kann die Seite des Finales zufällig sein. Eine Änderung in
    `src` gehört nicht in Teil R und braucht eine eigene Entscheidung.
- **R4 Ausgangsstand aufnehmen (Haltepunkt).** `apps/ringwerk/tools/pruefen-ringwerk.ts --aufnehmen` gegen den
  gebauten Stand von `main` (vor Teil W) auf der Prüfdatenbank:
  - **Seiten:** je Wettbewerb jede erreichbare Seite (`/competitions/[id]/{schedule,standings,ranking,playoffs,
participants,series,audit-log}`, Wettbewerbsliste, Dashboard, Teilnehmer, Disziplinen), als ADMIN und USER, bei 390
    und 1280 px. Gespeichert wird der Text jeder Tabelle, Liste und Paarung als Zeilen (`pageText`), dazu ein
    Bildschirmfoto.
  - **Brackets:** je L5/L6-Szenario Bildschirmfoto des Brackets und Aufbau als Daten (Runden, Paarungen, Stand,
    Sieger).
  - **PDFs:** alle sieben PDF-Routen für jeden passenden Wettbewerb: `competitions/[id]/pdf/{schedule,standings,
ranking,playoffs}`, `competitions/[id]/starter-list/pdf`, `participants/pdf` und das öffentliche
    `public/c/[slug]/pdf` (mit und ohne Passwort; es wählt je Phase selbst zwischen Spielplan und Playoffs). Gespeichert als Text (`pdfText`) und
    als Seitenbilder (`pdfPages`).
  - Ablage: Text und Aufbau unter `apps/ringwerk/tools/pruefdaten/referenz/` (committet, frei von Personendaten);
    Bilder unter `reports/ringwerk-referenz/` (lokal, gitignored). Erzeugungszeit und QR-Code-Inhalt werden vor dem
    Vergleich herausgenommen (Zeitstempel und Token wechseln je Lauf).
  - **HALT:** Der User sieht sich eine Auswahl der Bilder an (je Art ein Bracket, ein PDF je Route) und bestätigt den
    Ausgangsstand.
- **R5 Abläufe über die Oberfläche.** `pruefen-ringwerk.ts --ablaeufe` auf frischer Prüfdatenbank, am Telefon (390 px)
  und am Desktop (1280 px), als MANAGER und ADMIN: Wettbewerb je Art anlegen, bearbeiten (Regelwerk-Sperre nach erstem
  Ergebnis), Teilnehmer einschreiben und zurückziehen, Spielplan erzeugen und neu erzeugen, Ergebnisse eintragen
  (Liga-Paarung, Best-of-Duelle mit Stechschuss, Event-Serie, Team, Saison-Serie), Kampflos, Playoffs starten, Duelle
  bis zum Finale samt Verlängerung, Runde weiterschalten, Status abschließen und archivieren, löschen (auch erzwungen),
  Protokoll ansehen, PDF herunterladen. **Nach jedem Schritt** liest das Skript die betroffenen Zeilen aus der
  Datenbank und vergleicht sie mit den eingegebenen Werten (nichts fehlt, nichts doppelt, keine verwaisten Serien).
  Dazu: Feldfehler lassen die Eingaben stehen; „ungespeicherte Änderungen“ greift beim Verlassen.
- **R6 Vergleich.** `pruefen-ringwerk.ts --vergleichen`: nimmt dieselben Seiten und PDFs auf und vergleicht mit R4.
  Fehler bei jeder Abweichung in Zahlen, Reihenfolge, Plätzen, Paarungen, Siegern und PDF-Text; die Bilder stellt es
  vorher/nachher nebeneinander in eine HTML-Datei unter `reports/` für die Sichtprüfung. Skripte
  `pruefen:aufnehmen`, `pruefen:ablaeufe`, `pruefen:vergleichen` in `apps/ringwerk/package.json`.
- **R7 Echte Daten, nur lesend.** Dasselbe `--aufnehmen`/`--vergleichen` gegen die Dev-DB mit der Kopie der echten
  Daten (`dev-restore`), ohne `--ablaeufe`. Ergebnisse nur lokal in `reports/`, nie committet. Der Bericht nennt, welche
  Phasen aus R3 die echten Daten enthalten und welche nur der Prüfbestand belegt.
- **R8 Doku.** Note `vault/apps/ringwerk/ringwerk-pruefbestand.md` (Zweck, Matrix, Befehle, was vor einem Release
  laufen muss), `apps/ringwerk/CLAUDE.md` (Abschnitt „Vor jedem Release“), `vault/operations/operations.md` (Release
  von Ringwerk: Abgleich, Backup, Termin).

**Prüfung Teil R:** `pnpm check`; `pruefdaten` zweimal hintereinander ergibt dieselben Daten (Prüfsumme über die
Tabellen); `--vergleichen` direkt nach `--aufnehmen` ohne Abweichung; eine absichtlich vertauschte Zeile in einer
Tabelle (testweise im Vergleich) wird rot gemeldet (Gegenprobe); `--ablaeufe` grün.

## Teil T — Treffsicher auf Design 2

### Basis

- **T1 Styles und Schrift.** `apps/treffsicher/src/app/globals.css`: `@import "tailwindcss"`, `tw-animate-css`,
  `shadcn/tailwind.css`, `@vereinsheim/ui/design2.css`, `@source "../"`, `@theme` mit den Schriftvariablen wie
  Spiegel. `apps/treffsicher/src/app/layout.tsx`: Archivo, Geist, Geist Mono wie Spiegel, `className="dark"`
  entfernen, `data-app="treffsicher"` bleibt, `suppressHydrationWarning`,
  `<ThemeScript storageKey="treffsicher-theme">` im `<head>`, `<ThemeProvider>` um `Providers`, Toaster aus
  `design2/toaster`.
- **T2 Rahmen.** `apps/treffsicher/src/components/app/shell/AppShell.tsx` (neu) mit `AppFrame` laut „Festgelegt“,
  `renderLink` mit `next/link`, `current` aus `usePathname()` (`/dashboard` exakt, sonst `startsWith`),
  `sidebarFooter={<ThemeSwitch />}`, `UndoHost` und `HelpProvider` um den Inhalt, `HelpSheet` eingehängt.
  `src/app/(app)/layout.tsx`: `AppShell` plus `Page` statt `Navigation` und `<main className="mx-auto max-w-6xl px-4
py-8">`. `Navigation.tsx` löschen. Test `AppShell.test.tsx` (Markup): Admin nur für Admins, aktiver Eintrag, „Neue
  Einheit“ zeigt auf `/sessions/new`. `src/proxy.ts`: Nicht-Admins auf `/admin…` → `/` (Prädikat `isAdminPath`,
  Test), falls nicht schon durch die eigene Aufgabe erledigt.
- **T3 Profil.** `src/app/(app)/profile/page.tsx` aus `account/page.tsx`: Darstellung (`ThemeSwitch`), Passwort,
  Abschnitt „Weitere Bereiche“ nur unter 1024 px (Ziele, Ablauf, Disziplinen, Admin), Abmelden. `account/page.tsx` →
  `permanentRedirect("/profile")`. Interne Links auf `/account` umstellen (`grep -rn '"/account' apps/treffsicher/src`).
- **T4 Anmeldung.** `src/app/(auth)/login/page.tsx` im Aufbau der Spiegel-Anmeldung (`apps/spiegel/src/app/login/`):
  Marke in Archivo, Karte mit `radius-xl`, beide Themes.
- **T5 Farben.** Nur so weit, dass die heutige Statistik in beiden Themes lesbar ist; Teil G ersetzt sie.
  `src/components/app/statistics-charts/constants.ts`: Ringverteilung auf `var(--score-10)`, `var(--score-9)`,
  `var(--score-8)`, `var(--score-7)` (≤ 7), Hex-Skala entfernen; Trefferlage-Hex auf `var(--overlay)`,
  `var(--chart-*)`. Recharts-Achsen und -Gitter auf `var(--muted-foreground)`, `var(--border)`, Schrift 12 px.
  Treffer und Ringwerte überall mit `score-*`: `components/app/sessions/ShotHistogram.tsx` und die Schusswerte der
  Einheit (Farbpunkt vor dem Wert wie Spiegels Ablesung, Text in Schriftfarbe, denn Gold und Türkis tragen als Schrift
  auf Hell nicht). `grep -rnE '#[0-9a-fA-F]{6}' apps/treffsicher/src --include='*.tsx' --include='*.ts'` außerhalb
  `export/pdf` ist danach leer.
- **T6 Trefferfarben im PDF.** `src/app/(app)/sessions/[id]/export/pdf/_lib/constants.ts`: die Meyton-Skala durch
  `SCORE_HEX` aus A12 ersetzen (das PDF kennt keine CSS-Variablen). Ringe ≤ 7 violett wie am Bildschirm.
- **T7 Zahlen.** Große Ergebnisse (Dashboard, Einheit, Serienergebnis) in `font-display` mit `tabular-nums`, Tabellen
  und Achsen `font-mono` (Stellen: `grep -rn 'text-2xl\|text-3xl\|text-4xl' apps/treffsicher/src/components`).
- **T8 Andere Formen ohne geteilte Primitives.** Wo Treffsicher eine Spiegel-Form braucht (Reiter der Statistik bis
  Teil G, Filter), nimmt es `design2/segmented`, `design2/toggle-chip`, `design2/sheet`; `packages/ui/src/ui/*` bleibt
  unverändert (siehe „Festgelegt“).
- **T9 Prüfung.** `apps/treffsicher/tools/pruefen-account.ts`: legt in der Dev-DB ein Konto `pruefen@treffsicher.test`
  an oder setzt sein Passwort, verweigert sich, wenn `DATABASE_URL` nicht auf `localhost` zeigt; Zugangsdaten als
  `PRUEFEN_EMAIL`/`PRUEFEN_PASSWORD` in `apps/treffsicher/.env`. `apps/treffsicher/tools/pruefen.ts` mit
  `@vereinsheim/pruefen`: je Hauptseite `noSideScroll` bei 375/390/768/1280, `barDoesNotCover`, `themeNoFlash`, Fokus
  im Löschdialog; Skript `pruefen` in `package.json`.

### Folgen vor dem Bestätigen

- **TC0 Textbuch (Haltepunkt).** Für jeden Dialog in TC2 Titel, Worum, Vorher prüfen, Was passiert, Was nicht
  passiert, Rückgängig, Knopf nach den Schreibregeln (conventions §10) als „alt → neu“ in
  `vault/_attachments/textbuch-ringwerk-treffsicher.md`. Die Folgen aus den Actions ablesen (was löscht kaskadierend).
  **HALT:** Der User liest und gibt frei.
- **TC1 Texte.** `apps/treffsicher/src/lib/consequences.ts` mit je einer reinen Funktion pro Dialog (Rückgabe
  `Decision`), Test `consequences.test.ts` hält den Wortlaut und `forbiddenIn(..., TREFFSICHER_OLD_WORDS)`.
- **TC2 Dialoge.** `DecisionDialog` statt `AlertDialog` in `ArchiveDisciplineButton`, `DeleteDisciplineButton`,
  `GoalActions`, `AdminUsersTable`, `AttachmentSection`, `DeleteSessionButton`, `DeleteShotRoutineButton`;
  `DiscardChangesDialog` ebenso. Vorher je Komponente ein Test, welche Action mit welchen Werten läuft. Nach dem
  Löschen `useUndo` dort, wo die Action ein Rückgängig hat (heute keine: dann Toast wie bisher).

### Hilfe und „–“ mit Grund

- **TD0 Textbuch (Haltepunkt).** Erklärungen im Format `HelpText` für Prognose/Feedback und Befinden der Einheit.
  **HALT:** Der User gibt frei.
- **TD1 Themen.** `apps/treffsicher/src/lib/help/topics.ts` (`Record<string, HelpText>`), Test: jedes Thema hat
  `title`, `short`, `what`; `forbiddenIn` über alle Felder.
- **TD2 „?“** an `SessionPrognosisFeedbackComparisonCard` und Befinden; Schalter „Erklärungen“ wie Spiegel.
- **TD3 „–“ mit Grund.** Stellen mit `0`, leer oder Platzhalter für „kein Wert“ (`grep -rn '?? 0\|"—"\|Keine Daten'
apps/treffsicher/src/components`) zeigen „–“ mit Grund aus einer reinen Funktion (Test).
- **TD4 Doku.** conventions §3 (Shell: `Page`), §4 (Farben: Design-2-Tokens, Akzent je App in beiden Themes,
  Ringwert-Skala), §5 neu („Navigation: `AppFrame`“), §2 („Bestätigungen: `DecisionDialog`“) mit dem Hinweis, dass
  Ringwerk bis Teil W noch das alte Schema hat; `vault/apps/treffsicher/*` mit Navigation, Theme, Dialogen.

**Prüfung Teil T:** `pnpm check`; `pnpm --filter treffsicher pruefen --start` und `pnpm --filter spiegel pruefen
--start` grün; Sichtprüfung im Browser bei 390 und 1280 px, hell und dunkel, jede Hauptseite, jeder Dialog,
Bildschirmfotos für den User; `pnpm --filter ringwerk pruefen:vergleichen` ohne Abweichung (Ringwerk unberührt).

## Teil G — Treffsichers Statistik wie Spiegels Fortschritt

Treffsicher hat heute eine eigene Welt: sechs Reiter, 18 Hooks in `statistics-charts/hooks`, eigene Trend- und
Normalisierungsrechnung, Hochrechnung, Radar, gestapelte Fläche, Meyton-Farben, Recharts. Spiegel beantwortet dieselbe
Frage („Werde ich besser?“) mit **einer** Seite eines Zeitraums und Regeln, die schon geprüft sind (Simulation B19).
Die Rechnungen in `shot-core/analysis/period.ts` (`periodTrend`, `periodBuckets`, `trainingVolume`, `comparePeriods`)
arbeiten bereits auf einem schlichten Wert je Scheibe (`CardValue { id, atMs, value, n }`). Die Rekorde setzt
`combineRecords` aus `RecordCandidates` je Scheibe zusammen. Gebunden an Spiegel sind nur `shot-ui/period/model.ts`
(`ProjectedCard`) und die Links in `CardList`/`CardReadout` (`RouteLink`).

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
| Meyton-Farbschema                               | `score-*` (Teil T, auch im PDF)                                                                                             |
| keine Rekorde                                   | Spiegels Rekorde (R1–R8, R10, R11), wo Einzelschüsse erfasst sind                                                           |

- **G0 Abgleich (Haltepunkt).** Die Tabelle mit echten Zahlen aus der Dev-DB belegen (wie viele Einheiten mit
  Einzelschüssen, mit Trefferlage, mit Befinden, mit Qualität; nur Zählungen, keine Namen). **HALT:** Der User gibt die
  Zuordnung frei oder ändert sie.
- **G1 Eingabe verallgemeinern.** `packages/shot-ui/src/period/model.ts`: `periodModel` nimmt statt
  `ProjectedCard[]` eine schlanke Eingabe
  `PeriodItem { id: string; startedAtMs: number; kind: "training" | "match"; probeOnly: boolean; metrics: Record<string, { value: number; n: number } | null>; records: { decimal: RecordCandidates | null; rings: RecordCandidates | null }; flags: readonly string[] }`.
  `records` trägt die Bausteine der Rekorde je Wertung (aus `cardRecordCandidates`), damit `combineRecords` ohne
  Schüsse auskommt. Spiegel bildet `ProjectedCard` in `shot-ui/period/fromProjection.ts` darauf ab.
  Charakterisierung vorher: `model.test.ts` und ein neuer Test, der für `testSeason.ts` das ganze `PeriodModel`
  (samt `records` mit R10/R11 und `NEW_RECORDS`) vor und nach dem Umbau gleich hält (Gegenprobe: Quelle vertauschen →
  rot, conventions §9).
- **G2 Links lösen.** `CardList` und `CardReadout` bekommen `renderLink(id, props)` statt `RouteLink`/`ListRoute`;
  Spiegel reicht `RouteLink` durch. Markup-Tests unverändert grün.
- **G3 Einheiten als Eingabe.** `apps/treffsicher/src/lib/statistics/periodItems.ts`: Einheit → `PeriodItem`.
  Ø je Schuss aus den Wertungsserien, `n` = Wertungsschüsse. Die Wertung (Zehntel oder ganze Ringe) folgt der
  Disziplin als Vorgabe, wie Spiegels Wertung je Disziplin (`official` in `PeriodCard`, Vorgaben für Training und
  Wettkampf); die heutige Logik aus `statistics-charts/utils/displayScore.ts` zieht hierher, weil G9 den Ordner löscht.
  Zehnerquote, Innenzehner, Serien und `records` (über `cardRecordCandidates` aus einer `PeriodCard` der
  Einzelschüsse; ohne Lage bleibt „engste Gruppe“ leer) nur mit Einzelschüssen, sonst `null` mit Grund. Lage aus
  `hitLocation*Mm`/`*Direction`. Rechnungen nur aus `@vereinsheim/shot-core`, keine eigene Mittelung. Test mit
  Fixtures, in denen eine falsche Quelle (Probe mitgezählt, Serien statt Schüsse gemittelt) ein anderes Ergebnis gibt.
- **G4 Seite.** `src/app/(app)/statistics/page.tsx`: `PeriodPage` mit `PeriodHeader`, `SectionNav`, `PeriodChart`,
  `VolumeChart`, `PeriodResult`, `CardReadout`, `CardList`, `PeriodTiles`, `PeriodInsights` wie Spiegels
  `ProgressScreen` (`apps/spiegel/src/components/progress/ProgressScreen.tsx`); Zustand in der Adresse über
  `shot-ui/period/state`. Rechnen auf dem Server, die Seite bekommt das fertige Modell. Lastgrenzen aus
  [[treffsicher-dos-protection]] bleiben.
- **G5 Einflüsse.** Ein Reiter „Einflüsse“ unter der Analyse: je Befinden-Wert (Schlaf, Energie, Stress, Motivation)
  und Ausführungsqualität zwei Gruppen (obere gegen untere Hälfte der eigenen Werte im Zeitraum), `comparePeriods` auf
  Ø je Schuss, Urteil in Alltagsworten; unter fünf Einheiten je Seite „zu wenige Einheiten“. Reine Funktion
  `influences(items)` in `apps/treffsicher/src/lib/statistics/influences.ts`, Test inklusive Mutationsprobe.
- **G6 Selbstbild.** Ein Reiter „Selbstbild“: je Dimension Ø Prognose, Ø Feedback, Abstand, als Zeilen mit Balken in
  Design 2 (kein Radar).
- **G7 Einheit.** `components/app/sessions/ShotHistogram.tsx` → Spiegels Ringverteilung
  (`shot-ui/analysis/charts/RingBars.tsx`), Farben `score-*`, „Werte als Tabelle“.
- **G8 Hilfe.** Kacheln und Karten holen ihre Erklärung über `helpForMetric`/`helpTopic` aus `shot-help` (gleiche
  Texte wie Spiegel). Neue Themen nur für „Einflüsse“ und „Selbstbild“, vorher ins Textbuch (**Haltepunkt**).
- **G9 Alte Statistik entfernen.** `components/app/statistics-charts/**`, `components/ui/chart.tsx` und `recharts` aus
  `apps/treffsicher/package.json`, wenn kein Import mehr bleibt (`pnpm install --frozen-lockfile` danach, conventions
  §9). PDF-Abschnitt `sessions/[id]/export/pdf/_lib/sections/hitLocation.ts` bleibt.
- **G10 Doku.** `vault/apps/treffsicher/statistics-visualization.md` neu (Seite eines Zeitraums, Abgleich,
  Einflüsse), `treffsicher-requirements.md` Abschnitt „Statistiken & Auswertung“ (Hochrechnung, Radar und
  Meyton-Farben gestrichen), `wellbeing-tracking.md`, `spiegel-langzeit.md` (Bausteine auch in Treffsicher),
  `packages/shot-ui/CLAUDE.md`.

**Prüfung Teil G:** `pnpm check`; Spiegel `pruefen` grün (die Verallgemeinerung ändert dort nichts); Treffsicher
`pruefen` mit Abschnitt „Statistik“: kein seitliches Scrollen, Lineal und „Werte als Tabelle“, Vergleich, Blatt
„Filter“. Abgleich der Zahlen: Ø je Schuss je Disziplin und Zeitraum auf der neuen Seite gleich der heutigen
Übersicht (vor G9 an der Dev-DB nebeneinander gemessen, Abweichungen erklärt im Bericht).

## Teil W — Ringwerk auf Design 2 (zuletzt, eigene Releases)

Erst, wenn Treffsicher nach Teil T und G eine Weile produktiv läuft. Jeder Abschnitt (Basis, Dialoge, Hilfe) ist ein
eigener Merge; vor jedem Merge und jedem Release gilt „Ringwerk: Betrieb sichern“. W ändert Darstellung, nicht Daten:
Der Vergleich aus Teil R muss bei Zahlen, Reihenfolge, Plätzen, Paarungen, Siegern und PDF-Text ohne Abweichung
bleiben; nur die Bilder der Seiten dürfen sich ändern, die der PDFs nicht.

### Basis

- **W1 Styles und Schrift.** wie T1 mit `data-app="ringwerk"`, `storageKey="ringwerk-theme"`.
- **W2 Rahmen.** wie T2 laut „Festgelegt“ (Rolle aus der Session, Teilnehmer/Disziplinen für ADMIN/MANAGER, Admin für
  ADMIN); `Navigation.tsx` löschen; `src/app/(app)/admin/layout.tsx` setzt kein eigenes Padding. `src/proxy.ts` wie in
  T2. Die Tabellen der Ratenbegrenzung unter Admin bleiben in ihren Karten (`min-w-0` im Raster, wie Spiegel).
- **W3 Profil und Anmeldung.** wie T3/T4 (`src/app/(app)/profile/`, `(public)/login/page.tsx`); am Telefon
  Disziplinen und Admin in Profil.
- **W4 Wettbewerb-Unternavigation.** `components/app/shell/CompetitionDetailHeader.tsx`: Reiterleiste in einer Zeile,
  die in sich seitlich scrollt (`Segmented` ohne `wrap`, als Links, Höhe aus `JUMP_BAR`), Name der Seite immer
  sichtbar (heute `hidden sm:inline`), Zurück-Link bleibt. Jede Seite, die heute erreichbar ist, bleibt es in jeder
  Phase (R4 prüft das je Szenario).
- **W5 Tabellen, Ränge, Bracket.** `components/ui/rank-badge.tsx` auf `rank-*` in beiden Themes; Tabellen
  (`StandingsTable`, `BestOfStandingsTable`, `SeasonStandingsTable`, `EventRankingTable`, `EventTeamRankingTable`,
  `schedule-view/*Table.tsx`): Ergebnisse `font-mono tabular-nums`, Platz in `font-display`; ausgeblendete Spalten am
  Telefon bleiben (`HIDE_ON_MOBILE`, sein Test bleibt unverändert). `PlayoffBracket`/`BracketDiagram` scrollt in sich,
  die Seite nie seitlich; Linien und Sieger-Hervorhebung aus Tokens.
- **W6 Primitives in beiden Themes.** `card`, `table`, `tabs`, `select`, `dialog`, `alert-dialog`, `dropdown-menu`,
  `badge`, `slider`, `textarea`, `input`, `skeleton`, `empty-state` gegen die Spiegel-Optik halten (Radien,
  `surface-2`, `line-strong`, Fokusring). Änderungen in `packages/ui/src/ui/*`; jetzt erst, weil Ringwerk im selben
  Merge umzieht. Markup-Test je geänderter Komponente; Spiegel und Treffsicher `pruefen` grün.
- **W7 Prüfung.** `apps/ringwerk/tools/pruefen.ts` mit `@vereinsheim/pruefen` (wie T9, Konten aus R2) und
  `pruefen:vergleichen` (R6) und `pruefen:ablaeufe` (R5).

### Folgen vor dem Bestätigen

- **WC0 Textbuch (Haltepunkt).** wie TC0 für die Dialoge in WC2; die Folgen aus den Actions ablesen (was löscht
  `delete.ts` kaskadierend, was bleibt im Protokoll, was sperrt das Regelwerk). **HALT:** Der User gibt frei.
- **WC1 Texte.** `apps/ringwerk/src/lib/consequences.ts` wie TC1; `scheduleDialogText` dort aufnehmen.
- **WC2 Dialoge.** Je Komponente **zuerst** der Charakterisierungstest (welche Action mit welchen Werten genau einmal),
  dann `DecisionDialog`: `DeleteEventSeriesButton`, `DeleteSeasonSeriesButton`, `ParticipantDeleteDialog`,
  `ToggleActiveAction`, `ConfirmActions`, `DisciplineActions`, `CompetitionStatusActions`,
  `ForceDeleteCompetitionSection`, `CompetitionActions`, `StartPlayoffsButton`, `AdvanceRoundButton`,
  `DeleteDuelConfirm`, `EntryControls`, `UserRowActions`, `GenerateScheduleButton`, `CompetitionForm`.
- **WC3 Aufräumen.** `packages/ui/src/shell/ConfirmDialog.tsx` und sein Export entfallen, wenn kein Import mehr
  bleibt; `useNavigationConfirm`-Aufrufer nutzen `DecisionDialog`.

### Hilfe und „–“ mit Grund

- **WD0 Textbuch (Haltepunkt).** Erklärungen für Teiler, Ringteiler, Sortierung der Tabelle (klassisch und
  abwechselnd), Best-of mit Direktvergleich, Faktor-Korrektur, Setzung und Runden der Playoffs, Finalwertung mit
  Stichkriterien und Verlängerung. **HALT:** Der User gibt frei.
- **WD1 Themen.** `apps/ringwerk/src/lib/help/topics.ts` wie TD1.
- **WD2 „?“** an den Spaltenköpfen Teiler/Ringteiler, am Sortiersatz in `SeasonStandingsTable`, am Kopf von
  `BestOfStandingsTable` und `PlayoffBracket`.
- **WD3 „–“ mit Grund** wie TD3 für `apps/ringwerk/src/components`; Tabellen ohne Ergebnis zeigen „noch kein
  Ergebnis“.
- **WD4 Doku.** conventions §2–§5 ohne Ringwerk-Ausnahme, `navigation-pattern`, `color-semantics`, `component-canon`,
  `vault/apps/ringwerk/*` mit Navigation, Theme, Dialogen, Hilfe.

**Prüfung Teil W (je Merge):** `pnpm check`; `pnpm --filter ringwerk pruefen:vergleichen` ohne Abweichung in Zahlen,
Reihenfolge, Plätzen, Paarungen, Siegern und PDF-Text, PDF-Bilder gleich; `pruefen:ablaeufe` grün am Telefon und am
Desktop; R7 an den echten Daten ohne Abweichung; Sichtprüfung der Seiten und Brackets durch den User (Bilder
vorher/nachher nebeneinander); `tools/stack-e2e/run.sh`; danach Release nach „Ringwerk: Betrieb sichern“ Punkt 5.

## Teil E — Gate über drei Apps, Aufräumen

- **E1 (geschützt)** `scripts/consistency-check.sh`: Apps `ringwerk treffsicher spiegel`; `MUST_MATCH` für
  `src/app/globals.css`, `src/app/error.tsx`, `src/app/(app)/error.tsx`, `src/app/not-found.tsx`, `components.json`
  über alle drei (vorher in den Apps angleichen: E4).
- **E2 (geschützt)** Regeln: Icon-Buttons unter 24 px statt unter `h-10 w-10` (`size-[1-5]\b|h-[1-5] w-[1-5]` an
  `size="icon"`-Buttons); `dark:` bleibt verboten mit neuer Begründung („Farbe aus den Tokens“); Ausnahme der
  Trefferlage-Hex-Skala entfernen; Palette-Klassen gelten jetzt auch für Spiegel. Gegen eine Probedatei mit Verstößen
  und gegen den grünen Ist-Zustand prüfen (conventions §8).
- **E3 (geschützt)** Kopfkommentar des Skripts auf drei Apps; `bash -n scripts/consistency-check.sh`.
- **E4 Angleichen.** `globals.css`, Error-Boundaries, `not-found.tsx`, `components.json` der drei Apps byte-gleich
  (Spiegels Fassung als Vorlage, `@source` für `packages/shot-ui/src` in allen). Für Ringwerk gilt „Betrieb sichern“.
- **E5 `theme.css` entfernen.** Datei und Export aus `packages/ui`; `grep -rn 'theme.css' apps packages` leer.
- **E6 Doku.** conventions §1 (geteilte Schicht = Design 2), §8 (Gate über drei Apps, neue Regeln), §10 wird
  „Design 2 (alle Apps)“ und rückt nach vorn; `drift-protection`, `vault/architecture/architecture.md`
  (Cross-App-Konsistenz), SP-4.3 **Status:** umgesetzt; `/sync-graph`.

**Prüfung Teil E:** `./scripts/consistency-check.sh` grün; mit Probedatei rot; `pnpm check`; alle drei `pruefen`;
Ringwerk `pruefen:vergleichen` ohne Abweichung.

## Teil F — Durchsicht nach drei Ebenen (Messung, dann eigener Plan)

- **F1 Messung.** Wie [[spiegel-durchsicht]] am Telefon (390 px, 772 px Inhalt über der Leiste): je Hauptseite Länge
  in Bildschirmen, Bedienelemente und Zahlen (gesamt / erster Bildschirm), doppelte Zahlen, Fachbegriffe; die
  Kernfragen je App („Wie war meine letzte Einheit?“, „Werde ich besser?“, „Wo stehe ich in der Liga?“, „Wann schieße
  ich wieder?“) mit Urteil. Für Ringwerk an den Szenarien aus Teil R, damit jede Phase gemessen ist. Ergebnis als Note
  `vault/apps/treffsicher/treffsicher-durchsicht.md` und `vault/apps/ringwerk/ringwerk-durchsicht.md` mit Befunden.
  Dabei auch: Disziplinen werden in allen drei Apps verschieden verwaltet (Spiegel seit Oktober im Admin mit Wertung
  je Disziplin); ob eine gemeinsame Form passt, ist ein Befund.
- **F2** `/plan` für die Umsetzung der Befunde (Antwort zuerst auf Dashboard, Statistik und Wettbewerbsseite, eine
  Zeile Bedienung vor dem Inhalt, Filter im Blatt). Für Ringwerk nur Vorschläge, jede Änderung einzeln freigegeben.

## Nicht in diesem Plan (eigene Pläne oder Aufgaben)

- **Nicht-Admin auf `/admin` zum Start** in Ringwerk und Treffsicher: eigene Aufgabe der anderen Session (Fehler, der
  heute trifft); T2/W2 prüfen nur noch.
- **Papierkorb für Treffsicher-Einheiten** (Schema `deletedAt`, Abfragen, Seite „Papierkorb“, Löschen nach 30 Tagen,
  `useUndo`): eigener Plan mit Migration (geschützt). Ringwerk danach prüfen.
- **SP-4.1** (Treffsicher ablösen oder behalten) bleibt offen; der Umzug lohnt sich unabhängig davon. Teil G macht
  beide Wege leichter: Mit derselben Seite und denselben Rechnungen kann Treffsicher später auch Spiegels Scheiben
  zeigen (ADR-026).
- PDFs in Design 2.
- **Integrationsbranch nach `main`:** Wann und wie `feat/design2-all-apps` nach `main` geht und wie Releases
  (Treffsicher vor Ringwerk) dazu passen, entscheidet der User.

## Tests (Überblick)

- Neu: `design2/app-frame.test.tsx`, `design2/help.test.tsx`, `design2/score-colors.test.ts`, `lib/wording.test.ts`,
  erweitert `tokens.test.ts` (Kontraste), `ThemeScript.test.tsx` (Schlüssel), `AppShell.test.tsx` je App,
  `consequences.test.ts` je App, `help/topics.test.ts` je App, Grund-Funktionen aus TD3/WD3, `design2/bar.test.ts`
  (verschoben), `periodItems.test.ts` und `influences.test.ts` (Treffsicher), Charakterisierung des ganzen
  `PeriodModel` für `testSeason.ts` (G1), Charakterisierung je Ringwerk-Dialog (WC2).
- Skriptprüfungen (nicht im Gate): `pruefen` je App; Ringwerk zusätzlich `pruefen:aufnehmen`, `pruefen:vergleichen`,
  `pruefen:ablaeufe` auf dem Prüfbestand und `--aufnehmen`/`--vergleichen` an den echten Daten.
- Unverändert grün: `shot-ui` `AppFrame.test.tsx`, `help.test.tsx`, `period/*.test.ts(x)`, Spiegels
  `DecisionDialog`-/`UndoBar`-Tests am neuen Ort, alle bestehenden Ringwerk-Tests (PDF, Playoffs, Tabellen).
- Mutationsprobe (conventions §9): in A1 eine Akzentfarbe auf zu hellen Wert setzen → Kontrasttest rot; in TC1 ein
  Semikolon in einen Text → Wortlauttest rot; in R6 eine vertauschte Zeile → Vergleich rot.

## Verifikation

1. Je Teil `pnpm check` grün (alle fünf Gates, alle Apps) und `pnpm --filter <app> pruefen --start` für die
   betroffenen Apps; ab Teil R nach jedem Teil auch `pnpm --filter ringwerk pruefen:vergleichen`.
2. Sichtprüfung im Browser je Teil: 390 × 844 und 1280 × 900, hell und dunkel, Bildschirmfotos an den User.
3. Nach Teil T, W und E: `tools/stack-e2e/run.sh` mit den echten Images (Schriften kommen aus `next/font`, kein Abruf
   zur Laufzeit).
4. `/validate` und `/review` je Teil, Merge in den Integrationsbranch `feat/design2-all-apps` nur mit User-OK; Ringwerk-Releases nur nach „Ringwerk: Betrieb
   sichern“.
