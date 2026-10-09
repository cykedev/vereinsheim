# Plan — U1 Scheibe entschlacken

Branch `feat/spiegel-scheibe-entschlacken`. Aus der Durchsicht vom 9. Oktober 2026
(https://claude.ai/artifact/5MYsm67LubHQTVQ6dk3myd). Der User hat alle Empfehlungen angenommen:

- der Abschnitt „Zahlen“ entfällt;
- Zehntel und ganze Ringe nur auf der Scheibe und in Profil;
- Fachbegriffe nur im Blatt;
- Reihenfolge U1 bis U4.

**B7 (Ebenen in ein Blatt) ist verworfen:** Die Knöpfe in den Ecken der Scheibe bleiben (User).

## Kontext

**Fehler vorweg (User, 9. Oktober 2026):** „Beispielscheibe öffnen springt gleich zur Analyse, bitte nach oben.“

- Ursache: Die Sprungleiste schreibt `#analysis` in die Adresse (`jumpToSection`, `pushState`), der Wechsel des
  Reiters einen Reiter-Anker (`writeHash`).
- Die Beispielscheibe (`CardView` ohne `opened`) liest beim Einhängen `location.hash`, als wäre die Seite damit
  geladen worden. Dann öffnet sie den Reiter und springt zum Abschnitt (`CardView.tsx` Zeilen 108, 114, 163).
- Der Anker der vorigen Seite gilt so für die neue.

Die Seite einer Scheibe ist auf dem Telefon 5,8 Bildschirme lang, schon wenn nur der Reiter „Überblick“ offen ist.

- **B1:**
  - „Trefferbild in Zahlen“ (10 Kacheln) und der Überblick der Analyse (8 Kacheln) stehen untereinander. Fünf
    Zahlen gibt es doppelt.
  - Jede Kennzahl der zehn Kacheln steht auch in einem Reiter:
    - Streukreis, R50, Streuung x und y in „Maße der Gruppe“;
    - Tempo und seine mittlere Hälfte in „Zeit und Verlauf“;
    - Ø, Zehnerquote und σ im Überblick;
    - der Schwerpunkt unter „Lage“.
- **B2:**
  - Die Beobachtungen in Worten sind das Verständlichste der Seite. Sie stehen erst auf dem vierten Bildschirm.
  - Der Kopf zeigt nur den ersten Satz der ersten Beobachtung.

## Entscheidungen

- **D0 Der Anker beim Laden gilt nur für die erste Ansicht.** Nach dem ersten Wechsel der Ansicht beginnt jede Seite
  oben. Ein Anker, der während der Ansicht ankommt (`hashchange`), wirkt weiter.

- **D1 Kein Abschnitt „Zahlen“ auf der Seite einer Scheibe.**
  - Die Sprungleiste heißt „Scheibe · Schüsse · Analyse“.
  - Der Überblick der Analyse ist die Zahlen-Ansicht.
  - `MetricTiles` entfällt (nur die Seite einer Scheibe nutzt ihn).
  - Der Anker `#numbers` gilt auf der Seite einer Scheibe nicht mehr. Er ist dort ungültig, also Vorgabe (oben),
    nie ein Fehler; im Fortschritt bleibt er.
- **D2 Folge von D1, bewusst:**
  - Die Kacheln rechneten über die Auswahl an der Scheibe (etwa nur Serie 2). Die Analyse rechnet immer über alle
    Wertungsschüsse.
  - Für eine gewählte Serie bleiben:
    - Streukreis und Schwerpunkt auf der Scheibe;
    - das Serienergebnis an der kleinen Scheibe;
    - die Schüsse in der Tabelle.
  - Kennzahlen je Serie stehen unter „Serien im Vergleich“.
- **D3 Der Schalter „Erklärungen“ zieht in den Kopf der Analyse:** rechts neben „Was diese Scheibe zeigt“ (neue
  Eigenschaft `action` an `AnalysisPanel`).
- **D4 Die wichtigsten Beobachtungen im Kopf, höchstens drei.**
  - Die Lage steht immer zuerst.
  - Danach, in der Reihenfolge der Beobachtungen, nur was auffällt:
    - Ausreißer, wenn es welche gibt;
    - ein klarer Trend;
    - eine Probe, die echt neben der Mitte lag.
  - Präzision, Pausen und Tempo stehen nicht im Kopf. Sie sind immer da, sagen einzeln wenig, und der Satz zu
    Pausen urteilt selbst „drei Schuss sind wenig“.
  - Je Beobachtung ihr erster Satz, mit dem Symbol wie im Überblick.
  - Ohne Lage (keine Positionen) nur die auffälligen. Ohne beides kein Absatz, wie heute.
  - Darunter „Alle Beobachtungen ›“: öffnet den Überblick und springt zur Analyse.
- **D5 Wortlaut bleibt:** Die Sätze selbst ändern sich erst mit U3 (Sprache).
- **D6 Leitlinie im Vault:** drei Ebenen (Antwort, Belege, Werkzeug), die Befunde und die Entscheidungen der
  Durchsicht als eigene Note `vault/spiegel/spiegel-durchsicht.md`.

## Dateien

| Datei | Änderung |
|---|---|
| `tools/labor/src/loadAnchor.ts` (neu), `tools/labor/src/App.tsx`, `tools/labor/src/CardView.tsx` | Anker beim Laden nur für die erste Ansicht (D0) |
| `vault/spiegel/spiegel-durchsicht.md` (neu), `vault/spiegel/spiegel.md` | Leitlinie, Messung, Befunde, Entscheidungen, U1–U4; Eintrag im MOC |
| `packages/shot-ui/src/layout/sections.ts` (+ Test) | `PAGE_SECTIONS` ohne `numbers` |
| `packages/shot-ui/src/layout/SectionNav.tsx` (+ Test) | Spalten auf dem Telefon nach Zahl der Abschnitte (3 oder 4) |
| `packages/shot-ui/src/nav/routes.test.ts`, `nav/navigate.test.ts` | `#numbers` auf der Scheibe ungültig; Beispiele mit `shots` |
| `packages/shot-ui/src/analysis/AnalysisPanel.tsx` (+ Test) | `action` im Kopf |
| `packages/shot-ui/src/analysis/observations.ts` (+ Test) | `notable`, `firstSentence`, `keyObservations` |
| `packages/shot-ui/src/analysis/ObservationSymbol.tsx` (neu), `analysis/tabs/OverviewTab.tsx` | Symbol der Beobachtung als eigener Baustein, der Überblick nutzt ihn |
| `packages/shot-ui/src/readout/CardHeader.tsx` (+ Test) | `observations` und `onMore` statt `sentence` |
| `packages/shot-ui/src/layout/CardPage.tsx` | Kommentar: `below` ist die Analyse |
| `packages/shot-ui/src/metrics/MetricTiles.tsx` (+ Test), `packages/shot-ui/package.json` | entfällt samt Export |
| `packages/shot-ui/src/period/PeriodTiles.tsx` | Kommentar ohne `MetricTiles` |
| `tools/labor/src/CardView.tsx`, `tools/labor/src/testHook.ts` | ohne Kacheln; „Erklärungen“ an der Analyse; Kopf mit Beobachtungen |
| `tools/labor/pruefung.js` | Prüfungen der Kacheln umstellen, neue Prüfungen |
| `packages/shot-ui/CLAUDE.md`, `tools/labor/CLAUDE.md` | Doku |
| `vault/spiegel/spiegel-navigation.md`, `spiegel-ui-design.md`, `spiegel-mobile.md`, `spiegel-langzeit.md` | Sprungleiste und Anker ohne „Zahlen“ |

## Required Docs

- `vault/conventions.md` (§10 Design 2)
- `packages/shot-ui/CLAUDE.md` (Seite aus `CardPage`, Analyse, Zustand in der Adresse)
- `tools/labor/CLAUDE.md` (Eigenheiten der Skriptprüfung, Helfer)
- `vault/SCHEMA.md` (Frontmatter der neuen Note)

## Aufgaben

### Task 1: Beispielscheibe beginnt oben (Fehler)

- **`tools/labor/src/loadAnchor.ts` (neu):**
  ```ts
  // Der Anker, mit dem das Labor geladen wurde, gilt nur für die erste Ansicht. Später trägt die Adresse den Anker
  // der vorigen Seite (Sprungleiste, Reiter); eine neu geöffnete Seite beginnt oben (User, 9. Oktober 2026)
  const AT_LOAD = typeof location === "undefined" ? "" : location.hash
  let first = true
  /** der Anker beim Laden, solange die erste Ansicht steht; danach "" */
  export const loadAnchor = (): string => (first ? AT_LOAD : "")
  /** nach einem Wechsel der Ansicht gilt der Anker beim Laden nicht mehr */
  export const leaveFirstView = (): void => {
    first = false
  }
  ```
- **`App.tsx`:** `leave()` ruft zuerst `leaveFirstView()`. Jeder Wechsel (`go`, `changeView`) läuft über `leave()`.
- **`CardView.tsx`:** Die drei Stellen, die beim Einhängen `location.hash` lesen, nehmen `loadAnchor()`:
  - Reiter;
  - `tabInAddress`;
  - Sprung beim Laden.
  `follow` (`hashchange`) liest weiter `location.hash`.
- **Prüfung (zuerst rot sehen):**
  - im Fortschritt die Sprungleiste „Analyse“ klicken, die Adresse trägt `#analysis`;
  - dann „Beispielscheiben öffnen“;
  - erwartet: Kopf der Scheibe oben (< 80 px) und Reiter „Überblick“.

### Task 2: Durchsicht im Vault

- **Neue Note `vault/spiegel/spiegel-durchsicht.md`.**
  - Frontmatter:
    - `id: spiegel-durchsicht`, `type: concept`, `title: "Spiegel-Durchsicht — Bedienbarkeit und Komplexität"`;
    - `aliases: [usability-durchsicht, komplexität, drei-ebenen]`;
    - `keywords`: bedienbarkeit, usability, komplexität, überfrachtet, drei ebenen, antwort, belege, werkzeug,
      fachsprache, filter, doppelte zahlen, beobachtungen, sprungleiste;
    - `part_of: ["[[spiegel]]"]`, `governed_by: ["[[adr-030]]"]`;
    - `relates_to: ["[[spiegel-mobile]]", "[[spiegel-ui-design]]", "[[spiegel-navigation]]"]`.
  - Abschnitte:
    - TL;DR;
    - Leitlinie „drei Ebenen“ mit den drei Regeln (eine Zahl einmal je Seite, höchstens eine Zeile Bedienung vor dem
      Inhalt, Fachbegriffe nur im Blatt), dazu warum kein Schalter „Einfach/Ausführlich“;
    - Messung (Tabelle der Durchsicht);
    - Aufgaben;
    - Befunde B1–B9 (B7 verworfen, die Ecken bleiben);
    - Entscheidungen des Users vom 9. Oktober 2026;
    - Umsetzung U1–U4 mit Verweis auf diesen Plan.
- **`vault/spiegel/spiegel.md`:** einen Eintrag „Durchsicht“ im MOC.
- **Prüfung:** `node .claude/vault-lint.mjs` gültig.

### Task 3: Abschnitte ohne „Zahlen“

- **`sections.ts`:**
  - `PAGE_SECTIONS = [target „Scheibe“, shots „Schüsse“, analysis „Analyse“]`;
  - Kommentar: „Zahlen“ entfiel mit U1, der Überblick der Analyse ist die Zahlen-Ansicht.
- **`SectionNav.tsx`:**
  - Spalten auf dem Telefon aus einer festen Liste:
    `const PHONE_COLUMNS = { 3: "max-sm:grid-cols-3", 4: "max-sm:grid-cols-4" }` (Klassen wörtlich);
  - gewählt nach `sections.length`, sonst 4.
- **Tests:**
  - `sections.test.ts`: die drei Ids in Reihenfolge; `parseHash("#numbers")` ist `null`; `#analysis` und die Reiter
    wie bisher.
  - `SectionNav.test.tsx`:
    - Seite einer Scheibe mit `max-sm:grid-cols-3` und drei Links;
    - Zeitraum (`PERIOD_SECTIONS`) mit `max-sm:grid-cols-4`;
    - die Fälle für `activeSection` ohne `numbers`.
  - `routes.test.ts`:
    - `#numbers` auf einer Scheibe gibt `anchor: null`, `cardHash` dann `""`;
    - die Beispiele mit `numbers` nehmen `shots`.
  - `navigate.test.ts`: das Beispiel für Blättern mit Abschnitt nimmt `shots`.

### Task 4: „Erklärungen“ im Kopf der Analyse

- **`AnalysisPanel`:**
  - Eigenschaft `action?: ReactNode`;
  - der Kopf wird `flex flex-wrap items-start justify-between gap-3`: links Titel und Grundlage wie bisher, rechts
    `action`.
- **Test (Markup):** `action` steht im Kopf nach dem Titel und vor der Reiterleiste; ohne `action` kein leerer
  Behälter.

### Task 5: Die wichtigsten Beobachtungen

- **`observations.ts`:**
  - `Observation` bekommt `notable: boolean`:
    - Lage: `true`;
    - Präzision, Pausen, Tempo: `false`;
    - Ausreißer: `numbers.length > 0`;
    - Trend: `trend.clear`;
    - Probe: `zeroed?.real === true`.
  - `export function firstSentence(text: string): string`: Text bis zum ersten Punkt, auf den ein Leerzeichen und ein
    Großbuchstabe folgen (Regel heute in `CardView`, `/(?<=\.) (?=[A-ZÄÖÜ])/`).
  - `export function keyObservations(list: readonly Observation[], max = 3): Observation[]`:
    - die Beobachtung mit `icon === "position"` zuerst, dann die übrigen mit `notable` in ihrer Reihenfolge;
    - höchstens `max`, jeweils mit `text: firstSentence(text)`.
- **`analysis/ObservationSymbol.tsx` (neu):**
  - `ObservationSymbol` und die Pfade `ICONS` aus `OverviewTab.tsx` hierher, unverändert;
  - `OverviewTab` importiert ihn.
- **`CardHeader`:**
  - `sentence: string | null` wird `observations: readonly Observation[]`, dazu `onMore?: () => void`.
  - Markup unter dem Ergebnis (Telefon) bzw. unter Titel und Metazeile (ab 768 px, `md:col-start-1`):
    - `<ul data-key-observations>`, je `<li data-observation={icon}>` mit `ObservationSymbol` und Text,
      `text-[14px] leading-relaxed text-foreground-2`;
    - mit `onMore` danach ein Knopf „Alle Beobachtungen ›“ (`data-more-observations`, Stil wie „Abend in Scheiben ›“
      auf Start);
    - ohne Beobachtungen weder Liste noch Knopf.
- **Tests (TDD):**
  - `observations.test.ts`:
    - Lage zuerst, auch wenn sie nicht `notable` wäre;
    - Ausreißer, klarer Trend und echte Probe kommen dazu, Präzision, Pause und Tempo nie;
    - höchstens drei;
    - nur der erste Satz;
    - ohne Lage nur die auffälligen;
    - leere Liste ergibt eine leere Liste;
    - `firstSentence` mit „Schuss 27 …“ und mit einem Satz ohne zweiten.
    - Mit einer echten Scheibe aus den Beispielen (40 Schuss mit Probe):
      - Lage „echt“ und Ausreißer Schuss 27;
      - kein klarer Trend (keine Trend-Beobachtung);
      - die Probe ohne Versatz (keine Probe-Beobachtung).
      - Ergebnis: zwei Beobachtungen.
  - `CardHeader.test.tsx`:
    - Reihenfolge `h1` → Ergebnis → Liste;
    - je Beobachtung `data-observation`;
    - „Alle Beobachtungen“ nur mit `onMore`;
    - ohne Beobachtungen nichts.
  - **Gegenprobe:**
    - `notable` überall `true` → der Test „höchstens drei, nur auffällige“ wird rot;
    - Lage nicht vorziehen → der Test mit Lage an anderer Stelle wird rot.

### Task 6: Kacheln weg

- `metrics/MetricTiles.tsx` und `MetricTiles.test.tsx` löschen, den Export aus `package.json` nehmen. Danach ist
  `src/metrics/` leer.
- `period/PeriodTiles.tsx`: der Kommentar nennt den Stil ohne `MetricTiles` („Kacheln mit Wert, Einheit und kurzer
  Angabe“).
- `layout/CardPage.tsx`: Kommentar `below` „Abschnitte darunter in voller Breite (die Analyse)“.

### Task 7: Labor

- **`CardView.tsx`:**
  - Der Block `{ id: "numbers", … MetricTiles … }` aus `below` entfällt.
  - `AnalysisPanel` bekommt `action={<ToggleChip pressed={explain} icon={<HelpIcon />} onPressedChange={onExplain}>Erklärungen</ToggleChip>}`.
  - Der Kopf:
    - `useMemo(() => keyObservations(observations(analysisInput(shots, state.scoring, target))), …)` statt `sentence`;
    - `onMore={() => { changeTab("overview"); showSection("analysis") }}`.
  - Kommentar zu `#numbers` beim Laden anpassen: Nur die Seite eines Zeitraums kennt ihn.
- **`testHook.ts`:** `TILE_KEYS` raus, `keyObservations` und `firstSentence` rein.

### Task 8: Skriptprüfung

- **Entfällt mit den Kacheln:**
  - „Kacheln gegen den Fachkern“, die Titel der Kacheln, die Kacheln über Serie 2;
  - `tileKeys`, `tileValue` und die Prüfung ab Zeile 230.
- **Umstellen:**
  - Die Wertung „ganze Ringe“ (bisher an `result.decimalMean`) prüft die Kachel „Ergebnis“ im Überblick
    (`[data-tile="Ergebnis"]`).
  - Erklärungen:
    - an: Kurzsätze an den acht Kacheln des Überblicks und an den Karten des Reiters;
    - aus: keine;
    - der Knopf „Erklärungen“ steht im Kopf der Analyse.
  - Hilfe auf dem Telefon: statt `[data-metric="group.r50"]` das „?“ der Karte „Maße der Gruppe“.
  - Die Suche nach abgeschnittenem Text nur noch über `[data-tile] *`.
- **Neu:**
  - Die Sprungleiste hat drei Einträge (Scheibe, Schüsse, Analyse); auf dem Telefon füllen sie die Breite.
  - Es gibt keine Section „Trefferbild in Zahlen“ und kein `#numbers`.
  - Der Kopf zeigt `keyObservations` aus `__labor`: gleiche Zahl, gleicher Text, die Lage zuerst. Auf der
    Beispielscheibe sind es zwei.
  - „Alle Beobachtungen“ öffnet den Überblick (Reiter „Überblick“ gewählt) und die Analyse steht oben.
  - Telefon 375 px: Kopf mit Ergebnis und Beobachtungen; kein seitliches Scrollen. Die Seite ist mindestens einen
    Bildschirm kürzer als vorher.
    - Gemessen: Höhe des Dokuments geteilt durch (812 − 72), vorher 5,8 bei 390 px.
    - Erwartung: unter 5,0.

### Task 9: Doku

- **`packages/shot-ui/CLAUDE.md`:**
  - Exporte: `MetricTiles` raus, `ObservationSymbol` rein;
  - `observations` mit `keyObservations` und `firstSentence`;
  - `CardHeader` mit Beobachtungen und „Alle Beobachtungen“;
  - Seite aus `CardPage` ohne Zahlen;
  - `AnalysisPanel.action`.
- **`tools/labor/CLAUDE.md`:** Erklärungen an der Analyse, keine Kacheln.
- **Vault:**
  - `spiegel-navigation.md`: Anker der Scheibe ohne `#numbers`, Bild der Seite;
  - `spiegel-ui-design.md`: Sprungleiste „Scheibe · Schüsse · Analyse“;
  - `spiegel-mobile.md`: Ebenen der Information ohne „zehn Kacheln“, Verweis auf die Leitlinie;
  - `spiegel-langzeit.md`: „vier Felder wie auf der Scheibe“ wird „wie auf der Scheibe“.

## Teststeps

0. Prüfung aus Task 1 vor der Behebung rot, danach grün.
1. `pnpm --filter @vereinsheim/shot-ui test` (sections, SectionNav, routes, navigate, AnalysisPanel, observations,
   CardHeader).
2. Labor direkt bauen, `pnpm --filter @vereinsheim/labor pruefen` → 0 FAIL.
3. `node .claude/vault-lint.mjs` gültig.
4. `pnpm check` grün vor jedem Commit.

## Verification

- `pnpm check` grün, `vault-lint` gültig, Labor direkt gebaut, `pruefen` 0 FAIL.
- Gegenproben (je rot):
  - `leaveFirstView()` nicht aufgerufen (Beispielscheibe springt wieder);
  - `notable` überall `true`;
  - Lage nicht vorziehen;
  - Abschnitt „Zahlen“ wieder eingebaut (Prüfung der Sprungleiste);
  - „Alle Beobachtungen“ ohne Wechsel des Reiters.
- Bildschirmfotos, unbeschnitten angesehen:
  - Seite einer Scheibe am Telefon 390 im Rahmen: Kopf, Scheibe, Analyse;
  - Desktop 1280 hell und dunkel;
  - Längenmessung wie in der Durchsicht.
- Artifact neu veröffentlichen.
