# Spiegel: welcher Rekord zeigt welche Scheibe

## Kontext

Der User am 12. Oktober 2026: „bei den Rekorden ist es schwer zu wissen, auf welches "zeigen" man klicken muss“. In
`PeriodInsights` (Fortschritt, Abschnitt Analyse) steht jeder Rekord als Text links und ein kleiner Knopf „zeigen“ ganz
rechts (`grid-cols-[minmax(0,1fr)_auto]`). Am Desktop liegen zwischen beiden über 500 px; bis zu 21 gleiche „zeigen“
stehen in einer Spalte, ohne Linie und ohne Hover über die Zeile. Was gerade gezeigt ist, sieht man an den Rekorden nicht.

## Entscheidungen

- **Die ganze Zeile ist der Knopf** (wie die Zeilen der Scheiben-Liste darunter): Hover `bg-surface-2` über die volle
  Breite, Fokusrahmen um die Zeile, Trennlinien `border-t border-border` zwischen den Rekorden. „zeigen“ bleibt am Ende
  als Hinweis, gehört jetzt sichtbar zur Zeile.
- **Gewählt markiert:** Neue Prop `chosen` (die Wahl des Zeitraums, wie bei `CardList`). Rekorde dieser Scheibe tragen
  `bg-accent-wash`, `aria-pressed="true"` und statt „zeigen“ „gezeigt“. Ohne Wahl ist nichts markiert, wie in der Liste.
- **Außerhalb des Zeitraums** kein Knopf, sondern eine Zeile mit „außerhalb“ in `text-muted-foreground` (bisher ein
  gesperrter Knopf).
- Der Name des Knopfs ist sein Inhalt (Bezeichnung, Wert, Datum, „zeigen“), kein abweichendes `aria-label`.

## Aufgaben

1. `packages/shot-ui/src/period/PeriodInsights.tsx`: Zeile als `<button>` mit Prop `chosen?: string | null`, Markierung
   und „gezeigt“; außerhalb ohne Knopf. Tests in `PeriodTiles.test.tsx`: außerhalb ohne `<button>`, gewählt mit
   `aria-pressed="true"` und „gezeigt“ nur an den Rekorden der gewählten Scheibe, ohne Wahl keine Markierung.
2. `apps/spiegel/src/components/progress/ProgressScreen.tsx` und `tools/labor/src/PeriodView.tsx`: `chosen` übergeben.
3. Labor `pruefung.js`: Nach dem Sprung von einem Rekord ist er markiert (`aria-pressed`, „gezeigt“); `recordJump` und
   die Rekord-Prüfung an die neue Form.
4. Doku: `packages/shot-ui/CLAUDE.md` (Rekorde), [[spiegel-navigation]] bzw. die Note der Langzeit-Ansicht, wo die
   Rekorde beschrieben sind.

## Dateien

- `packages/shot-ui/src/period/PeriodInsights.tsx`, `PeriodTiles.test.tsx`
- `apps/spiegel/src/components/progress/ProgressScreen.tsx`, `tools/labor/src/PeriodView.tsx`, `tools/labor/pruefung.js`
- `packages/shot-ui/CLAUDE.md`, Vault-Note der Rekorde

## Required Docs

- `vault/conventions.md` §10 (Design 2, Tokens), `packages/shot-ui/CLAUDE.md`

## Tests

- Markup: außerhalb kein Knopf; gewählte Scheibe markiert mit „gezeigt“; ohne Wahl nichts markiert.
- Labor: Sprung von einem Rekord markiert ihn.

## Verifikation

- `pnpm check`, Labor `pruefen`.
- Browser (eigene Scheiben, `/progress` „Alles“): Hover färbt die ganze Zeile; „zeigen“ springt zur Ablesung; zurück
  bei den Rekorden ist die Zeile markiert und sagt „gezeigt“; Telefon 375 px ohne seitliches Scrollen.
