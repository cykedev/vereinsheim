---
id: conventions
type: guide
title: "Shared Conventions — Treffsicher × Ringwerk"
aliases: ["Shared Conventions — Treffsicher × Ringwerk"]
keywords: [shared, conventions, treffsicher, ringwerk]
---

**TL;DR** Diese Dateien MÜSSEN in beiden Repos identisch sein (Gate = fatal bei Abweichung):

# Shared Conventions — Treffsicher × Ringwerk

> **Lebende Quelle der Wahrheit für app-übergreifende Konsistenz.** Diese Datei ist in beiden Repos
> **byte-identisch** und wird vom Drift-Gate (`vereinsheim/scripts/consistency-check.sh`) erzwungen.
> Änderungen hier immer in **beiden** Repos gleich einpflegen.

## 1. Byte-identische Shared-Schicht

Diese Dateien MÜSSEN in beiden Repos identisch sein (Gate = fatal bei Abweichung):

- App-lokale Reste (weiter im Gate, Next/shadcn-erzwungen + trivial): `components.json` + der dünne
  `src/app/globals.css`-Stub (nur die tailwindcss/tw-animate-css/shadcn-Imports + `@vereinsheim/ui/theme.css`;
  der Theme-Kern liegt im Paket). shadcn-CLI läuft weiter im App-Kontext.
- **Geteilt via `@vereinsheim/config`** (packages/config, seit Phase 2 — Drift dort **strukturell
  unmöglich**, daher *nicht* mehr im Gate): `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`,
  `postcss.config.mjs`, `next.config.ts`. Die App-Dateien sind nur noch dünne `extends`/Re-Export-Stubs
  (`.prettierrc` → `package.json`-Feld); Verhalten/Regeln ändert man **im Paket**, nicht in den Apps.
- Error-Boundaries: `src/app/error.tsx`, `src/app/(app)/error.tsx`, `src/app/not-found.tsx`
- **Geteilt via `@vereinsheim/ui`** (packages/ui, seit Phase 4 / Zyklus 2 — Drift **strukturell
  unmöglich**, daher *nicht* mehr im Gate): die ui-Primitives (`button`, `card`, `dialog`, …, seit
  September 2026 auch `table` + `skeleton`), die 4 shell-Komponenten (`ConfirmDialog`,
  `DetailActionBar`, `PageHeader`, `Providers`), die Rate-Limit-Admin-Oberfläche
  (`admin/LoginRateLimitTable`, `admin/LoginRateLimitInsights`) und der Tailwind-Theme-Kern
  (`@vereinsheim/ui/theme.css`). Import via `@vereinsheim/ui/<name>` bzw.
  `@vereinsheim/ui/shell/<name>`; Styles/Verhalten ändert man **im Paket**. App-spezifische `ui/*`
  (chart/form in Treffsicher, checkbox/rank-badge in Ringwerk) + `Navigation` bleiben app-lokal.
- **Geteilt via `@vereinsheim/lib`** (packages/lib, seit Phase 4 / Zyklus 1 — Drift **strukturell
  unmöglich**, daher *nicht* mehr im Gate): `cn` (`utils`), `forms/fieldErrors` (inkl. `getErrorMessage`),
  die Form-Hooks `useUnsavedChangesGuard` + `useNavigationConfirm`, `dateTime` (server-only, liefert
  `getDisplayTimeZone`) und seit September 2026 `format` (**isomorphe** Anzeige-Formatierung, auch für
  Client-Komponenten) sowie der reine Auth-Kern `auth/validation` +
  `auth/rate-limit/{config,limiter,normalization,types,adminTypes}`. Import via
  `@vereinsheim/lib/<subpath>`; Logik ändert man **im Paket**, nicht in den Apps.
- Diese Datei: `docs/shared-conventions.md`

Regel: Wer eine dieser Dateien ändert, ändert sie in **beiden** Repos gleich. Neue, klar
app-übergreifende Komponenten gehören in diese Liste (in `MUST_MATCH` des Gates ergänzen).

**Offen, noch nicht im Gate** (September 2026 entstanden, byte-identisch in beiden Apps —
gehören beim nächsten Gate-Update in `MUST_MATCH`, siehe §8):

- `src/components/app/admin/AdminLoginRateLimitTable.tsx` — dünner Wrapper um
  `@vereinsheim/ui/admin/LoginRateLimitTable`; app-lokal, weil die Server Action nicht aus einer
  geteilten Datei kommen darf.
- `test/server-only-stub.ts` + der `server-only`-Alias in `vitest.config.ts` — besser noch:
  die Vitest-Basiskonfiguration nach `@vereinsheim/config` ziehen, dann entfällt beides.

## 2. Komponenten-Kanon

- **Seitenkopf:** `<PageHeader title description action />` (`shell/PageHeader.tsx`). Kein inline-h1.
  Detailseiten mit oberer Aktionsleiste nutzen stattdessen `DetailActionBar` (siehe unten) + rohes
  `h1` im selben Stil.
- **Detail-Aktionen:** `<DetailActionBar>` — Inline-`ghost`-Buttons oben rechts, Reihenfolge
  **fachlich → destruktiv → Zurück**. **Kein** `DropdownMenu`/`MoreHorizontal` für Objekt-Aktionen.
- **Leerzustände:** `<EmptyState title description icon actionLabel actionHref />`. Kein inline
  `Keine … vorhanden`.
- **Bestätigungen:** `<ConfirmDialog>` (destruktiv: `destructive`-Prop). Nie native `confirm()`.
- **Feldfehler:** `getFieldError`/`getGeneralError` (`lib/forms/fieldErrors.ts`) + `<FieldError>` mit
  `aria-invalid`/`aria-describedby`.
- **Toasts:** nach jeder mutierenden Server-Action `toast.success(...)` bzw. `toast.error(...)` (sonner).
- **Datenverlust:** Langformulare nutzen `useUnsavedChangesGuard` + `useNavigationConfirm` + `ConfirmDialog`.

## 3. Typografie & Layout

- Seitentitel: `text-2xl font-semibold tracking-tight` (**nicht** `font-bold`).
- Untertitel: `text-sm text-muted-foreground`.
- Pending-/Lade-Texte: Unicode-Ellipsis `…` (U+2026), nie ASCII `...`.
- App-Shell: `mx-auto max-w-6xl px-4 py-8` — **im Layout, nicht in der Seite**. Eine Seite setzt
  **keinen** eigenen `px-`/`py-`-Container (sonst doppeltes Padding); ein eigenes `max-w` für
  Formularseiten (`mx-auto max-w-lg space-y-6`) ist erlaubt und bewusst zu setzen.
- **Kontrast-Untergrenze:** kein Opazitäts-Modifier auf `text-muted-foreground` (kein `/60`, `/70`,
  `/80`) und keine Schriftgröße unter `text-xs`. Zurückgenommener Text nutzt die volle
  `muted-foreground`-Farbe.

## 4. Icon-Vokabular (lucide-react)

| Bedeutung   | Icon         |     | Bedeutung        | Icon                       |
| ----------- | ------------ | --- | ---------------- | -------------------------- |
| Disziplinen | `Target`     |     | Bearbeiten       | `Pencil`                   |
| Löschen     | `Trash2`     |     | Archiv / Restore | `Archive`/`ArchiveRestore` |
| Neu anlegen | `Plus`       |     | Zurück           | `ArrowLeft`                |
| Konto       | `UserCircle` |     | Abmelden         | `LogOut`                   |
| Mobil-Menü  | `Menu`/`X`   |     | PDF/Download     | `Download`                 |

Marken-Logos (kollisionsfrei, je App eindeutig): **Treffsicher `Crosshair`**, **Ringwerk `CircleDot`**.
`Target` ist Disziplinen, `Trophy` ist in Ringwerk Wettbewerb/Sieger — **keines davon als Logo**.
Admin ist `Shield` (letzter Haupt-Nav-Eintrag), PDF/Download ist `Download`.

### Farben: semantische Tokens statt Palette

Farbe trägt Bedeutung und wird über die Tokens aus `@vereinsheim/ui/theme.css` ausgedrückt:

| Token                  | Bedeutung                                     |
| ---------------------- | --------------------------------------------- |
| `success`              | Sieg, erledigt, Erfolgsmeldung                |
| `warning`              | Unentschieden, offen, Hinweis                 |
| `info`                 | neutral markiert (Typ-Badge, Achtelfinale)    |
| `destructive`          | Löschen, Fehler, schlechter als Prognose      |
| `rank-1`/`-2`/`-3`     | Platz 1/2/3 — Gold/Silber/Bronze              |
| `chart-1` … `chart-5`  | Diagramm-Serien (`chart-1` = App-Akzent)      |

**Keine Tailwind-Palette-Klassen** (`text-emerald-600`, `bg-amber-950`, …) und **keine
`dark:`-Varianten** — beide Apps laufen fest im Dark Mode, eine `dark:`-Variante ist toter Code.
Ausnahme: die Hex-Skala der Trefferlage-Charts (`statistics-charts/constants.ts`) — Datenskala,
keine UI-Semantik.

Die **Akzentfarbe** je App kommt über `data-app` am `<html>`-Element (Ringwerk = Messing,
Treffsicher = Teal) und überschreibt nur `--primary`, `--primary-foreground`, `--ring`, `--chart-1`.

## 5. Navigation

Ein Schema in beiden Apps (September 2026 angeglichen):

- Kopfzeile `border-b border-border bg-card`.
- Links das **Logo als Link** auf die Startseite: Marken-Icon `h-5 w-5 text-primary` +
  `text-lg font-semibold tracking-tight`.
- Desktop-Links `hidden md:flex`; **Admin ist der letzte Haupt-Nav-Eintrag** (`Shield`), nicht im
  rechten Bereich.
- Rechts das Konto-Dropdown (`UserCircle`, „Mein Konto" + Separator + „Abmelden") **nur ab `md`**
  (`hidden md:block`), daneben der Hamburger `md:hidden`.
- Mobil `{mobileOpen && <nav className="border-t md:hidden">}` mit Hauptlinks **plus Konto plus
  Abmelden** — auf dem Telefon ist das Dropdown nicht erreichbar.
- Aktiv-Erkennung `pathname.startsWith(href)`; für ein Dashboard auf `/` **exakter** Vergleich.

## 6. Daten & Formatierung

- Datum/Zeit/Zahl über `@vereinsheim/lib/format` — **kein** inline `new Intl.*Format(...)` und kein
  `toLocale*String()` in Seiten, Komponenten, Hooks, PDF-Renderern. Braucht man ein neues Format,
  kommt es **ins Paket**, nicht in die Datei.
- Das Modul ist **isomorph** (kein `server-only`), damit Client-Komponenten und Chart-Hooks es nutzen
  können. Die **Anzeige-Zeitzone ist immer ein Parameter**; server-seitig kommt sie aus
  `getDisplayTimeZone()` (`@vereinsheim/lib/dateTime`, liest `DISPLAY_TIME_ZONE`) und wird als Prop
  durchgereicht. Ein Formatter ohne Zeitzone rendert in der Zone des Containers (UTC) — genau so
  entstanden die Zeitzonen-Bugs im Protokoll und in den Ringwerk-PDFs.
- Locale: **`de-DE`** (`APP_LOCALE`). Zeitzone-Default: `Europe/Berlin` (beide Apps).
- **ActionResult-Kanon** (Zielform, Ringwerk-Muster): diskriminierte Union
  `{ success: true; data?: T } | { error: string | Record<string, string[] | undefined> }`,
  je App in `src/lib/types.ts`. Konsumenten narrowen über `"error" in result` bzw.
  `"success" in state` — **kein** `state?.success` (die Union hat die Felder nicht optional) und
  **kein** `success: false`. Einen einzeiligen Fehlertext liefert `getErrorMessage` aus
  `@vereinsheim/lib/forms/fieldErrors`. _Seit September 2026 in beiden Apps umgesetzt._

## 7. Listen & Karten

Ganze Karte ist Link auf die Detailseite; keine „Details →"-Buttons. Ausnahme Ringwerk-Wettbewerbe
(Mehrfachziel): Name-als-Link. Verwaltungslisten zeigen kompakte Karten.

## 8. Drift-Schutz (Prozess)

- **Quality-Gates (vor jedem Commit, via `/check`):** `lint`, `format:check`, `test`, `tsc` **und
  `next build`** — alle fünf grün. `next build` ist Pflicht und fängt Build-only-Fehler ab, die die
  anderen Gates **nicht** sehen — z.B. die Next.js-Regel, dass eine `"use server"`-Datei nur direkt
  deklarierte async-Funktionen exportieren darf (keine Re-Exports/Barrels). Bei jeder Änderung an
  Server Actions zwingend.
- **Gate:** `vereinsheim/scripts/consistency-check.sh` läuft vor jedem Release (in
  `build-and-push.sh`) und ist **fatal** bei Abweichung der Shared-Schicht/Configs, **warnend** bei
  Dependency-Drift und Anti-Pattern.
- **Umgesetzt (Tier 1):** die Shared-Schicht liegt in gemeinsamen Paketen (`@vereinsheim/ui`,
  `@vereinsheim/lib`, `@vereinsheim/config`) — Drift ist dort strukturell unmöglich (siehe §1).
- **Offene Angleichungen:** Dependency-Pins (inkl. TypeScript-Major).
- **Noch nicht erzwungen:** die Regeln aus §3 (Seiten-Container, Kontrast-Untergrenze), §4
  (Palette-Klassen) und §6 (inline `Intl`) sind seit September 2026 im Code eingehalten, aber der
  `consistency-check.sh` prüft sie noch nicht — sie können also zurückdriften. Die Checks dafür
  nachzuziehen ist der offene Schritt (`scripts/` ist ein user-gated Pfad, siehe
  [[autopilot-guard-blocks-contract-only-plans]]).

## 9. Aus Lernlog übernommen

<!-- Zuletzt konsolidiert: 2026-08-25 -->

- **Bedingt ausgeblendete Formularfelder brauchen im Update Drei-Wege-Semantik**: Ein Feld, das
  das Formular nur bedingt rendert, fehlt im ausgeblendeten Zustand komplett in der FormData —
  `formData.get(...)` liefert dann `null`, was **nicht** dasselbe ist wie „vom User geleert". Im
  `update()` deshalb unterscheiden: Feld fehlt → `undefined` (Spalte nicht anfassen), leer
  abgeschickt (`""`) → `null` (bewusst geleert), Wert → parsen. Sonst löscht ein Speichern in
  einem Zustand, in dem das Feld unsichtbar ist, gespeicherte Daten lautlos (siehe
  [[deadline-wipe-on-hidden-form-fields]]).

- **Domänenentscheidungen am echten Datensatz gegenprüfen**: Wertungs-/Domänenentscheidungen vor
  dem "endgültig"-Status mit dem Domänen-Owner am echten Test-Datensatz gegenprüfen — besonders wenn
  sie kontraintuitiv wirken könnten. Spec-/Sportleitungs-Entscheidungen sind revidierbar; deshalb die
  Modell-Logik dafür zentral (eine reine Funktion) halten, damit ein späterer Flip nur eine Stelle
  berührt.
