# Spiegel: Ausschnitt der Scheibe merken

## Kontext

Offener Einzelpunkt der Spiegel-Roadmap (User, 12. Oktober 2026): Ganze Scheibe oder „Auf Gruppe zoomen“ wird nicht
gemerkt. Ebenen und „übrige blass/aus“ stehen im Cookie `spiegel-target`, der Ausschnitt war beim Merken der
Darstellung bewusst ausgenommen.

## Entscheidungen

- **`view` in `TargetDisplay`** (`shot-ui/target/display`), Vorgabe „target“, Ungültiges gilt als Vorgabe.
- **`reset` behält den Ausschnitt** (`shot-ui/view-state`): Wechsel der Scheibe setzt nur Auswahl und Schuss zurück.
- Seite einer Scheibe und Labor schreiben die Darstellung auch beim Umschalten des Ausschnitts. Ohne Schüsse zeigt
  „Gruppe“ die ganze Scheibe (`groupView`), ein gemerktes „Gruppe“ ist überall sicher.

## Aufgaben

1. `display.ts`, `view-state.ts` mit Tests.
2. `CardScreen.tsx` (Anfang, Übernahme nach Zurück, `changeView`) und Labor `CardView.tsx`.
3. Labor-Prüfung: Eine andere Karte derselben Scheibe steht sofort auf ihrer Gruppe.
4. Doku: `apps/spiegel/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`, Punkt in der Roadmap streichen.

## Nebenbefunde (beim Prüfen)

- Die Labor-Prüfung brauchte 89 von 90 s virtueller Zeit; daher der seltene Lauf ohne Bericht. Budget 150 s.
- Der Sprung zurück im Labor (`go` in `App.tsx`) lief über `requestAnimationFrame` und kam in Headless-Chrome manchmal
  vor der neuen Seite (Fortschritt: 0 statt 700 px, 4 von 12 Läufen). Jetzt nach dem Commit (Layout-Effekt).

## Prüfung

`pnpm check` (46/46), Labor `pruefen` 0 FAIL in 12 Läufen. Die Seite einer Scheibe in der App: nicht im Browser
belegt (Anmeldung); abgedeckt über die Tests von `display` und `view-state` und das Labor mit denselben Bausteinen.
