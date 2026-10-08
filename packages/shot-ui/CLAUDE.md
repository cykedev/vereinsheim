# @vereinsheim/shot-ui — Claude Scope-Notiz

Die Bausteine von Spiegel als echte React-Komponenten: Scheibe, Serien als kleine Scheiben und was
folgt (Plan `plans/2026-10-08-spiegel-shot-ui-fundament.md`, ADR-030, Roadmap SP-1.8). Vorbild ist die
Spielwiese (`tools/spielwiese`), ausprobiert wird im Labor (`tools/labor`); später setzt `apps/spiegel`
dieselben Bausteine mit echten Daten ein.

## Exporte

| Export                          | Datei             | Inhalt                                                                                                |
| ------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| `@vereinsheim/shot-ui/types`    | `src/types.ts`    | `SeriesKey`, `Selection`, `ViewBox`                                                                   |
| `@vereinsheim/shot-ui/geometry` | `src/geometry.ts` | Ausschnitte (`targetView`, `groupView`, `seriesTileView`), `screenSizes`, `scoreColor`, `tileColumns` |

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
