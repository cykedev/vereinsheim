---
id: spiegel-langzeit
type: concept
title: "Spiegel über viele Scheiben — Langzeit-Konzept"
aliases: [spiegel-zeitraum, langzeit-konzept, fortschritt-konzept]
keywords: [analyse über den zeitraum, erkenntnisse, trefferbild als hauptbild, langzeit, zeitraum, saison, fortschritt, verlauf, formband, gleitender schnitt, rekorde, kalender, vergleich, zeitraum gegen zeitraum, besser werden, form, langzeit-trefferbild, dichte, umrisse, heatmap, filter, disziplin-familie, training, wettkampf, benannter zeitraum, auswahl, navigation, drill-down, ablesung, scheiben-liste, erkenntnisse, mindestzahl, nicht nachweisbar]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-030]]"]
relates_to: ["[[spiegel-vergleichen]]", "[[spiegel-ui-design]]", "[[spiegel-roadmap]]", "[[spiegel-statistics]]", "[[spiegel-metrics]]", "[[spiegel-mobile]]", "[[spiegel-data-model]]", "[[statistics-visualization]]"]
---

**TL;DR** Die Seite eines Zeitraums (Bereich Fortschritt) ist für den Schützen selbst gebaut wie die Seite einer
Scheibe, nur über viele: Statt der Scheibe steht der Verlauf fest im Bild, statt des Schusses wird eine Scheibe
abgelesen, statt der Schusstabelle gibt es die Liste der Scheiben, darunter Zahlen und Analyse. Die Scheiben ergeben
sich aus Zeitraum und Filter; Zeiträume sind rollend, frei oder vom Schützen benannt. Vergleiche ziehen auf eine eigene
Seite ([[spiegel-vergleichen]]); bis dahin ist der Vergleich mit einem zweiten Zeitraum eingebaut und urteilt nur mit
Test. Die Analyse über den Zeitraum zeigt im Überblick nur Belegtes, das Trefferbild ist ein zweites Hauptbild neben
dem Verlauf (Konzept vom 21. Oktober 2026). Gebaut sind Fachkern (`shot-core/analysis/period.ts`, `records.ts`,
`pattern.ts`) und Seite (`shot-ui/period/*`, `PeriodPage`, in der App `/progress`) samt Trefferbild und den Reitern
Ergebnis, Präzision und Lage; offen sind Überblick und Zeit mit Erkenntnissen und das Anlegen benannter Zeiträume. Treffsicher zeigt seine Statistik mit denselben Bausteinen
([[statistics-visualization]]).

## Grundentscheidungen

1. **Für den Schützen selbst.** Nicht für einen Trainer mit mehreren Schützen (SP-3.2) und nicht als Saison-Rückblick für den Verein.
2. **Zeitraum und Filter** bestimmen die Scheiben, nicht eine Auswahl von Hand und keine gepflegten Sammlungen. Die Menge wächst mit jedem Abend von selbst.
3. **Wie die Seite einer Scheibe.** Dasselbe Gerüst, dieselben Bausteine und Regeln, auch auf dem Telefon ([[spiegel-mobile]], [[spiegel-ui-design]]).
4. **Saison = eigene, benannte Zeiträume** des Schützen („Saison 26/27“, „Vorbereitung Landesmeisterschaft“), dazu rollende Vorgaben und ein freier Zeitraum. Keine Saison vom Verein, kein Kalenderjahr als Grenze.
5. **Vergleich auf einer eigenen Seite:** Bis zum 21. Oktober 2026 war der Vergleich eingebaut („Vergleichen mit …“
   im Blatt „Filter“, jede Zahl mit beiden Werten). Er zieht auf die Seite „Vergleichen“ ([[spiegel-vergleichen]]), der
   Fortschritt behält nur den stillen Bezug im Satz. Ein Urteil gibt es weiter nur mit Test.

## Fragen des Schützen

| Frage | Antwort auf der Seite | Katalog ([[spiegel-statistics]]) |
|---|---|---|
| Werde ich besser? | Verlauf je Scheibe mit gleitendem Schnitt und Formband, Vergleich mit dem Zeitraum davor | T1, T2, T3, C3 |
| Wie war die Saison? | Kopf mit Scheiben, Schüssen, Ø je Schuss, Bestwert; Rekorde | T6, R1–R8, R10, R11 |
| Bin ich gerade in Form? | die letzten Scheiben gegen den eigenen Schnitt, Boden und Decke | C4, T5 |
| Wo verliere ich Ringe? | Langzeit-Trefferbild, Lage über Zeit, Ausreißerrichtung, Schussposition in der Serie | L7, L9, L10, I7 |
| Was hat die neue Munition gebracht? | Vergleich nach Merkmal (nach SP-2.3) | C5, C6 |
| Wann schieße ich gut? | Tageszeit, Pause, Tempo gegen Wert | K1–K5, Z6, Z7 |

Die beiden letzten und „Wo verliere ich Ringe?“ brauchen, was noch offen ist (unten).

## Prinzipien

1. **Eine Familie, eine Wertung.** Die Disziplin-Familie ist Pflichtfilter, nie gemischt; Freihand und Auflage
   bleiben getrennt (SF-65). Ganze Ringe und Zehntel schalten wie überall um, Rekorde und Verläufe laufen je
   Wertung ([[spiegel-metrics]]).
2. **Je Schuss statt Summe.** Ergebnisse laufen als Ø je Schuss. Streumaße, die an der Schusszahl hängen, gelten
   nur bei gleichem n, sonst σ̂ (SF-60, SF-07).
3. **Jede Scheibe ist ein Punkt.** Der Verlauf zeigt Scheiben, nicht Schüsse. Über lange Zeiträume fasst er sie
   je Monat zusammen (Median, Boden und Decke, T5).
4. **Ehrlich vergleichen.** Ein Unterschied bekommt nur ein Urteil („besser“, „schwächer“), wenn ein Test ihn zeigt;
   sonst „kein klarer Unterschied“. Mindestzahlen gelten für Scheiben, nicht nur für Schüsse: Viele Schüsse aus
   wenigen Abenden sind keine breite Grundlage.
5. **Vom Zeitraum zur Scheibe und zurück.** Jeder Punkt führt zu seiner Scheibe, „zurück“ bringt in den
   Zeitraum mit Filter und gewählter Scheibe (Adresse wie auf der Scheibe).
6. **Dieselben Bausteine.** Ein Gerüst wie `CardPage` (`PeriodPage`), Sprungleiste, Lineal, Hilfe als Blatt,
   Design 2 ([[adr-030]]).

## Die Seite eines Zeitraums

Der Bereich **Fortschritt** der App-Navigation ([[spiegel-ui-design]], „Navigation“) ist die Seite eines Zeitraums.
Vergleiche stehen auf der eigenen Seite „Vergleichen“ unter Fortschritt ([[spiegel-vergleichen]]); bis sie gebaut ist,
bleibt der eingebaute Vergleich.

| Seite einer Scheibe | Seite eines Zeitraums |
|---|---|
| Kopf: Disziplin, Datum, Beobachtungen | Kopf: Zeitraum, Familie, Satz |
| Ergebnis-Box: Ergebnis, Schüsse, Zehner … | Ergebnis-Box: Ø je Schuss, Scheiben, Wertungsschüsse, beste Scheibe, mit Vergleich das Urteil |
| Scheibe, fest im Bild | **Verlauf**, fest im Bild |
| Serien unter der Scheibe | Umfang je Woche oder Kalender unter dem Verlauf (T6, T7) |
| Ablesung des Schusses | Ablesung der Scheibe: Datum, Wert, kleine Scheibe, „Scheibe öffnen“ |
| Schusstabelle | Liste der Scheiben, neueste oben, mit Abstand zum Schnitt |
| Kacheln im Überblick der Analyse | Zahlen über den Zeitraum, mit Vergleichswert |
| Analyse in fünf Reitern | Analyse in drei Reitern: Ergebnis (Rekorde), Präzision, Lage; Überblick und Zeit offen |

### Einstieg

- **Fortschritt** in der Navigation öffnet den zuletzt übernommenen Zeitraum (gemerkt je Gerät,
  [[spiegel-navigation]]); ohne ihn die letzten 90 Tage der zuletzt geschossenen Familie.
- **Von Start:** „Form der letzten 90 Tage“ führt in den Fortschritt mit Vergleich.
- **Aus der Scheiben-Liste:** „Im Fortschritt zeigen“ im Blatt „Filter“ nimmt Familie, Art und Zeitraum mit;
  umgekehrt „Alle in Scheiben zeigen“.
- **Aus einer Scheibe:** Der Rückweg einer aus dem Fortschritt geöffneten Scheibe führt in ihren Zeitraum, ihr Punkt
  ist gewählt. Ein Weg „Im Verlauf zeigen“ von jeder Scheibe gehört zur Auswahl ([[spiegel-navigation]]) und ist
  offen.

### Kopf

- **Eine Zeile Bedienung:** Familie (Pflicht) als Segment, dahinter ein Chip mit dem Zeitraum und dem, was abweicht
  („Letzte 90 Tage · Training · mit Zeitraum davor“), danach der Wechsel-Chip der Wertung der Familie
  ([[spiegel-navigation]], „Wertung je Scheibe und je Familie“).
- **Blatt „Filter“** hinter dem Chip, auf dem Telefon von unten; die Wahl gilt mit „Übernehmen“:
  - rollende Vorgaben: letzte 30 Tage, letzte 90 Tage, letzte 6 Monate (182 Tage, das Mittelmaß zwischen 90 Tagen
    und einem Jahr), letzte 12 Monate, alles
  - die benannten Zeiträume des Schützen
  - frei von … bis
  - „Vergleichen mit“: ohne, der gleich lange Zeitraum davor, ein benannter Zeitraum (später ein Merkmal); Scheiben,
    die in beiden Zeiträumen liegen, zählen nur im gewählten
  - Art (alle, Training, Wettkampf), „Trainings nur aus Probe mitzählen“
  - „Als Zeitraum speichern“ fehlt noch.
- **Ergebnis-Box** wie `CardResult`: Ø je Schuss über alle Wertungsschüsse groß ([[adr-034]]), darunter Scheiben und
  Wertungsschüsse, die beste Scheibe unter der häufigsten Schusszahl (eine kurze Scheibe hätte es sonst leichter).
  Bei einem Vergleich steht dazu der Unterschied mit Urteil, etwa „+0,08 gegen Zeitraum davor · kein klarer
  Unterschied“.
- **Ein Satz** beantwortet „Werde ich besser?“: ohne gewählten Vergleich still gegen den Zeitraum davor, bei
  „Alles“ die letzten 90 Tage gegen die 90 davor; Verlauf und Ergebnis-Box zeigen einen Vergleich nur, wenn er
  gewählt ist.
- **Wertung:** Der Fortschritt rechnet in der Wertung der Familie; umgestellt wird sie über den Chip, automatisch
  gespeichert.

### Sprungleiste

„Verlauf · Scheiben · Zahlen · Analyse“, vier Felder in derselben Leiste wie auf der Scheibe.

### Verlauf (oben, fest im Bild ab 768 px)

- **Kennzahl über einen Umschalter:** Ø je Schuss (Vorgabe), Streuung (σ), Zehner, Tempo; nur Kennzahlen, die nicht
  an der Schusszahl hängen.
- **Darstellung:** Punkte je Scheibe, der gleitende Schnitt als Linie, das Formband als Fläche (T1, T2). Ab 60
  Scheiben „je Monat“ mit Median und Boden bis Decke, bis der Schütze selbst wählt; Boden ist das schwächere Ende (bei
  σ das P90), beim Tempo nur die Spanne.
- **Antippen** wählt eine Scheibe über das Lineal ([[spiegel-mobile]]): Die Ablesung rechts (auf dem Telefon als
  Zeile unter dem Verlauf) zeigt Datum, Wert, eine kleine Scheibe und „Scheibe öffnen“. Verlauf, Liste und Ablesung
  teilen die Wahl.
- **Mit Vergleich:** Beide Zeiträume liegen auf einer relativen Achse („Scheibe 1, 2, 3 … im Zeitraum“)
  übereinander, der Vergleich grau und hohl. Getrennt nach Kalender ließen sich zwei Zeiträume nicht
  übereinanderlegen.
- **Umfang darunter**, umschaltbar „Wochen | Kalender“ (die Wahl steht nicht in der Adresse):
  - Wochen: Säulen je Woche, beschriftet mit dem Montag.
  - Kalender (T7): je Woche eine Spalte Montag bis Sonntag, getönt in vier Stufen nach den Schüssen des Abends
    (relativ zum stärksten Tag), ein Abend mit Wettkampf mit goldenem Rand. Ein Trainingstag ist ein Link an seinen
    Abend in der Liste (Anker, markiert); sein Name nennt Tag, Scheiben und Schüsse. Er zeigt so viele ganze Wochen,
    wie nebeneinander passen, und blättert mit „‹ früher“ und „später ›“; Tage außerhalb des Zeitraums stehen blass
    ([[spiegel-navigation]]).

### Liste und Ablesung

- **Abstand zum Schnitt:** zu den bis zu fünf Scheiben davor, ohne die Scheibe selbst, auch über den Anfang des
  Zeitraums hinweg. Das ist der eine Bezug für eine Scheibe; sein „?“ steht an der Ablesung („Abstand zum Schnitt
  davor“).
- Die Liste zeigt zehn Scheiben und „Alle zeigen“.

### Zahlen und Analyse

- **Zahlen:** sechs Kacheln über den Zeitraum (über alle Schüsse, das Tempo als Mittel je Scheibe; nur Kennzahlen, die nicht an der Schusszahl
  hängen). Mit Vergleich stehen in jeder Kachel der Wert dort, Δ und das Urteil in Alltagsworten: „deutlich besser“,
  „schwächer“, „kein klarer Unterschied“; die Kacheln heißen „Streuung“ und „Tempo“.
- **Analyse heute: „Rekorde“** über alle Scheiben der Familie:
  - oben höchstens fünf aus dem Zeitraum, darunter zugeklappt „Alle Rekorde (n)“; jeder in ganzen Worten.
  - Die ganze Zeile eines Rekords ist der Knopf, mit Linien dazwischen wie in der Liste der Scheiben.
  - Die Rekorde der gewählten Scheibe sind markiert und sagen „gezeigt“. Liegt die Scheibe außerhalb des Zeitraums,
    steht „außerhalb“ ohne Knopf.
- **Training nur aus Probe** zählt als Vorgabe mit, denn so trainieren die meisten; im Fachkern bleibt
  `includeProbeOnly` eine Option, die Seite setzt sie als Vorgabe.
- **Analyse über den Zeitraum** (SP-2.7, Konzept vom 21. Oktober 2026, mit dem User abgestimmt): siehe den
  folgenden Abschnitt.

### Analyse über den Zeitraum: Fragen statt Kennzahlen

Ziel ist ein Profi-Werkzeug, das nicht dazugebaut wirkt: Der Katalog hinter der Seite ist groß, die Seite bleibt kurz.
Drei Grundsätze:

1. **Der Überblick zeigt nur, was belegt ist.** Höchstens drei Erkenntnisse als Satz, jede mit Test und Mindestzahl,
   geordnet nach den Ringen, die sie kosten („Rechts tief kostet die meisten Ringe“, „Nach Pausen schwächer“). Jeder
   Satz führt in seinen Reiter, eine Erkenntnis über zwei Gruppen (Wettkampf gegen Training) auf die Seite
   „Vergleichen“ ([[spiegel-vergleichen]]). Was nichts zeigt, steht leise in einer Zeile („Kein klarer Unterschied:
   Tageszeit, Platz in der Serie, erster Schuss“). Weil der Überblick viele Fragen auf einmal prüft, korrigiert er für
   Mehrfachtests (Holm), belegt per Simulation wie B19.
2. **Die Reiter sind das Werkzeug**, mit wenigen Karten je Reiter und derselben Ordnung wie auf der Scheibe:

| Reiter | Inhalt | Katalog |
|---|---|---|
| Überblick | höchstens drei belegte Erkenntnisse, darunter, was ohne klaren Unterschied blieb | – |
| Ergebnis | Rekorde, Verteilung der Serien und Ringanteile über die Zeit, Abstandskurve | R1–R8, R10, R11, V3–V5 |
| Präzision | Form über mehrere Scheiben als Ellipse (gepoolt, rund oder länglich) | L9 |
| Lage | Lage über Zeit (Schwerpunkt je Scheibe als zwei Zeitreihen), Ausreißerrichtung | L10, L7 |
| Zeit | Platz in der Serie, Reaktion nach schwachem Schuss, erster Wertungsschuss, Tempo gegen Wert, Tageszeit, Pause, Trendsteigung | I7–I9, Z6, Z7, K2, K4, T4 |

3. **Das Trefferbild ist Hauptbild, keine Karte:** Wo auf der Scheibe die Scheibe steht, steht hier der Verlauf; ein
   Umschalter „Verlauf | Trefferbild“ zeigt an derselben Stelle das Langzeit-Trefferbild (L9, unten). Ablesung, Liste
   und Zahlen bleiben, wie sie sind.

Was nicht hierher gehört: Wettkampf gegen Training (W1–W4) und jeder andere Vergleich stehen auf der Seite
„Vergleichen“; Munitionslos und Ausrüstung (K1) brauchen Angaben (SP-2.3); Befinden (K6) und Selbstbild liegen im
Tagebuch ([[adr-033]]), das denselben Fachkern nutzt.

**Angaben und Grundlage ([[adr-033]]):** Jede Auswertung nennt die Angabe, die sie braucht (Lage je Schuss, Zeit,
Serien), und zählt jede Scheibe, so weit ihre Angaben reichen. Die Grundlage steht dabei („über 31 von 38 Scheiben, 7
ohne Lage“). Eine Trefferlage nur als Summe (Ausdruck, Handeingabe) zählt im Schwerpunkt je Scheibe (L10), nie im
Dichtebild (L9) und nie in der Ausreißerrichtung (L7).

**Gebaut wird in drei Plänen:** 1. Trefferbild und Lage (L9, L10, L7, Reiter Ergebnis, Präzision, Lage); 2. die Seite
„Vergleichen“ samt Umzug des Vergleichs aus dem Fortschritt (C2, C3, W1); 3. Überblick und die Reiter Zeit und
Ergebnis (I7–I9, Z6, Z7, K2, K4, T4, V3–V5, W2–W4 als Zeilen im Vergleich).

### Langzeit-Trefferbild (gebaut)

- **Umschalter** „Verlauf | Trefferbild“ als erste Zeile der Karte des Hauptbilds (`PeriodChartBar`, `show=target` in
  der Adresse, die Sprungleiste heißt dann „Trefferbild“); beim Trefferbild steht dort nur noch sein „?“.
- **Eine Sicht, wo die Schüsse lagen.** Eine zweite Sicht „Form“ (jede Scheibe auf ihre Mitte geschoben) gab es bis
  zum 21. Oktober 2026; sie sah der Lage zu ähnlich, um verstanden zu werden. Die Form steht jetzt als Ellipse im
  Reiter Präzision.
- **Auf derselben Scheibe wie die Seite einer Scheibe:** Beide zeichnen das Scheibenbild über einen Baustein
  (`TargetBoard`: Papier, Spiegel, Ringe, Ringzahlen auf vier Achsen, gestrichelte Innenzehn bei der Luftpistole).
- **Drei Stile nach der Zahl der Schüsse** (`PatternStyle`):
  - unter 50 Schuss jeder Treffer in Kalibergröße und Ringfarbe (`rings`), eine Dichte sagt dann nichts;
  - bis 3.000 Schuss jeder Treffer in Kalibergröße, gefärbt nach der Dichte an seiner Stelle (`shots`): sechs Stufen
    von ganz selten (hellviolett, `heat-0`) bis oft (gelb, `heat-5`), deren Grenzen 99 von 100, neun Zehntel, drei
    Viertel, die Hälfte, ein Viertel und ein Zehntel der Schüsse umschließen (`HEAT_SHARES`), die dichten zuletzt
    gezeichnet, Deckkraft 0,85, Ringe und Ringzahlen darüber, damit man sieht, was wo ist; der Ausschnitt reicht bis
    zum weitesten Schuss, höchstens 1,6-mal so weit wie 99 % der Schüsse, wer dann draußen liegt, wird unter dem Bild
    gezählt („1 Schuss liegt außerhalb des Bilds.“);
  - über 3.000 Schuss (`PATTERN_SHOTS_MAX`, Menge an den Browser) nur die Umrisse (`outlines`), ohne Knopf,
    Ausschnitt 99 % der Schüsse × 1,35. Dieselben Schwellen gelten beim Vergleichen. Bis zum 22. Oktober 2026 stand
    hier die Dichte als sechs Bänder in den Farben der Treffer. Mit den Umrissen fielen sie weg: Sie waren nur eine
    Notlösung, weil der Server keine Tausende Treffer schickt, und die eigenen Daten erreichen 3.000 Schuss in Jahren
    nicht (Luftpistole „Alles“ 985 Schuss).
- **Warum Treffer in Dichtefarbe:** Der User verglich am 21. Oktober 2026 Heatmap, Treffer in Ringfarbe und Treffer in
  Dichtefarbe an den eigenen Daten. Treffer in Ringfarbe wiederholen nur die Ringe (die Farbe hängt am Abstand zur
  Mitte), bei vielen Schüssen versinkt die Dichte; die reine Heatmap zeigt keine Treffer. Treffer in Dichtefarbe zeigen
  jeden Schuss, die seltenen und den Kern. Verworfen davor: hellblaue Flächen, eine zurückgenommene dunkle Scheibe,
  eigene Ringe mit Saum, einzelne seltene Treffer über einer Heatmap.
- Die Legende ist ein Verlauf „selten … oft“, bei Treffern dazu „Jeder Punkt ist ein Schuss.“
- **Dichte oder Umrisse:** Von 50 bis 3.000 Schuss schaltet ein runder Knopf oben links im Bild (`CornerButton`, Kreis in einem
  gestrichelten) statt der Dichte die Umrisse wie beim Vergleichen ([[spiegel-vergleichen]]): durchgezogen und leicht
  getönt die Fläche mit der Hälfte der Schüsse, gestrichelt die mit 9 von 10, in der Farbe der Seite A
  (`compare-a`), der geviertelte Kreis bleibt. Gezeichnet von einem Baustein für beide Seiten (`DensityOutlines`), die
  Legende ist dieselbe („Durchgezogen: die Hälfte der Schüsse. Gestrichelt: 9 von 10.“). Unter 50 Schuss gibt es kein
  Raster und keinen Knopf, darüber nur die Umrisse. Die Wahl ist, wie gezeichnet wird, nicht was man sieht: Sie steht nicht in der Adresse,
  sondern im Gerät (`localStorage` unter `spiegel-pattern-view`, `usePatternView` in Spiegel; der Baustein ist gesteuert), Vorgabe ist die Dichte. Der User wollte am
  22. Oktober 2026 beides haben: die Dichte zeigt jeden Treffer, die Umrisse lesen sich wie der Vergleich.
- **Der geviertelte Kreis** ist die Mitte aller Schüsse, der feine Rahmen um ihn der Bereich, in dem sie sicher liegt
  ([[adr-034]]).
- **Ein Satz unter dem Bild** gibt die Antwort: zuerst die Lage („versetzt: rechts tief“ oder ohne gesicherten Versatz
  „Deine Mitte liegt 2,9 mm hoch. Ob das so bleibt, ist mit 7 Scheiben noch nicht sicher.“, nie „passt“ neben einem
  Kreis, der daneben liegt; Test je Richtung über Schüsse und Abende), dann die Form („länglich, eher waagrecht“ oder „keine klare Richtung“, Test über die
  gepoolte Form); ohne Urteil über die Form kein zweiter Satz.
- **Rechnen auf dem Server:** aus den gespeicherten Lagen der Projektion (`marks`, 10 µm), erst wenn das Bild oder die
  Reiter Präzision und Lage es brauchen (`periodPatternAction`); an den Browser gehen bis 3.000 Schuss die Treffer mit
  ihrem Band, ab 50 Schuss das Raster von 64 × 64 (für die Umrisse), dazu der Schwerpunkt je Scheibe. Gemessen: „Alles“ mit 1.564 Scheiben (nur Raster) 56 ms und 156 KB, 90 Tage (76 Scheiben, Treffer in Dichtefarbe und Raster) 8 ms und 51 KB
  ([[spiegel-db-schema]]). Die Dichte glättet 1,3-mal so stark wie nach Silverman, die Ränder sind weiche Kurven.
- **Reiter Präzision:** die Form über mehrere Scheiben als Ellipse (doppelte Halbachsen der gepoolten Streuung) mit
  ihrer langen Seite und gestrichelt dem Kreis einer runden Gruppe gleicher Streuung, ohne Maßstab; daneben Form, Länge
  zu Breite und σ.
- **Reiter Lage:** Lage über Zeit als zwei Zeitreihen wie der Verlauf (links/rechts, tief/hoch), jede Scheibe ein Punkt,
  die Linie der Schnitt der letzten fünf, gestrichelt die Mitte; der Maßstab folgt neun von zehn Abständen, weiter
  draußen steht ein Ring am Rand. Das Lineal wählt die Scheibe für die Ablesung, ohne zu springen. Ein Pfad der
  Schwerpunkte auf dem Scheibenbild wurde bei vielen Scheiben zum Knäuel.
- **Urteile** mit Simulation ([[spiegel-statistics]], B23–B25): Form länglich ab p < 0,05 und 1,15 : 1, ab 100 Schuss
  aus 5 Scheiben; Lage über die Schwerpunkte ab 5 Scheiben; Ausreißerrichtung ab 30 Ausreißern.

### Vergleich (eingebaut, zieht um)

Bis die Seite „Vergleichen“ steht ([[spiegel-vergleichen]]), gilt im Fortschritt:


- **Einheit des Tests ist die Scheibe:** Je Seite gehen die Werte der Scheiben in den Test, nicht alle Schüsse
  zusammen (Mann-Whitney auf den Scheibenwerten, C3). Unter fünf Scheiben je Seite steht „zu wenige Scheiben“ statt
  eines Urteils.
- **Bedeutsamkeit** (T3): „deutlich“ steht nur neben einem Urteil, wenn der Unterschied mindestens 0,3 der
  gepoolten Streuung der Scheiben ausmacht.
- **Scheibe gegen Scheibe** (C2, offen, SP-2.2) wird derselbe Mechanismus: Ein Zeitraum kann eine einzelne Scheibe
  sein. Auf dem Langzeit-Trefferbild liegen dann zwei Gruppen in zwei Farben.

### Zeiträume des Schützen

- **Ein benannter Zeitraum** hat Name, Beginn, ein Ende (offen heißt „läuft noch“) und optional eine Familie.
  Er ist persönlich und wird nicht geteilt.
- **Im Datenmodell** ist er eine eigene Entität am Konto (`NamedPeriod` mit Name, Beginn und Ende, ohne Familie;
  [[spiegel-data-model]]). Gewählt und verglichen wird er im Blatt „Filter“, seine Kennung steht in der Adresse.
- **Anlegen** über „Als Zeitraum speichern“ im Blatt, ändern und löschen in einer Liste unter Fortschritt: offen.

### Telefon

Wie auf der Scheibe:

- Kopf, Sprungleiste mit vier Feldern, Verlauf in voller Breite, darunter die Ablesung als Zeile.
- Die Liste der Scheiben zeigt zehn und „Alle zeigen“, danach folgen Zahlen und Analyse.
- Das Blatt „Filter“ öffnet sich von unten.
- Gemessen am 9. Oktober 2026 bei 390 × 844: 3,97 Bildschirme.

### Rechnen

- **Werte je Scheibe:** Die Seite liest die vorberechneten Kennzahlwerte je Scheibe (Projektion im
  [[spiegel-data-model]]) und rechnet nicht alle Schüsse im Browser neu.
- **Langzeit-Trefferbild:** Es braucht Schüsse, bei langen Zeiträumen Tausende. Der Server soll dafür ein
  Dichteraster liefern.
- **Ausreißer:** Der schrittweise Test braucht O(n³/10) und ist nur je Scheibe gedacht. Über Zeiträume zählen
  die Ausreißer je Scheibe.

### Auch in Treffsicher

Treffsichers Statistik ist dieselbe Seite über Einheiten statt Scheiben ([[statistics-visualization]], [[adr-032]]).
Eingabe ist `PeriodItem`; was Spiegel anders braucht als Treffsicher, sind Parameter mit Spiegels Vorgabe, Spiegel
ändert sich dadurch nicht:

- **Wörter:** `PeriodWordsProvider` (`period/PeriodWords`) mit `PeriodWords` (`period/words`: Einzahl, Mehrzahl, Satz
  ohne Rekord); die reinen Texte (`verdictText`, `periodSentence`, `recordRows`, `weekText`, `deltaText`) nehmen sie als
  letzten Parameter. Vorgabe `CARD_WORDS` („Scheibe“). „Einheit“ ist wie „Scheibe“ weiblich, die Sätze bleiben gleich.
- **Hilfe:** `HelpTextsProvider` (`help/HelpTexts`) gibt Titel und Kurzsatz einer Erklärung; `AnalysisCard` nimmt
  sie als `texts`. Vorgabe `shot-help`.
- **Kennzahlen:** `periodModel({ tileKeys })` für die Kacheln (die erste trägt den Vergleich), `PeriodChartBar.metrics`
  für den Verlauf. Treffsicher: Ø je Schuss, Zehner, Lage (`group.mpiDistance` aus der Trefferlage des Ausdrucks,
  in der Adresse `metric=location`).
- **Blatt „Filter“:** `probeOnlySwitch={false}` blendet „Trainings nur aus Probe mitzählen“ aus.
- **Ablesung:** `CardReadout` mit `target: null` zeichnet keine kleine Scheibe.

## Vorgaben

- **Beim ersten Öffnen** die letzten 90 Tage: Sie zeigen Form und Trend, ohne alte Abende zu mischen.
- **Kennzahl des Verlaufs** ist Ø je Schuss: verständlich und von der Schusszahl unabhängig.
- **Ein Vergleich urteilt** ab fünf Scheiben je Seite; eine Simulation bestätigt die Zahl (B19 in
  [[spiegel-statistics]]: Fehlalarm höchstens etwa 5 %, eine Verengung von 1,5 auf 1,3 mm erkennt der Vergleich bei 5
  gegen 5 Scheiben in gut der Hälfte, bei 10 gegen 10 in gut neun von zehn Fällen). „Deutlich“ zeigt die Oberfläche
  nur neben einem Urteil: Ohne Veränderung trifft die Bedeutsamkeit bei 5 gegen 5 Scheiben in etwa sechs von zehn
  Fällen zu.

## Offen

| Inhalt | Roadmap |
|---|---|
| Überblick mit belegten Erkenntnissen, Reiter Zeit und Ergebnis; Trendsteigung (T4) | SP-2.7, Plan 3 |
| Benannte Zeiträume anlegen, ändern und löschen; Vergleich nach Merkmal nach SP-2.3 | SP-2.2, SP-2.3 |
