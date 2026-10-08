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
| `@vereinsheim/shot-ui/target/useAnimatedViewBox` | `src/target/useAnimatedViewBox.ts` | weicher Übergang des Ausschnitts (340 ms), `useElementWidth`                                                                                                                                                                                                |
| `@vereinsheim/shot-ui/series/SeriesStrip`        | `src/series/SeriesStrip.tsx`       | Serien als kleine Scheiben im gleichen Ausschnitt, Serienergebnis, als Schalter für die Auswahl, dazu „Alle“                                                                                                                                                |
| `@vereinsheim/shot-ui/format`                    | `src/format.ts`                    | `formatValue`, `formatSigned`, `unitText`, `directionText`, `directionWords`, `durationText`, `percentText`: feste Stellen, Komma, echtes Minus, ohne `Intl`                                                                                                |
| `@vereinsheim/shot-ui/metrics/MetricTiles`       | `src/metrics/MetricTiles.tsx`      | Kacheln „Trefferbild in Zahlen“ über die Auswahl: Wert, Einheit, kurze Angabe, Kurzsatz als Titel, optional „?“                                                                                                                                             |
| `@vereinsheim/shot-ui/readout/ShotReadout`       | `src/readout/ShotReadout.tsx`      | Ablesung: angetippter oder letzter Schuss, Wert in Ringwert-Farbe, andere Wertung, Teiler, Abstand, x/y                                                                                                                                                     |
| `@vereinsheim/shot-ui/readout/CardSummary`       | `src/readout/CardSummary.tsx`      | Übersicht der ganzen Scheibe: Schüsse, Ergebnis, Zehner, Innenzehner, bester Teiler                                                                                                                                                                         |
| `@vereinsheim/shot-ui/table/ShotTable`           | `src/table/ShotTable.tsx`          | Schusstabelle: neuester oben, folgt der Auswahl, Zeile wählt den Schuss (Weg per Tastatur), Intervalle mit Lücke und Pause                                                                                                                                  |
| `@vereinsheim/shot-ui/controls/ScoringSwitch`    | `src/controls/ScoringSwitch.tsx`   | Wertung Zehntel/ganze Ringe, die amtliche als Hinweis                                                                                                                                                                                                       |
| `@vereinsheim/shot-ui/help/HelpBody`             | `src/help/HelpBody.tsx`            | Erklärung aus `shot-help`: Felder in der Reihenfolge des Leitfadens (`HELP_FIELDS`), Formel zugeklappt                                                                                                                                                      |
| `@vereinsheim/shot-ui/help/HelpDetails`          | `src/help/HelpDetails.tsx`         | „Was heißt das?“ unter einer Karte, `helpEntry(id)` (Thema oder Oberfläche)                                                                                                                                                                                 |
| `@vereinsheim/shot-ui/help/HelpButton`           | `src/help/HelpButton.tsx`          | „?“-Knopf mit Namen, `HelpIcon`                                                                                                                                                                                                                             |
| `@vereinsheim/shot-ui/help/HelpSheet`            | `src/help/HelpSheet.tsx`           | Erklärung einer Kennzahl als Blatt (`Sheet` aus `@vereinsheim/ui/design2`)                                                                                                                                                                                  |
| `@vereinsheim/shot-ui/target/MpiMark`            | `src/target/MpiMark.tsx`           | Schwerpunkt-Zeichen (weiß mit zwei schwarzen Vierteln), auf der Scheibe und in Diagrammen                                                                                                                                                                   |
| `@vereinsheim/shot-ui/analysis/parts`            | `src/analysis/parts.tsx`           | Teile der Analyse: `AnalysisCard`, `KeyValues`, `Verdict`, `Note`, `IntervalBar`, `ScaleBar`, `scaleStep`                                                                                                                                                   |
| `@vereinsheim/shot-ui/analysis/AnalysisPanel`    | `src/analysis/AnalysisPanel.tsx`   | Analyse einer Scheibe: sechs Reiter, Grundlage ohne Probe (bei nur Probe die Probe), Datenlage, Glossar, Fehlschlüsse                                                                                                                                       |
| `@vereinsheim/shot-ui/analysis/input`            | `src/analysis/input.ts`            | `analysisInput`: worüber die Analyse rechnet (`base`, `basis`)                                                                                                                                                                                              |

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
- **Farben nur aus den Design-2-Tokens** (`@vereinsheim/ui/design2.css`), keine Palette-Klassen, keine
  `dark:`-Varianten; die Scheibe ist in beiden Themes gleich.
- Markup-Tests mit `renderToStaticMarkup` in der Node-Umgebung; Bedienung prüft die Skriptprüfung des
  Labors (`pnpm --filter @vereinsheim/labor pruefen`).
- JIT-Paket wie `shot-core`: Eine Next-App braucht es in `transpilePackages`.
- Nach Änderungen: `pnpm check`; `format:check` prüft auch diese Datei.
