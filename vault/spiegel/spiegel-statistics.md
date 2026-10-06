---
id: spiegel-statistics
type: concept
title: "Spiegel — Statistik-Katalog"
aliases: [statistik-katalog, statistiken, analyse-katalog, profi-analyse]
keywords: [statistik, statistiken, kennzahl, analyse, profi, systematisch trainieren, trefferbild, präzision, streuung, sigma, rayleigh, cep, r50, mittlerer radius, streukreis, trefferkreis, extreme spread, höhe, breite, ellipse, schwerpunkt, trefferlage, hotelling, vertrauensbereich, wilson, ringverlust, lageverlust, richtungsuhr, ausreißer, drift, von neumann, ringverteilung, zähler, histogramm, tempo, rhythmus, pause, ermüdung, trend, theil-sen, gleitender schnitt, serien, probe, eingeschossen, rekorde, verlauf, formband, vergleich, munitionslos, wettkampf, druck, soll-schnitt, beobachtungen, esta 5, ballistic manager, shotsapp, ring reader, targetscan, scatt, shotanalyzer, kongsberg, sius]
part_of: ["[[spiegel]]"]
relates_to: ["[[spiegel-metrics]]", "[[spiegel-ui-design]]", "[[spiegel-edge-cases]]", "[[spiegel-vision]]", "[[statistics-visualization]]", "[[meyton-printout]]"]
---

**TL;DR** Alle Statistiken, die Spiegel mit Meyton-Rohdaten sinnvoll zeigen kann: 99 Kennzahlen in 13 Themen, je mit Definition, Priorität und Platz in der Roadmap. Was eine einzelne Scheibe hergibt, rechnet der Fachkern seit SP-1.10; Verläufe, Rekorde und Vergleiche über Zeiträume folgen in Phase 2. Leitbild ist ein Profi-Werkzeug zum systematischen Trainieren und Analysieren, das jede Zahl ehrlich zeigt: mit n, Unsicherheit und dem Hinweis „unklar“, wenn die Daten nicht reichen.

# Spiegel — Statistik-Katalog

## Leitbild

Der User will ein Profi-Werkzeug, „das mir viele gute Informationen zeigt, mit denen ich systematisch trainieren kann und mit dem ich analysieren kann“ (6. Oktober 2026). Daraus folgt:

- **Viel, aber geordnet:** Statistiken nach Themen, das Wichtigste (Priorität A) zuerst, der Rest auf Antippen.
- **Ehrlich:** Jede Zahl steht auf einer sichtbaren Grundlage (n, Zeitraum, Filter). Unter der Mindestzahl steht „–“ mit Grund, Unsicherheit wird gezeigt, und „unklar“ ist ein normales Ergebnis.
- **Handlungsnah:** Wo es geht, sagt die Statistik, was zu tun ist („Lage echt, zentriert wären es 2,4 Ringe mehr“) statt nur Zahlen zu liefern.
- **Messdaten, kein Tagebuch:** Ziele, Absicht, Reflexion und Befinden bleiben laut [[adr-026]] in Treffsicher. Spiegel liefert die Messung, Übungen mit messbarem Kriterium und die Auswertung.

## Notation

vᵢ ist der Zehntelwert, Ringᵢ der ganze Ring, n die Zahl der zählenden Schüsse. Lage pᵢ in mm (Mitte 0, x rechts, y oben); Schwerpunkt m = (x̄, ȳ); rᵢ = |pᵢ − m|, dᵢ = |pᵢ| (Teiler = dᵢ in 1/100 mm). Sx, Sy mit n − 1. W ist der Ringabstand (LG 2,5 mm, LP 8 mm). Ebenen: Schuss, Serie, Scheibe, Zeitraum. Priorität A (früh, großer Nutzen), B (später), C (schön zu haben). Spalte „Wo“: Roadmap-Feature oder „vorhanden“ (seit SP-1.2 in der Registry).

## Was es schon gibt

- **Spiegel** (`packages/shot-core`): die Registry aus [[spiegel-metrics]] mit Ergebnis und Ø je Schuss (ganze Ringe und Zehntel), Zehnern, Innenzehnern, bestem Teiler, Schwerpunkt-Abstand, Streukreis, mittlerem Radius, R50, Streuung x/y, Tempo, längster Pause und Versatz Probe → Wertung.
- **Treffsicher** ([[statistics-visualization]]): Übersicht je Disziplin, Ergebnisverlauf mit gleitendem Schnitt und Band, Min/Max/Ø je Serienposition, Trefferlage je Einheit (aus dem PDF) als Wolke und Verlauf, Ringverteilung, Befinden-Korrelation, Prognose und Feedback.
- **Meyton:** der Ausdruck ([[meyton-printout]]: Zähler, Innenzehner, beste und weiteste Teiler, Trefferkreis, Trefferlage, je Schuss Wert und Richtungspfeil). Die Treffer-Statistik in ESTA 5 nennt Schwerpunkt, Trefferkreis („der kleinste Kreis, der alle Treffer einschließt“) samt Mittelpunkt, Höhe und Breite, Ø Entfernung zur Mitte und Abstände von Treffer zu Treffer; der Ballistic Manager zusätzlich Sx, Sy, Sa (Rayleigh-σ), den Abstand aufeinanderfolgender Treffer und die Wanderung des Schwerpunkts.
- **Fremde Werkzeuge:** DISAG ShotsApp (Umkreis und Mittelpunkt je Serie, Rhythmus-Grafik „Schüsse über Zeit“), Kongsberg (MPI, Extreme Spread, kleinster Kreis und kleinstes Rechteck), SIUS BTS (MPI, Höhe/Breite), SCATT (Intervalle, nur der Teil ohne Zielverlauf), ShotAnalyzer (Munitionstest, Spiele wie „Bleib drüber“ und Soll-Schnitt), Ring Reader (CEP50, korrigiertes Ergebnis, Erkenntnisse wie Schussposition, Reaktion nach Fehler, Training gegen Wettkampf, Ausreißerrichtungen, Bedingungen), TargetScan (Ringverlust durch Lage gegen Gruppengröße), Ballistic X (MR, CEP, Korrektur auf Null).

## Katalog

### 1 Ergebnis

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| E1 | Ergebnis | Σ Ringᵢ bzw. Σ vᵢ der Wertung; Summe nur für vollständige Scheiben (SF-07) | Serie, Scheibe | A | vorhanden |
| E2 | Ø je Schuss | Σ vᵢ / n, in beiden Wertungen | Serie, Scheibe, Zeitraum | A | vorhanden |
| E3 | Hochrechnung | Ø je Schuss × Soll-Schusszahl; nie als Rekord (SF-09) | Scheibe | B | SP-1.8 |
| E4 | Zehner und Zehnerquote | Anzahl Ring 10; Quote mit Wilson-Intervall | Serie, Scheibe, Zeitraum | A | vorhanden (Anzahl), SP-1.10 (Quote) |
| E5 | Innenzehner und Quote | LG und LP nicht vergleichbar | Serie, Scheibe, Zeitraum | A | vorhanden |
| E6 | Bester und schwächster Schuss | max/min vᵢ mit Schussnummer, ohne verdächtige | Serie, Scheibe | A | SP-1.10 |
| E7 | Teiler-Schnitt und -Median | Mittel und Median der dᵢ | Serie, Scheibe, Zeitraum | B | SP-1.10 |
| E8 | Beste und weiteste Teiler | je drei mit Schussnummer, wie auf dem Ausdruck | Serie, Scheibe | B | SP-1.10 |
| E9 | Ringverlust | n·10 − ΣRing bzw. n·10,9 − Σvᵢ | Serie, Scheibe | B | SP-1.10 |
| E10 | Konstanz | SD und Spanne der Serien gleicher Länge, MAD der vᵢ | Scheibe, Zeitraum | A | SP-1.10 |
| E11 | Anteil über Schwelle | Anteil vᵢ ≥ s mit Wilson-Intervall | Serie, Scheibe, Zeitraum | B | SP-1.10 |

### 2 Trefferbild und Präzision

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| P1 | Streukreis (Meyton: Trefferkreis) | kleinster Kreis um alle Trefferzentren; wächst mit n | Serie, Scheibe | A | vorhanden |
| P2 | Extreme Spread | größter Abstand zweier Treffer | Serie, Scheibe | C | Funktion `extremeSpread` |
| P3 | Mittlerer Radius | (1/n) Σrᵢ; Erwartungswert wächst mit √((n−1)/n) | Serie, Scheibe, Zeitraum | A | vorhanden |
| P4 | R50 (≈ CEP50) | Median der rᵢ ohne Fehlschüsse | Serie, Scheibe, Zeitraum | A | vorhanden |
| P5 | Rayleigh-σ (Meyton: Sa) | Sa = √(Σrᵢ²/(2(n−1))), σ̂ = Sa/c4(2n−1), 95-%-Bereich über χ² mit 2(n−1) Freiheitsgraden; kaum n-abhängig | Scheibe, Zeitraum | B | SP-1.10 |
| P6 | Streuung x und y | Sx und Sy | Serie, Scheibe, Zeitraum | A | vorhanden |
| P7 | Höhe und Breite | max − min in y und x, dazu (H + B)/2 | Serie, Scheibe | B | SP-1.10 |
| P8 | Form der Gruppe | Halbachsen und Winkel der Kovarianz-Ellipse, Verhältnis a/b; Winkel nur ab 10 Schuss und a/b > 1,3 | Scheibe, Zeitraum | B | SP-1.10 |
| P9 | Streuung in Ringbreiten | MR / W | Scheibe, Zeitraum | B | SP-1.10 |
| P10 | Erwartete Zehnerquote | P(d ≤ W) für eine Normalgruppe mit σ̂ und m (Modell) | Scheibe, Zeitraum | C | später |

### 3 Lage und Systematik

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| L1 | Schwerpunkt (Meyton: Trefferlage) | m mit Richtung; nach „Visier verstellt“ getrennt (SF-63) | Serie, Scheibe, Zeitraum | A | SP-1.10 |
| L2 | Schwerpunkt-Abstand | |m|; der Schwerpunkt selbst ist unsicher (aus 10 Schuss ≈ 0,4σ) | Serie, Scheibe, Zeitraum | A | vorhanden |
| L3 | Ist die Lage echt? | Hotelling-T² gegen F(2, n−2), 95-%-Ellipse um m | Scheibe, Zeitraum | A | SP-1.10 |
| L4 | Ringe durch Lage gegen Streuung | Lagen um −m verschieben und neu werten: Lage- und Streuungsverlust; erst ab 10 Schuss und wenn L3 „echt“ sagt; nie amtlich | Serie, Scheibe, Zeitraum | A | SP-1.10 |
| L5 | Lageanteil am Fehler | Anteil von |m|² am mittleren quadratischen Abstand, Schätzrauschen abgezogen | Scheibe, Zeitraum | B | SP-1.10 |
| L6 | Richtungsuhr | Anteil je Uhrzeit (30°-Sektor) um die Mitte oder um m; ab etwa 30 Schuss | Scheibe, Zeitraum | B | SP-1.10 |
| L7 | Ausreißerrichtung | Richtungsuhr der schwächsten 10 % relativ zu m | Zeitraum | B | SP-2.7 |
| L8 | Drift in der Abgabefolge | Ø und größter Sprung, von-Neumann-Verhältnis (≈ 2 unabhängig, < 2 Wandern) | Scheibe | C | SP-1.10 |
| L9 | Langzeit-Trefferbild | alle Schüsse eines Zeitraums als Dichte, je Familie | Zeitraum | B | SP-2.7 |
| L10 | Lage über Zeit | Schwerpunkt je Scheibe als Wolke mit Pfad, nach n gewichtet | Zeitraum | B | SP-2.7 |
| L11 | Visierkorrektur in Klicks | −m / Klickweg; nur wenn L3 „echt“ sagt | Scheibe | C | SP-2.3 (Ausrüstung) |

### 4 Verteilung

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| V1 | Ringverteilung (Zähler) | Anzahl je Ring 10…0 plus Innenzehner; Histogramm, keine Torte | Serie, Scheibe, Zeitraum | A | SP-1.10 |
| V2 | Zehntelverteilung | Histogramm der vᵢ in 0,1-Klassen | Scheibe, Zeitraum | B | SP-1.10 |
| V3 | Abstandskurve | Anteil der Schüsse mit Teiler ≤ t | Zeitraum | B | SP-2.1 |
| V4 | Verteilung der Serien | Quartile der Serienergebnisse je Monat | Zeitraum | B | SP-2.1 |
| V5 | Ringanteile im Zeitverlauf | Anteil je Ring je Scheibe, gestapelt | Zeitraum | B | SP-2.1 |
| V6 | Ausreißer | rᵢ > Q3 + 1,5·IQR; Verhältnis MR/R50 (≈ 1,06 bei runder Gruppe) | Scheibe, Zeitraum | B | SP-1.10 |
| V7 | Ringverlust durch Ausreißer | Σ(Median − vᵢ) über die schwächsten 10 % | Scheibe, Zeitraum | B | SP-1.10 |

### 5 Zeit und Rhythmus

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| Z1 | Tempo | Median der Intervalle ohne Pausen | Serie, Scheibe, Zeitraum | A | vorhanden |
| Z2 | Tempo-Konstanz | IQR der Intervalle, auch relativ zum Median; konstanter ist nicht automatisch besser | Scheibe, Zeitraum | A | SP-1.10 |
| Z3 | Dauer und Netto-Schießzeit | erster bis letzter Schuss; netto ohne Pausen; Schüsse je Stunde | Scheibe, Zeitraum | A | SP-1.10 |
| Z4 | Pausen und Wiedereinstieg | Anzahl, Summe, längste; Ø der drei Schüsse nach einer Pause gegen den Scheiben-Ø | Scheibe, Zeitraum | A | vorhanden (längste), SP-1.10 |
| Z5 | Rhythmus-Profil | gleitender Median der Intervalle über die Schussnummer | Scheibe | B | SP-1.10 |
| Z6 | Tempo und Wert | Ø vᵢ je Klasse des Intervalls davor; einige hundert Schuss | Zeitraum | B | SP-2.7 |
| Z7 | Tempo nach schwachem Schuss | Intervall nach schwachen gegen nach übrigen Schüssen | Zeitraum | C | SP-2.7 |
| Z8 | Zeitbedarf für die Disziplin | Netto-Tempo × Soll-Schusszahl gegen ein gepflegtes Zeitlimit | Scheibe, Zeitraum | C | später |

### 6 Verlauf in der Einheit

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| I1 | Serienkurve | Serienergebnisse in Reihenfolge; im Zeitraum Min/Max/Ø je Position | Scheibe, Zeitraum | A | SP-1.10 |
| I2 | Ermüdung | Ø der letzten zehn minus der ersten zehn, R50 ebenso; als Muster erst über mehrere Scheiben | Scheibe, Zeitraum | A | SP-1.10 |
| I3 | Trend in der Scheibe | Theil-Sen-Steigung je zehn Schuss mit Intervall; „klar“ nur ohne 0 im Intervall | Scheibe | B | SP-1.10 |
| I4 | Gleitender Schnitt | Ø der letzten bis zu zehn Schüsse | Scheibe | A | SP-1.10 |
| I5 | Streuung im Verlauf | R50 je Serie | Scheibe | B | SP-1.10 |
| I6 | Schwerpunkt-Wanderung | Schwerpunkt je Serie und Abstand zum Scheiben-Schwerpunkt | Scheibe | B | SP-1.10 |
| I7 | Schussposition in der Serie | Ø vᵢ je Position 1…10 über viele Serien | Zeitraum | B | SP-2.7 |
| I8 | Reaktion nach schwachem Schuss | Folgeschuss nach schwachen gegen nach übrigen, gepaart je Scheibe | Zeitraum | B | SP-2.7 |
| I9 | Erster Wertungsschuss | Wert minus Scheiben-Ø; nur als Muster | Scheibe, Zeitraum | B | SP-2.7 |
| I10 | Längste Folge über Schwelle | längste Folge vᵢ ≥ s | Scheibe, Zeitraum | B | SP-1.10 |

### 7 Probe und Wertung

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| S1 | Versatz Probe → Wertung | letzte fünf Probeschüsse vor der Wertung gegen die Wertung | Scheibe | A | vorhanden |
| S2 | Probe-Umfang | Zahl, Blöcke à zehn, Dauer, Zeit bis zum ersten Wertungsschuss | Scheibe, Zeitraum | A | SP-1.10 |
| S3 | Probe-Qualität | Ø und R50 der Probe (nach der letzten Verstellung) gegen die Wertung | Scheibe, Zeitraum | B | SP-1.10 |
| S4 | Eingeschossen? | Lage der letzten fünf Probeschüsse mit Vertrauensbereich wie L3 | Scheibe | C | SP-1.10 |
| S5 | Visierverstellungen | Anzahl und Lagesprung je Verstellung (`segmentGroups`) | Scheibe, Zeitraum | C | SP-2.3 |

### 8 Langzeit und Trend

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| T1 | Verlauf jeder Kennzahl | Wert je Scheibe, Woche oder Monat mit gleitendem Schnitt; Familie Pflicht, n-abhängige Maße nur bei gleichem n | Zeitraum | A | SP-2.1 |
| T2 | Formband | typische Schwankung um den gleitenden Schnitt | Zeitraum | A | SP-2.1 |
| T3 | Bedeutsame Veränderung | Unterschied zweier Zeiträume gegen die typische Schwankung (lohnend ab 0,3 ×, Hopkins) | Zeitraum | B | SP-2.7 |
| T4 | Trendsteigung | Theil-Sen je Monat mit Intervall; nicht in die Zukunft verlängern | Zeitraum | B | SP-2.7 |
| T5 | Boden und Decke | P10, Median und P90 der Scheiben-Ø je Monat | Zeitraum | B | SP-2.1 |
| T6 | Trainingsumfang | Schüsse, Scheiben, Einheiten, Netto-Zeit je Woche | Zeitraum | A | SP-2.1 |
| T7 | Kalender | Trainingstage als Kalender | Zeitraum | B | SP-2.1 |
| T8 | Erfolgsserien | Wochen in Folge mit Training, Scheiben über dem eigenen Schnitt | Zeitraum | C | SP-2.8 |

### 9 Rekorde und Meilensteine

Nur endgültige, vollständige Wertung, ohne die Merkmale verdächtig, nur-pdf, neu-gewertet und ausgenommen (SF-15, SF-66); je Familie und je Wertung, wahlweise getrennt nach Training und Wettkampf.

| ID | Kennzahl | Prio | Wo |
|---|---|---|---|
| R1 | Beste Scheibe je Schusszahl | A | SP-2.1 |
| R2 | Beste Serie | A | SP-2.1 |
| R3 | Bester Teiler | A | SP-2.1 |
| R4 | Engste Gruppe über genau zehn Schuss und über die volle Scheibe | A | SP-2.1 |
| R5 | Bester Schuss, Zahl der 10,9 | B | SP-2.1 |
| R6 | Meiste Zehner und Innenzehner | B | SP-2.1 |
| R7 | Längste Zehnerfolge | B | SP-2.1 |
| R8 | Beste Form (Ø über fünf Scheiben) | C | SP-2.1 |
| R9 | Meilensteine (1 000 Schuss, erste 10,9, Abstand zum Rekord) | C | SP-2.8 |

### 10 Vergleiche

| ID | Kennzahl | Definition | Prio | Wo |
|---|---|---|---|---|
| C1 | Serie gegen Serie | alle Serien mit jeder Kennzahl, beste und engste markiert | A | SP-1.8 |
| C2 | Scheibe gegen Scheibe | zwei Gruppen auf einer Scheibe, Tabelle mit Δ | A | SP-2.2 |
| C3 | Zeitraum gegen Zeitraum | Ø je Scheibe mit Intervall, Abstandskurven übereinander | A | SP-2.2 |
| C4 | Gegen den eigenen Schnitt | Δ zum 30-Tage-Schnitt, Perzentil unter den letzten 50 | A | SP-2.2 |
| C5 | Merkmal A gegen B | Welch-t, Mann-Whitney, F-Test; Urteil besser, schlechter oder unklar | B | SP-2.2 nach SP-2.3 |
| C6 | Vorher/Nachher | Scheiben vor und nach einem Ereignis, gegen den Trend geprüft | B | SP-2.2 nach SP-2.3 |
| C7 | Schütze gegen Schütze | nur mit beidseitiger Freigabe, nur je Schuss normiert | C | SP-3.2 |

### 11 Kontext

| ID | Kennzahl | Definition | Prio | Wo |
|---|---|---|---|---|
| K1 | Munitionslos und Ausrüstung | σ̂ mit Intervall je Los, am besten aus Auflage-Scheiben; 30–40 Schuss je Los | B | SP-2.7 |
| K2 | Tageszeit | Ø je Schuss nach Startzeit; am Vereinsabend kaum messbar | C | SP-2.7 |
| K3 | Wochentag | hängt an Training oder Wettkampf | C | SP-2.7 |
| K4 | Trainingspause | Ø je Schuss gegen die Tage seit der letzten Einheit | C | SP-2.7 |
| K5 | Stand | eigene Werte je Stand; für den Admin der Schwerpunkt je Stand über alle Freigaben (Messrahmen), nur aggregiert | C | SP-2.7 |
| K6 | Befinden | Korrelation mit Schlaf, Energie, Stress nur über Treffsicher | C | SP-3.1 |

### 12 Wettkampf und Druck

| ID | Kennzahl | Definition | Prio | Wo |
|---|---|---|---|---|
| W1 | Wettkampf-Abschlag | Ø und R50 im Wettkampf minus Training (Meyton-Status) | A | SP-2.7 |
| W2 | Schlussphase | letzte Serie minus Ø der übrigen, Wettkampf gegen Training | B | SP-2.7 |
| W3 | Startphase | erste Serie minus Ø der übrigen | B | SP-2.7 |
| W4 | Tempo unter Druck | Tempo und Tempo-Konstanz im Wettkampf gegen Training | B | SP-2.7 |
| W5 | Soll-Schnitt zum Ziel | (Ziel − bisher) / Restschüsse; nachträglich, ab wann das Ziel außer Reichweite war | B | SP-2.8 |
| W6 | Zielwahrscheinlichkeit | Anteil der letzten N Scheiben, die das Ziel erreichten, mit Wilson | C | SP-2.8 |

### 13 Datenlage

| ID | Kennzahl | Definition | Prio | Wo |
|---|---|---|---|---|
| Q1 | Datenlage | Wertung, Probe, ohne Lage, ohne Zeit, Merkmale; als dezente Zeile unter jeder Ansicht | A | SP-1.10 |

## Mit unseren Daten nicht möglich

- **Zielverlauf** (SCATT, Noptel): Halteraum, Zielweg, Zielzeit, Nachhalten, Durchsacken. Allein die Gewehrstabilität erklärt in einer Übersichtsarbeit gut die Hälfte der Varianz; für Spiegel ist sie unsichtbar.
- **Abzug:** Abzugsdruck, Sauberkeit der Auslösung.
- **Körper:** Herzfrequenz, Atmung, Körperschwankung.
- **Waffe und Umgebung:** Verkanten, Laufbewegung, Geschossgeschwindigkeit; Licht und Temperatur allenfalls als Tag.
- **Reine Zielzeit:** Wir kennen nur Abgabezeitpunkte; jedes Intervall enthält Laden, Absetzen und Zielen.
- **Mentales und Befinden:** bleiben in Treffsicher ([[adr-026]]).
- **Scheiben nur aus dem PDF:** ohne Lage und Zeit nur Wert-Kennzahlen.

## Ehrliche Zahlen

- **Mindestzahl, sonst „–“** (SF-61): Streukreis und mittlerer Radius ab 3, aussagekräftig ab 10; R50 ab 5; Form ab 10; Erkenntnisse über Zeiträume (Schussposition, Reaktion nach Fehler, Tempo gegen Wert) erst ab einigen hundert Schuss oder 20 Ereignissen.
- **Unsicherheit zeigen:** σ über χ², Lage über Hotelling, Quoten über Wilson, Trends über Theil-Sen. Bei 10 Schuss ist der 95-%-Bereich für σ fast so breit wie σ selbst; für ±10 % braucht es rund 80 Schuss.
- **Gleiches n:** Streukreis, Extreme Spread, Höhe/Breite, bester Teiler und längste Folge wachsen mit n; mittlerer Radius und R50 schrumpfen leicht bei kleinem n (Faktor √((n − 1)/n)). σ̂ ist das stabilste Maß für Verläufe über unterschiedliche Schusszahlen.
- **Robust als Standard in Verläufen:** Median, R50, MAD, Quantilbänder.
- **Nur Gleiches vergleichen:** gleiche Familie, gleiche Wertung; mm-Werte von LG und LP nie.
- **Viele Vergleiche erzeugen Zufallstreffer:** Mindest-n, Korrektur (Holm oder Benjamini-Hochberg) oder nur als Hinweis formulieren.
- **Regression zur Mitte und Auswahl:** Nach einem Rekord ist die nächste Scheibe meist schwächer; „beste Serie“ und korrigiertes Ergebnis sind aus denselben Daten gewählt und optimistisch.
- **Bedeutsamkeit statt Signifikanz:** lohnend ab 0,3 × der typischen Schwankung (Hopkins); „unklar“ ist ehrlich.
- **Transparenz:** jede Zahl mit n, Zeitraum, Filter und Kennzahl-Version; Modellwerte als Modell gekennzeichnet.

## Beobachtungen in Worten (Beispiele)

1. „Serie 3 war deine engste (R50 1,9 mm), Serie 4 streut 34 % weiter.“ — nur bei gleicher Schusszahl und mindestens 20 % Unterschied.
2. „Dein Schwerpunkt liegt 1,8 mm links, bei 40 Schuss ist das kein Zufall. Zentriert wären es rund 2,4 Ringe mehr gewesen.“ — nur wenn L3 „echt“ sagt und n ≥ 10.
3. „Die letzten zehn Schuss waren je Schuss 0,21 schwächer als die ersten zehn, in 6 deiner letzten 8 Trainings war das so.“ — als Muster erst ab fünf Scheiben.
4. „Drei Abreißer nach rechts unten kosteten dich 2,1 Ringe.“
5. „Deine Probe war enger als die Wertung (R50 1,6 gegen 2,3 mm).“ — gleiches n.
6. „Diese Scheibe ist besser als 85 % deiner letzten 50.“ — ab 20 Vergleichsscheiben.
7. „Seit dem neuen Munitionslos ist dein mittlerer Radius 0,2 mm kleiner, das liegt noch in der normalen Schwankung.“

## Quellen

Geöffnet bei der Recherche am 6. Oktober 2026:

- Meyton: ESTA 5 Treffer-Statistik <https://support.meyton.info/files/de-DE/252126475356976395.html>; Ballistic Manager, Werte von Treffern <https://support.meyton.info/files/de-DE/374244747378960523.html>; Beschreibung einer Serie <https://support.meyton.info/files/de-DE/43582475372880395.html>; Beschreibung vom Ergebnis <https://support.meyton.info/files/de-DE/43757579372885387.html>; Trefferwertungen <https://support.meyton.info/files/de-DE/53715723360817163.html>
- DISAG: <https://www.shotsapp.de/>, <https://apps.apple.com/de/app/disag-shotsapp/id1658745651>, OpticScore <https://www.sg-wahrenholz.de/images/sgw/opticscore.pdf>
- Kongsberg: <https://docs.kongsbergtargets.com/en_US/shooter/understanding-series-statistics>
- SIUS: <https://sius.be/files/SIUSBTS.pdf>, <https://support.sius.com/wp-content/uploads/2023/04/Manual-for-SIUSData-_-SIUSData-EN-V1.pdf>
- SCATT: <https://www.scatt.com/pages/scatt-professional-software>, <https://www.scatt.com/pages/scatt-basic-software>
- ShotAnalyzer: <http://dot4you.ch/wp-content/uploads/2018/11/ShotAnalyzer_Handbuch-1.pdf>
- Ring Reader: <https://ringreader.app/guide/de/statistiken>, <https://ringreader.app/guide/de/zahlen-interpretieren>, <https://ringreader.app/guide/de/ergebnis-ansehen>, <https://meisterschuetzen.org/forum/thread/13078-ring-reader-ergebnisanalyse-und-trainingstagebuch/>
- TargetScan: <https://apps.apple.com/us/app/targetscan-pistol-rifle/id448045769>, <https://targetshootingapp.com/wiki/Shooting_Group_Statistics/>
- Ballistic X: <https://apps.apple.com/us/app/ballistic-x/id1441335342>
- Statistik: Ballistipedia <http://ballistipedia.com/index.php?title=FAQ>, <http://ballistipedia.com/index.php?title=Closed_Form_Precision>; Precision Rifle Blog <https://precisionrifleblog.com/2020/12/12/measuring-group-size-statistics-for-shooters/>; shotGroups <https://cran.r-project.org/web/packages/shotGroups/vignettes/shotGroups.pdf>; Tschannen <https://mittelkaliber.ch/wp-content/uploads/2015/12/Artikel_Statistik_M.Tschannen.pdf>; Hopkins <https://www.sportsci.org/jour/04/wghtests.htm>; von-Neumann-Test <https://search.r-project.org/CRAN/refmans/DescTools/html/VonNeumannTest.html>
- Sportwissenschaft: Bale et al. 2026 <https://shura.shu.ac.uk/37490/1/Davids-AnEcologicalDynamicsInterpretation(VoR).pdf>; Übersicht 2021 <https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0247353>; Loch et al. 2023 <https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2023.1087995/full>; Post-Error-Slowing <https://pmc.ncbi.nlm.nih.gov/articles/PMC9286459/>; Hot Hand <https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0261890>
