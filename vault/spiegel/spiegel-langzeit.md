---
id: spiegel-langzeit
type: concept
title: "Spiegel über viele Scheiben — Langzeit-Konzept"
aliases: [spiegel-zeitraum, langzeit-konzept, fortschritt-konzept]
keywords: [langzeit, zeitraum, saison, fortschritt, verlauf, formband, gleitender schnitt, rekorde, kalender, vergleich, zeitraum gegen zeitraum, besser werden, form, langzeit-trefferbild, dichte, filter, disziplin-familie, training, wettkampf, benannter zeitraum, auswahl, navigation, drill-down, ablesung, scheiben-liste, erkenntnisse, mindestzahl, nicht nachweisbar]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-030]]"]
relates_to: ["[[spiegel-ui-design]]", "[[spiegel-roadmap]]", "[[spiegel-statistics]]", "[[spiegel-metrics]]", "[[spiegel-mobile]]", "[[spiegel-data-model]]"]
---

**TL;DR** Die Seite eines Zeitraums (Bereich Fortschritt) ist für den Schützen selbst gebaut wie die Seite einer
Scheibe, nur über viele: Statt der Scheibe steht der Verlauf fest im Bild, statt des Schusses wird eine Scheibe
abgelesen, statt der Schusstabelle gibt es die Liste der Scheiben, darunter Zahlen und Analyse. Die Scheiben ergeben
sich aus Zeitraum und Filter; Zeiträume sind rollend, frei oder vom Schützen benannt. Der Vergleich mit einem zweiten
Zeitraum ist eingebaut und urteilt nur mit Test. Gebaut sind Fachkern (`shot-core/analysis/period.ts`, `records.ts`)
und Seite (`shot-ui/period/*`, `PeriodPage`, in der App `/progress`); offen sind Langzeit-Trefferbild, Erkenntnisse
je Reiter und das Anlegen benannter Zeiträume.

## Grundentscheidungen

1. **Für den Schützen selbst.** Nicht für einen Trainer mit mehreren Schützen (SP-3.2) und nicht als Saison-Rückblick für den Verein.
2. **Zeitraum und Filter** bestimmen die Scheiben, nicht eine Auswahl von Hand und keine gepflegten Sammlungen. Die Menge wächst mit jedem Abend von selbst.
3. **Wie die Seite einer Scheibe.** Dasselbe Gerüst, dieselben Bausteine und Regeln, auch auf dem Telefon ([[spiegel-mobile]], [[spiegel-ui-design]]).
4. **Saison = eigene, benannte Zeiträume** des Schützen („Saison 26/27“, „Vorbereitung Landesmeisterschaft“), dazu rollende Vorgaben und ein freier Zeitraum. Keine Saison vom Verein, kein Kalenderjahr als Grenze.
5. **Vergleich eingebaut:** „Vergleichen mit …“ im Blatt „Filter“. Jede Zahl zeigt dann beide Werte und den Unterschied, ein Urteil nur mit Test.

## Fragen des Schützen

| Frage | Antwort auf der Seite | Katalog ([[spiegel-statistics]]) |
|---|---|---|
| Werde ich besser? | Verlauf je Scheibe mit gleitendem Schnitt und Formband, Vergleich mit dem Zeitraum davor | T1, T2, T3, C3 |
| Wie war die Saison? | Kopf mit Scheiben, Schüssen, Ø je Schuss, Bestwert; Rekorde | T6, R1–R8 |
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
Eine eigene Seite **Vergleich** gibt es nicht; der Vergleich ist eingebaut.

| Seite einer Scheibe | Seite eines Zeitraums |
|---|---|
| Kopf: Disziplin, Datum, Beobachtungen | Kopf: Zeitraum, Familie, Satz |
| Ergebnis-Box: Ergebnis, Schüsse, Zehner … | Ergebnis-Box: Ø je Schuss, Scheiben, Wertungsschüsse, beste Scheibe, mit Vergleich das Urteil |
| Scheibe, fest im Bild | **Verlauf**, fest im Bild |
| Serien unter der Scheibe | Umfang je Woche oder Kalender unter dem Verlauf (T6, T7) |
| Ablesung des Schusses | Ablesung der Scheibe: Datum, Wert, kleine Scheibe, „Scheibe öffnen“ |
| Schusstabelle | Liste der Scheiben, neueste oben, mit Abstand zum Schnitt |
| Kacheln im Überblick der Analyse | Zahlen über den Zeitraum, mit Vergleichswert |
| Analyse in fünf Reitern | Analyse: Rekorde; Reiter über den Zeitraum offen |

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
  - rollende Vorgaben: letzte 30 Tage, letzte 90 Tage, letzte 12 Monate, alles
  - die benannten Zeiträume des Schützen
  - frei von … bis
  - „Vergleichen mit“: ohne, der gleich lange Zeitraum davor, ein benannter Zeitraum (später ein Merkmal); Scheiben,
    die in beiden Zeiträumen liegen, zählen nur im gewählten
  - Art (alle, Training, Wettkampf), „Trainings nur aus Probe mitzählen“
  - „Als Zeitraum speichern“ fehlt noch.
- **Ergebnis-Box** wie `CardResult`: Ø je Schuss als Mittel der Scheiben groß, darunter Scheiben und
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

- **Zahlen:** sechs Kacheln über den Zeitraum (Mittel je Scheibe, nur Kennzahlen, die nicht an der Schusszahl
  hängen). Mit Vergleich stehen in jeder Kachel der Wert dort, Δ und das Urteil in Alltagsworten: „deutlich besser“,
  „schwächer“, „kein klarer Unterschied“; die Kacheln heißen „Streuung“ und „Tempo“.
- **Analyse heute: „Rekorde“** über alle Scheiben der Familie:
  - oben höchstens fünf aus dem Zeitraum, darunter zugeklappt „Alle Rekorde (n)“; jeder in ganzen Worten.
  - Die ganze Zeile eines Rekords ist der Knopf, mit Linien dazwischen wie in der Liste der Scheiben.
  - Die Rekorde der gewählten Scheibe sind markiert und sagen „gezeigt“. Liegt die Scheibe außerhalb des Zeitraums,
    steht „außerhalb“ ohne Knopf.
- **Training nur aus Probe** zählt als Vorgabe mit, denn so trainieren die meisten; im Fachkern bleibt
  `includeProbeOnly` eine Option, die Seite setzt sie als Vorgabe.
- **Reiter der Analyse** über den Zeitraum (offen, SP-2.7), jeweils mit Mindestzahl an Scheiben:

| Reiter | Inhalt | Katalog |
|---|---|---|
| Überblick | Beobachtungen in Worten über den Zeitraum | – |
| Ergebnis | Verteilung der Scheiben-Ø, Boden und Decke, Rekorde | T5, R1–R8 |
| Präzision | σ̂ im Verlauf, Langzeit-Trefferbild, Form über mehrere Scheiben | L9 |
| Lage | Lage über Zeit, Ausreißerrichtung, Richtungsuhr über alle Schüsse | L7, L10 |
| Zeit | Umfang und Kalender, Tempo gegen Wert, Tageszeit, Pause | T6, T7, Z6, Z7, K1–K5 |

### Langzeit-Trefferbild (offen)

- **Zwei Sichten:** Bei **Form** ist jede Scheibe auf ihren eigenen Schwerpunkt geschoben; übrig bleibt die
  reine Streuung über die Abende. **Lage** zeigt die Schüsse, wo sie lagen; so wird ein Versatz sichtbar, der
  immer wiederkehrt.
- **Dichte statt Punkte:** Ab einigen hundert Schüssen zeigt das Bild die Dichte (Flächen oder Höhenlinien),
  nicht mehr jeden Schuss.

### Vergleich (eingebaut)

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

## Vorgaben

- **Beim ersten Öffnen** die letzten 90 Tage: Sie zeigen Form und Trend, ohne alte Abende zu mischen.
- **Kennzahl des Verlaufs** ist Ø je Schuss: verständlich und von der Schusszahl unabhängig.
- **Langzeit-Trefferbild** startet in der Sicht **Form**: Sie beantwortet „Wie eng schieße ich?“ ohne die
  Wanderung der Lage.
- **Ein Vergleich urteilt** ab fünf Scheiben je Seite; eine Simulation bestätigt die Zahl (B19 in
  [[spiegel-statistics]]: Fehlalarm höchstens etwa 5 %, eine Verengung von 1,5 auf 1,3 mm erkennt der Vergleich bei 5
  gegen 5 Scheiben in gut der Hälfte, bei 10 gegen 10 in gut neun von zehn Fällen). „Deutlich“ zeigt die Oberfläche
  nur neben einem Urteil: Ohne Veränderung trifft die Bedeutsamkeit bei 5 gegen 5 Scheiben in etwa sechs von zehn
  Fällen zu.

## Offen

| Inhalt | Roadmap |
|---|---|
| Langzeit-Trefferbild mit Form, Lage und Dichte | SP-2.7 |
| Erkenntnisse Reiter für Reiter, jede mit Mindestzahl und Simulation; Trendsteigung (T4) | SP-2.7 |
| Benannte Zeiträume anlegen, ändern und löschen; Vergleich nach Merkmal nach SP-2.3 | SP-2.2, SP-2.3 |
| Scheibe gegen Scheibe (C2) | SP-2.2 |
