# Spiegel: Warnung „Encountered a script tag“ beseitigen

## Kontext

Offener Einzelpunkt aus `vault/spiegel/spiegel-roadmap.md`. Das Root-Layout rendert im `<head>` das Skript der
Darstellung (`THEME_SCRIPT`), das die Klasse `dark` vor dem ersten Zeichnen setzt.

## Ursache (geprüft im Browser-Fenster, Next 16.3.2, React 19.2.8)

React warnt nur in `createInstance`, also wenn es ein `<script>` im Client **neu anlegt**. Beim Hydrieren übernimmt es
das Element aus dem HTML. Neu angelegt wird es, wenn ein Hydrierungsfehler außerhalb einer Suspense-Grenze auftritt:
React baut dann die ganze Wurzel samt `<head>` im Client neu. Beleg: ein absichtlicher Textunterschied in `LoginForm`
erzeugt genau die Warnung, gefolgt von „Hydration failed“. Laden, Seitenwechsel, `router.refresh()`, 404 und HMR erzeugen
sie nicht. Die Warnung ist also eine Folgemeldung (Ursache etwa ein Unterschied in einer Seite oder eine
Browser-Erweiterung, die das Formular der Anmeldung ändert) und lenkt vom eigentlichen Fehler ab.

## Entscheidung

- Neue Client-Komponente `ThemeScript` (`src/components/theme/ThemeScript.tsx`): rendert das `<script>` nur beim Rendern
  auf dem Server und beim Hydrieren (`useSyncExternalStore` mit Server-Snapshot `true`, Client-Snapshot `false`). Rendert
  React im Client neu, gibt sie `null` zurück: keine Warnung, das Skript im HTML ist längst gelaufen.
- Nach dem Hydrieren entfernt React das Element aus dem `<head>`; es hat seine Arbeit dann getan.
- Kein `next/script` (`beforeInteractive` läuft im App Router erst mit dem Client-Bundle, also nach dem Zeichnen).
- Keine Suspense-Grenze um die ganze App: würde Umleitungen (`redirect` in `requireSession`) und das Streaming ändern.

## Aufgaben

1. `ThemeScript.tsx` + Test (`renderToStaticMarkup`: das HTML enthält das Skript).
2. `layout.tsx` nutzt `ThemeScript`.
3. Doku: Punkt aus `spiegel-roadmap.md` streichen, Regel in `apps/spiegel/CLAUDE.md`.

## Verifikation

- Browser-Fenster, frischer Tab: keine Warnung; Hell, Dunkel, System ohne Aufblitzen, auch nach einem Seitenwechsel;
  Probe mit absichtlichem Hydrierungsfehler: nur noch „Hydration failed“.
- `pnpm check` (46/46).
