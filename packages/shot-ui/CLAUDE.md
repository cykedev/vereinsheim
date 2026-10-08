# @vereinsheim/shot-ui — Claude Scope-Notiz

Die Bausteine von Spiegel als echte React-Komponenten: Scheibe, Serien als kleine Scheiben und was
folgt (Plan `plans/2026-10-08-spiegel-shot-ui-fundament.md`, ADR-030, Roadmap SP-1.8). Vorbild ist die
Spielwiese (`tools/spielwiese`), ausprobiert wird im Labor (`tools/labor`); später setzt `apps/spiegel`
dieselben Bausteine mit echten Daten ein.

## Exporte

| Export                                           | Datei                              | Inhalt                                                                                                                                                                            |
| ------------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@vereinsheim/shot-ui/types`                     | `src/types.ts`                     | `SeriesKey`, `Selection`, `ViewBox`                                                                                                                                               |
| `@vereinsheim/shot-ui/geometry`                  | `src/geometry.ts`                  | Ausschnitte (`targetView`, `groupView`, `seriesTileView`), `screenSizes`, `scoreColor`, `tileColumns`                                                                             |
| `@vereinsheim/shot-ui/layers`                    | `src/layers.ts`                    | `layerOrder`: Treffer mit Nummer in Abgabefolge, Auswahl oben, angetippter Schuss zuletzt                                                                                         |
| `@vereinsheim/shot-ui/view-state`                | `src/view-state.ts`                | `viewReducer`, `initialViewState`, `isSelected`: Auswahl, angetippter Schuss, Ausschnitt, Ebenen, Wertung, Visier                                                                 |
| `@vereinsheim/shot-ui/shots`                     | `src/shots.ts`                     | `seriesKeyOf`, `shotLabels` (P1 …, 1 …), `formatScore`, `hasPosition`, `sightAdjustCut`, `groupShots` (Gruppe der Auswahl), `selectionShots` (Schüsse der Auswahl für Kennzahlen) |
| `@vereinsheim/shot-ui/target/TargetView`         | `src/target/TargetView.tsx`        | die Scheibe: Ringe, Treffer mit Nummer, Auswahl blass oder aus, Streukreis, Ellipse, Schwerpunkt, Zoom                                                                            |
| `@vereinsheim/shot-ui/target/useAnimatedViewBox` | `src/target/useAnimatedViewBox.ts` | weicher Übergang des Ausschnitts (340 ms), `useElementWidth`                                                                                                                      |
| `@vereinsheim/shot-ui/series/SeriesStrip`        | `src/series/SeriesStrip.tsx`       | Serien als kleine Scheiben im gleichen Ausschnitt, Serienergebnis, als Schalter für die Auswahl, dazu „Alle“                                                                      |
| `@vereinsheim/shot-ui/format`                    | `src/format.ts`                    | `formatValue`, `formatSigned`, `unitText`, `directionText`: feste Stellen, Komma, echtes Minus, ohne `Intl`                                                                       |
| `@vereinsheim/shot-ui/metrics/MetricTiles`       | `src/metrics/MetricTiles.tsx`      | Kacheln „Trefferbild in Zahlen“ über die Auswahl: Wert, Einheit, kurze Angabe, Kurzsatz als Titel, optional „?“                                                                   |

## Regeln

- **Reine Funktionen getrennt von React:** Geometrie, Ebenen und Zustand sind Funktionen mit Tests nach
  Handwerten; Komponenten zeichnen nur, was diese liefern.
- **Zahlen nur aus dem Fachkern** (`@vereinsheim/shot-core`), Texte nur aus `@vereinsheim/shot-help`,
  Format über `@vereinsheim/lib/format` (Zeitzone als Parameter). Keine eigene Statistik im Baustein.
- **Client-Komponenten** mit `"use client"`, Daten kommen als Props; kein Laden von Daten im Baustein.
- **Farben nur aus den Design-2-Tokens** (`@vereinsheim/ui/design2.css`), keine Palette-Klassen, keine
  `dark:`-Varianten; die Scheibe ist in beiden Themes gleich.
- Markup-Tests mit `renderToStaticMarkup` in der Node-Umgebung; Bedienung prüft die Skriptprüfung des
  Labors (`pnpm --filter @vereinsheim/labor pruefen`).
- JIT-Paket wie `shot-core`: Eine Next-App braucht es in `transpilePackages`.
- Nach Änderungen: `pnpm check`; `format:check` prüft auch diese Datei.
