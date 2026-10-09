# Plan: Befunde der Prüfung auf der Seite einer Scheibe

- **Anlass:** Prüfung aller Rechnungen und Beschreibungen vom 9. Oktober 2026, Bericht
  `reports/2026-10-09-spiegel-pruefung.md`. Die Befunde „Über viele Scheiben“ sind mit L3 behoben; hier folgen
  die übrigen fünf Themen.
- **Branch:** `feat/spiegel-pruefung-scheibe`, aufbauend auf `feat/spiegel-sprungleiste` (Sprungleiste springt
  selbst).
- **Entscheidungen des Users (9. Oktober 2026):**
  - „Visier raus“.
  - „SD statt MAD“.

## Kontext

Der Fachkern rechnet überall richtig. Die Fehler liegen in fünf Arten:

- **Bezug unklar:** worauf sich eine Zahl bezieht, je Schuss, je Serie oder über die ganze Scheibe. Das ist
  dieselbe Art wie der Trend.
- **Worte:** Wörter, die etwas anderes behaupten, als gerechnet wird.
- **Zwei Größen:** zwei Größen unter einem Namen.
- **Randfälle:** Fälle, in denen ein Text das Falsche sagt.
- **Veraltete Texte:** Texte, die nach den Umbauten nicht mehr stimmen.

Jeder Befund unten ist am Code nachvollzogen (Bericht und Agenten-Skripte).

## Entscheidungen

- **D1 Visier raus (User):**
  - Keine Oberfläche und kein Hilfetext spricht vom Visier, von Klicks oder davon, ob man etwas verstellen sollte.
  - Was bleibt, ist die Rechnung: Wie viele Ringe die Lage kostet (E9/L4), heißt jetzt „Gruppe in der Mitte“.
  - L11 („Visierkorrektur in Klicks“) wird im Katalog „entfernt“, mit Grund.
  - Der Fehlschluss „Wer am Visier dreht …“ wird zu „Wer auf einen Versatz reagiert, den der Zufall erklärt, …“.
- **D2 SD statt MAD (User):**
  - Die „Schwankung je Schuss“ (E10) ist die Standardabweichung der Schusswerte (n − 1) statt des MAD.
  - Grund: Der MAD ist in ganzen Ringen beim Luftgewehr fast immer 0,00 (Prüfung: 100 % der Karten bei σ 1,5 mm).
- **D3 Versatz Probe → Wertung (Vorschlag, bitte bei der Freigabe bestätigen):**
  - Die Kachel im Überblick zeigt statt der Zahl das Urteil „eingeschossen?“ (S4: „kein Versatz nachweisbar“
    bzw. „echt neben der Mitte“).
  - Im Reiter Probe bleibt die Zahl, mit dem Hinweis, wie groß sie auch ohne jede Verschiebung ist.
  - Beleg: neue Simulation B21. Ohne Verschiebung liegt der Abstand im Median bei etwa 0,55 σ, in 5 von 100
    Fällen über 1,15 σ (Prüfung).
- **D4 Zahl und Bezug immer zusammen:** Jede Zahl, die über mehrere Schüsse summiert, nennt ihr n („40 weitere
  Schuss … zusammen“). Jede, die je Schuss gilt, sagt „je Schuss“. Bei Serien steht „Ringe“ dabei.
- **D5 Texte nur mit Beleg:**
  - Neue Zahlen in Texten nur aus dem Simulationsblock (B21 neu, B9 in ganzen Ringen neu) oder exakt (R50 ≈ 1,18 σ
    = √(2 ln 2) für eine runde Normalgruppe).
- **D6 Labor-Prüfung bleibt grün:** Wo die Skriptprüfung alte Texte nachrechnet, zieht sie mit. Neue Regeln
  bekommen Markup-Tests.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-core/src/analysis/result.ts` (+ Test) | E10: `shotSd` statt `mad` |
| `packages/shot-core/src/analysis/timing.ts` (+ Test) | Pausen über Schüsse mit Zeit (Grenzfall SF-18/15) |
| `packages/shot-core/src/analysis/sighters.ts` (+ Test) | Probe auch nach Beginn der Wertung erkennen und benennen |
| `packages/shot-ui/src/analysis/observations.ts` (+ Tests) | Lage-, Pausen-, Ermüdungs-, Probe- und Ausreißer-Sätze |
| `packages/shot-ui/src/analysis/overview.ts` (+ Test) | Kacheln Trend und Probe → Wertung |
| `packages/shot-ui/src/analysis/tabs/*.tsx` (+ Tests) | Ergebnis, Präzision, Lage, Zeit, Probe: Beschriftungen und Notizen |
| `packages/shot-ui/src/analysis/charts/ShapeChart.tsx` | Notiz zur Ellipse (2a, 2b) |
| `packages/shot-ui/src/analysis/AnalysisPanel.tsx` | Datenlage je Wertung, Grammatik |
| `packages/shot-ui/src/metrics/MetricTiles.tsx` (+ Test) | Hinweise Streukreis, R50, Streuung x/y, σ, Ø; Probe in der Auswahl |
| `packages/shot-ui/src/readout/CardResult.tsx`, `ShotLine.tsx`, `table/ShotTable.tsx` | „ohne Zehntel“, x/y, Pausen |
| `packages/shot-help/src/topics.ts`, `guide.ts`, `glossary.ts` (+ Tests) | Hilfetexte |
| `packages/shot-help/scripts/simulate.ts` | B21 neu, B9 in ganzen Ringen |
| `vault/spiegel/spiegel-statistics.md`, `spiegel-statistics-help.md` (erzeugt), `spiegel-edge-cases.md` | Katalog, Belege |
| `tools/labor/pruefung.js` | Prüfungen mit geänderten Texten |

## Required Docs

- `packages/shot-core/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`, `packages/shot-help/CLAUDE.md`
- `reports/2026-10-09-spiegel-pruefung.md`; die Agenten-Skripte unter `scratchpad/audit-*`, wenn noch vorhanden
- `vault/conventions.md` §9

## Aufgaben

### Task 1: Visier raus und der Lage-Gewinn mit seinem n (D1, D4; Ergebnis 1, Lage 1, 2)

- **`observations.ts`, Lage echt:**
  - Alt: „Mit korrigiertem Visier brächten die nächsten Schüsse etwa 2,8 Ringe mehr.“
  - Neu: „Läge die Gruppe in der Mitte, brächten 40 weitere Schuss zusammen etwa 2,8 Ringe mehr (rund 0,07 je
    Schuss).“ Dabei kommt n aus `split.n`, „je Schuss“ ist `gain / n`, zwei Stellen.
  - Bei `gain ≤ 0` statt „Eine Korrektur brächte keine Ringe.“: „In der Mitte brächte die Gruppe keine Ringe
    mehr.“
- **`observations.ts`, Lage nicht echt:** „Die Daten geben keinen Grund, das Visier zu verstellen.“ wird zu „Ein
  Versatz ist nicht belegt.“
- **`PositionTab.tsx`:**
  - Notiz: „Die Ellipse umschließt mit 95 % den wahren Schwerpunkt. Liegt die Mitte darin, ist ein Versatz nicht
    belegt.“
  - Zeile „Mit korrigiertem Visier“ wird zu „Gruppe in der Mitte“.
- **`topics.ts`:**
  - `lage-echt` read: „„Echt versetzt“: Der Versatz ist größer, als der Zufall bei dieser Schusszahl erklärt.
    „Nicht unterscheidbar“: Er kann Zufall sein.“
  - `ringverlust-nach-ursache` read: „Großer Lage-Anteil: Die Gruppe sitzt neben der Mitte. Großer
    Streuungs-Anteil: Präzision. …“ (Rest bleibt).
- **`guide.ts`, Fehlschluss „Unklar ist ein Ergebnis“:** „… Wer trotzdem auf einen Versatz reagiert, den der
  Zufall erklärt, verschiebt seine Gruppe oft weg von der Mitte und verliert dabei im Mittel Ringe.“
- **Katalog:**
  - L11 bekommt „**entfernt (Oktober 2026):** keine Hinweise zum Visier (User, 9. Oktober 2026)“.
  - Beispiel 2 und Zeile 21 („zentriert wären es …“) bekommen die neue Form mit n.
- **Tests:**
  - Satz mit n und „je Schuss“ für die LP-Testkarte, kein „Visier“ in `observations`.
  - Markup-Test des Reiters Lage ohne „Visier“.
  - shot-help-Test: kein Hilfetext enthält „Visier“ (ein neuer Stiltest).

### Task 2: E10 mit der Standardabweichung je Schuss (D2; Ergebnis 2, 8, 9)

- **`result.ts`:**
  - `SeriesConsistency.mad` wird zu `shotSd`: die Standardabweichung der Schusswerte in der Wertung (n − 1), ab 2
    Schuss mit Wert, sonst null.
  - Doc: „wie stark ein einzelner Schuss um den Schnitt schwankt; in ganzen Ringen auch beim Luftgewehr nicht 0“.
- **Tests (Handwerte):** Die Testscheibe mit vier Serien (10,0 · 10,2 · 9,8 · 10,1) und der kurzen fünften (10,0)
  ergibt:
  - in Zehnteln 0,14124;
  - in ganzen Ringen 0,42044 (35 × 10, 10 × 9).
  - Dazu 10,0 / 9,0 / 10,0 / 9,0 → 0,57735.
- **`ResultTab.tsx`:**
  - „Streuung der Serien (SD)“ wird zu „Abweichung der Serien (SD)“.
  - „Schwankung je Schuss (MAD)“ wird zu „Abweichung je Schuss (SD)“.
- **Help `serien-und-konstanz`:**
  - formula „MAD“ wird zu „SD der Schusswerte (n − 1)“.
  - minimum: „Ab 1 Schuss; die Abweichung je Schuss ab 2, SD und Spanne der Serien ab 2 Serien gleicher Länge.“
- **Katalog E10:** Definition angepasst.
- **Labor-Prüfung:** die Zeile nachrechnen (bisher MAD).

### Task 3: Ergebnis (Befunde 3–7, 10–17)

1. **Ø auch ohne Ergebnis** (3):
   - Ist die Summe null, zeigen `ResultTab` und die Überblick-Kachel „Ergebnis –“ und die Zeile „Ø je Schuss“
     mit dem Wert über die Schüsse mit Wert.
   - So stimmt die Hilfe „Den Ø gibt es trotzdem“.
2. **„ohne Zehntel“** (4): Hat jeder Wertungsschuss einen Ring, aber nicht jeder Zehntel, heißt es „nicht jeder
   Schuss mit Zehntel · auf ganze Ringe schalten“ statt „nicht jeder Schuss mit Wert“. Das gilt in `CardResult`,
   `ResultTab` und `overview`.
3. **Ist mit n** (5): Ist die Summe null, wird „Ist“ zu „Ist (39 Schuss mit Lage)“; das gilt auch für die Zeile
   „Gruppe in der Mitte“.
4. **Grund mit verdächtigem Schuss** (6, Lage 4): „nicht jeder Wertungsschuss mit gültiger Lage (fehlt oder
   verdächtig)“, in `PositionTab` und `overview`.
5. **Kacheln und Probe** (7):
   - Schließt die Auswahl Probe ein, hängt bei `result.*` „· ohne Probe“ am Hinweis.
   - Bei Auswahl Probe lautet der Grund „zählt nur Wertungsschüsse“ statt „nur 0 zählen, ab 1 Schuss“.
6. **Texte:**
   - `topics.ts` 10: „(9,8, 9,9) zählen in ganzen Ringen nur 9; ein, zwei Zehntel mehr, und es wäre jeweils ein
     Ring mehr.“
   - 11: „Ohne echten Versatz ist der Lage-Anteil meist leicht negativ, in ganzen Ringen oft 0.“
   - 12: „(Zehner; Luftgewehr auch ab 10,5, Luftpistole ab 9,0; in ganzen Ringen Ring 10 und ab Ring 9) mit
     95-%-Bereich und die längste Folge ab 10,0.“
   - 13: Kurzsatz der Zehnerquote „…; den Bereich zeigt der Reiter Ergebnis.“
   - 14: „Bei 20 Zehnern aus 40 Schuss …“
   - 15: „Ab 1 Schuss mit Teiler.“
   - 17: Verweis „(Reiter „Lage“)“.
   - Kachel-Hinweis „in Zehnteln“ wird zu „Zehntelwertung“, „in ganzen Ringen“ zu „ganze Ringe“.
7. **Katalog 16:** „… Streukreis, Extreme Spread und längste Folge wachsen, der beste Teiler sinkt mit n.“
8. **Grammatik:**
   - Ausreißer-Satz: „Schuss 27 fällt … Er kostet …“ bzw. „Sie kosten …“.
   - „1 Ring“ statt „1 Ringe“.

- **Tests:** je Punkt ein Markup- oder Satztest mit einer Karte, die den Fall hat (fehlender Zehntelwert,
  verdächtiger Schuss mit Lage, Auswahl Probe, ein einzelner Ausreißer).

### Task 4: Präzision (Befunde 1–12)

1. **Formdiagramm** (1):
   - Notiz: „Ellipse und Mitte ohne die Ausreißer (rote Punkte). Die Ellipse reicht doppelt so weit wie die
     Halbachsen (2a, 2b); bei einer runden Gruppe liegen etwa 86 % der Treffer darin.“
   - Die 86 % sind exakt: 1 − e⁻² für einen Kreis vom Radius 2σ, Katalog B0.
2. **Mit und ohne Ausreißer** (2):
   - Zeile „Halbachsen (ohne Ausreißer)“, wenn welche markiert sind.
   - `topics.ts` (masse-der-gruppe): „Die Form rechnet ohne Ausreißer; ein einzelner Abreißer hebt die Streuung
     nur in seiner Richtung.“
   - `form-der-gruppe` what: „a und b sind die Streuung entlang der langen und der kurzen Achse, gemessen wie
     Streuung x und y, aber ohne die Ausreißer.“
3. **Winkel** (3):
   - „längs etwa 11 bis 5 Uhr (111°, gegen den Uhrzeigersinn ab 3 Uhr)“: Uhr aus dem Winkel wie bei der
     Richtungsuhr.
   - Der Winkel wird modulo 180 gerundet (179,6° → 0°).
   - Test mit 111° und 179,6°.
4. **Durchmesser** (4):
   - Kachel-Hinweis „Durchmesser, Mitte zu Mitte“, Zeile „Streukreis (Durchmesser)“.
   - Katalog P1 „Durchmesser des kleinsten Kreises um alle Trefferzentren“.
5. **R50-Hinweis** (5): „Radius um den Schwerpunkt, in dem die Hälfte liegt, ohne Fehlschüsse“.
6. **Glossar σ** (6): „Streuung je Richtung in mm, gemittelt aus waagrecht und senkrecht; der typische Abstand
   vom Schwerpunkt ist größer (R50 ≈ 1,18 σ bei einer runden Gruppe). Kaum von der Schusszahl abhängig.“
7. **R50 und weite Schüsse** (7): „Einzelne weite Schüsse verändern R50 viel weniger als σ und den Streukreis,
   bei 10 Schuss aber merklich, weil sie den Schwerpunkt verschieben.“
8. **Grammatik** (8): wie Task 3.8.
9. **Negative Kosten** (9): „bringen 1,2 Ringe mehr als der Median der übrigen (liegen zur Mitte hin)“.
10. **Rund** (10): „kein Winkel: Streckung nicht nachweisbar“ statt „rund im Rahmen des Zufalls“.
11. **Fachsprache** (11):
    - „waagrecht“, „senkrecht“, „kaum von der Schusszahl abhängig“.
    - „σ aus 40 Schuss, für wenige Schüsse korrigiert“.
    - Mauchly W fällt aus der Zeile; es steht weiter in der Formel.
12. **Ausreißer-Hilfe** (12): „einen einzelnen Schuss fünfmal σ neben der Gruppe (Luftgewehr bei σ 1,5 mm: 7,5 mm,
    drei Ringbreiten) in knapp neun von zehn Fällen“ (B14: 86,2 %).

- **Tests:** Markup des Reiters Präzision (Zeilen, Notiz), Winkeltexte, Kachel-Hinweise.

### Task 5: Lage (Befunde 3, 5–12; 1, 2, 4 in Task 1 und 3)

1. **Ellipse und Auswahl** (3): Notiz unter dem Schalter: „Auf der Scheibe gilt die Ellipse für die Auswahl dort;
   dieses Urteil für alle Wertungsschüsse.“
2. **Wandern** (6):
   - Notiz und Hilfe: „Um 2 sind die Schüsse unabhängig. Deutlich darunter liegen aufeinanderfolgende Treffer
     näher beieinander, als die Gruppe breit ist: Die Gruppe wandert langsam, oder mehrere Ausreißer folgen direkt
     aufeinander. Über 2 springen aufeinanderfolgende Treffer eher hin und her.“
3. **Pfad der Serien** (7): „Auch ohne Wandern liegt der Schwerpunkt einer Zehnerserie im Mittel etwa ein Drittel
   σ neben dem der Scheibe.“ (B12)
4. **Negativer Lage-Anteil** (8):
   - Der Screenreader-Text nennt die Werte mit Vorzeichen.
   - Ist der Lage-Anteil negativ, steht die Notiz „Lage negativ: Eine Verschiebung um den gemessenen Versatz würde
     Ringe kosten.“
5. **Mindestzahl** (10):
   - „ab 3 Schuss mit Lage (nicht alle auf einer Linie)“.
   - Help „Schwerpunkt ab 3 Schuss“, wie die Karte.
6. **Katalog L6** (11): „Zahl der Treffer je Uhrzeit“.
7. **Ablesezeile** (12): `ShotLine` zeigt „Abstand zur Mitte“ wie die Karte statt x/y.

- **Tests:** Markup der Notizen, `ShotLine` ohne x/y.

### Task 6: Zeit und Verlauf (Befunde 1–10)

1. **Pausen-Satz** (1): „Nach der Pause vor Schuss 21 lagen die Schüsse danach (bis zu drei) im Schnitt 0,32 Ringe
   je Schuss unter deinen übrigen Schüssen.“ bzw. „genau im Schnitt deiner übrigen Schüsse“.
2. **Pause ohne Wert** (2, Fachkern):
   - `pauseRecovery` findet Pausen über Schüsse mit Zeit, wie `rhythmProfile`.
   - Die Schnitte davor und danach gelten nur über Schüsse mit Wert; ohne solche ist der Wert null.
   - Test: Zehntel des Schusses 21 entfernt, die Pause bleibt.
3. **Kachel Trend** (3): Einheit „Ringe“, Hinweis „je Schuss alle 10 Schuss · Zehnerserie −2,7 · nicht klar“.
4. **Ermüdung** (4):
   - „Die letzten zehn Schuss lagen im Schnitt 0,45 Ringe je Schuss unter den ersten zehn (zusammen −4,5 Ringe),
     R50 +1,40 mm.“
   - Im Reiter „Unterschied je Schuss −0,45 Ringe (zehn Schuss: −4,5)“.
5. **Pausen-Worte** (5):
   - „danach Ø −0,18 Ringe je Schuss“.
   - Notiz „„Danach“: Ø der bis zu drei Schüsse nach der Pause gegen den Ø deiner übrigen Schüsse.“
   - Kurzsatz „Deine Pausen und ob die Schüsse danach besser oder schwächer waren als deine übrigen.“
6. **Mindestzahlen** (6):
   - Rhythmus „Ab 3 Schuss mit Zeit.“
   - Tempo: Der Reiter nimmt den Median aus `time.intervalMedian` (ab 3); die Streuung bleibt „ab 4“.
   - Pausen „ab 2 Schuss mit Zeit und Wert“.
   - Verlauf „Ab 2 Schuss mit Wert, der Trend ab 10.“
7. **Schusstabelle** (7): Pausen mit `durationText` („3:20 min“ statt „3 min“).
8. **Ermüdung in ganzen Ringen** (8):
   - B9 bekommt eine Zeile in ganzen Ringen.
   - Der Text nennt beide Werte: „bis zu etwa 0,35 Ringe je Schuss (in ganzen Ringen etwa x)“, mit x aus dem Lauf.
9. **Rhythmus** (9): „Steigt sie zum Ende (längere Abstände) oder werden die Säulen unruhiger, lohnt der Blick auf
   die Ermüdung.“
10. **Formeln** (10): Z2 „Q3 − Q1 der Abstände ohne Pausen“; Z5 „Median der letzten fünf Abstände ohne Pausen“.

- **Tests:** Fachkern-Test für 2; Satz- und Markup-Tests für 1, 3, 4, 5, 7.

### Task 7: Probe und Datenlage (Befunde 1–12)

1. **„Wertung begann mit einem Versatz“** (1) fällt weg. Neu: „Die letzten fünf Probeschüsse lagen echt neben der
   Mitte (rechts oben, 1,2 mm).“
2. **Versatz Probe → Wertung** (2, D3):
   - Die Überblick-Kachel zeigt das Urteil von S4 („kein Versatz nachweisbar“ / „echt neben der Mitte“) statt der
     Zahl.
   - Im Reiter Probe steht die Notiz: „Aus fünf Probeschüssen ist ihr Schwerpunkt unsicher: Auch ohne jede
     Verschiebung liegt der Abstand meist bei etwa einem halben σ, in 5 von 100 Fällen über gut einem σ.“
     Die Zahlen kommen aus B21.
3. **Probe gegen Wertung** (3):
   - caution: „Lagen deine ersten Probeschüsse woanders, etwa vor einer Korrektur am Anschlag, machen sie σ und R50
     der Probe größer, ohne dass du unpräziser warst.“
   - short: „Wie deine ganze Probe gegen die Wertung abschneidet.“
4. **Probe nach Beginn der Wertung** (4): „Keine Probeschüsse vor der Wertung; Probe nach ihrem Beginn zählt hier
   nicht.“ Test mit Probe nach dem ersten Wertungsschuss.
5. **„die letzten fünf“ mit n** (5): „Lage der letzten drei Probeschüsse“, in Reiter, Notiz und Satz aus
   `zeroed.n`.
6. **Training nur aus Probe** (6): Bei `basis === "nur Probe"` zeigt die Karte „Eingeschossen?“ die Notiz `noProbe`
   und die Kachel „Training nur mit Probe“.
7. **Datenlage nach Wertung** (7): In Zehnteln steht dort „1 ohne Zehntel“.
8. **Trainingsregel** (8):
   - Datenlage „60 Probe, als Training wie Wertung gezählt · …“.
   - Leitfaden: „Eine Scheibe nur mit Probe ist Training: Spiegel zeigt sie wie Wertung, mit Schüssen 1, 2, 3 …,
     Serien zu zehn und Ergebnis; das schwarze Eck oben rechts erinnert daran, dass es Probe ist.“
   - `datenlage` „die Scheibe hat; Lage, Zeit und Wert zählen über beide“.
9. **Dauer** (9): „Vom ersten Probeschuss bis zur Wertung“.
10. **Grammatik** (10):
    - „2 Fehlschüsse“, „1 verdächtiger Schuss“.
    - „40 Wertungsschüsse · 9 Probeschüsse“.
11. **Rundung** (11): „rechts, 0,47 mm“.
12. **Vault** (12):
    - SF-01 „Ergebnis wie Wertung, nicht amtlich“.
    - Katalog Q1 mit „ohne Wert“.

- **Tests:** Satztests für 1 und 5, Markup für 2, 4 und 6, Datenlage-Texte für 7, 8 und 10.

### Task 8: Simulationen und Belege

- **`simulate.ts`:**
  - **B21:** Versatz Probe → Wertung ohne Verschiebung. Je Lauf 5 Probe- und 40 Wertungsschüsse Luftgewehr
    (σ 1,5 mm), dazu derselbe Fall mit 3 Probeschüssen. Ausgabe: Median und 95. Perzentil des Abstands in σ;
    5 000 Läufe, Seed 21 000 + n.
  - **B9:** eine Zeile in ganzen Ringen.
- **Katalog:**
  - Den Block „Belege aus Simulationen“ nachziehen, mit der Stand-Zeile „Prüfung (9. Oktober 2026)“.
  - Die übrigen Zeilen mit dem Lauf vergleichen; sie bleiben gleich.
- **Texte aus Task 6.8 und 7.2:** Sie zitieren die Zahlen genau, wie sie im Block stehen.

### Task 9: Labor-Prüfung und Doku

- **`pruefung.js`:** Prüfungen, die geänderte Texte nachrechnen, zum Beispiel:
  - die Abweichung je Schuss statt des MAD;
  - die Kachel Probe → Wertung;
  - Lage-Sätze;
  - Zeilen „Gruppe in der Mitte“.
- **Abnahme:** `pruefen` meldet 0 FAIL.
- **Doku:**
  - `shot-ui/CLAUDE.md`: neue Regel „Zahl und Bezug zusammen“ (D4).
  - `shot-help/CLAUDE.md`: „keine Hinweise zum Visier“.
  - `reports/2026-10-09-spiegel-pruefung.md`: Umgang je Befund.
  - Leitfaden neu erzeugen.

## Teststeps

- Fachkern (Task 2, 6.2, 7.4): Tests zuerst rot, dann die Umsetzung mit Handwerten aus diesem Plan.
- Je Befund mindestens ein Test, der den alten Text oder die alte Rechnung als falsch erkennt.
- **Gegenproben:**
  - `shotSd` wieder als MAD gibt rot.
  - `pauseRecovery` nur über Schüsse mit Wert gibt rot.
  - Satz ohne n gibt rot.
- Gate nach jedem Task.

## Verification

- `pnpm check` grün.
- Labor `pruefen` meldet 0 FAIL.
- `simulate`: neue Zeilen im Block, alte unverändert.
- Sichtprüfung im Labor (Desktop, 375 px) an den Beispielen:
  - „40 Schuss mit Probe“ LP und LG;
  - „60 Probe“;
  - „Zwei Abreißer“;
  - „Ausdruck“.
- Artifact neu veröffentlichen.
- Datenlage abgleichen (conventions §9): Was die Beispiele nicht hergeben (Pause ohne Wert, Probe nach Beginn der
  Wertung), steht als „nur durch Tests belegt“ im Bericht.
