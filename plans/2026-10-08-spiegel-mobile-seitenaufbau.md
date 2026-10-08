# Plan: Spiegel auf dem Telefon — Seitenaufbau (SP-1.8, Schritt 4)

## Context

Die Bausteine einer Scheibe sind fertig (Schritte 1–3: Scheibe, Serien, Kacheln, Ablesung, Tabelle, Analyse in
sechs Reitern). Auf dem Telefon ist die Seite aber eine lange Liste: Im Labor beginnt die Analyse nach über
3.000 px. Was eine Karte an der Scheibe schaltet (Ellipse, Zeile der Tabelle), passiert außer Sicht, und die
Erklärungen stehen als lange Texte zwischen den Zahlen. Der Konzept-Entwurf [[spiegel-mobile]] hat das
gemessen und vier Fragen gestellt. Dieser Schritt baut den Seitenaufbau für Telefon, Tablet und Desktop als
Bausteine in `packages/shot-ui` und setzt ihn im Labor zusammen. Die App `apps/spiegel` gibt es noch nicht;
sie übernimmt später dieselben Bausteine.

Bereits entschieden (User, 8. Oktober 2026): Bedienelemente in der Optik des Desktops, Reiterleiste einzeilig
mit seitlichem Scrollen, Kartenraster in Zeilen.

## Entscheidungen

Die vier offenen Fragen aus [[spiegel-mobile]] sind mit der Empfehlung beantwortet; die Freigabe dieses Plans
entscheidet sie.

- **D1 Eine Seite mit Sprungleiste** (Frage 1). Unter dem Kopf klebt eine Leiste „Scheibe · Zahlen · Schüsse ·
  Analyse“ am oberen Rand (`position: sticky`). Die Einträge sind Anker (`#scheibe` …), die Abschnitte haben
  `scroll-margin-top` in Leistenhöhe; der Eintrag des sichtbaren Abschnitts ist hervorgehoben
  (`aria-current="location"`, über einen `IntersectionObserver`). In der Analyse klebt ihre Reiterleiste an
  derselben Stelle und deckt die Sprungleiste ab: nie zwei Leisten.
- **D2 Erster Bildschirm am Stand** (Frage 2). Auf dem Telefon in dieser Reihenfolge: Kopf (Scheibe, Beispiel,
  Ergebnis groß mit Schusszahl, Wertung ganze Ringe/Zehntel, ein Satz: die erste Beobachtung), Scheibe mit
  Schaltern und einer Ablesezeile („Schuss 23 · 9,7 · Teiler 312,4 · 4,2 mm rechts und 1,1 mm tief“), Serien.
  Dann die Kacheln, die Schüsse, die Analyse. Die Ablese-Karte gibt es ab 768 px, darunter die Zeile.
- **D3 Hilfe als Blatt** (Frage 3). Jede Karte der Analyse trägt im Kopf ein „?“ (`HelpButton`), das ihre
  Erklärung als Blatt öffnet (`HelpSheet`, auf dem Telefon von unten, ab 768 px als Karte rechts). Die
  aufklappbaren „Was heißt das?“ unter den Karten entfallen. Der Schalter „Erklärungen“ zeigt an jeder Karte
  und Kachel den Kurzsatz unter dem Titel. Glossar und typische Fehlschlüsse bleiben aufklappbar am Ende der
  Analyse. **Das ersetzt D4 des Analyse-Plans** (`plans/2026-10-08-spiegel-shot-ui-analyse.md`: Aufklappen unter
  der Karte); [[spiegel-ui-design]] verlangt das Blatt schon.
- **D4 Grundlage im Kopf** (Frage 4). σ und Zehnerquote stehen weiter zweimal. Der Kopf der Kacheln sagt
  „über Serie 2“, „über alle Schüsse ohne Probe“ usw., der Kopf der Analyse sagt es schon („Analyse über …“).
- **D5 Tablet und Desktop.** Ab 768 px zwei Spalten: links die Scheibe (Karte mit Schaltern und Ablesezeile),
  `sticky` unter der Sprungleiste; rechts Ablese-Karte, Übersicht, Serien, Kacheln, Schüsse, Analyse. Die
  Scheibe ist höchstens so groß, dass sie mit Leiste und Schaltern in die Fensterhöhe passt
  (`max-w-[calc(100dvh-9rem)]`, mittig). In der festen Spalte stehen nur Schalter, Scheibe und Ablesezeile; was
  das Labor sonst unter der Scheibe hat (Ansehen/Setzen, Übrige, Hinweis), steht rechts oben. Das Kartenraster der Analyse richtet sich nach der Breite seines
  Containers statt des Fensters: zwei Spalten ab 820 px Container (`@container`, `@min-[820px]:grid-cols-2`).
- **D6 Sprung zur Scheibe mit Rücksprung.** Ändert eine Aktion außerhalb der Scheibe die Scheibe (Knopf
  „Vertrauensellipse“, Zeile der Schusstabelle) und ist die Scheibe nicht im Bild, scrollt die Seite zur
  Scheibe und zeigt unten eine Pille „Zurück zu „Lage““ (bzw. „Zurück zu „Schüsse““). Ein Tipp darauf scrollt
  zurück; sie verschwindet auch, wenn man selbst zurückscrollt. Mit „Bewegung reduzieren“ springt die Seite
  ohne Animation. Auf dem Desktop ist die Scheibe sichtbar, dort gibt es keinen Sprung.
- **D7 Abschnitt und Thema in der Adresse.** Ein einfacher Anker ohne `=` (im Artifact kommt nur so einer an):
  `#scheibe`, `#zahlen`, `#schuesse`, `#analyse` für die Abschnitte, `#ueberblick`, `#ergebnis`,
  `#praezision`, `#lage`, `#zeit`, `#probe` für die Reiter (öffnen den Reiter und springen zur Analyse). Ein
  Wechsel des Reiters schreibt den Anker mit `history.replaceState`, ohne zu scrollen. Ohne Anker gilt der
  gemerkte Reiter (`localStorage`, nur im Labor).
- **D8 Schusstabelle auf dem Telefon.** Unter 768 px die zehn neuesten Zeilen der Auswahl und ein Knopf „Alle
  40 zeigen“ / „Weniger zeigen“; der gewählte Schuss bleibt sichtbar, auch wenn er älter ist. Ab 768 px wie
  bisher im eigenen Scrollkasten. Rein über CSS-Klassen und einen Zustand im Baustein, ohne Breitenmessung.
- **D9 Querformat.** Die Scheibe ist auch auf dem Telefon höchstens so groß wie die Fensterhöhe minus Leiste
  und Schalter (dieselbe Grenze wie D5); kein seitliches Scrollen bei 812 × 375 px.
- **D10 Kleinkram aus dem Review.** Die Reiterleiste verweist mit `aria-controls` auf den Bereich der Karten
  (`role="region"`, benannt nach dem Reiter). `AnalysisPanel` rechnet seine Karten in `useMemo` über Schüsse,
  Wertung, Scheibe, Reiter, Ellipse und „Erklärungen“; die Seite reicht stabile Rückrufe (`useCallback`).

**Nicht in diesem Schritt:** das Diagramm-Lineal (Antippen statt Hover, Werte fest über dem Diagramm, Kopplung
an die Scheibe) und „Werte als Tabelle“ werden Schritt 5; Test mit VoiceOver.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-ui/src/layout/sections.ts` (+ Test) | Abschnitte, Reiter-Anker, `parseHash`, `hashFor` |
| `packages/shot-ui/src/layout/SectionNav.tsx` (+ Test), `useActiveSection.ts` | Sprungleiste, aktiver Abschnitt |
| `packages/shot-ui/src/layout/CardPage.tsx` (+ Test) | Rahmen der Seite: Kopf, Leiste, Scheibe (sticky ab md), Spalte rechts |
| `packages/shot-ui/src/layout/ReturnPill.tsx` (+ Test), `jump.ts` (+ Test) | Rücksprung-Pille, `isOutOfView` |
| `packages/shot-ui/src/readout/ShotLine.tsx` (+ Test), `readout/readout.ts` | Ablesezeile; gemeinsames Modell mit `ShotReadout` |
| `packages/shot-ui/src/readout/CardHeader.tsx` (+ Test) | Kopf mit Ergebnis, Wertung, Satz |
| `packages/shot-ui/src/help/HelpSheet.tsx` (+ Test) | Blatt für jede Erklärung (`helpId`) |
| `packages/shot-ui/src/analysis/parts.tsx`, `AnalysisPanel.tsx`, `tabs/*.tsx`, `tabs/index.ts` (+ Tests) | „?“ im Kartenkopf, Kurzsatz, Reiterleiste sticky, Container-Raster, `aria-controls`, `useMemo` |
| `packages/shot-ui/src/metrics/MetricTiles.tsx` (+ Test) | Grundlage „über …“ im Kopf |
| `packages/shot-ui/src/table/ShotTable.tsx` (+ Test) | zehn Zeilen und „Alle zeigen“ unter 768 px |
| `packages/ui/src/design2/segmented.tsx` (+ Test) | optional `controls` → `aria-controls` |
| `packages/shot-ui/package.json`, `CLAUDE.md` | Exporte `layout/*`, `readout/ShotLine`, `readout/CardHeader`; Regeln |
| `tools/labor/src/App.tsx`, `src/testHook.ts`, `pruefung.js`, `CLAUDE.md` | Seite aus `CardPage`, Anker, Rücksprung, Prüfungen |
| `vault/spiegel/spiegel-mobile.md`, `spiegel-ui-design.md`, `spiegel-roadmap.md`, `vault/architecture/architecture.md` | Entscheidungen, Stand |

## Required Docs

- `vault/spiegel/spiegel-mobile.md` (Befunde, Prinzipien, Empfehlung) und `vault/spiegel/spiegel-ui-design.md`
  (Hilfe und Erklärungen, Analyse einer Scheibe, Navigation)
- `vault/conventions.md` §3 (Kontrast, Schrift ab `text-xs`), §10 (Design 2: nur Tokens, keine `dark:`)
- `packages/shot-ui/CLAUDE.md` (Regeln der Bausteine) und `tools/labor/CLAUDE.md` (Prüfung, Artifact)
- `plans/2026-10-08-spiegel-shot-ui-analyse.md` (D3 Reiter, D4 Hilfe, die hier ersetzt wird)

## Tasks

1. **Abschnitte und Anker (test-first).** `layout/sections.ts`: `PAGE_SECTIONS` (`scheibe` „Scheibe“, `zahlen`
   „Zahlen“, `schuesse` „Schüsse“, `analyse` „Analyse“), `TAB_ANCHORS: Record<AnalysisTab, string>`
   (`overview` → `ueberblick`, `result` → `ergebnis`, `precision` → `praezision`, `position` → `lage`, `time` →
   `zeit`, `sighters` → `probe`), `parseHash(hash) → { section: PageSection; tab?: AnalysisTab } | null`
   (Reiter-Anker liefern `section: "analyse"` und den Reiter; Unbekanntes `null`), `hashFor(section, tab?)`.
   Tests: jeder Anker hin und zurück, nur Zeichen `[a-z]`, Unbekanntes und leerer Anker `null`.
2. **Sprungleiste (test-first).** `layout/useActiveSection.ts` (Hook: beobachtet `[data-section]`, Rand
   `-40% 0px -55% 0px`, liefert die Id des Abschnitts in der Mitte; ohne `IntersectionObserver` `null`).
   `layout/SectionNav.tsx` (`active`, `className`): `<nav aria-label="Abschnitte">` mit vier Ankern
   `href="#scheibe"` …, aktiv mit `aria-current="location"` und Akzent, `sticky top-0 z-20 h-12 bg-background`,
   Optik wie die Reiterleiste. Tests: vier Anker in der Reihenfolge, genau einer `aria-current`, Klassen sticky.
3. **Rahmen der Seite (test-first).** `layout/CardPage.tsx` (`header`, `nav`, `target`, `aside`, `sections:
   { id: PageSection; node: ReactNode }[]`): ein Raster, unter 768 px eine Spalte in der Reihenfolge Kopf,
   Leiste, Scheibe, `aside`, Abschnitte; ab 768 px `md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]`, die
   Scheibe in Spalte 1 über alle Zeilen `md:sticky md:top-14 md:self-start`, alles andere in Spalte 2. Die
   Scheibe trägt selbst `data-section="scheibe"` (ein umschließender Abschnitt würde das Raster zerbrechen),
   jeder weitere Abschnitt `data-section`, `id` und `scroll-mt-14`. `useActiveSection` behält den zuletzt
   getroffenen Abschnitt, solange keiner die Mitte schneidet (etwa über `aside`). Tests: Markup-Reihenfolge,
   `data-section` je Abschnitt, Klassen für sticky und Spalten.
4. **Ablesezeile (test-first).** Aus `ShotReadout` das Modell nach `readout/readout.ts` ziehen
   (`readoutModel(shots, state)`: angetippter oder letzter Schuss, Wert, Teiler, Abstand, Lage), `ShotReadout`
   nutzt es weiter. `readout/ShotLine.tsx`: eine Zeile `Schuss 23 · 9,7 · Teiler 312,4 · 4,2 mm rechts und
   1,1 mm tief` (`directionWords` für die Lage, Wert in Ringwert-Farbe), `aria-live="polite"`, ohne Schuss
   „Noch kein Schuss“. Tests: gleiche Werte wie `ShotReadout`, angetippter statt letzter Schuss, ganze Ringe.
5. **Kopf der Scheibe (test-first).** `readout/CardHeader.tsx` (`title`, `meta: string[]`, `shots`, `state`,
   `scoring: ReactNode`, `sentence: string | null`): Titel, Metazeile mit „·“, Ergebnis groß aus dem Fachkern
   (`result.decimal` in der Wertung) mit „Ringe“ und Schusszahl, daneben der Umschalter, darunter der Satz.
   Ohne Wert „–“ mit Grund wie die Kachel („nicht jeder Schuss mit Wert“ / „ab 1 Schuss“). Tests: Ergebnis
   gleich Fachkern in beiden Wertungen, Satz, Grund ohne Wert.
6. **Hilfe als Blatt, Teil 1: Blatt und Karte (test-first).** `HelpDetails` bleibt als Baustein, die Analyse
   nutzt ihn nicht mehr. `HelpSheet` nimmt `helpId: string | null`
   (Thema oder Oberfläche über `helpEntry`); die Kacheln melden weiter den Kennzahl-Schlüssel, die Seite
   übersetzt mit `helpForMetric(key)?.id`. `AnalysisCard`: statt `HelpDetails` ein `HelpButton` im Kopf
   (`data-help` = Id, Name „Erklärung: Titel“), nur mit `onHelp`; mit `explain` steht der Kurzsatz
   (`data-short`) unter dem Titel. `CardContext` und `AnalysisPanel` bekommen `onHelp`; die Datenlage-Zeile
   bekommt ihr „?“. Tests in `parts.test.tsx`, `help.test.tsx`: „?“ ruft `onHelp` mit der Id (über den
   Element-Baum), Kurzsatz nur mit `explain`, kein `<details data-help>` mehr in Karten.
7. **Hilfe als Blatt, Teil 2: Reiter und Prüfungen der Hilfe.** Alle Reiter geben `onHelp` weiter (Überblick:
   Beobachtungen, Einstieg ohne „?“). `coverage.test.ts` prüft D3 statt D4: jedes Thema hat genau ein „?“
   (`data-help`) über alle Reiter, `datenlage` an der Datenlage-Zeile, die Oberflächen-Hilfen
   „beobachtungen“ und „probe-auf-der-scheibe“. Glossar und Fehlschlüsse öffnet „Erklärungen“ nicht mehr.
   Tests der Reiter auf `data-help` umstellen, wo sie `details` erwarten.
8. **Grundlage im Kopf der Kacheln (test-first).** `MetricTiles`: „über alle Schüsse“, „über alle Schüsse mit
   Probe“, „über alle Schüsse ohne Probe“, „über die Probe“, „über Serie 2“. Tests anpassen.
9. **Reiterleiste und Raster der Analyse (test-first).** `Segmented` bekommt `controls?: string` →
   `aria-controls`. `AnalysisPanel`: die Reiterleiste in einem Streifen `sticky top-0 z-30 -mx-4 bg-background
   px-4 py-2` (deckt die Sprungleiste), Kartenbereich mit `id` und `role="region"` (`aria-label` „Thema
   Lage“ …), Raster als Container (`@container`, `@min-[820px]:grid-cols-2` statt `min-[861px]:grid-cols-2`,
   einzelne letzte Karte entsprechend), Karten in `useMemo`. Tests: `aria-controls` zeigt auf die Region,
   Container-Klassen, sticky. Das `useMemo` zeigt sich nicht im Markup; seine Abhängigkeiten stehen im Code
   und gehen ins Review.
10. **Schusstabelle auf dem Telefon (test-first).** `ShotTable` (`collapseAfter?: number`, Standard 10): Zeilen ab
    der elften `max-md:hidden`, solange nicht aufgeklappt, außer der gewählten; darunter ein Knopf `md:hidden`
    „Alle 40 zeigen“ / „Weniger zeigen“ (`aria-expanded`). Tests: elfte Zeile mit `max-md:hidden`, gewählte
    alte Zeile ohne, Knopf mit Zahl, bei zehn oder weniger Zeilen kein Knopf.
11. **Rücksprung (test-first).** `layout/jump.ts`: `isOutOfView(rect, viewportHeight, topInset)` (rein; nicht im
    Bild, wenn unter dem Rand oder ganz unter der Leiste versteckt). `layout/ReturnPill.tsx` (`label`,
    `onReturn`, `onDismiss`): feste Pille unten mittig, `bottom` mit `env(safe-area-inset-bottom)`, Text
    „Zurück zu „{label}““, Design-2-Tokens. `layout/useReturnJump.ts` (Hook): `jumpTo(element, label)` merkt
    `scrollY`, scrollt (glatt, außer `prefers-reduced-motion`), zeigt die Pille; zurück scrollt zur gemerkten
    Stelle; die Pille verschwindet, wenn man auf 200 px an die Stelle zurückscrollt. Tests: `isOutOfView` an
    Rändern, Pille mit Text und Knopf.
12. **Labor zusammensetzen.** `App.tsx`: Labor-Kopf und Labor-Leiste (Scheibe, Beispiel, Darstellung) wie
    bisher, darunter `CardPage` mit `CardHeader` (Titel: Name der Scheibe, Meta: Beispiel; Satz: erste
    Beobachtung über `observations(analysisInput(...))`), `SectionNav` mit `useActiveSection`, Scheibe mit
    Schaltern (Ebenen, Ausschnitt), Hilfe „Trefferbild“ als „?“ und `ShotLine` (`md:hidden`); rechts (`aside`)
    die Labor-Schalter (Ansehen/Setzen, Übrige, Hinweis zum Beispiel), `ShotReadout` (`max-md:hidden`),
    Übersicht mit Wertung, Serien; Abschnitte Zahlen (Kacheln),
    Schüsse (Tabelle), Analyse. Ein `HelpSheet` für Kacheln, Karten und Trefferbild. Anker: beim Laden
    `parseHash(location.hash)`, auf `hashchange` hören; Reiterwechsel schreibt `hashFor("analyse", tab)` mit
    `replaceState`. Rücksprung: Ellipsen-Knopf aus der Analyse und Zeile der Tabelle rufen `jumpTo(Scheibe,
    "Lage" bzw. "Schüsse")`, wenn `isOutOfView`; nur der Knopf in der Analyse springt, nicht der Schalter
    an der Scheibe. Stabile Rückrufe mit `useCallback`. Prüfhaken bekommt
    nichts Neues.
13. **Skriptprüfung.** `pruefung.js` anpassen und ergänzen: Hilfe-Abschnitt auf „?“ und Blatt umstellen (jedes
    Thema ein „?“, Blatt zeigt Titel und „Was“ des Themas, „Erklärungen“ zeigt Kurzsätze an jeder Karte und
    Kachel); Sprungleiste (vier Anker, Klick auf „Analyse“ bringt die Analyse unter die Leiste, genau ein
    Eintrag aktiv); Anker `#lage` im Rahmen öffnet den Reiter Lage und zeigt die Analyse; Reiterwechsel
    schreibt den Anker; Telefon 375 × 812: Kopf mit Ergebnis und die Scheibe ganz im ersten Bildschirm, Serien
    beginnen darin, Tabelle zehn Zeilen und „Alle 40 zeigen“, Ellipsen-Knopf aus „Lage“ bringt die Scheibe ins
    Bild und die Pille, die Pille bringt zurück; Querformat 812 × 375 ohne seitliches Scrollen, Scheibe passt
    in die Höhe; Desktop 1280: Scheibe bleibt beim Scrollen der rechten Spalte stehen; die Analyse-Abstände
    weiter 16 px; Reiterleiste klebt über der Sprungleiste.
14. **Doku.** [[spiegel-mobile]]: Fragen beantwortet, Status umgesetzt (ohne Lineal). [[spiegel-ui-design]]:
    Abschnitt „Seitenaufbau“ (Telefon, Desktop, Sprungleiste, Rücksprung, Anker) und „Hilfe und Erklärungen“
    auf Blatt und Kurzsatz. Roadmap SP-1.8 Stand (Schritt 4, Schritt 5 Lineal), Repo-Karte,
    `packages/shot-ui/CLAUDE.md` (Exporte `layout/*`, `readout/ShotLine`, `readout/CardHeader`; Regel: Seite aus
    `CardPage`), `tools/labor/CLAUDE.md`.

## Test steps

- `pnpm check` grün nach jedem Task; `node --test .claude/hooks/autopilot-guard.test.mjs` unberührt.
- Gegenproben: Reiter-Anker vertauscht → Anker-Test rot; `aria-current` an allen Einträgen → Leisten-Test rot;
  Kurzsatz ohne `explain` → Karten-Test rot; „?“ ruft `onHelp` mit falscher Id → Test rot; gewählte alte Zeile
  versteckt → Tabellen-Test rot; Scheibe nicht sticky → Desktop-Prüfung rot; Pille ohne Rücksprung →
  Telefon-Prüfung rot.
- `pnpm --filter @vereinsheim/labor pruefen` → 0 FAIL, dreimal hintereinander.
- Sichtprüfung im Browser-Fenster: 375 × 812, 812 × 375, 768, 1280; hell und dunkel; Labor veröffentlichen.

## Verification

Bericht `reports/2026-10-08-spiegel-mobile-seitenaufbau.md`; Labor unter derselben Adresse neu veröffentlichen;
Review des Branches; Merge nach `main` mit OK. Danach fehlt für das Telefon nur noch das Diagramm-Lineal
(Schritt 5).
