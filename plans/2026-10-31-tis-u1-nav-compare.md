# U1: Scheiben im Tagebuch, Breite der Diagramme, Verlauf im Vergleich

Teilplan des Koordinationsplans [`2026-10-26-treffsicher-in-spiegel.md`](2026-10-26-treffsicher-in-spiegel.md). Branch
`feat/tis-u1-nav-compare` vom Basisbranch `feat/treffsicher-in-spiegel`. Drei Befunde des Users nach dem Release vom
30. Oktober 2026, am iPhone (Spiegel als Web-App auf dem Home-Bildschirm). Das UI-Konzept hat der User am 31. Oktober
2026 freigegeben.

## Kontext

1. **Scheiben am Telefon zu tief.** Mit eingeschaltetem Tagebuch steht in der unteren Leiste „Tagebuch“ statt
   „Scheiben“ (`DIARY_BAR` in `packages/shot-ui/src/layout/AppFrame.tsx`). Die Scheiben sind dann nur noch über Profil
   erreichbar, über den Knopf „Alle Scheiben“ in `apps/spiegel/src/parts/profile.tsx`. Die Seite einer Scheibe markiert
   in der Leiste „Profil“ (`barAreaOf`).
2. **Seite zu breit in der Zielerreichung.** Auf der Seite eines Ziels (`GoalScreen`, Kasten „Stand“) musste der User
   herauszoomen. Vermutete Ursache: `ChartSlot` (`packages/shot-ui/src/analysis/charts/frame.tsx`) rendert auf dem
   Server mit `FALLBACK_WIDTH` 600. Das `<svg width=600>` in `GoalChart` steckt in Rasterzellen ohne `min-w-0`:
   - `div.grid.gap-3` im Kasten „Stand“,
   - darin `div.grid.gap-3 @min-[34rem]:grid-cols-2`,
   - darin `GoalChart`: `div.grid.gap-2`.

   Eine Rasterzelle wird mindestens so breit wie ihr Inhalt (`min-width: auto`). Die Spalte wird so 600 px breit, und
   `ChartSlot` misst danach wieder 600. Die Breite hält sich damit selbst fest.
3. **Vergleich zweier Zeiträume ohne Verlauf.** Der Vergleich ist mit `6338d8f0` vom Fortschritt nach `/compare`
   gezogen. Unter „Zwei Zeiträume“ blieben dabei nur Bild und Tabelle. Der Verlauf A gegen B (`PeriodChart` mit
   `compareRange`) und die Kacheln mit dem Vergleich (`PeriodTiles`/`PeriodResult` mit `comparison`) fehlen seither.
   Der Code dafür lebt in `packages/shot-ui/src/period/` weiter. Treffsicher nutzt ihn in der Statistik
   (`withCompare`).

## Ansatz (freigegebenes Konzept)

### A. Scheiben als Reiter im Tagebuch

- Die Reiter des Tagebuchs werden **Einträge · Scheiben · Fragen · Ziele · Abläufe · Auswertung**. „Scheiben“ führt
  auf `/cards` und behält dabei die zuletzt besuchte Liste. `AppShell` hat dieses Gedächtnis schon (`memory.cards`,
  `areaLinks`). Gibt es nichts Gemerktes, gilt einfach `/cards`.
- Ist das Tagebuch an, steht auf der Liste der Scheiben (`/cards`) über dem Inhalt dieselbe Reiterzeile, „Scheiben“
  markiert. Die Zeile sieht auf jeder Breite gleich aus. Am Desktop bleibt „Scheiben“ zusätzlich in der Seitenleiste.
- Die Grenze der Teile ([[adr-033]], `src/parts/boundary.test.ts`) gilt weiter: Der Ergebnisteil importiert das
  Tagebuch nie. Die Seite `/cards` holt die Reiterzeile über eine neue Nahtstelle in `src/parts/`, zum Beispiel
  `src/parts/diary-tabs.tsx`. Sie rendert `DiaryTabs` mit `current="cards"` nur, wenn `diaryEnabled`. Die Liste der
  Reiter bleibt an einer Stelle (`DIARY_TABS` in `src/diary/components/DiaryTabs.tsx`).
- Leiste am Telefon (`barAreaOf`): Mit Tagebuch gehören `cards` (Liste und Seite einer Scheibe) zu `diary`, nicht mehr
  zu `profile`. Der Test zu `barAreaOf` wird entsprechend angepasst.
- In Profil fällt der Knopf „Alle Scheiben“ weg (`parts/profile.tsx`, Kommentar und Test mitziehen).
- Ohne Tagebuch ändert sich nichts: keine Reiterzeile auf `/cards`, Leiste wie bisher.
- Die Seite einer einzelnen Scheibe bekommt keine Reiterzeile. Sie hat ihre Kontextleiste mit Rückweg (Konvention §2:
  Unterseite markiert den Bereich in der Leiste).

### B. Breite der Diagramme

- **Erst nachstellen, dann ändern.** Die Seite eines Ziels mit Diagramm im Browser bei 390 und 360 px öffnen. Messen
  mit `innerWidth === visualViewport.width` und `document.documentElement.scrollWidth <= innerWidth`, vor dem Fix rot
  und danach grün (Konvention §9, „Feld fester Breite“).
- Die Ursache behebt man an der Stelle, die sie für alle Nutzer von `ChartSlot` setzt. Ein vorgerendertes Diagramm darf
  seine Zelle nicht aufspannen. Vorschlag, die Wahl im Fix belegen:
  - **In `ChartSvg`:** `className="block max-w-full"`. Ein ersetztes Element mit prozentualer `max-width` trägt nichts
    zur Mindestbreite bei.
  - **Oder in `ChartSlot`:** `width: 0; min-width: 100%`, sodass die Zelle nicht vom Inhalt lebt.

  Danach misst `ChartSlot` die echte Breite, und das Diagramm zeichnet neu.
- Zusätzlich `min-w-0` an den Rasterzellen im Kasten „Stand“ von `GoalScreen` und in `GoalChart`, wo eine Zelle ein
  Diagramm hält.
- **Alle Masken des Tagebuchs mitprüfen.** Dieselbe Messung läuft bei 360 und 390 px auf:
  - Einträge, neuer Eintrag, Eintrag bearbeiten, Fragen,
  - Ziele, neues Ziel, Ziel, Ziel bearbeiten,
  - Abläufe, neuer Ablauf,
  - Auswertung und eine Seite eines Einflusses.

  Zusätzlich auf Fortschritt und Vergleichen, die `ChartSlot` ebenfalls nutzen. Jede Seite, die zu breit ist, wird
  behoben. Der Bericht nennt jede Seite mit ihrem Messwert.
- Die Skriptprüfung prüft „kein seitliches Scrollen am Telefon“ bisher nicht im Tagebuch. Die Prüfung in
  `tools/pruefen-diary.ts` wird auf die Seite eines Ziels mit Diagramm erweitert, bei 390 px und mit dem ersten Bild
  vom Server, also ohne vorherige Navigation im Client.

### C. Verlauf und Werte unter „Zwei Zeiträume“

- Unter „Zwei Zeiträume“ stehen unter Bild und Tabelle wieder zwei Abschnitte:
  - **Verlauf:** `PeriodChart` wie im Fortschritt, Zeitraum A gegen B. Die Ansicht je Scheibe oder je Monat steuert
    das Modell, wie bisher mit `compareRange`.
  - **Werte:** die Kacheln des Zeitraums mit dem Vergleich gegen B (`PeriodTiles` bzw. das, was Treffsicher in der
    Statistik mit Vergleich zeigt), mit Hilfe „?“ wie im Fortschritt.
- Die anderen Arten („Zwei Scheiben“, „Wettkampf und Training“) bleiben, wie sie sind.
- Eine Sprungleiste (`SectionNav` wie im Fortschritt) über die Abschnitte Bild, Zahlen, Verlauf und Werte, nur bei
  „Zwei Zeiträume“.
- **Daten:** `comparePageData` (`src/lib/compare.ts`) rechnet für `type: "periods"` zusätzlich ein `periodModel` über
  dieselben Scheiben der Familie. Es nimmt Zeitraum A als `range`, B als `compare` sowie dieselbe Art, dasselbe
  Einschießen und dieselbe Wertung. Weitergegeben wird `lightPeriodModel`, genau wie `progressPageData` in
  `src/lib/overview.ts`. Die Wahl der Zeiträume bleibt die Wahl der Seite: kein zweites Blatt und kein zweiter Weg.
  Übersichten lesen keine Schüsse ([[adr-031]]): Das Modell kommt aus den Projektionen wie im Fortschritt.
- **Wortlaut:** Die Überschriften „Verlauf“ und „Werte“ und die Hilfetexte nimmt man aus dem, was im Fortschritt schon
  steht. Neue Sätze gehen erst ins Textbuch (Konvention §10). Muss ein neuer Satz her, bricht der Plan hier ab und
  fragt den Koordinator.
- Die Vault-Note [[spiegel-vergleichen]] und `apps/spiegel/CLAUDE.md` (Abschnitt „Vergleichen“) nachziehen.

## Dateien

- `packages/shot-ui/src/layout/AppFrame.tsx` (+ Test): `barAreaOf` mit Tagebuch `cards → diary`.
- `apps/spiegel/src/diary/components/DiaryTabs.tsx` (+ `components.test.tsx`): Reiter „Scheiben“ an zweiter Stelle;
  Text in `src/diary/texts.ts`.
- `apps/spiegel/src/parts/diary-tabs.tsx` (neu): Nahtstelle für die Reiterzeile auf `/cards`;
  `src/parts/boundary.test.ts` grün halten.
- Seite und Hülle der Liste: `apps/spiegel/src/app/(app)/cards/page.tsx` und die Hülle der Liste. Die Reiterzeile kommt
  als Prop, die Hülle importiert nichts aus dem Tagebuch.
- `apps/spiegel/src/parts/profile.tsx` (+ Test): „Alle Scheiben“ entfällt.
- `packages/shot-ui/src/analysis/charts/frame.tsx` (+ Markup-Test): Diagramm spannt die Zelle nicht auf.
- `apps/spiegel/src/diary/components/GoalScreen.tsx`, `GoalChart.tsx`: `min-w-0` an den Zellen.
- `apps/spiegel/src/lib/compare.ts` (+ Test), `apps/spiegel/src/components/compare/CompareScreen.tsx`: Verlauf und Werte.
- `apps/spiegel/tools/pruefen.ts`, `tools/pruefen-diary.ts`: Prüfungen für Reiter, Breite und Verlauf im Vergleich.
- `vault/spiegel/spiegel-navigation.md`, `vault/spiegel/spiegel-vergleichen.md`, `vault/spiegel/spiegel-diary.md`,
  `apps/spiegel/CLAUDE.md`.

## Required Docs

- `vault/conventions.md` §2 (Reiter, `TabBar`), §3 (Raster der Seiten), §9 („Feld fester Breite“, „Was nebeneinander
  steht“), §10.
- `vault/spiegel/spiegel-navigation.md`, `vault/spiegel/spiegel-vergleichen.md`, `vault/spiegel/spiegel-diary.md`.
- `vault/decisions/adr-033.md` (Teile und ihre Grenze).
- `apps/spiegel/CLAUDE.md`: Abschnitte „Fortschritt“, „Vergleichen“, „Tagebuch“, „Skriptprüfung“.

## Aufgaben

1. **Breite nachstellen** (vor jeder Änderung):
   - Dev-Server des Worktrees auf eigenem Port, Demo-Konto per `seed:own --demo` erst nach Signal des Koordinators.
   - Ein Ziel mit Diagramm anlegen oder ein vorhandenes öffnen.
   - Messwerte bei 360 und 390 px notieren.
   - Bestätigt sich die Ursache nicht, stoppen und dem Koordinator berichten (Circuit-Breaker).
2. **Breite beheben** in `frame.tsx` (Markup-Test: `svg` trägt `max-w-full`, oder `ChartSlot` setzt die Breite wie
   gewählt), dazu `min-w-0` in `GoalScreen`/`GoalChart`. Messung grün. Danach alle Seiten aus B messen und jede, die zu
   breit ist, beheben.
3. **Leiste:** `barAreaOf` mit Tagebuch `cards → diary`, Test.
4. **Reiter „Scheiben“** in `DIARY_TABS`, Text, Test.
5. **Nahtstelle und `/cards`:** `parts/diary-tabs.tsx`, die Seite reicht die Zeile an die Hülle. Ohne Tagebuch gibt es
   keine Zeile (Test). `boundary.test.ts` grün.
6. **Profil:** „Alle Scheiben“ entfernen, Test.
7. **Vergleich, Daten:** `comparePageData` liefert bei `periods` ein `period`-Modell (A gegen B). Testfall: Die
   Kacheln tragen den Vergleich, und der Verlauf hat `compareRange` = B. Gegenprobe: Mit vertauschtem A/B muss der Test
   rot werden.
8. **Vergleich, Seite:** Abschnitte Verlauf und Werte unter Bild und Tabelle, Sprungleiste, Hilfe. Nur bei `periods`.
9. **Skriptprüfung:**
   - Reiter „Scheiben“ im Tagebuch führt zur Liste, und dort ist „Scheiben“ markiert.
   - Am Telefon ist in der Leiste dabei „Tagebuch“ markiert.
   - Die Seite eines Ziels ist bei 390 px nicht breiter als das Fenster, mit dem ersten Bild vom Server.
   - Vergleichen „Zwei Zeiträume“ zeigt den Verlauf mit zwei Zeiträumen.
10. **Doku:** Vault-Notes und `apps/spiegel/CLAUDE.md` nachziehen, `vault-lint` grün.

## Test steps

- `pnpm check` (alle fünf Gates) grün.
- `pnpm --filter spiegel pruefen --start` nach Signal des Koordinators, mit `seed:own --demo` davor und `seed:own
  --email <Konto des Users>` danach in **einem** Befehl. Der bekannte FAIL bleibt der einzige.
- Screenshots bei 390 px:
  - Tagebuch mit der Reiterzeile,
  - `/cards` mit der Reiterzeile und der markierten Leiste,
  - die Seite eines Ziels mit Diagramm,
  - Vergleichen „Zwei Zeiträume“ mit Verlauf und Werten.

  Dazu ein Screenshot am Desktop von `/cards` mit Seitenleiste und Reiterzeile.

## Verification

- Messwerte vor und nach dem Fix je geprüfter Seite, bei 360 und 390 px, im Bericht `reports/`.
- Kein seitliches Scrollen auf allen Seiten des Tagebuchs, auf Fortschritt und auf Vergleichen.
- Ohne Tagebuch ist die Navigation unverändert: Skriptprüfung oder Markup-Test mit `diary=false`.
- Keine Schüsse an den Browser durch den Verlauf im Vergleich: nur `lightPeriodModel`, kein `cardWithShots`.
- Die Brücke braucht kein Update.
