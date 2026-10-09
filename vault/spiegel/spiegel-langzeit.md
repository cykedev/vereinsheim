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

**TL;DR** Die Seite eines Zeitraums ist für den Schützen selbst gebaut wie die Seite einer Scheibe, nur über viele: Statt der Scheibe steht der Verlauf fest im Bild, statt des Schusses wird eine Scheibe abgelesen, statt der Schusstabelle gibt es die Liste der Scheiben, darunter Zahlen und Analyse. Die Scheiben ergeben sich aus Zeitraum und Filter; Zeiträume sind rollend, frei oder vom Schützen benannt. Der Vergleich mit einem zweiten Zeitraum ist eingebaut und urteilt nur mit Test. Entwurf vom 8. Oktober 2026; Grundentscheidungen und Vorgaben hat der User getroffen, L1 (Diagramm-Lineal), L2 (Fachkern) und L3 (die Seite im Labor) sind erledigt; als Nächstes kommen L4 (Langzeit-Trefferbild), L5 (Erkenntnisse je Reiter) und L6 (Zeiträume speichern).

## Entschieden mit dem User (8. Oktober 2026)

1. **Für den Schützen selbst.** Nicht für einen Trainer mit mehreren Schützen (SP-3.2) und nicht als Saison-Rückblick für den Verein.
2. **Zeitraum und Filter** bestimmen die Scheiben, nicht eine Auswahl von Hand und keine gepflegten Sammlungen. Die Menge wächst mit jedem Abend von selbst.
3. **Wie die Seite einer Scheibe.** Dasselbe Gerüst, dieselben Bausteine und Regeln, auch auf dem Telefon ([[spiegel-mobile]], [[spiegel-ui-design]]).
4. **Saison = eigene, benannte Zeiträume** des Schützen („Saison 26/27“, „Vorbereitung Landesmeisterschaft“), dazu rollende Vorgaben und ein freier Zeitraum. Keine Saison vom Verein, kein Kalenderjahr als Grenze.
5. **Vergleich eingebaut:** Im Kopf „vergleichen mit …“. Jede Zahl zeigt dann beide Werte und den Unterschied, „echt“ nur mit Test.

## Fragen des Schützen

| Frage | Antwort auf der Seite | Katalog ([[spiegel-statistics]]) |
|---|---|---|
| Werde ich besser? | Verlauf je Scheibe mit gleitendem Schnitt und Formband, Vergleich mit dem Zeitraum davor | T1, T2, T3, C3 |
| Wie war die Saison? | Kopf mit Scheiben, Schüssen, Ø je Schuss, Bestwert; Rekorde | T6, R1–R8 |
| Bin ich gerade in Form? | die letzten Scheiben gegen den eigenen Schnitt, Boden und Decke | C4, T5 |
| Wo verliere ich Ringe? | Langzeit-Trefferbild, Lage über Zeit, Ausreißerrichtung, Schussposition in der Serie | L7, L9, L10, I7 |
| Was hat die neue Munition gebracht? | Vergleich nach Merkmal (nach SP-2.3) | C5, C6 |
| Wann schieße ich gut? | Tageszeit, Pause, Tempo gegen Wert | K1–K5, Z6, Z7 |

## Prinzipien

1. **Eine Familie, eine Wertung.** Die Disziplin-Familie ist Pflichtfilter, nie gemischt; Freihand und Auflage
   bleiben getrennt (SF-65). Ganze Ringe und Zehntel schalten wie überall um, Rekorde und Verläufe laufen je
   Wertung ([[spiegel-metrics]]).
2. **Je Schuss statt Summe.** Ergebnisse laufen als Ø je Schuss. Streumaße, die an der Schusszahl hängen, gelten
   nur bei gleichem n, sonst σ̂ (SF-60, SF-07).
3. **Jede Scheibe ist ein Punkt.** Der Verlauf zeigt Scheiben, nicht Schüsse. Über lange Zeiträume fasst er sie
   zu Woche oder Monat zusammen (Median, P10–P90 als Boden und Decke, T5).
4. **Ehrlich vergleichen.** Ein Unterschied heißt nur „echt“, wenn ein Test ihn zeigt; sonst „nicht
   nachweisbar“. Mindestzahlen gelten für Scheiben, nicht nur für Schüsse: Viele Schüsse aus wenigen Abenden
   sind keine breite Grundlage.
5. **Vom Zeitraum zur Scheibe und zurück.** Jeder Punkt führt zu seiner Scheibe, „zurück“ bringt in den
   Zeitraum mit Filter und Stelle (Anker in der Adresse wie auf der Scheibe).
6. **Dieselben Bausteine.** Gerüst aus `CardPage`, Sprungleiste, Reiter, Hilfe als Blatt, Design 2
   ([[adr-030]]).

## Entwurf: die Seite eines Zeitraums

Die App-Navigation kennt schon den Bereich **Fortschritt** ([[spiegel-ui-design]], „Navigation“). Er wird zur
Seite eines Zeitraums. Die bisher geplante eigene Seite **Vergleich** geht im eingebauten Vergleich auf.

| Seite einer Scheibe | Seite eines Zeitraums |
|---|---|
| Kopf: Disziplin, Datum, Satz | Kopf: Zeitraum, Familie, Art, Satz |
| Ergebnis-Box: Ergebnis, Schüsse, Zehner … | Ergebnis-Box: Ø je Schuss, Scheiben, Schüsse, Bestwert, Trend |
| Scheibe, fest im Bild | **Verlauf**, fest im Bild |
| Serien unter der Scheibe | Kalender oder Umfang je Woche unter dem Verlauf (T6, T7) |
| Ablesung des Schusses | Ablesung der Scheibe: Datum, Wert, kleine Scheibe, „Scheibe öffnen“ |
| Schusstabelle | Liste der Scheiben, neueste oben, mit Abstand zum Schnitt |
| Zahlen (Kacheln) | Zahlen über den Zeitraum, mit Vergleichswert |
| Analyse in sechs Reitern | Analyse in Reitern über den Zeitraum |

### Einstieg

- **Fortschritt** in der Navigation öffnet den zuletzt benutzten Zeitraum; beim ersten Mal die letzten 90 Tage
  der zuletzt geschossenen Familie.
- **Aus einer Scheibe:** „im Verlauf zeigen“ öffnet den Zeitraum um diese Scheibe, ihr Punkt ist gewählt.
- **Aus der Scheiben-Liste:** Dieselbe Filterleiste (Familie, Art) gilt hier wie dort.

### Kopf

- **Zeitraum-Wähler** als Chip („Letzte 90 Tage ▾“), auf dem Telefon als Blatt:
  - rollende Vorgaben: letzte 30 Tage, letzte 90 Tage, letzte 12 Monate, alles
  - die benannten Zeiträume des Schützen
  - frei von … bis
  - „Als Zeitraum speichern“
- **Familie** (Pflicht), **Art** (alle, Training, Wettkampf), Wertung.
- **„vergleichen mit …“** (optional): der gleich lange Zeitraum davor, ein benannter Zeitraum, später ein Merkmal.
- **Ergebnis-Box** wie `CardResult`: Ø je Schuss groß, darunter Scheiben und Schüsse, Bestwert. Bei einem
  Vergleich steht dazu der Unterschied mit Urteil, etwa „+0,08 gegen den Zeitraum davor, nicht nachweisbar“.
- **Ein Satz**, die erste Erkenntnis des Zeitraums.

### Sprungleiste

„Verlauf · Scheiben · Zahlen · Analyse“, vier Felder in derselben Leiste wie auf der Scheibe.

### Verlauf (oben, fest im Bild ab 768 px)

- **Kennzahl wählbar:** Ø je Schuss (Vorgabe), σ̂, Zehnerquote, Tempo und weitere aus der Registry.
- **Darstellung:** Punkte je Scheibe, der gleitende Schnitt als Linie, das Formband als Fläche (T1, T2).
  Ab etwa 60 Scheiben fasst er nach Woche oder Monat zusammen.
- **Antippen** wählt eine Scheibe: Die Ablesung rechts (auf dem Telefon als Zeile unter dem Verlauf) zeigt
  Datum, Wert, eine kleine Scheibe und „Scheibe öffnen“. Dafür braucht es das Diagramm-Lineal
  ([[spiegel-mobile]], Schritt 5).
- **Mit Vergleich:** Der zweite Zeitraum liegt in einer zweiten, festen Farbe auf einer relativen Achse
  („Scheibe 1, 2, 3 … im Zeitraum“) über dem ersten. Getrennt nach Kalender ließen sich zwei Zeiträume nicht
  übereinanderlegen.

### Zahlen und Analyse

- **Zahlen:** Kacheln über den Zeitraum. Mit Vergleich stehen in jeder Kachel A, B und der Unterschied mit
  Urteil.
- **Reiter der Analyse**, jeweils mit Mindestzahl an Scheiben:

| Reiter | Inhalt | Katalog |
|---|---|---|
| Überblick | Beobachtungen in Worten über den Zeitraum | – |
| Ergebnis | Verteilung der Scheiben-Ø, Boden und Decke, Rekorde | T5, R1–R8 |
| Präzision | σ̂ im Verlauf, Langzeit-Trefferbild, Form über mehrere Scheiben | L9 |
| Lage | Lage über Zeit, Ausreißerrichtung, Richtungsuhr über alle Schüsse | L7, L10 |
| Zeit | Umfang und Kalender, Tempo gegen Wert, Tageszeit, Pause | T6, T7, Z6, Z7, K1–K5 |
| Probe | Versatz Probe → Wertung über Zeit, Anteil „eingeschossen“ | S1–S4 |

### Langzeit-Trefferbild

- **Zwei Sichten:** Bei **Form** ist jede Scheibe auf ihren eigenen Schwerpunkt geschoben; übrig bleibt die
  reine Streuung über die Abende. **Lage** zeigt die Schüsse, wo sie lagen; so wird ein Versatz sichtbar, der
  immer wiederkehrt.
- **Dichte statt Punkte:** Ab einigen hundert Schüssen zeigt das Bild die Dichte (Flächen oder Höhenlinien),
  nicht mehr jeden Schuss.

### Vergleich (eingebaut)

- **Einheit des Tests ist die Scheibe:** Je Seite gehen die Scheiben-Werte in den Test, nicht alle Schüsse
  zusammen (Welch-t oder Mann-Whitney auf den Scheiben-Ø, für Präzision σ̂ je Scheibe; C3, C5). Unter einer
  Mindestzahl an Scheiben je Seite steht „zu wenige Scheiben“ statt eines Urteils.
- **Bedeutsamkeit** (T3): Neben „echt“ steht, ob der Unterschied gegen die typische Schwankung ins Gewicht fällt.
- **Scheibe gegen Scheibe** (C2) ist derselbe Mechanismus: Ein Zeitraum kann eine einzelne Scheibe sein. Auf
  dem Langzeit-Trefferbild liegen dann zwei Gruppen in zwei Farben.

### Zeiträume des Schützen

- **Ein benannter Zeitraum** hat Name, Beginn, ein Ende (offen heißt „läuft noch“) und optional eine Familie.
  Er ist persönlich und wird nicht geteilt.
- **Anlegen** geht über „Als Zeitraum speichern“ im Wähler, ändern und löschen in einer Liste unter Fortschritt.
- **Im Datenmodell** ist er eine eigene Entität am Konto ([[spiegel-data-model]]).

### Telefon

Wie auf der Scheibe:

- Kopf, Sprungleiste mit vier Feldern, Verlauf in voller Breite, darunter die Ablesung als Zeile.
- Die Liste der Scheiben zeigt zehn und „Alle zeigen“, danach folgen Zahlen und Analyse.
- Der Zeitraum-Wähler öffnet sich als Blatt von unten.

### Rechnen

- **Werte je Scheibe:** Die Seite liest die vorberechneten Kennzahlwerte je Scheibe (Projektion im
  [[spiegel-data-model]]) und rechnet nicht alle Schüsse im Browser neu.
- **Langzeit-Trefferbild:** Es braucht Schüsse, bei langen Zeiträumen Tausende. Der Server liefert dafür ein
  Dichteraster.
- **Ausreißer:** Der schrittweise Test braucht O(n³/10) und ist nur je Scheibe gedacht. Über Zeiträume zählen
  die Ausreißer je Scheibe.

## Bauschritte (Vorschlag)

| Schritt | Inhalt | Roadmap |
|---|---|---|
| L1 | Diagramm-Lineal: Werte per Antippen, Kopplung an die Auswahl (erledigt, 8. Oktober 2026) | SP-1.8, Schritt 5 |
| L2 | Fachkern: Werte je Scheibe → Verlauf, gleitender Schnitt, Formband, Boden und Decke, Vergleich zweier Zeiträume mit Test und Bedeutsamkeit, Rekorde; mit Simulationen (erledigt, 8. Oktober 2026: `shot-core/analysis/period.ts` und `records.ts`, Entscheidungen D1–D9 im Plan `plans/2026-10-08-spiegel-zeitraum-kern.md`, Belege B19 und B20) | SP-2.1, SP-2.2 |
| L3 | Bausteine: Zeitraum-Wähler, Verlauf-Diagramm, Ablesung einer Scheibe, Liste der Scheiben, Kacheln mit Vergleich, Seite eines Zeitraums. Im Labor eine erfundene Saison (etwa 80 Scheiben über sechs Monate mit Formknick und Munitionswechsel) (erledigt im Labor, 9. Oktober 2026: `shot-ui/period/*`, `PeriodPage`, Saison in `tools/labor`; Plan `plans/2026-10-09-spiegel-zeitraum-seite.md`) | SP-2.1 |
| L4 | Langzeit-Trefferbild mit Form, Lage und Dichte | SP-2.7 |
| L5 | Erkenntnisse Reiter für Reiter, jede mit Mindestzahl und Simulation | SP-2.7 |
| L6 | Benannte Zeiträume speichern; Merkmal-Vergleich nach SP-2.3 | SP-2.2, SP-2.3 |

## Umgesetzt in L3 (9. Oktober 2026)

Das Konzept oben genauer, wie es im Labor steht (Entscheidungen D1–D18 im Plan):

- **Verlauf:** Kennzahl über einen Umschalter (Ø je Schuss, σ, Zehner, Tempo; nur Kennzahlen, die nicht an der
  Schusszahl hängen). Ab 60 Scheiben „je Monat“ mit Median und Boden bis Decke, bis der Schütze selbst wählt;
  Boden ist das schwächere Ende (bei σ das P90), beim Tempo nur die Spanne. Mit Vergleich beide Zeiträume auf
  „Scheibe 1, 2, 3 …“, der Vergleich grau und hohl.
- **Abstand zum Schnitt** (Liste, Ablesung): zu den bis zu fünf Scheiben davor, ohne die Scheibe selbst, auch über
  den Anfang des Zeitraums hinweg.
- **Ergebnis-Box:** Ø je Schuss als Mittel der Scheiben, Wertungsschüsse, die beste Scheibe unter der häufigsten
  Schusszahl (eine kurze Scheibe hätte es sonst leichter).
- **Zahlen:** sechs Kacheln (Mittel je Scheibe), mit Vergleich Wert dort, Δ und Urteil; „bedeutsam“ nur neben
  einem Urteil.
- **Analyse in L3:** „Gegen deinen Schnitt“ (über alle Scheiben der Familie bis zur neuesten im Zeitraum) und
  „Rekorde“ (über alle Scheiben der Familie). Reiter kommen mit L4 und L5.
- **Training nur aus Probe** zählt als Vorgabe mit (Schalter „mit Training nur aus Probe“ an), denn so
  trainieren die meisten (User, 9. Oktober 2026); im Fachkern bleibt `includeProbeOnly` eine Option, die Seite setzt sie als Vorgabe.
- **Nicht in L3:** „Als Zeitraum speichern“ (L6), Kalender (T7), Trendsteigung (T4), Langzeit-Trefferbild (L4).

### Nach U2 (9. Oktober 2026)

Aus der Durchsicht ([[spiegel-durchsicht]], Plan `plans/2026-10-09-spiegel-fortschritt-besser.md`):

- **Der Satz beantwortet „Werde ich besser?“:** ohne gewählten Vergleich still gegen den Zeitraum davor, bei „Alles“
  die letzten 90 Tage gegen die 90 davor; Verlauf und Ergebnis-Box zeigen einen Vergleich nur, wenn er gewählt ist.
- **Ein Bezug für eine Scheibe:** der Schnitt der fünf davor. Die Karte „Gegen deinen Schnitt“ (30 Tage, Platz unter
  den letzten 50) entfiel; ihr „?“ steht an der Ablesung („Abstand zum Schnitt davor“).
- **Eine Zeile Bedienung:** Familie als Segment, dahinter ein Chip („Letzte 90 Tage · Training · mit Zeitraum
  davor“), der das Blatt „Filter“ öffnet: Zeitraum, Vergleich, Art, „Trainings nur aus Probe mitzählen“.
- **Kein Schalter der Wertung:** Der Fortschritt zeigt die Wertung des Geräts; sie steht in Profil.
- **Rekorde:** oben höchstens fünf aus dem Zeitraum, darunter zugeklappt „Alle Rekorde (n)“.
- Auf dem Telefon (390 × 844) 3,97 statt 4,7 Bildschirme.

## Vorgaben (vom User bestätigt, 8. Oktober 2026)

- **Beim ersten Öffnen** die letzten 90 Tage: Sie zeigen Form und Trend, ohne alte Abende zu mischen.
- **Kennzahl des Verlaufs** ist Ø je Schuss: verständlich und von der Schusszahl unabhängig.
- **Langzeit-Trefferbild** startet in der Sicht **Form**: Sie beantwortet „Wie eng schieße ich?“ ohne die
  Wanderung der Lage.
- **Ein Vergleich urteilt** ab fünf Scheiben je Seite; die Simulation in L2 bestätigt die Zahl (B19: Fehlalarm höchstens etwa 5 %, eine Verengung von 1,5 auf 1,3 mm erkennt der Vergleich bei 5 gegen 5 Scheiben in gut der Hälfte, bei 10 gegen 10 in gut neun von zehn Fällen). „Bedeutsam“ zeigt die Oberfläche nur neben einem Urteil: Ohne Veränderung trifft es bei 5 gegen 5 Scheiben in etwa sechs von zehn Fällen zu.
