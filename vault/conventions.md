---
id: conventions
type: guide
title: "Shared Conventions — Ringwerk × Treffsicher × Spiegel"
aliases: ["Shared Conventions — Ringwerk × Treffsicher × Spiegel", "Shared Conventions — Treffsicher × Ringwerk"]
keywords: [shared, conventions, treffsicher, ringwerk, spiegel, konventionen, design 2, drift-gate]
---

**TL;DR** Die app-lokalen Stub-Dateien MÜSSEN in allen drei Apps byte-gleich sein, und alle drei folgen denselben Regeln von Design 2 (Gate = fatal bei Abweichung):

# Shared Conventions — Ringwerk × Treffsicher × Spiegel

> **Lebende Quelle der Wahrheit für app-übergreifende Konsistenz.** Eine Quelle am Root (`vault/conventions.md`),
> per `@import` in der Root-`CLAUDE.md`. Die Gleichheit der geteilten Dateien und die Regeln von Design 2 erzwingt das
> Drift-Gate (`scripts/consistency-check.sh`) über alle Apps aus `scripts/lib/apps.sh`.

## 1. Byte-identische Shared-Schicht

Diese Dateien MÜSSEN in allen drei Apps identisch sein (Gate = fatal bei Abweichung):

- App-lokale Reste (im Gate, Next/shadcn-erzwungen + trivial): `components.json` + der dünne
  `src/app/globals.css`-Stub (die Imports von tailwindcss, tw-animate-css, shadcn und `@vereinsheim/ui/design2.css`,
  `@source` für die App und `packages/shot-ui/src`, die Schriften aus `next/font`; die Tokens liegen im Paket).
  shadcn-CLI läuft weiter im App-Kontext.
- Error-Boundaries: `src/app/error.tsx`, `src/app/(app)/error.tsx`, `src/app/not-found.tsx` (Design 2, Texte für
  alle drei Apps).
- **Geteilt via `@vereinsheim/config`** (packages/config — Drift dort **strukturell
  unmöglich**, daher *nicht* im Gate): `tsconfig.json`, `eslint.config.mjs`, `.prettierrc`,
  `postcss.config.mjs`, `next.config.ts`, `vitest.config.ts` (inkl. `server-only`-Alias
  auf einen Stub im Paket; die App ergänzt Eigenheiten wie `fileParallelism` per `mergeConfig`). Die App-Dateien sind nur noch dünne `extends`/Re-Export-Stubs
  (`.prettierrc` → `package.json`-Feld); Verhalten/Regeln ändert man **im Paket**, nicht in den Apps.
- **Geteilt via `@vereinsheim/ui`** (packages/ui — Drift **strukturell
  unmöglich**, daher *nicht* im Gate): die ui-Primitives (`button`, `card`, `dialog`, `table`,
  `skeleton`, …), die 3 shell-Komponenten (`DetailActionBar`,
  `PageHeader`, `Providers`), die Rate-Limit-Admin-Oberfläche
  (`admin/LoginRateLimitTable`, `admin/LoginRateLimitInsights`), die Bausteine von Design 2 (`design2/*`) und
  die Tokens (`@vereinsheim/ui/design2.css`, §10). Import via `@vereinsheim/ui/<name>` bzw.
  `@vereinsheim/ui/shell/<name>`; Styles/Verhalten ändert man **im Paket**. App-spezifische `ui/*`
  (form in Treffsicher, checkbox/rank-badge in Ringwerk) bleiben app-lokal.
- **Geteilt via `@vereinsheim/lib`** (packages/lib — Drift **strukturell
  unmöglich**, daher *nicht* im Gate): `cn` (`utils`), `forms/fieldErrors` (inkl. `getErrorMessage`),
  die Form-Hooks `useUnsavedChangesGuard` + `useNavigationConfirm`, `dateTime` (server-only, liefert
  `getDisplayTimeZone` und `isValidIanaTimeZone`), `format` (**isomorphe** Anzeige-Formatierung, auch für
  Client-Komponenten) sowie der reine Auth-Kern `auth/validation` +
  `auth/rate-limit/{config,limiter,normalization,types,adminTypes}`, dazu Anmeldeablauf
  (`auth/credentials`, mit gleich langer Antwort für unbekannte Konten), IP aus Proxy-Headern (`auth/client-ip`), Store
  (`auth/rate-limit/stores`, Tabelle als Schnittstelle) und Admin-Auswertung der Sperren (`auth/rate-limit/admin`) für
  alle drei Apps. Import via `@vereinsheim/lib/<subpath>`; Logik ändert man **im Paket**, nicht in den Apps.

Regel: Wer eine dieser Dateien ändert, ändert sie in **allen drei** Apps gleich. Neue, klar
app-übergreifende Komponenten gehören in diese Liste (in `MUST_MATCH` des Gates ergänzen).

**Zusätzlich im Gate** (byte-identisch in allen drei Apps):

- `AdminLoginRateLimitTable.tsx` — dünner Wrapper um `@vereinsheim/ui/admin/LoginRateLimitTable`; app-lokal, weil
  eine geteilte Datei keine Server Action re-exportieren darf. Ringwerk und Treffsicher unter
  `src/components/app/admin/`, Spiegel unter `src/components/admin/`.

## 2. Komponenten-Kanon

- **Seitenkopf:** `<PageHeader title description action />` (`design2/page-header`). Kein inline-h1.
  Detailseiten mit oberer Aktionsleiste nutzen stattdessen `DetailActionBar` (siehe unten) + rohes
  `h1` im selben Stil.
- **Detail-Aktionen:** `<DetailActionBar>` — Inline-`ghost`-Buttons oben rechts, Reihenfolge **fachlich → destruktiv →
  Zurück**. **Kein** `DropdownMenu`/`MoreHorizontal` für Objekt-Aktionen. Ausnahme Spiegel: Die Seite einer Scheibe ist
  lang und oben voll (Rückweg, Titel, Beobachtungen, Sprungleiste). Ihre seltenen Aktionen (Disziplin, Teilen, Löschen)
  stehen am Ende im Kasten „Diese Scheibe“ (`CardActions`), je eine Zeile mit Zustand und Aktion rechts, fachlich vor
  destruktiv.
- **Reiter:** `<TabBar>` aus `@vereinsheim/ui/design2/tab-bar` für die Seiten eines Bereichs (Links), in allen Apps
  **eine Zeile, die wischt**; nie mehrzeilig. Der gezeigte Reiter ist in der Farbe der App markiert und rückt ins Bild,
  auf einer Unterseite ist der Reiter ihres Bereichs markiert (`detail`) und führt zurück. Reiter in einer Seite sind
  `Segmented scroll`: Eine Auswahl, die die Ansicht der Seite umschaltet, gilt als Reiter (die Analyse, die Art des
  Vergleichs). Auswahlen, die nur filtern oder einstellen (`Segmented`, mit `wrap` für viele oder lange Möglichkeiten
  wie Listen und Merkmale), sind keine Reiter und dürfen umbrechen. Entschieden am 29. Oktober 2026.
- **Leerzustände:** `<EmptyState title description icon actionLabel actionHref />`. Kein inline
  `Keine … vorhanden`.
- **Bestätigungen:** `<DecisionDialog>` mit den Folgen aus `lib/consequences.ts` der App (§10 „Kein Knopf ohne
  Folge“). Geht eine Aktion an dieser Stelle nicht, sagt `<NoticeDialog>` warum, statt einer Rückfrage, die danach
  scheitert. Nie native `confirm()`.
- **Hilfe:** Eine Zahl oder Überschrift, die Leser nicht von selbst verstehen, trägt ein „?“ (`HelpButton` aus
  `design2/help`). Es öffnet die Erklärung als Blatt (`HelpSheet`, einmal im Rahmen der App, geöffnet über `useHelp`),
  nie nur als Tooltip. Die Texte stehen an einer Stelle: Spiegel `@vereinsheim/shot-help`, Treffsicher und Ringwerk
  `src/lib/help/topics.ts` (Tests halten Felder und Schreibregeln, in Ringwerk auch den Wortlaut des Textbuchs).
- **„–“ mit Grund:** Wo kein Wert steht, steht „–“ und leise daneben der Grund, in schmalen Zellen als Tooltip und für
  Screenreader. Keine 0 und kein leeres Feld für „kein Wert“. Die Gründe kommen aus einer reinen Funktion der App
  (Treffsicher `src/lib/missing.ts`, Ringwerk `src/lib/help/missing.ts`). In Ringwerk nur auf dem Bildschirm, die PDFs
  bleiben, wie sie sind.
- **Feldfehler:** `getFieldError`/`getGeneralError` (`lib/forms/fieldErrors.ts`) + `<FieldError>` mit
  `aria-invalid`/`aria-describedby`.
- **Toasts:** nach jeder mutierenden Server-Action `toast.success(...)` bzw. `toast.error(...)` (sonner).
- **Datenverlust:** Langformulare nutzen `useUnsavedChangesGuard` + `useNavigationConfirm` + den Verwerfen-Dialog
  der App (Treffsicher `DiscardChangesDialog`, Ringwerk im Formular des Wettbewerbs, beide mit `DecisionDialog`).

## 3. Typografie & Layout

- Seitentitel: `font-display text-[1.7rem] leading-tight font-bold` über `design2/page-header` (Design 2, alle Apps).
- Untertitel: `text-sm text-muted-foreground`.
- Pending-/Lade-Texte: Unicode-Ellipsis `…` (U+2026), nie ASCII `...`.
- App-Shell: `Page` aus `design2/page` mit einer Spalte (`grid-cols-1`) — **im Layout, nicht in der Seite**. Eine Seite setzt
  **keinen** eigenen `px-`/`py-`-Container (sonst doppeltes Padding); ein eigenes `max-w` für
  Formularseiten (`mx-auto max-w-lg space-y-6`) ist in Treffsicher und Ringwerk erlaubt und bewusst zu setzen.
- **Raster der Seiten in Spiegel:** Jede Seite steht linksbündig im Rahmen (`Page`, höchstens 80 rem). Keine Seite
  zentriert sich selbst. Es gibt zwei Formen:
  - **Zwei Spalten** für Seiten mit Bild und Zahlen (Start, Scheibe, Fortschritt, Vergleichen): `PAGE_COLUMNS` aus
    `@vereinsheim/shot-ui/layout/columns`, ab 768 px links das Bild, rechts die Zahlen.
  - **Eine Spalte** für alle übrigen (Scheiben, Offen, Profil, Papierkorb, Admin): eine Breite, `PAGE_SINGLE`
    (48 rem), damit der Inhalt beim Wechsel der Bereiche nicht springt. Formulare darin dürfen schmaler sein
    (`max-w-lg`).
  - Ausnahme sind die Fehlerseiten ohne Rahmen (`error.tsx`, `not-found.tsx`, byte-gleich in allen Apps): Sie stehen
    zentriert.
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
| Tagebuch    | `BookOpen`   |     |                  |                            |

Marken-Logos (kollisionsfrei, je App eindeutig): **Treffsicher `Crosshair`**, **Ringwerk `CircleDot`**.
`Target` ist Disziplinen, `Trophy` ist in Ringwerk Wettbewerb/Sieger — **keines davon als Logo**.
Admin ist `Shield` (letzter Haupt-Nav-Eintrag), PDF/Download ist `Download`. Ein Link zu einer anderen App
(Treffsicher „Zu Spiegel“ für ein umgezogenes Konto) ist `ArrowUpRight` und öffnet im selben Tab.

### Farben: semantische Tokens statt Palette

Farbe trägt Bedeutung und wird über Tokens ausgedrückt, in allen Apps aus `@vereinsheim/ui/design2.css` (dieselben Namen, hell und dunkel, dazu `score-10` … `score-7` für
Ringwerte, §10):

| Token                  | Bedeutung                                     |
| ---------------------- | --------------------------------------------- |
| `success`              | Sieg, erledigt, Erfolgsmeldung                |
| `warning`              | Unentschieden, offen, Hinweis                 |
| `info`                 | neutral markiert (Typ-Badge, Achtelfinale)    |
| `destructive`          | Löschen, Fehler, schlechter als Prognose      |
| `rank-1`/`-2`/`-3`     | Platz 1/2/3 — Gold/Silber/Bronze              |
| `chart-1` … `chart-5`  | Diagramm-Serien (`chart-1` = App-Akzent)      |

**Keine Tailwind-Palette-Klassen** (`text-emerald-600`, `bg-amber-950`, …) und **keine
`dark:`-Varianten** — Farbe kommt aus den Tokens, die in hell und dunkel je ihren Wert haben. Treffer und Ringwerte zeigen alle Apps in den Farben von Spiegel (`score-*`, im PDF `SCORE_HEX`);
die Meyton-Skala von Treffsicher ist entfallen.

Die **Akzentfarbe** je App kommt über `data-app` am `<html>`-Element (Ringwerk = Messing,
Treffsicher = Teal, Spiegel ohne `data-app` = Blau), in Design 2 für hell und dunkel getrennt.

## 5. Navigation

**Design 2 (alle Apps): `AppFrame`** aus `@vereinsheim/ui/design2/app-frame`. Am Telefon eine untere Leiste
mit höchstens fünf Einträgen und der Aktion der App in der Mitte (Treffsicher „Neue Einheit“), im Querformat eine
schmale Leiste, ab 1024 px eine Seitenleiste mit Trenner vor Profil und Admin. Was nicht in die Leiste passt, steht am
Telefon in Profil. Die Darstellung steht unten in der Seitenleiste und in Profil. Aktiv-Erkennung über eine reine
Funktion der App (`areaOf`, Start exakt). Eine Seite wiederholt die Aktion des Rahmens nicht. Ringwerk hat keine
Aktion in der Mitte und zeigt die Bereiche je Rolle ([[ringwerk-design2]]); die Seiten eines Wettbewerbs stehen als
Reiter unter dem Namen.

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
  `@vereinsheim/lib/forms/fieldErrors`. _In allen drei Apps umgesetzt._

## 7. Listen & Karten

Ganze Karte ist Link auf die Detailseite; keine „Details →"-Buttons. Ausnahme Ringwerk-Wettbewerbe
(Mehrfachziel): Name-als-Link. Verwaltungslisten zeigen kompakte Karten.

## 8. Drift-Schutz (Prozess)

- **Quality-Gates (vor jedem Commit, via `/check`):** `lint`, `format:check`, `test`, `tsc` **und
  `next build`** — alle fünf grün. `next build` ist Pflicht und fängt Build-only-Fehler ab, die die
  anderen Gates **nicht** sehen — z.B. die Next.js-Regel, dass eine `"use server"`-Datei nur direkt
  deklarierte async-Funktionen exportieren darf (keine Re-Exports/Barrels). Bei jeder Änderung an
  Server Actions zwingend.
- **Der Cache des Gates kennt die Pakete:** `test` und `lint` hängen in der Root-`turbo.json` neben
  `db:generate` an `"^build"`. Die Pakete haben kein `build`-Script. Ihr leerer `build`-Knoten kostet
  keine Zeit, trägt aber den Hash ihrer Quellen. Ohne ihn kämen Tests und Lint einer App nach einer
  Änderung in `packages/*` grün aus dem Cache. Ein `dependsOn` in der `turbo.json` eines Pakets oder
  einer App **ersetzt** das der Root und muss `"^build"` deshalb wiederholen. Einzige Ausnahme ist
  die Brücke: ihre `inputs` nennen genau die Vertragsdateien, die die Go-Tests lesen. Prüfen mit
  `turbo run test lint --dry=json` vor und nach einer Änderung im Paket (siehe [[monorepo]]).
- **Gate:** `vereinsheim/scripts/consistency-check.sh` läuft vor jedem Release (in
  `build-and-push.sh`, immer über alle Apps, auch wenn `APPS` nur eine baut) und ist **fatal** bei Abweichung der
  Shared-Schicht (§1) und bei Verstößen gegen die Regeln unten, **warnend** bei Dependency-Drift und Anti-Pattern
  (native Dialoge, `MoreHorizontal`). Die Apps kommen aus `scripts/lib/apps.sh`.
- **Umgesetzt (Tier 1):** die Shared-Schicht liegt in gemeinsamen Paketen (`@vereinsheim/ui`,
  `@vereinsheim/lib`, `@vereinsheim/config`) — Drift ist dort strukturell unmöglich (siehe §1).
- **Offene Angleichungen:** Dependency-Pins (inkl. TypeScript-Major).
- **Erzwungen** (`consistency-check.sh`, Abschnitt „Konventionen von Design 2 (fatal)"), in `apps/*/src` aller drei
  Apps und in den geteilten Paketen `packages/ui/src`, `packages/shot-ui/src`, `packages/shot-help/src` (ohne Tests):
  Palette-Klassen und `dark:`-Varianten (§4, Farbe aus den Tokens), Opazitäts-Modifier auf `text-muted-foreground`
  (§3), inline `new Intl.*` und `toLocale*String()` (§6), ASCII-Ellipsen (§3), „… →"-Buttons (§7) und Symbolknöpfe
  (`<Button size="icon…">`, auch über mehrere Zeilen) mit einer Klasse `size-`, `h-` oder `w-` unter 6, auch halbe
  Stufen, `px` und `[Npx]` unter 24 px (§10; der kleinste ist `icon-xs`). Rohe `<button>` sieht diese Regel nicht.
  Reiterleisten von Hand (§2): der Stil der gezeigten Seite mit Fläche (`aria-[current=page]:bg-…`) außerhalb von
  `design2/tab-bar` und `design2/app-frame`. Ausgenommen von `dark:` sind nur die shadcn-Primitives in `packages/ui/src/ui` und Ringwerks
  `components/ui/checkbox.tsx`, die ihre Varianten aus dem Generator mitbringen.
  Die Muster sind bewusst eng: ein „→" **darf** als Inhalt in Protokolltexten stehen. Wer eine Regel ergänzt, prüft sie
  gegen eine Probe-Datei mit absichtlichen Verstößen **und** gegen den grünen Ist-Zustand.

## 9. Aus Lernlog übernommen

<!-- Zuletzt konsolidiert: 2026-10-03 -->

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

- **Fest breite Elemente in tabellarischen Zellen brauchen einen Platzhalter**: Fällt ein fest
  breites Element (Badge, Icon, Marker) in einer Zelle bedingt weg, tritt ein gleich breiter,
  `aria-hidden` Platzhalter an seine Stelle — sonst rutschen die Zahlen der betroffenen Zeilen
  gegen die übrigen. Die Bedingung dafür gehört als **ein** Prädikat in die geteilte Logik, aus der
  Bildschirm **und** PDF sie ziehen; zwei Kopien stimmen anfangs überein und laufen später
  auseinander (siehe [[next-dist-dir-shared-with-dev-server]] für dieselbe Klasse von Problem:
  zwei Autoritäten für dieselbe Sache).

- **Markup ist auch ohne jsdom testbar**: Beide Apps testen in `environment: "node"` ohne jsdom
  oder testing-library — für alles, was am gerenderten Markup hängt (`class`-Attribute,
  bedingt gerenderte Spalten, Hervorhebungen), genügt trotzdem
  `renderToStaticMarkup(createElement(Komponente, props))` aus `react-dom/server` in einer
  `.test.tsx`. Eine responsive Regel wie „diese Spalte klappt mobil weg" ist damit prüfbar, ohne
  neue Test-Infrastruktur einzuführen und ohne Screenshot (Beispiel:
  `apps/ringwerk/src/components/app/series/SeasonStandingsTable.test.tsx`). Interaktion —
  Klicks, State-Wechsel — braucht weiterhin jsdom und bleibt eine eigene Entscheidung.

- **Charakterisierungstests müssen die falsche Quelle erkennen können**: Wer vor einem Umbau das
  heutige Verhalten per Test festhält, baut die Fixtures so, dass „keine Information" ein anderes
  Ergebnis ergibt als das erwartete — z.B. Namen **gegen** die Stärke sortiert, damit eine Tabelle,
  die nichts wertet und nur alphabetisch ordnet, sofort rot wird. Danach per Gegenprobe (Quelle
  testweise vertauschen) belegen, dass die Tests wirklich fallen (Beispiel:
  `apps/ringwerk/src/lib/playoffs/actions/seeding.test.ts`).

- **Mocks für Abfragen filtern nach der Bedingung, um die es geht**: Liefert das Mock einer Abfrage mit `where` einen
  festen Wert (etwa `count` → 0), sieht kein Test, welche Zeilen der Code mitzählt. Das Mock filtert deshalb wie Prisma
  nach dieser Bedingung (z.B. `status`), und die Fixture enthält auch die Zeilen, die der Code ausschließen soll. So
  blieb unbemerkt, dass Ringwerk die offenen Paarungen eines Zurückgezogenen mitzählte und den Playoff-Start sperrte
  (Beispiel: `byWhere` in `apps/ringwerk/src/lib/playoffs/actions/seeding.test.ts`).

- **Tests gegen die Dev-Datenbank fassen nur eigene Zeilen an**: Die Dev-Datenbank ist eine Prod-Kopie. Eine Funktion,
  die über alle Zeilen läuft (etwa `rereadOutdatedPrintouts`), bekommt für Tests eine Grenze auf die eigene Anlage
  (`siteId`); mit einem Stub als Leser hätte der Test sonst echte Ausdrucke mit erfundenen Werten überschrieben
  (aufgefallen beim Schreiben des Tests, Oktober 2026). Braucht ein Test einen Zustand fremder Zeilen (etwa „kein
  anderes aktives Admin-Konto“), stellt er ihn in einer Transaktion her, die er am Ende mit einem Fehler zurückrollt,
  und prüft darin die Funktion, die die Transaktion nimmt (`deleteAccountIn` in
  `apps/spiegel/src/parts/account-actions.test.ts`). Echte Admins kurz zu deaktivieren hätte ihre Sitzungen beendet.

- **Prettier nicht auf Vault-Notes**: Prettier bricht lange Listen der Frontmatter (`keywords:`, `relates_to:`) auf
  mehrere Zeilen um. Der Loader liest nur die einzeilige Form; `vault-lint` meldet dann fehlende `keywords:`, und die
  Kanten aus `relates_to` fehlen still im Graph. Das Gate prüft den Vault nicht mit Prettier; wer Dateien von Hand
  formatiert, lässt `vault/` aus (aufgefallen im Oktober 2026 an `spiegel-diary`, 641 statt 647 Kanten).

- **Datenlage vor der Sichtprüfung abgleichen**: Bevor eine Änderung im Browser als geprüft gilt,
  die vorhandenen Dev-Daten gegen die zu prüfenden Zustände halten (z.B. „abgeschlossener
  Wettbewerb", „Liga mit Ergebnissen", „mehr Zeilen als die Vorschau"). Was die Daten nicht
  hergeben, steht im Validierungsbericht ausdrücklich als **„nicht belegt"** — mit dem Test, der den
  Pfad stattdessen abdeckt — und zählt nicht stillschweigend als geprüft.

- **`toBeCloseTo` nimmt `null` als 0**: In vitest besteht `expect(null).toBeCloseTo(0)`. Wo eine
  Funktion `null` liefern kann („kein Wert“) und der erwartete Wert 0 ist, vorher
  `expect(x).not.toBeNull()` prüfen, sonst geht „kein Wert“ als 0 durch (Beispiel: `expectNear` in
  `packages/shot-core/src/metrics.test.ts`; aufgefallen, weil eine Mutation grün blieb).

- **Eigenschaftstests per Mutation gegenprüfen**: Ein Test auf eine Eigenschaft („ausgeglichen“)
  kann auch von einer schlechteren Variante erfüllt werden. Den Kern der Logik testweise
  vereinfachen (z.B. eine Paritätsregel durch `true` ersetzen) und prüfen, ob ein Test rot wird.
  Bleibt alles grün, fehlt die Eigenschaft, die die Regel eigentlich liefert (Beispiel:
  `apps/ringwerk/src/lib/matchups/roundRobin.test.ts`, Seitenwechsel statt nur Bilanz).

- **Aussagen über UI-Pfade an der UI prüfen, nicht an der Action**: Was eine Server-Action erlaubt,
  muss die Oberfläche nicht anbieten. Bevor Doku oder eine Antwort an den User sagt „das geht
  über X“, den Render-Pfad prüfen (Bedingung, unter der der Button erscheint).

- **Prüfen und Löschen gehören in dieselbe Transaktion**: Eine Sperre („erst löschen, wenn noch kein
  Ergebnis existiert“) außerhalb der Transaktion lässt ein Zeitfenster offen. Prüfung, Löschen und
  Neuanlage laufen deshalb in **einer** interaktiven Transaktion (bei Konfliktgefahr
  `isolationLevel: "Serializable"`), und der Löschbefehl trägt die Bedingung zusätzlich selbst
  (z.B. `series: { none: {} }`). Vorher den Fremdschlüssel prüfen: Ein `ON DELETE SET NULL` lässt
  abhängige Daten still verwaisen, statt zu scheitern (Beispiel:
  `apps/ringwerk/src/lib/matchups/actions.ts`).

- **Formulare mit Server Action gesteuert halten**: React 19 setzt ein `<form action={…}>` nach dem Absenden zurück;
  ungesteuerte Felder (`defaultValue`) sind danach leer, ein Feldfehler löschte die Eingaben. Felder mit `value` und
  `onChange` (wie die Nutzerformulare in Ringwerk) behalten sie. Aufgefallen in Spiegel (Kontenverwaltung, Oktober 2026)
  bei der Prüfung im Browser, kein Test sah es.

- **Runden an der Hälfte nicht `toFixed` überlassen**: `toFixed` rundet die Binärzahl. 362,6 Ringe auf 40 Schuss sind
  genau 9,065, gerechnet einmal 9,06500…1 (zeigt 9,07), einmal 9,06499…5 (zeigt 9,06). Bei 40 Schuss liegt jede vierte
  Scheibe auf so einer Hälfte. Aufgefallen beim Vergleich der Liste vor und nach der Projektion: Nur der Rechenweg
  hatte sich geändert, und zwei Zeilen zeigten anders. `formatValue` in `shot-ui` rundet deshalb erst auf zwölf
  gültige Stellen und dann kaufmännisch.

- **„Unexpected end of JSON input“ in `loadWorkspaceState`**: Laufen mehrere pnpm-Prozesse gleichzeitig (etwa
  `pnpm exec tsx` neben dem Gate), liest pnpm den Zustand des Workspace manchmal halb geschrieben. Der Fehler ist
  flüchtig: das Gate noch einmal laufen lassen, nichts reparieren.

- **Nach `pnpm add` in einer App `pnpm install --frozen-lockfile`**: `pnpm --filter <app> add`
  kann Peer-Varianten neu auflösen, ohne die `node_modules`-Links der **anderen** App
  nachzuziehen. Deren Gate fällt dann mit `Cannot find package …` aus, obwohl der Diff sauber ist.
  Ein `pnpm install --frozen-lockfile` verlinkt neu. Den Lockfile-Diff auf Änderungen in fremden
  Importern prüfen: Sie invalidieren deren Image-Build-Cache. Löst pnpm dabei Peer-Varianten fremder Pakete neu auf
  (etwa `eslint-plugin-import` in den Snapshots), nur die eingefügten Zeilen übernehmen (alter Lockfile plus die
  Einfügungen aus dem neuen, etwa per `difflib`) und mit `pnpm install --frozen-lockfile` gegenprüfen.

- **Ein neuer FAIL der Skriptprüfung ohne Codeänderung: erst an den Daten nachstellen**: Die Prüfung läuft gegen echte
  Daten in rollenden Zeiträumen („Letzte 90 Tage“), sie trifft also jeden Tag etwas andere Scheiben. Am 21. Oktober 2026
  fiel „ein Tipp in den Verlauf wählt die Scheibe“ auf einem Branch, der den Fortschritt nicht berührte: Der mittlere
  Punkt war an diesem Tag einer von drei Scheiben eines Abends, die im Verlauf fast übereinander stehen. Im Browser
  nachgestellt (Lage der Punkte, gewählte Kennung), war es ein echter Fehler des Lineals, kein Wackeln. Nicht als
  „flaky“ abtun und nicht im fremden Branch reparieren, sondern eigenen Branch aufmachen. Daten, in denen sich Werte
  überdecken, prüft die Prüfung seither eigens (Stapel eines Abends im Fortschritt).

- **`pending` gilt für die ganze Transition, auch für das `router.refresh()` darin**: Läuft nach der Action noch
  `router.refresh()` in derselben Transition, bleibt `pending` wahr, bis die Seite neu gerechnet ist. Teilen sich zwei
  Knöpfe ein `pending`, zeigt „…“ nur der Knopf der Aktion, die läuft; der andere behält seinen Namen und ist höchstens
  gesperrt (`buttonLabels` in `apps/spiegel/src/components/card/ShareCard.tsx`). Sonst hieß der Knopf direkt nach dem
  Teilen rund 250 ms „Beenden…“. Aufgefallen im Oktober 2026, als die Skriptprüfung in einem von fünf Läufen scheiterte.

- **Zustand, der „…“ steuert, gehört vor `startTransition`**: Was eine async Action in ihrer Transition setzt (auch vor
  dem ersten `await`), zeigt React 19 erst, wenn die Action fertig ist. Welche Aktion läuft, der Fortschritt und das
  Leeren eines alten Berichts werden deshalb vor `startTransition` gesetzt; nur Zwischenstände nach einem `await` dürfen
  darin stehen. Sonst hieß der Knopf beim ersten Anhängen eines Belegs die ganze Zeit „Foto oder PDF anhängen“
  (`apps/spiegel/src/components/card/CardEvidence.tsx`). Aufgefallen im Review, Oktober 2026.

- **Eine Sperre prüft ein Test mit einer Transaktion, die sie hält**: Zwei Aufrufe in `Promise.all` überlappen in einem
  Test selten wirklich; ein Test der Grenze blieb grün, als `lockCard` fehlte. Der Test öffnet stattdessen selbst eine
  Transaktion, nimmt die Sperre, startet den Aufruf, schreibt und gibt erst dann frei (Beispiel: „Grenze unter der
  Sperre“ in `apps/spiegel/src/lib/evidence/actions.test.ts`). Gegenprobe: ohne Sperre muss er fallen.

- **Ein Kindprozess schreibt auf macOS in eine Pipe asynchron**: Node schreibt `process.stdout` in eine Pipe unter Linux
  synchron, auf macOS nicht. Ein Skript, das eine Zeile schreibt und danach blockiert (Endlosschleife, `process.exit`),
  liefert auf dem Mac nichts, und der Elternprozess wartet bis zu seiner eigenen Zeitgrenze. Deshalb erst im Rückruf
  von `write` blockieren oder beenden (Beispiel: `apps/spiegel/src/lib/printouts/__fixtures__/hang-child.mjs`).
  Aufgefallen im Oktober 2026 beim Leser der Ausdrucke.

- **Ein Pfad aus dem Arbeitsverzeichnis zieht Dateien ins Image**: Steht in Server-Code
  `join(process.cwd(), "src/…/datei.ts")`, kopiert Next (Turbopack) beim Build das ganze Verzeichnis dieser Datei nach
  `.next/standalone`, samt Tests und Fixtures. Ein Pfad aus Teilen (`...["src", …]`) ist schlimmer: Dann landet der
  ganze App-Ordner im Image. Weder `outputFileTracingExcludes` (gilt nicht für `instrumentation`) noch
  `/* turbopackIgnore: true */` am `join` noch ein Zweig über `NODE_ENV` halfen. Nach so einem Pfad
  `ls .next/standalone/apps/<app>` prüfen. Offen in Spiegel: `src/lib/printouts/` (Dev-Pfad des Lesers), harmlos, aber
  Testcode im Image.

- **Mutationsprobe an einer Abbruchgrenze hinterlässt Prozesse**: Nimmt die Mutation den `kill` eines Kindprozesses
  heraus, läuft der Kindprozess nach dem roten Test weiter (eine Endlosschleife braucht dann einen ganzen Kern). Nach so
  einer Probe mit `pgrep -fl <skript>` nachsehen und beenden.

- **`NOT` über eine Spalte, die NULL sein kann, lässt diese Zeilen aus**: In SQL ist `NOT (NULL = x)` NULL, nicht wahr.
  Ein Prisma-`where` wie `NOT: [{ importKey: k }]` trifft deshalb keine Zeile mit `importKey` NULL. Wer „alle außer …“
  sucht, wählt die Zeilen und filtert in JS, oder nimmt `OR: [{ importKey: null }, { NOT: … }]` dazu. Aufgefallen im
  Oktober 2026 beim Aufräumen der Demo-Scheiben (`seed:own --demo`).

- **Neue Felder ändern eine Charakterisierung, die jedes Feld festschreibt**: `period/season.test.ts` hält jedes Feld von
  `PeriodModel` fest. Kommt ein Feld dazu oder ändert sich eine Kennung, wird der Schnappschuss rot, ohne dass eine Zahl
  sich ändert. Vor `vitest -u` die alten Zeilen gegen die neuen halten (kleines Skript): nur neue Felder, alte Werte
  gleich, bei umbenannter Kennung nur die Folge nach Kennung. Aufgefallen im Oktober 2026 bei der Grundlage der Zahlen.

- **Was nebeneinander steht, steht auf einer Linie**: Kacheln oder Zeilen mit einem Bild und Text, der umbrechen kann,
  richten ihren Text oben am Bild aus (`align-top` in Tabellen) und teilen sich die Zeilen über Kacheln hinweg
  (`grid-rows-subgrid`, Beispiel: `EveningBlock` auf Start). Sonst rutscht der Wert einer Kachel tiefer, sobald in ihr
  ein Wort umbricht („Training nur Probe“ neben „Training“). Die Wirkung im Browser mit gemischten Texten prüfen, in den
  Dev-Daten stehen oft gleich lange. Aufgefallen im Oktober 2026 in der Liste und auf Start.

- **Ein Feld fester Breite in einer Zeile macht am Telefon die ganze Seite breiter**: Mobile Browser vergrößern das
  Layout-Fenster bis zur Mindestbreite des Inhalts, `scrollWidth` bleibt dann gleich `innerWidth`, nur
  `visualViewport.width` ist kleiner. Ein Feld, das nachgeben soll, bekommt `w-0 grow max-w-…` statt einer festen Breite
  (mit `w-28` trug es 112 px in die Mindestbreite, die Zeile wurde 413 px breit). Prüfen mit `innerWidth ===
  visualViewport.width` bei 390 und 360 px. Aufgefallen im Oktober 2026 im Formular „Ergebnis eintragen“. Am Desktop
  zieht `visualViewport` die Scrollbar ab, `innerWidth` nicht: Dort gegen `document.documentElement.clientWidth` prüfen
  (Abschnitt „Reiter“ in `apps/ringwerk/tools/pruefen.ts`).

- **Ein Toast liegt über einer klebenden Leiste unten**: Toasts stehen über der unteren Leiste der App, genau dort, wo
  eine klebende Leiste mit „Speichern“ steht; ein Toast der vorigen Seite schluckte den Klick. Ein Formular mit so einer
  Leiste schließt Toasts beim Öffnen (`toast.dismiss()`) und zeigt Fehler an der Leiste statt als Toast. Aufgefallen
  in der Skriptprüfung (Oktober 2026), die zu schnell für einen Menschen klickt, aber dasselbe sieht.

- **Prisma 7 prüft ein `select` nicht gegen das Schema**: Eine Spalte, die der erzeugte Client noch nicht kennt, nimmt
  `select: { neu: true }` ohne Fehler an; ihr Wert hat den Typ `never`, und `wert !== null` übersetzt. tsc und Tests mit
  gemockter Datenbank bleiben grün, erst die Abfrage zur Laufzeit scheitert. Code, der eine neue Spalte liest, kommt
  deshalb erst nach Migration und `db:generate` in einen Commit. Aufgefallen im Oktober 2026 in Treffsicher
  (`movedToSpiegelAt`, [[treffsicher-read-only]]).

- **Prettier im Paket aufrufen, nicht vom Root**: Der Root hat keine Prettier-Konfiguration, `pnpm exec prettier --write
  <pfad>` vom Root formatiert deshalb mit den Vorgaben von Prettier (andere Zeilenbreite) und `format:check` des Pakets
  wird rot. Formatieren mit `cd <app oder paket> && pnpm exec prettier --write <datei>`. Aufgefallen im Oktober 2026
  beim Umbenennen einer Option über alle Schichten.

## 10. Design 2 (alle Apps, ADR-030, ADR-032)

- **Tokens aus `@vereinsheim/ui/design2.css`**: dieselben Namen, die die
  ui-Primitives nutzen (auch `rank-1` … `rank-3` und `chart-1` … `chart-5`, Akzent je App über `data-app` in beiden
  Themes), dazu Design-2-eigene (`surface-2`, `line-strong`, `foreground-2`, `*-wash`, `gold` (ein Zeichen in Gold, goldener als das
  Text-Token `warning`), `quiet` (ein leises Zeichen, 3,6 : 1 auf der Kartenfläche, nie für Text), `gold-wash` (goldene Tönung deckend auf der
  Kartenfläche), `gold-line` (Rahmen um Gold),
  `paper`, `spiegel`, `score-10` … `score-7`, `overlay`). Hell auf `:root`, dunkel unter `.dark`
  (Klassen-Strategie); jede Farbe, die wechselt, steht in beiden Blöcken (Test `tokens.test.ts`). Die
  Scheibe (Papier, Spiegel, Ringwert-Farben) ist in beiden Themes gleich.
- Auch in Design 2 **keine Palette-Klassen und keine `dark:`-Varianten**: Farbe kommt aus den Tokens.
- **Allgemeine Bausteine** unter `@vereinsheim/ui/design2/*` (Segment-Umschalter, mit `wrap` mehrzeilig für viele oder lange
  Möglichkeiten wie Listen und Merkmale, Schalter-Chip, weicher Kreis
  `round-toggle` für eine Einstellung neben einer großen Zahl oder in einer Filterzeile: 32 px, innen die Kartenfläche, Rahmen
  `line-strong`, Gold nur für das Hervorgehobene; dazu für jede App: Darstellung `theme` und `theme-switch` mit eigenem
  Schlüssel je App, `toaster`, Rahmen `app-frame`, Reiter `tab-bar`, Seite `page`, `decision-dialog`, `undo`, Hilfe `help` und
  `help-sheet`, das Maß der Leisten `bar`, Ringwert-Farben als Hex `score-colors`; Liste in `packages/ui/CLAUDE.md`).
  Die Schreibregeln teilen alle Apps über `@vereinsheim/lib/wording` (Semikolon, drei Punkte), die Skriptprüfung über
  `@vereinsheim/pruefen`. Was
  den Fachkern braucht (Scheibe, Serien), in `@vereinsheim/shot-ui`, mit Markup-Tests; die Bedienung im Browser prüft
  die Skriptprüfung der App (`pnpm --filter spiegel pruefen`).
- Alle drei Apps laufen auf Design 2: Spiegel als Vorbild, Treffsicher ([[treffsicher-design2]]) und Ringwerk
  ([[ringwerk-design2]]) seit Oktober 2026. Das Drift-Gate prüft sie mit denselben Regeln (§8).
- **Symbolknöpfe** sind mindestens 24 px groß (`size="icon-xs"`), sonst `icon-sm` (32 px), `icon` (36 px) oder
  `icon-lg` (40 px); eine Klasse, die sie kleiner macht, ist verboten (Gate für `<Button size="icon…">`, §8).
- **Kein Knopf ohne Folge:** Jede Aktion, die bestätigt, ablehnt, entfernt, widerruft, umstellt oder ein Konto ändert, fragt
  über `DecisionDialog` (`@vereinsheim/ui/design2/decision-dialog`) und sagt in Alltagsworten, worum es geht, was vorher zu
  prüfen ist, was dann passiert, was **nicht** passiert und wie es rückgängig geht. Die Texte stehen an einer Stelle
  (`apps/spiegel/src/lib/admin/consequences.ts`, `apps/treffsicher/src/lib/consequences.ts`,
  `apps/ringwerk/src/lib/consequences.ts`; Tests halten den Wortlaut), ohne Pronomen für Personen. Keine
  Fachbegriffe in der Oberfläche; als Aufgabe erscheint im Admin nur, was ein Mensch entscheiden muss, Technisches regelt
  Spiegel selbst und zeigt es höchstens als Zustand.
- **So schreiben wir** ([[spiegel-dialog-texts-not-understood]]):
  1. Erst sagen, was vorher passiert ist. Dann die Frage.
  2. Ein Gedanke pro Satz. Keine Semikolons, keine verschachtelten Bedingungen.
  3. Die Wörter des Users, nicht die des Codes: Sportpassnummer, zurückweisen, wieder zulassen, Spiegel holt,
     verbinden und trennen.
  4. Orte in der App nennen („in der App unter ‚Offen‘“, „im Profil“).
  5. Konkret: wer merkt was, und wann.
  6. Der Knopf sagt, was man will, nicht was technisch passiert.
  7. Keine Pronomen für Personen.

  `OLD_WORDS` in `apps/spiegel/src/lib/admin/consequences.ts` hält Semikolons und die alten Wörter aus Dialogen,
  Erklärungen, Zuständen, Übersicht und Hinweistext fern (Tests). Ob ein Text verständlich ist, prüft ein Mensch: Neue
  Texte kommen erst ins Textbuch („Textbuch Spiegel“), dann in den Code.
