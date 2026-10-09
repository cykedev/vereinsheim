# Plan — U5 Start und Liste

Branch `feat/spiegel-start-und-liste`, gestapelt auf U4 (`feat/spiegel-probe-wie-ausdruck`). Fünfter Schritt der
Durchsicht vom 9. Oktober 2026 (`vault/spiegel/spiegel-durchsicht.md`: B5, B8, B9 und der Befund zum Formband).

Der User hat die UI-Punkte am 9. Oktober 2026 ausdrücklich autonom freigegeben: „mach bitte autonom mit alle ui
punkten weiter. warte nicht auf freigaben von mir, setze deine annahmen und vorschläge um“. Der Plan gilt damit als
freigegeben. Merge nach `main` und Push bleiben beim User.

## Kontext

**Start:**
- Satz und Zeile unter der großen Zahl sagen dasselbe:
  - Satz: „Im Formband: 0,06 unter deinem Schnitt.“
  - Zeile: „−0,06 zum Schnitt der 5 Scheiben davor · im Formband“
- Die Rekorde lesen sich schwer: „meiste 10,9, 20 Schuss 1“.
- Die Form-Zeile ist dicht: „Form, letzte 90 Tage · Luftgewehr: Ø 10,25 je Schuss · +0,15 gegen den Zeitraum davor ·
  deutlich besser ›“.
- Das Formband ist eine Zahlenachse ohne Zeit (User: „ich verstehe es kaum, vor allem mit der ‚abend‘“):
  - die grauen Punkte liegen leicht versetzt übereinander;
  - „Abend“ schwebt über dem Mittel der Scheiben des Abends;
  - Band und gestrichelte Linie haben zwei verschiedene Bezüge.

**Liste:**
- Zwei Ergebnisse stehen ohne Namen nebeneinander, mal ganze Ringe vorn, mal Zehntel („391 408,9“, „619,1 587“).
- Die Filter brauchen drei Zeilen (Familie, Art, Merkmal, „Verlauf dieser Filter“).

## Entscheidungen

- **D1 Formband als kleiner Verlauf:**
  - Die letzten 20 Scheiben der Familie in zeitlicher Folge von links nach rechts, der Ø je Schuss nach oben. Das ist
    dasselbe Bild wie der Verlauf im Fortschritt; das Formband lernt man einmal.
  - Das Band läuft als Fläche um den gleitenden Schnitt, der als Linie in der Mitte; beide aus `periodTrend` je
    Scheibe, wie im Fortschritt.
  - Die Scheiben des Abends rechts groß in der Farbe des Akzents, beschriftet mit dem Datum des Abends („Sa 26.09.“)
    statt „Abend“.
  - Keine gestrichelte Linie „Schnitt“ mehr: Den Schnitt der fünf davor nennt die Zeile unter der Zahl (D2).
  - Achse: höchster und tiefster Wert links, keine Zeitbeschriftung.
  - Die Zeile darunter: „Grau: deine letzten Scheiben. Das Band zeigt deine übliche Schwankung.“
- **D2 Satz und Zahl ohne Doppelung:**
  - Der Satz bleibt („Im Formband: 0,06 unter deinem Schnitt.“).
  - Unter der großen Zahl steht statt des Abstands der Bezug: „Schnitt der 5 Scheiben davor: 10,28“.
- **D3 Rekorde in ganzen Worten** (Fortschritt und Start, `recordRows`), gezeigt als „Bezeichnung: Wert“:
  - „Bestes Ergebnis (40 Schuss): 391,0 Ringe“, „Beste Serie (10 Schuss): 104,3 Ringe“, „Bester Teiler: 22,8“;
  - „Engste Serie (10 Schuss): 12,3 mm Streukreis“, „Engste Scheibe (40 Schuss): 18,0 mm Streukreis“;
  - „Meiste 10,9 (20 Schuss): 1“, „Meiste Zehner (40 Schuss): 23“, „Meiste Innenzehner (20 Schuss): 3“;
  - „Längste Zehnerfolge: 7 Schuss“, „Beste Form (Ø über 5 Scheiben): 10,32“.
- **D4 Form auf Start in zwei Zeilen:**
  - Titel „Form der letzten 90 Tage“.
  - Darunter ein Satz: „Luftgewehr: Ø 10,25 je Schuss, deutlich besser als in den 90 Tagen davor (+0,15).“
  - Ohne Urteil „… kein klarer Unterschied zu den 90 Tagen davor (+0,03).“; mit zu wenigen Scheiben „… für einen
    Vergleich mit den 90 Tagen davor zu wenige Scheiben.“
- **D5 Ergebnis mit Namen der Wertung:**
  - **Liste:** zwei Spalten „Ringe“ und „Zehntel“ statt „Ergebnis“ mit zwei Zahlen; die amtliche Wertung fett, die
    andere normal.
  - Unter jeder Monatskarte eine Zeile „Fett: amtliche Wertung der Scheibe.“
  - Ohne Wert in einer Wertung ein Strich.
  - **Kacheln auf Start:** das amtliche Ergebnis groß mit „Ringe“ oder „Zehntel“, die andere Wertung klein mit Namen
    („408,9 Zehntel“).
- **D6 Filter der Liste in einer Zeile wie im Fortschritt** (B5):
  - Vorn die Familie als Segment.
  - Daneben ein Chip mit der Zusammenfassung, etwa „Alle Scheiben“ oder „Training · Nur PDF · Letzte 90 Tage“.
  - Der Chip öffnet das Blatt „Filter“ mit Art, Merkmal (nur wenn es welche gibt), dem Zeitraum aus dem Fortschritt
    (mit „Zeitraum entfernen“) und dem Link „Im Fortschritt zeigen ›“, der „Verlauf dieser Filter“ ersetzt.
  - Die Familie bleibt außerhalb, wie im Fortschritt.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-ui/src/start/model.ts` (+ `model.test.ts`) | `strip` je Scheibe mit `mean` und `band` (D1) |
| `packages/shot-ui/src/start/FormStrip.tsx` (+ Test) | kleiner Verlauf (D1) |
| `packages/shot-ui/src/start/EveningBlock.tsx`, `sentence.ts` (+ Tests) | Bezug unter der Zahl (D2), Legende (D1), Kacheln (D5) |
| `packages/shot-ui/src/period/records.ts`, `PeriodInsights.tsx` (+ Tests) | Rekorde (D3) |
| `packages/shot-ui/src/start/FormLine.tsx` (+ Test) | Form in zwei Zeilen (D4) |
| `packages/shot-ui/src/list/EveningList.tsx` (+ Test) | Spalten „Ringe“ und „Zehntel“ (D5) |
| `packages/shot-ui/src/list/ListControls.tsx`, `ListFilterSheet.tsx` (neu) (+ Tests) | eine Zeile, Blatt „Filter“ (D6) |
| `tools/labor/src/*View.tsx`, `pruefung.js` | verdrahten, Prüfungen nachziehen |
| `packages/shot-ui/CLAUDE.md`, `tools/labor/CLAUDE.md`, `vault/spiegel/spiegel-durchsicht.md`, `spiegel-navigation.md` | Doku |

## Aufgaben

1. **Rekorde (D3):**
   - Tests auf die neuen Bezeichnungen und „Bezeichnung: Wert“ in Fortschritt und Start, zuerst rot;
   - dann `records.ts`, `PeriodInsights.tsx`, `EveningBlock.tsx`.
2. **Form auf Start (D4):** Tests in `OpenAndForm.test.tsx` (drei Fälle), dann `FormLine.tsx`.
3. **Bezug unter der Zahl (D2):** Test, dann `EveningBlock.tsx`. `eveningDeltaText` entfällt, wenn es niemand mehr
   nutzt.
4. **Formband als Verlauf (D1):**
   - `strip` mit `mean` und `band` je Scheibe, Test gegen `periodTrend`;
   - `FormStrip` neu als kleiner Verlauf; Markup-Test: Punkte von links nach rechts in zeitlicher Folge, die des
     Abends groß und rechts, Datum statt „Abend“, Band als Pfad, keine Linie „Schnitt“;
   - Legende anpassen.
5. **Ergebnis mit Namen (D5):** Tests für Liste (Spalten, fett die amtliche, Zeile unter der Karte) und Kacheln auf
   Start, dann `EveningList.tsx` und `EveningBlock.tsx`.
6. **Filter der Liste (D6):**
   - `listFilterSummary` mit Test;
   - `ListFilterSheet` (Blatt wie `PeriodPicker`, Markup-Test);
   - `ListControls` in einer Zeile;
   - Labor verdrahten.
7. **Skriptprüfung:**
   - Texte nachziehen;
   - neu: Start-Streifen in zeitlicher Folge, Datum am Abend;
   - Liste: Filter in einer Zeile am Telefon 390 und 375, Blatt setzt Art und Merkmal;
   - Rekorde „Bezeichnung: Wert“.
8. **Doku:** `shot-ui/CLAUDE.md`, `labor/CLAUDE.md`, Durchsicht (U5 erledigt), `spiegel-navigation.md` (Start, Liste).

## Teststeps

1. `pnpm --filter @vereinsheim/shot-ui test` nach jeder Aufgabe, `pnpm check` vor jedem Commit.
2. Labor direkt bauen, `pnpm --filter @vereinsheim/labor pruefen` 0 FAIL.
3. Gegenproben über Sicherungskopie (nie `git checkout`):
   - Streifen wieder nach Wert statt nach Zeit → rot;
   - Datum wieder „Abend“ → rot;
   - Filter in zwei Zeilen → rot.

## Verification

- Gates grün, `pruefen` 0 FAIL, Gegenproben rot.
- Bildschirmfotos von Start und Scheiben-Liste (Telefon 390 dunkel, Desktop 1280 hell), unbeschnitten angesehen.
- Artifact neu veröffentlichen.
