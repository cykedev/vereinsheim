# Spiegel: Darstellung der Scheibe als Voreinstellung merken

## Kontext

Der User am 12. Oktober 2026: „ich möchte, dass wir die darstellungs einstellungen der scheibe (schwerpunkt, kreie,
ellipse, zahlen, ausblenden ...) speichern (im browser) so dass dies die voreinstellung des nutzers ist. bei jeder
änderung wird der gespeicherte wert aktualisiert“. Heute beginnt jede Scheibe mit Schwerpunkt und Streukreis an, Nummern
und Ellipse aus, übrige Schüsse blass (`initialViewState`, `others` in `CardScreen`). Laut `packages/shot-ui/CLAUDE.md`
gehört das nicht in die Adresse: Sie hält fest, *was* man sieht, nicht *wie* es gezeichnet ist.

## Entscheidungen

- **Gemerkt:**
  - die vier Ebenen (Schwerpunkt, Streukreis, Ellipse, Nummern);
  - „übrige blass/aus“.
- **Nicht gemerkt:** der Ausschnitt. Er gehört zur einzelnen Scheibe; eine neue Scheibe beginnt mit der ganzen.
- **Im Browser als Cookie** `spiegel-target` (ein Jahr):
  - Der Server liest ihn und zeichnet die Scheibe schon beim ersten Bild richtig, ohne Umspringen beim Hydrieren.
  - Jede Änderung schreibt ihn neu. Ein kaputter oder alter Wert gilt Feld für Feld als Vorgabe.
- **Reine Funktionen in `shot-ui`** (`target/display.ts`): `TargetDisplay`, `DEFAULT_TARGET_DISPLAY`,
  `parseTargetDisplay`, `serializeTargetDisplay`. Das Labor merkt sich dieselbe Darstellung in seinem Speicher
  (`localStorage`).

## Aufgaben

1. `packages/shot-ui/src/target/display.ts` mit Tests (hin und zurück, kaputt, alt, fehlende Felder).
2. App:
   - `src/lib/target-display{,-cookie,-client}.ts`: Name, Lesen auf dem Server, Schreiben im Browser.
   - Die Seite einer Scheibe gibt die Darstellung an `CardScreen`. Dort ist sie der Anfangszustand und wird bei jeder
     Änderung geschrieben.
3. Labor: `CardView` liest und schreibt die Darstellung über `store`.
4. Doku: `apps/spiegel/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`.

## Tests

- `display.test.ts`: Vorgabe ohne Wert; hin und zurück; unbekannte und falsche Felder fallen auf die Vorgabe.

## Verifikation

- `pnpm check`, Labor `pruefen`.
- Browser: Ebenen umschalten, eine andere Scheibe öffnen und neu laden; die Darstellung bleibt, ohne Umspringen.
