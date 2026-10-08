# Plan: Analyse einer Scheibe als Bausteine (Schritt 3)

Branch `feat/spiegel-shot-ui-analyse`, gestapelt auf `feat/spiegel-probe-corner` (Probe-Eck) und
`feat/spiegel-selection-probe` (Alle oder ohne Probe, Eck auch beim Training); beide vorher nach `main`. Bezug: Plan
`2026-10-08-spiegel-shot-ui-fundament.md` (Schritte 1–5), [[spiegel-ui-design]], [[spiegel-statistics]],
Roadmap SP-1.8, Fachkern `packages/shot-core/src/analysis` (SP-1.10), Hilfe `packages/shot-help` (SP-1.11).

## Kontext

Schritt 1 und 2 haben Scheibe, Serien, Kacheln, Ablesung, Übersicht, Schusstabelle, Wertung und Hilfe als
Bausteine gebaut. Was der Spielwiese noch fehlt, ist ihr größter Teil: die **Analyse einer Scheibe** mit
sechs Reitern (Überblick, Ergebnis, Präzision, Lage, Zeit und Verlauf, Probe), 25 Karten, neun Diagrammen,
Beobachtungen in Worten, Einstieg, Datenlage, Glossar und typischen Fehlschlüssen
(`tools/spielwiese/template.html` Zeilen 1104–1899: Reiter 1107–1114, Überblick 1613–1643, Ergebnis
1645–1686, Präzision 1688–1724, Lage 1726–1761, Zeit 1763–1803, Probe 1805–1827, Diagramme 1215–1534,
Datenlage 1596–1604; Prüfungen in `harness.js` Zeilen 106–360). Der Fachkern
rechnet alles (27 Auswertungen in `ANALYSIS_CATALOG`), `shot-help` erklärt jede Katalog-ID.

Dazu kommen Entscheidungen dieser Session:

- **Kein „Visier verstellt“** (User): Der optionale Parameter `adjustAfter` in `shot-core/analysis/sighters.ts`
  und `segmentGroups` in `geometry.ts` fallen weg, ebenso die Texte dazu in `shot-help` und im Katalog.
- **Nur Probe ist Training** (`probeOnlyAsMatch`): Eine solche Karte bekommt die volle Analyse wie Wertung.
- **Alle oder ohne Probe** für die Bausteine an der Scheibe (`Whole`, `defaultWhole`).

## Entscheidungen

- **D1 Die Analyse rechnet über alle Schüsse ohne Probe** (die Wertung der ganzen Scheibe), wie in der Spielwiese
  und im Einstieg von `shot-help` („Lage, Streuung und Tempo der Analyse rechnen über die Wertung. Die Probe hat
  einen eigenen Reiter.“). **Gibt es nur Probe, rechnet sie über alle Probeschüsse** (User, 8. Oktober 2026).
  `analysisInput` legt das selbst fest (`base` = Wertung, ohne Wertung die Probe), unabhängig davon, ob die
  Seite `probeOnlyAsMatch` angewendet hat. Sie folgt weder einer gewählten Serie noch der Wahl „Alle“: Diese
  gelten für Scheibe, Kacheln und Tabelle. Der Kopf der Analyse nennt die Grundlage („über alle Schüsse ohne
  Probe“ bzw. „über alle Probeschüsse“).
- **D2 Aufbau:** reine Modelle, getrennt von React, im Ordner `packages/shot-ui/src/analysis/`:
  - `input.ts`: `analysisInput(shots, scoring, target)` → `{ all, base, scoring, target }` (`base` nach D1).
  - `overview.ts`: `overviewTiles(input)` (acht Kacheln: Wert, Einheit, Angabe, Hilfe-Id, ohne Wert der Grund).
  - `observations.ts`: `observations(input)` (Sätze mit Symbol, in fester Reihenfolge, nur mit Wert).
  - Karten je Reiter als Komponenten in `analysis/tabs/*.tsx`, Diagramme in `analysis/charts/*.tsx`, gemeinsame
    Teile in `analysis/parts.tsx`, der Rahmen in `analysis/AnalysisPanel.tsx`.
- **D3 Reiter** als Segment-Umschalter „Thema“ (Design 2), gesteuert von der Seite (`tab`, `onTab`); das Labor
  merkt ihn in `localStorage`. Unter jedem Reiter die Zeile „Datenlage“ mit ihrer Hilfe, dann Glossar und
  typische Fehlschlüsse als aufklappbare Karten. Einstieg („So liest du die Analyse“) und Beobachtungen stehen
  im Überblick. Breite Karten stehen allein, schmale im Raster: ab 861 px zwei Spalten, darunter eine, Abstand
  16 px.
- **D4 Hilfe an jeder Karte** wie in Schritt 2: Titel und Katalog-IDs (`" · "`) aus `helpTopic`, Kurzsatz als
  `title`, darunter `HelpDetails` („Was heißt das?“), geöffnet mit demselben Schalter „Erklärungen“ wie die
  Kacheln. Jedes Thema aus `HELP_TOPICS` und die Oberflächen-Hilfen „beobachtungen“ und „probe-auf-der-scheibe“
  haben ihren Platz (Test).
- **D5 Diagramme** als SVG in Bildschirm-Pixeln: Breite gemessen über `useElementWidth`, ohne Messung 600 px,
  1 Einheit = 1 px wie in der Spielwiese. Farben nur aus Design-2-Tokens: Ringwerte `--score-10 … -7`, Akzent
  `--primary` und `--accent-wash`, Pause `--warning`, Ausreißer `--destructive`, Linien `--border` und
  `--line-strong`, Schrift `--foreground-2` und `--muted-foreground`, Fläche `--card`. Das Schwerpunkt-Zeichen
  kommt als `MpiMark` aus `TargetView` heraus und wird geteilt.
- **D6 Kopplung an die Scheibe:** Die Karte „Lage echt?“ schaltet die Ebene „Vertrauensellipse“ der Scheibe
  (`onToggleLayer("ellipse")`, Zustand aus `state.layers.ellipse`). Der Bezug der Richtungsuhr (Mitte oder
  Schwerpunkt) ist lokaler Zustand der Karte.
- **D7 Probe ohne Visier:** „Probe gegen Wertung“ (S3) nimmt die ganze Probe vor der Wertung, „Eingeschossen?“
  (S4) und der Versatz Probe → Wertung (S1) die letzten fünf Probeschüsse mit Lage. Das Probe-Diagramm zeichnet
  die Probe in Abgabefolge (`inShotOrder`), nur mit gültiger Lage (in der Spielwiese nach Listenplatz, ohne
  Filter). Katalog-ID S5 („Visierverstellungen“) wird „entfernt“ mit Grund; IDs werden nie wiederverwendet.
- **D8 Ehrlich wie bisher:** Ohne Wert „–“ mit dem Grund aus der Mindestzahl des Fachkerns („ab 3 Schuss“) oder
  der fehlenden Angabe („ohne Zeiten“); „echt“, „klar“ und „belastbar“ nur, wenn der Fachkern es sagt. Der Satz
  zur Pause nennt bei fehlendem Wert „ohne Wert“ (die Spielwiese machte daraus „genau im Schnitt“). Kachel
  „Tempo“ und Karte „Tempo und Dauer“ nennen dieselbe Mindestzahl.
- **D9 Format** über `./format`: neu `durationText(ms)` („42 s“, „3:05 min“, „1:02 h“), `percentText(rate)`
  („23 %“) und `directionWords(point)` („2,5 mm rechts und 1,2 mm tief“, unter 0,05 mm je Richtung „mittig“).
  Teiler wie in der Tabelle mit einer Nachkommastelle.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-core/src/analysis/sighters.ts` (+ Test), `src/geometry.ts` (+ Test) | ohne `adjustAfter`, ohne `segmentGroups` |
| `packages/shot-help/src/guide.ts`, `src/topics.ts`, `vault/spiegel/spiegel-statistics-help.md` (erzeugt) | Texte ohne Verstellung |
| `vault/spiegel/spiegel-statistics.md`, `spiegel-metrics.md`, `spiegel-ui-design.md` | L1, S1, S3, S4, S5 (entfernt); Regeln der Analyse |
| `packages/shot-ui/src/format.ts` (+ Test) | `durationText`, `percentText`, `directionWords` |
| `packages/shot-ui/src/analysis/input.ts`, `overview.ts`, `observations.ts` (+ Tests) | Modelle |
| `packages/shot-ui/src/analysis/parts.tsx` (+ Test) | Karte, Werteliste, Urteil, Hinweis, Intervallbalken, Maßstab |
| `packages/shot-ui/src/analysis/AnalysisPanel.tsx` (+ Test) | Reiter, Raster, Datenlage, Glossar, Fehlschlüsse |
| `packages/shot-ui/src/analysis/tabs/{Overview,Result,Precision,Position,Time,Sighters}Tab.tsx` (+ Tests) | Karten je Reiter |
| `packages/shot-ui/src/analysis/charts/*.tsx` (+ Tests) | RingBars, DecimalHistogram, SeriesChart, CourseChart, RhythmChart, ClockChart, ShapeChart, PathChart, SighterChart |
| `packages/shot-ui/src/target/MpiMark.tsx`, `TargetView.tsx` | Schwerpunkt-Zeichen geteilt |
| `packages/shot-ui/package.json`, `CLAUDE.md` | Exporte, Regeln |
| `tools/labor/src/App.tsx`, `src/testHook.ts`, `pruefung.js`, `CLAUDE.md` | Verdrahtung, Prüfhaken, Prüfungen |
| `vault/spiegel/spiegel-roadmap.md`, `vault/architecture/architecture.md` | Stand SP-1.8, Repo-Karte |

## Required Docs

`vault/conventions.md` (§3 Kontrast und Schriftgrößen, §4 Farben, §6, §10 Design 2), [[spiegel-ui-design]],
[[spiegel-statistics]] (Katalog), `packages/shot-ui/CLAUDE.md`, `packages/shot-core/CLAUDE.md` (Regeln zu
Auswertungen, Abgabefolge, Ehrlichkeit), `packages/shot-help/CLAUDE.md` (eine Quelle, Leitfaden erzeugen),
`tools/labor/CLAUDE.md` (Eigenheiten der Skriptprüfung), Spielwiese `tools/spielwiese/template.html` Zeilen
1104–1899 und `harness.js` Zeilen 106–360. Nicht lesen: `packages/shot-core/src/metrics.ts` (gesperrt); die API
steht in `packages/shot-core/CLAUDE.md` und an den Aufrufen in `analysis/*.ts`.

## Tasks

1. **Fachkern ohne Visier (test-first).** `sighters.ts`: `lastSighterGroup` und die `options`-Parameter von
   `sighterComparison` und `sighterZeroed` weg; S3 über `sightersBeforeMatch`, S4 über deren letzte fünf mit
   Lage. `segmentGroups` und sein `describe` in `geometry.test.ts` weg. In `sighters.test.ts` die Fälle mit
   `adjustAfter` ersetzen durch: S3 zählt die ganze Probe vor der Wertung, S4 die letzten fünf mit Lage, auch
   wenn die Probe früher weit daneben lag. `shot-help`: `guide.ts` (Einstieg „Probe und Wertung“, Oberfläche
   „probe-auf-der-scheibe“ ohne „gestrichelt“) und `topics.ts` („probe-gegen-wertung“ `what`, „eingeschossen“
   `what`, `read`, `minimum`, `formula`) ohne Verstellung; `pnpm --filter @vereinsheim/shot-help docs`.
   `spiegel-statistics.md`: L1 ohne Trennung durch das Ereignis, S1/S3/S4 ohne „nach der letzten Verstellung“,
   S5 „entfernt (User, 8. Oktober 2026: kein Visier-Ereignis)“; `spiegel-metrics.md` ohne den Satz zu
   `adjustAfter`; `spiegel-ui-design.md`: „Auswertungen der Probe nehmen die letzten fünf“ genauer (S3 die ganze
   Probe, S1/S4 die letzten fünf).
2. **Format (test-first).** `durationText(42_000)` → „42 s“, `(185_000)` → „3:05 min“, `(3_720_000)` →
   „1:02 h“; `percentText(0.234)` → „23 %“; `directionWords({ xUm: 2500, yUm: -1200 })` → „2,5 mm rechts und
   1,2 mm tief“, `{ xUm: 30, yUm: -40 }` → „mittig“.
3. **Teile (test-first).** `parts.tsx`: `AnalysisCard({ topic | view, wide, ids?, explain, children })` mit
   `h3` (Titel, `span` IDs, `title` = Kurzsatz nur bei Themen) und `HelpDetails`; `KeyValues` (`dl`, leere
   Zeilen fallen weg), `Verdict` (Ton `ok`/`warn`/`none` über `success`/`warning`/`muted`), `Note`,
   `IntervalBar({ value, low, high, min, max, label })`, `ScaleBar({ spanMm, pxPerMm })` (erster Wert aus
   0,1 … 50 mm ≥ Spanne/4). `MpiMark` aus `TargetView` als eigene Datei, `TargetView` nutzt sie. Tests:
   Markup je Teil, IDs mit „ · “, Kurzsatz gleich `helpTopic(id).short`, Maßstab für 20 mm Spanne = 5 mm.
4. **Eingabe und Rahmen (test-first).** `input.ts` (Test: Wertung ohne Probe; nur Probe → alle Probeschüsse,
   auch ohne `probeOnlyAsMatch`) und `AnalysisPanel({ shots, state, target, tab, onTab, explain,
   onToggleLayer })`: Reiter „Thema“ (sechs Segmente), Kopf mit der Grundlage nach D1,
   Raster (`wide` allein, schmale in `md:grid-cols-2`), darunter Datenlage aus `dataCoverage(all)` („Datenlage:
   40 Wertung · 9 Probe · alle mit Lage, Zeit und Wert · Wertung in Zehnteln“, Flags als Wort: „verdächtig“) mit
   `HelpDetails("datenlage")`, Glossar (20 Einträge) und Fehlschlüsse (5) aus dem Paket; ohne Schüsse eine
   Karte „Noch keine Schüsse“. Tests: sechs Reiter in Reihenfolge, Datenlage-Satz, Glossar und Fehlschlüsse
   gleich dem Paket, leere Karte.
5. **Überblick (test-first).** `overviewTiles(input)`: Ergebnis, Zehnerquote (Wilson), Präzision σ, Lage
   (echt/unklar), Ringverlust, Trend, Tempo, Probe → Wertung; Werte gleich den Funktionen des Fachkerns,
   Angaben und Gründe wie in der Spielwiese (`template.html` Zeilen 1606–1635). `observations(input)`: sieben
   Sätze wie in der Spielwiese (Zeilen 1537–1594) ohne Visier, Pause mit „ohne Wert“. `OverviewTab`: Kacheln (Kurzsatz als `title`, mit
   „Erklärungen“ sichtbar), Karte „Beobachtungen“ (`VIEW_HELP` „beobachtungen“), Einstieg aus `READING_GUIDE`
   plus ein Satz zum Schalter. Tests gegen den Fachkern mit der Beispielkarte „40 Schuss“ (LP): acht Kacheln,
   Werte gleich, mindestens fünf Sätze, Pause vor Schuss 21 erkannt, ohne Wert der Grund.
6. **Ergebnis, Karten (test-first).** „Ergebnis“ (E1 · E2), „Beste und weiteste Teiler“ (E8), „Quoten“ (E4 ·
   E5 · E11 · I10; Schwellen wie in der Spielwiese Zeile 1676: ganze Ringe „Ring 10“ und „ab Ring 9“, Zehntel
   LG „ab 10,0“ und „ab 10,5“, LP „ab 10,0“ und „ab 9,0“; `IntervalBar`, längste Folge) und
   `RingBars` (HTML, Zeilen 10 bis min(tiefster, 8), 0 nur mit Fehlschuss, Breite count/max, Farbe
   `scoreColor`). Tests: Werte gleich Fachkern, Teilerlisten mit Nummer, zwei Quoten-Zeilen, Ring-Zeilen.
7. **Ergebnis, Diagramme (test-first).** `DecimalHistogram` (nur Zehntel, eine Säule je belegtem Zehntel, Farbe
   nach Ring, Beschriftung je Ring und „10,9“) mit Karte „Zehntelverteilung“ (in ganzen Ringen der Hinweis zum
   Umschalten); `SeriesChart` (Linie über volle Serien, kurze hohl, Werte darüber) mit Karte „Serien und
   Konstanz“ (E10 · I1). Tests: Säulen = belegte Zehntel, Ringe-Hinweis, Punkte je Serie, kurze Serie hohl.
8. **Präzision (test-first).** „Präzision σ“ (groß, `IntervalBar` 0 bis aufgerundete Obergrenze), „Maße der
   Gruppe“ (Streukreis, R50, R50 in Ringbreiten, Streuung x · y), „Ausreißer“ (Liste, Kosten nur mit Ausreißern),
   „Form der Gruppe“ mit `ShapeChart` (2-σ-Ellipse unter den Punkten, Ausreißer rot über `--destructive`,
   `MpiMark`, Maßstab). Tests: Werte gleich Fachkern, Ellipse nach den Punkten im Markup, Ausreißer-Punkte =
   markierte Schüsse, Grenze „gestreckt ab … bei n Schuss“.
9. **Lage (test-first).** „Lage echt?“ (Schwerpunkt in Worten, Abstand, Hotelling-T² gegen Grenze, Urteil, Knopf
   „Vertrauensellipse auf der Scheibe“ mit `aria-pressed` = `state.layers.ellipse`, ruft `onToggleLayer`),
   „Ringverlust nach Ursache“ (Balken Lage/Streuung, Ist, mit korrigiertem Visier, Urteil belastbar/unsicher),
   „Drift und Wanderung“ (von-Neumann-Skala 0–4, `PathChart` Schwerpunkt je Serie ab zwei Serien). Tests: Werte
   gleich Fachkern, Knopf meldet die Ebene, Pfad mit einer Marke je Serie.
10. **Richtungsuhr (test-first).** `ClockChart` (ein 30°-Keil je besetzter Stunde, Radius √(n/max), Ringe für
    25/50/100 %, Beschriftung 12/3/6/9) mit Karte „Richtungsuhr“ (L6), Umschalter „um die Mitte“ / „um den
    Schwerpunkt“ (lokal), unter 30 Schuss der Hinweis. Tests: Keile = besetzte Stunden, Bezug wechselt die Zählung.
11. **Zeit und Verlauf, Diagramme (test-first).** `CourseChart` (Wert je Schuss, gleitender Schnitt über zehn,
    Teil vor zehn gestrichelt, Serientrenner, Pause als gestrichelte `--warning`-Linie, Achse 10 bzw. 10,9) mit
    Karte „Verlauf und Trend“ (breit, Trend-Satz); `RhythmChart` (Abstand je Schuss als Säule, Pausen gekappt
    und beschriftet, Median der letzten fünf als Linie) mit Karte „Rhythmus“ (breit). Tests: Punkte = Schüsse,
    eine Pausen-Linie, Säulen = Abstände, Pause markiert.
12. **Zeit und Verlauf, Karten (test-first).** „Tempo und Dauer“, „Pausen“ (je Pause „Vor Schuss n“ mit Dauer
    und Wirkung), „Ermüdung“ (ab 20 Schuss), „Serien im Vergleich“ (Tabelle Serie | Ergebnis | R50 | Versatz).
    Tests: Werte gleich Fachkern, Tabelle mit einer Zeile je Serie, Ermüdung erst ab 20.
13. **Probe (test-first).** „Umfang der Probe“ (Zahl, Blöcke, Dauer, bis zur Wertung), „Probe gegen Wertung“
    (Tabelle Probe/Wertung: Schuss, Ø, R50, σ), „Eingeschossen?“ (Lage der letzten fünf, Versatz, Urteil),
    „Probe auf der Scheibe“ mit `SighterChart` (Probe hohl um die Mitte, Nummern P1 …, Schwerpunkt der Wertung
    als `MpiMark`, Maßstab; Abgabefolge, nur mit Lage). Tests: Werte gleich Fachkern, keine Erwähnung von
    „Verstellung“, Reihenfolge nach `seq` auch bei vertauschter Liste, Karte ohne Probe mit Hinweis.
14. **Labor.** Unter „Trefferbild in Zahlen“ der Abschnitt „Analyse“ mit `AnalysisPanel`; Reiter in
    `localStorage` (`labor.tab`), „Erklärungen“ geteilt mit den Kacheln, `onToggleLayer` dispatcht `toggle`.
    Prüfhaken: `window.__labor.tools` bekommt die Analyse-Funktionen des Fachkerns (`import * as analysis`),
    `overviewTiles` und `observations`.
15. **Skriptprüfung.** Aus der Spielwiese übernehmen (`harness.js` Zeilen 106–360, ohne Visier): sechs Reiter; Überblick acht
    Kacheln mit Werten gleich dem Fachkern; Beobachtungen ≥ 5 Sätze, Lage-Satz passend zu Hotelling, Pause vor
    Schuss 21; Datenlage-Zeile; Ergebnis (Ringbalken, Zehntel-Säulen = belegte Zehntel, Serienkurve, zwei
    Quoten); ganze Ringe (Hinweis statt Zehntel, Ergebnis ganzzahlig, Datenlage nennt die Wertung); Präzision (σ,
    R50 in Ringbreiten, Ausreißer-Kosten, Form mit Ellipse über den Punkten, Abreißer rot); Lage (Keile = besetzte
    Stunden, Uhr um den Schwerpunkt, Knopf zeigt und versteckt die Ellipse auf der Scheibe, von Neumann); Zeit
    (Verlauf mit 40 Punkten und einer Pause, Rhythmus mit 39 Abständen, Serien-Tabelle mit 4 Zeilen, Ermüdung);
    Probe (Umfang 9, „Eingeschossen?“ über die letzten fünf, keine „Verstellung“ auf der Seite); Hilfe (jede
    Karte mit „Was heißt das?“, jedes Thema hat seinen Platz, Texte gleich dem Paket, Einstieg, Glossar,
    Fehlschlüsse, Schalter öffnet und schließt alle und bleibt beim Reiterwechsel, Formel bleibt zu); Abstände
    16 px; „60 Probe“ bekommt die volle Analyse (Ergebnis, Serien 6); Ausdruck ohne Trend unter 10 Schuss; leere
    Karte sagt, was fehlt; Handy 390 px ohne seitliches Scrollen.
16. **Doku.** [[spiegel-ui-design]] (Abschnitt Analyse: D1, Reiter, Karten, Diagramme), Roadmap SP-1.8 Stand
    (Schritt 3 erledigt), `packages/shot-ui/CLAUDE.md` (Exporte, Regel D1), Repo-Karte, `tools/labor/CLAUDE.md`.

## Test steps

- `pnpm check` grün nach jedem Task.
- Gegenproben: Analyse über die Auswahl statt die Wertung → Überblick-Test rot; nur Probe ohne Rückfall auf die Probe →
  Eingabe-Test rot; Kachel „Ergebnis“ über alle
  Schüsse mit Probe → rot; Zehntel-Säulen auch für leere Zehntel → Säulen-Test rot; Probe-Diagramm nach
  Listenplatz → Reihenfolge-Test rot; Pause ohne Wert als „im Schnitt“ → Satz-Test rot; Hilfetext gekürzt →
  Hilfe-Test rot.
- `pnpm --filter @vereinsheim/labor pruefen` → 0 FAIL, dreimal hintereinander.
- Sichtprüfung im Browser-Fenster: Desktop und 375 px, hell und dunkel, jeder Reiter; Labor veröffentlichen.

## Verification

Bericht `reports/2026-10-08-spiegel-shot-ui-analyse.md`; Labor unter derselben Adresse neu veröffentlichen;
Review des Branches; Merge nach `main` mit OK. Danach ist die Spielwiese bis auf Schritt 4 (Zoom, Wiedergabe,
Serienvergleich) und 5 (über Tage) vollständig in Bausteinen.
