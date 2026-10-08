# @vereinsheim/shot-ui — Claude Scope-Notiz

Die Bausteine von Spiegel als echte React-Komponenten: Scheibe, Serien als kleine Scheiben und was
folgt (Pläne `plans/2026-10-08-spiegel-shot-ui-fundament.md` und `…-kacheln.md`, ADR-030, Roadmap
SP-1.8). Vorbild ist die Spielwiese (`tools/spielwiese`), ausprobiert wird im Labor (`tools/labor`);
später setzt `apps/spiegel` dieselben Bausteine mit echten Daten ein.

## Exporte

| Export                                           | Datei                              | Inhalt                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@vereinsheim/shot-ui/types`                     | `src/types.ts`                     | `SeriesKey`, `Whole` (alle mit oder ohne Probe), `Selection`, `ViewBox`                                                                                                                                                                                     |
| `@vereinsheim/shot-ui/geometry`                  | `src/geometry.ts`                  | Ausschnitte (`targetView`, `groupView`, `seriesTileView`), `screenSizes`, `scoreColor`, `tileColumns`, `nearestShot` (Antippen, `TAP_REACH_PX`)                                                                                                             |
| `@vereinsheim/shot-ui/layers`                    | `src/layers.ts`                    | `layerOrder`: Treffer mit Nummer in Abgabefolge, Auswahl oben, angetippter Schuss zuletzt                                                                                                                                                                   |
| `@vereinsheim/shot-ui/view-state`                | `src/view-state.ts`                | `viewReducer`, `initialViewState`, `isSelected`: Auswahl, angetippter Schuss, Ausschnitt, Ebenen, Wertung                                                                                                                                                   |
| `@vereinsheim/shot-ui/shots`                     | `src/shots.ts`                     | `probeOnlyAsMatch` (nur Probe wie Wertung), `defaultWhole` (Grundauswahl), `seriesKeyOf`, `shotLabels` (P1 …, 1 …), `formatScore`, `hasPosition`, `groupShots` (Gruppe der Auswahl), `selectionShots` (Schüsse der Auswahl für Kennzahlen), `shotIntervals` |
| `@vereinsheim/shot-ui/target/TargetView`         | `src/target/TargetView.tsx`        | die Scheibe: Ringe, Treffer mit Nummer, Auswahl blass oder aus, Streukreis, Ellipse, Schwerpunkt, Zoom                                                                                                                                                      |
| `@vereinsheim/shot-ui/target/TargetControls`     | `src/target/TargetControls.tsx`    | Knöpfe in den Ecken der Scheibe: Ausschnitt, übrige blass/aus, „?“, Schwerpunkt, Streukreis, Ellipse, Nummern                                                                                                                                               |
| `@vereinsheim/shot-ui/target/useAnimatedViewBox` | `src/target/useAnimatedViewBox.ts` | weicher Übergang des Ausschnitts (340 ms), `useElementWidth`                                                                                                                                                                                                |
| `@vereinsheim/shot-ui/series/SeriesStrip`        | `src/series/SeriesStrip.tsx`       | Serien als kleine Scheiben im gleichen Ausschnitt, Serienergebnis, als Schalter für die Auswahl, dazu „Alle“                                                                                                                                                |
| `@vereinsheim/shot-ui/format`                    | `src/format.ts`                    | `formatValue`, `formatSigned`, `unitText`, `directionText`, `directionWords`, `durationText`, `percentText`: feste Stellen, Komma, echtes Minus, ohne `Intl`                                                                                                |
| `@vereinsheim/shot-ui/metrics/MetricTiles`       | `src/metrics/MetricTiles.tsx`      | Kacheln „Trefferbild in Zahlen“ über die Auswahl: Wert, Einheit, kurze Angabe, Kurzsatz als Titel, optional „?“                                                                                                                                             |
| `@vereinsheim/shot-ui/readout/ShotReadout`       | `src/readout/ShotReadout.tsx`      | Ablesung, kompakt: angetippter oder letzter Schuss, Wert mit Ringwert-Farbe, andere Wertung, Teiler, Abstand (kein x/y)                                                                                                                                     |
| `@vereinsheim/shot-ui/table/ShotTable`           | `src/table/ShotTable.tsx`          | Schusstabelle: neuester oben, folgt der Auswahl, Zeile wählt den Schuss (Weg per Tastatur), Intervalle mit Lücke und Pause                                                                                                                                  |
| `@vereinsheim/shot-ui/controls/ScoringSwitch`    | `src/controls/ScoringSwitch.tsx`   | Wertung Zehntel/ganze Ringe, die amtliche als Hinweis                                                                                                                                                                                                       |
| `@vereinsheim/shot-ui/help/HelpBody`             | `src/help/HelpBody.tsx`            | Erklärung aus `shot-help`: Felder in der Reihenfolge des Leitfadens (`HELP_FIELDS`), Formel zugeklappt                                                                                                                                                      |
| `@vereinsheim/shot-ui/help/HelpDetails`          | `src/help/HelpDetails.tsx`         | „Was heißt das?“ unter einer Karte, `helpEntry(id)` (Thema oder Oberfläche)                                                                                                                                                                                 |
| `@vereinsheim/shot-ui/help/HelpButton`           | `src/help/HelpButton.tsx`          | „?“-Knopf mit Namen, `HelpIcon`                                                                                                                                                                                                                             |
| `@vereinsheim/shot-ui/help/HelpSheet`            | `src/help/HelpSheet.tsx`           | jede Erklärung (Thema oder Oberfläche, `helpId`) als Blatt (`Sheet` aus `@vereinsheim/ui/design2`)                                                                                                                                                          |
| `@vereinsheim/shot-ui/target/MpiMark`            | `src/target/MpiMark.tsx`           | Schwerpunkt-Zeichen (weiß mit zwei schwarzen Vierteln), auf der Scheibe und in Diagrammen                                                                                                                                                                   |
| `@vereinsheim/shot-ui/analysis/parts`            | `src/analysis/parts.tsx`           | Teile der Analyse: `AnalysisCard`, `KeyValues`, `Verdict`, `Note`, `IntervalBar`, `ScaleBar`, `scaleStep`                                                                                                                                                   |
| `@vereinsheim/shot-ui/analysis/AnalysisPanel`    | `src/analysis/AnalysisPanel.tsx`   | Analyse einer Scheibe: sechs Reiter, Grundlage ohne Probe (bei nur Probe die Probe), Datenlage, Glossar, Fehlschlüsse                                                                                                                                       |
| `@vereinsheim/shot-ui/analysis/input`            | `src/analysis/input.ts`            | `analysisInput`: worüber die Analyse rechnet (`base`, `basis`)                                                                                                                                                                                              |
| `@vereinsheim/shot-ui/analysis/overview`         | `src/analysis/overview.ts`         | `overviewTiles`: die acht Kacheln des Überblicks aus dem Fachkern, ohne Wert der Grund                                                                                                                                                                      |
| `@vereinsheim/shot-ui/analysis/observations`     | `src/analysis/observations.ts`     | `observations`: Beobachtungen in Worten, nur mit Wert, ohne Visier                                                                                                                                                                                          |
| `@vereinsheim/shot-ui/layout/sections`           | `src/layout/sections.ts`           | Abschnitte der Seite und Anker (`#lage` …): `PAGE_SECTIONS`, `TAB_ANCHORS`, `parseHash`, `hashFor`                                                                                                                                                          |
| `@vereinsheim/shot-ui/layout/SectionNav`         | `src/layout/SectionNav.tsx`        | Sprungleiste „Scheibe · Schüsse · Zahlen · Analyse“, klebt oben, aktiver Abschnitt hervorgehoben, auf dem Telefon vier gleiche Felder                                                                                                                       |
| `@vereinsheim/shot-ui/layout/useActiveSection`   | `src/layout/useActiveSection.ts`   | aktiver Abschnitt beim Scrollen gemessen, `activeSection` (spätester, dessen Anfang die Leiste erreicht hat)                                                                                                                                                |
| `@vereinsheim/shot-ui/layout/CardPage`           | `src/layout/CardPage.tsx`          | Rahmen der Seite: Telefon eine Spalte; ab 768 px links Scheibe und `under` (Serien) passend ins Fenster (`useTargetFit`), rechts `result` als Box, `aside`, `beside`, darunter `below`; ohne Schüsse nur `empty`                                            |
| `@vereinsheim/shot-ui/layout/NoShots`            | `src/layout/NoShots.tsx`           | Hinweis neben der leeren Scheibe statt leerer Kästen                                                                                                                                                                                                        |
| `@vereinsheim/shot-ui/layout/columns`            | `src/layout/columns.ts`            | `PAGE_COLUMNS`: Spalten von Kopf und Raster der Scheibe                                                                                                                                                                                                     |
| `@vereinsheim/shot-ui/layout/jump`               | `src/layout/jump.ts`               | `isOutOfView`, `shouldDismiss`: wann zur Scheibe springen, wann die Pille verschwindet                                                                                                                                                                      |
| `@vereinsheim/shot-ui/layout/useReturnJump`      | `src/layout/useReturnJump.ts`      | Sprung zur Scheibe mit Rücksprung (sofort, ohne Gleiten)                                                                                                                                                                                                    |
| `@vereinsheim/shot-ui/layout/ReturnPill`         | `src/layout/ReturnPill.tsx`        | Pille „Zurück zu „Lage““ unten mittig                                                                                                                                                                                                                       |
| `@vereinsheim/shot-ui/readout/readout`           | `src/readout/readout.ts`           | `readoutModel`: welcher Schuss abgelesen wird und was zu ihm feststeht                                                                                                                                                                                      |
| `@vereinsheim/shot-ui/readout/ShotLine`          | `src/readout/ShotLine.tsx`         | Ablesezeile für das Telefon: „Schuss 23 · 9,7 · Teiler 312,4 · Lage in Worten“                                                                                                                                                                              |
| `@vereinsheim/shot-ui/readout/CardHeader`        | `src/readout/CardHeader.tsx`       | Kopf der Seite im Raster der Seite: Titel, Metazeile, auf dem Telefon das Ergebnis, ein Satz                                                                                                                                                                |
| `@vereinsheim/shot-ui/readout/CardResult`        | `src/readout/CardResult.tsx`       | Ergebnis der ganzen Scheibe: groß, Wertung und Probe, Zehner, Innenzehner, bester Teiler (`RESULT_FACTS`), Wertung                                                                                                                                          |

## Regeln

- **Reine Funktionen getrennt von React:** Geometrie, Ebenen und Zustand sind Funktionen mit Tests nach
  Handwerten; Komponenten zeichnen nur, was diese liefern.
- **Design-2-Bausteine aus `@vereinsheim/ui/design2`** (Segment-Umschalter, Schalter-Chip, Blatt), nicht
  nachbauen.
- **Zahlen nur aus dem Fachkern** (`@vereinsheim/shot-core`), Erklärungen nur aus `@vereinsheim/shot-help`.
  Kurze Angaben unter einem Wert (wie gemessen, warum es keinen gibt) stehen im Baustein. Keine eigene
  Statistik im Baustein: Auch Hinweise rechnen über dieselben Schüsse wie der Wert (Platzhalter nach SF-15
  nicht mit Lage, Zeit oder Abstand).
- **Zahlen formatiert `./format`** (feste Stellen, Komma, echtes Minus, ohne `Intl`, wie auf dem
  Ausdruck); kein `toFixed(…).replace(…)` in Komponenten. Datum und Uhrzeit über `@vereinsheim/lib/format`
  mit der Zeitzone als Parameter.
- **Client-Komponenten** mit `"use client"`, Daten kommen als Props; kein Laden von Daten im Baustein.
- **Nur Probe ist Training:** Die Seite gibt die Schüsse einmal durch `probeOnlyAsMatch`, bevor sie die
  Bausteine füttert; eine Karte ohne Wertung erscheint dann wie Wertung. Die Bausteine prüfen das nicht selbst.
- **Die Analyse rechnet über `analysisInput`:** alle Schüsse ohne Probe, bei nur Probe die Probe; nicht über
  die Auswahl an der Scheibe. Nur der Reiter Probe nimmt die ganze Karte.
- **Karten und Diagramme der Analyse:** schmale Karten im Raster aus Zeilen, zu zweit erst ab 820 px Breite
  des Kartenbereichs (Container, gleich hoch, jeder Abstand 16 px), keine CSS-Spalten. In der Seite aus
  `CardPage` steht die Analyse ab 768 px in voller Breite unter der Scheibe (`below`). Diagramme in Bildschirm-Pixeln über `ChartSlot`/`ChartSvg`
  (`analysis/charts/frame.tsx`), Schrift ab 12 px, Punkte mit dunklem Rand; kein Wert nur im SVG-`<title>`
  ohne Grund (Antippen statt Hover ist offen, `vault/spiegel/spiegel-mobile.md`).
- **Seite aus `CardPage`:** Kopf (`CardHeader`), Sprungleiste (`SectionNav` mit `useActiveSection`), Scheibe,
  unter ihr die Serien (`under`), rechts daneben was zu ihr gehört (`result`: das Ergebnis als Box, auf dem Telefon im Kopf; `aside`: Ablesung; `beside`:
  Schüsse, füllen die Höhe), darunter in voller Breite, was Platz braucht (`below`: Zahlen, Analyse). Der Kasten
  der Scheibe trägt `data-target-box` und begrenzt sich mit `max-w-[var(--target-max,…)]`. Die Scheibe trägt selbst `data-section`, die Abschnitte haben
  `scroll-mt-14` für die 56 px hohe Leiste. Was außerhalb der Scheibe die Scheibe ändert, springt über
  `useReturnJump` zu ihr. Die Schalter der Scheibe liegen in ihren Ecken (`TargetControls`), nicht als Leiste. Ohne Schüsse zeigt die Seite neben der Scheibe nur `NoShots`, keine leeren Kästen
  und keine Kacheln voller Striche (`empty`).
- **Erklärungen als Blatt:** Karten der Analyse, Kacheln und die Scheibe tragen ein „?“ (`HelpButton` mit
  `helpId`), die Seite öffnet `HelpSheet`; „Erklärungen“ zeigt nur Kurzsätze. Kein „Was heißt das?“ zwischen
  den Zahlen (Plan Schritt 4, D3).
- **Auf dem Telefon dieselbe Optik wie am Desktop:** keine 44-px-Mindesthöhe an Umschaltern und Chips
  (User, 8. Oktober 2026); was zu breit ist, scrollt in sich (Reiterleiste auf dem Telefon), die Seite nie.
- **Nichts anschneiden, wo Platz ist:** Leisten und Kacheln richten sich nach dem Bereich, in dem sie stehen
  (Container-Abfragen wie `@min-[45rem]:`), nicht nach dem Fenster; eine Leiste, die in sich scrollt, ist der
  Ausweg für das Telefon, nicht für den Desktop (User, 8. Oktober 2026).
- **Farben nur aus den Design-2-Tokens** (`@vereinsheim/ui/design2.css`), keine Palette-Klassen, keine
  `dark:`-Varianten; die Scheibe ist in beiden Themes gleich.
- Markup-Tests mit `renderToStaticMarkup` in der Node-Umgebung; Bedienung prüft die Skriptprüfung des
  Labors (`pnpm --filter @vereinsheim/labor pruefen`).
- JIT-Paket wie `shot-core`: Eine Next-App braucht es in `transpilePackages`.
- Nach Änderungen: `pnpm check`; `format:check` prüft auch diese Datei.
