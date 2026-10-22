---
id: spiegel-statistics
type: concept
title: "Spiegel — Statistik-Katalog"
aliases: [statistik-katalog, statistiken, analyse-katalog, profi-analyse]
keywords: [statistik, statistiken, kennzahl, analyse, profi, systematisch trainieren, trefferbild, präzision, streuung, sigma, rayleigh, cep, r50, mittlerer radius, streukreis, trefferkreis, extreme spread, höhe, breite, ellipse, schwerpunkt, trefferlage, hotelling, vertrauensbereich, wilson, ringverlust, lageverlust, richtungsuhr, ausreißer, drift, von neumann, ringverteilung, zähler, histogramm, tempo, rhythmus, pause, ermüdung, trend, theil-sen, gleitender schnitt, serien, probe, eingeschossen, rekorde, verlauf, formband, vergleich, munitionslos, wettkampf, druck, soll-schnitt, beobachtungen, esta 5, ballistic manager, shotsapp, ring reader, targetscan, scatt, shotanalyzer, kongsberg, sius]
part_of: ["[[spiegel]]"]
relates_to: ["[[spiegel-metrics]]", "[[spiegel-ui-design]]", "[[spiegel-edge-cases]]", "[[spiegel-vision]]", "[[statistics-visualization]]", "[[meyton-printout]]"]
---

**TL;DR** Alle Statistiken, die Spiegel mit Meyton-Rohdaten sinnvoll zeigen kann: 99 Katalog-IDs in 13 Themen (6 davon entfernt), je mit Definition, Priorität und Platz in der Roadmap. Was eine einzelne Scheibe hergibt, rechnet der Fachkern (SP-1.10); Verläufe, Rekorde und Vergleiche über Zeiträume sind zum Teil gebaut (Phase 2). Leitbild ist ein Profi-Werkzeug zum systematischen Trainieren und Analysieren, das jede Zahl ehrlich zeigt: mit n, Unsicherheit und dem Hinweis „unklar“, wenn die Daten nicht reichen.

# Spiegel — Statistik-Katalog

## Leitbild

Leitbild ist ein Profi-Werkzeug, das viele gute Informationen zeigt, mit denen man systematisch trainieren und analysieren kann ([[spiegel-vision]]). Daraus folgt:

- **Viel, aber geordnet, und nichts doppelt:** Statistiken nach Themen, das Wichtigste (Priorität A) zuerst, der Rest auf Antippen. Eine Zahl, die aus einer anderen folgt oder dasselbe nur verrauschter misst, fällt weg (Maßstab Sa); die Zeile bleibt mit Grund, die ID wird nie wiederverwendet.
- **Ehrlich:** Jede Zahl steht auf einer sichtbaren Grundlage (n, Zeitraum, Filter). Unter der Mindestzahl steht „–“ mit Grund, Unsicherheit wird gezeigt, und „unklar“ ist ein normales Ergebnis.
- **Handlungsnah:** Wo es geht, sagt die Statistik, was zu tun ist („Lage echt; läge die Gruppe in der Mitte, brächten 40 weitere Schuss zusammen etwa 2,4 Ringe mehr“) statt nur Zahlen zu liefern.
- **Messdaten, kein Tagebuch:** Ziele, Absicht, Reflexion und Befinden bleiben laut [[adr-026]] in Treffsicher. Spiegel liefert die Messung, Übungen mit messbarem Kriterium und die Auswertung.

## Notation

vᵢ ist der Zehntelwert, Ringᵢ der ganze Ring, n die Zahl der zählenden Schüsse. Jede Statistik über Werte gibt es in beiden Wertungen; in ganzen Ringen steht Ringᵢ für vᵢ. Einzelne Schüsse zeigt die Oberfläche immer in Zehnteln, gleich in welcher Wertung die Scheibe steht: Schusstabelle, Ablesung, Verlauf je Schuss (I3, I4 mit gleitendem Schnitt) und die Zehntelverteilung V2. Lage pᵢ in mm (Mitte 0, x rechts, y oben); Schwerpunkt m = (x̄, ȳ); rᵢ = |pᵢ − m|, dᵢ = |pᵢ| (Teiler = dᵢ in 1/100 mm). Sx, Sy mit n − 1. W ist der Ringabstand (LG 2,5 mm, LP 8 mm). Ebenen: Schuss, Serie, Scheibe, Zeitraum. Priorität A (früh, großer Nutzen), B (später), C (schön zu haben). Spalte „Wo“: Roadmap-Feature oder „vorhanden“ (in der Registry).

## Was es schon gibt

- **Spiegel** (`packages/shot-core`): die Registry aus [[spiegel-metrics]] mit Ergebnis und Ø je Schuss (ganze Ringe und Zehntel), Zehnern, Innenzehnern, bestem Teiler, Schwerpunkt-Abstand, Streukreis, R50, Präzision σ, Streuung x/y, Tempo, Tempo-Streuung und Dauer, jede mit ihrer Katalog-ID.
- **Treffsicher** ([[statistics-visualization]]): Übersicht je Disziplin, Ergebnisverlauf mit gleitendem Schnitt und Band, Min/Max/Ø je Serienposition, Trefferlage je Einheit (aus dem PDF) als Wolke und Verlauf, Ringverteilung, Befinden-Korrelation, Prognose und Feedback.
- **Meyton:** der Ausdruck ([[meyton-printout]]: Zähler, Innenzehner, beste und weiteste Teiler, Trefferkreis, Trefferlage, je Schuss Wert und Richtungspfeil). Die Treffer-Statistik in ESTA 5 nennt Schwerpunkt, Trefferkreis („der kleinste Kreis, der alle Treffer einschließt“) samt Mittelpunkt, Höhe und Breite, Ø Entfernung zur Mitte und Abstände von Treffer zu Treffer; der Ballistic Manager zusätzlich Sx, Sy, Sa (Rayleigh-σ), den Abstand aufeinanderfolgender Treffer und die Wanderung des Schwerpunkts.
- **Fremde Werkzeuge:** DISAG ShotsApp (Umkreis und Mittelpunkt je Serie, Rhythmus-Grafik „Schüsse über Zeit“), Kongsberg (MPI, Extreme Spread, kleinster Kreis und kleinstes Rechteck), SIUS BTS (MPI, Höhe/Breite), SCATT (Intervalle, nur der Teil ohne Zielverlauf), ShotAnalyzer (Munitionstest, Spiele wie „Bleib drüber“ und Soll-Schnitt), Ring Reader (CEP50, korrigiertes Ergebnis, Erkenntnisse wie Schussposition, Reaktion nach Fehler, Training gegen Wettkampf, Ausreißerrichtungen, Bedingungen), TargetScan (Ringverlust durch Lage gegen Gruppengröße), Ballistic X (MR, CEP, Korrektur auf Null).

## Katalog

### 1 Ergebnis

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| E1 | Ergebnis | Σ Ringᵢ bzw. Σ vᵢ der Wertung; Summe nur für vollständige Scheiben (SF-07) | Serie, Scheibe | A | vorhanden |
| E2 | Ø je Schuss | Σ vᵢ / n, in beiden Wertungen; über einen Zeitraum über alle Schüsse (`pooledValue`, [[adr-034]]) | Serie, Scheibe, Zeitraum | A | vorhanden |
| E3 | Hochrechnung | Ø je Schuss × Soll-Schusszahl; nie als Rekord (SF-09) | Scheibe | B | SP-1.8 |
| E4 | Zehner und Zehnerquote | Anzahl Ring 10; Quote mit Wilson-Intervall; über einen Zeitraum Σ Zehner / Σ Schuss | Serie, Scheibe, Zeitraum | A | vorhanden (Anzahl), SP-1.10 (Quote) |
| E5 | Innenzehner | Anzahl; LG und LP nicht vergleichbar. Eine Quote mit Wilson-Intervall gibt es nicht; die Anzahl steht wie auf dem Ausdruck | Serie, Scheibe, Zeitraum | A | vorhanden |
| E6 | Bester und schwächster Schuss | **entfernt:** folgt aus E8, der kleinste Teiler ist der beste Schuss, der größte der schwächste | – | – | entfernt (SP-1.12) |
| E7 | Teiler-Schnitt und -Median | **entfernt:** läuft mit dem Ø je Schuss (E2) zu r = −0,998, weil der Zehntelwert linear im Abstand ist | – | – | entfernt (SP-1.12) |
| E8 | Beste und weiteste Teiler | je drei mit Schussnummer, wie auf dem Ausdruck | Serie, Scheibe | B | SP-1.10 |
| E9 | Ringverlust | n·10 − ΣRing bzw. n·10,9 − Σvᵢ; als `total` in L4 (Lage + Streuung), keine eigene Auswertung; nur, wenn jeder Wertungsschuss eine Lage hat und keiner verdächtig ist, sonst wäre es eine Teilsumme (SF-07) | Serie, Scheibe | B | SP-1.10, SP-1.12 |
| E10 | Konstanz | SD und Spanne der Serien gleicher Länge, Abweichung je Schuss = SD der vᵢ (n − 1), ab 2 Schuss mit Wert; nicht der MAD, der in ganzen Ringen beim Luftgewehr fast immer 0 ist | Scheibe, Zeitraum | A | SP-1.10 |
| E11 | Anteil über Schwelle | Anteil vᵢ ≥ s mit Wilson-Intervall | Serie, Scheibe, Zeitraum | B | SP-1.10 |

### 2 Trefferbild und Präzision

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| P1 | Streukreis (Meyton: Trefferkreis) | Durchmesser des kleinsten Kreises um alle Trefferzentren, Mitte zu Mitte; wächst mit n | Serie, Scheibe | A | vorhanden |
| P2 | Extreme Spread | größter Abstand zweier Treffer | Serie, Scheibe | C | Funktion `extremeSpread` |
| P3 | Mittlerer Radius | **entfernt:** ≈ 1,24 · σ̂ mit mehr Rauschen (Effizienz 0,92), weder robust noch auf dem Ausdruck | – | – | entfernt (SP-1.12) |
| P4 | R50 (≈ CEP50) | Median der rᵢ ohne Fehlschüsse | Serie, Scheibe, Zeitraum | A | vorhanden |
| P5 | Rayleigh-σ | σ̂ = √(Σrᵢ²/(2(n−1)))/c4(2n−1), 95-%-Bereich über χ² mit 2(n−1) Freiheitsgraden; kaum n-abhängig. Den Wert vor der Korrektur nennt Meytons Ballistic Manager „Sa“ (bei 10 Schuss 1,4 % kleiner, bei 40 Schuss 0,3 %). Spiegel zeigt ihn nicht: kein Vorteil gegenüber σ̂, gegen Meyton nicht prüfbar (ESTA 5 und der Ausdruck nennen ihn nicht), zwei fast gleiche Zahlen verwirren. Über einen Zeitraum gepoolt: √(Σ νⱼsⱼ² / Σ νⱼ) / c4(Σ νⱼ + 1) mit νⱼ = 2(nⱼ − 1), dieselbe Zahl wie die Streuung der Form (L9) | Scheibe, Zeitraum | B | SP-1.10 |
| P6 | Streuung x und y | Sx und Sy; über einen Zeitraum gepoolt mit νⱼ = nⱼ − 1, jede Scheibe um ihre Mitte | Serie, Scheibe, Zeitraum | A | vorhanden |
| P7 | Höhe und Breite | **entfernt:** Effizienz 0,23–0,43 gegenüber σ̂, ein Ausreißer macht die Breite 59–87 % größer; „senkrecht oder waagrecht?“ beantworten P6 und P8 | – | – | entfernt (SP-1.12) |
| P8 | Form der Gruppe | Halbachsen und Winkel der Kovarianz-Ellipse ohne die von V6 markierten Ausreißer (sonst streckte ein Abreißer die Ellipse in seine Richtung), Verhältnis a/b; gestreckt nur, wenn Mauchlys Test es mit 95 % zeigt (W = 4a²b²/(a²+b²)² unter 0,05^(2/(n−2)), für eine Normalgruppe exakt); dazu das a/b, ab dem das bei dieser Schusszahl gilt (12 Schuss 2,26, 20 Schuss 1,81, 40 Schuss 1,50, 120 Schuss 1,25). Eine runde Gruppe zeigt zufällig im Median a/b 1,32 bei 20 und 1,21 bei 40 Schuss; eine echte Streckung von 1,3 erkennt eine Scheibe mit 40 Schuss nur in 26 % der Fälle, über 120 Schuss in 71 % (B17). Ohne die Ausreißer ist der Test eine Näherung (B18): Eine runde Gruppe gilt in 4 bis 5 % der Scheiben als gestreckt, eine runde mit Abreißern in 6 bis 8 % statt 13 bis 16 % über alle Schüsse. Deutlich gestreckte, kurze Gruppen erkennt er seltener (a/b 3 bei 10 Schuss: 67 statt 78 %), weil der runde Ausreißer-Test dort einen Schuss an der Spitze herausnehmen kann. Winkel erst ab 10 Schuss | Scheibe, Zeitraum | B | SP-1.10 |
| P9 | Streuung in Ringbreiten | R50 / W | Scheibe, Zeitraum | B | SP-1.10, SP-1.12 |
| P10 | Erwartete Zehnerquote | P(d ≤ W) für eine Normalgruppe mit σ̂ und m (Modell) | Scheibe, Zeitraum | C | später |

### 3 Lage und Systematik

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| L1 | Schwerpunkt (Meyton: Trefferlage) | m mit Richtung; ohne Trennung nach Visierverstellungen, die Spiegel nicht abfragt (SF-63) | Serie, Scheibe, Zeitraum | A | SP-1.10 |
| L2 | Schwerpunkt-Abstand | |m|; der Schwerpunkt selbst ist unsicher (aus 10 Schuss ≈ 0,4σ) | Serie, Scheibe, Zeitraum | A | vorhanden |
| L3 | Ist die Lage echt? | Hotelling-T² gegen F(2, n−2), 95-%-Ellipse um m | Scheibe, Zeitraum | A | SP-1.10 |
| L4 | Ringe durch Lage gegen Streuung | jeder Treffer um den Schwerpunkt der übrigen verschoben (Leave-one-out, (pᵢ − m) · n/(n − 1)) und neu gewertet: Lage- und Streuungsverlust, zusammen E9. Schätzt, was die Gruppe in der Mitte auf neuen Schüssen brächte (B5), als Summe über die n Schüsse mit Lage, darum in Texten mit n und je Schuss; in der Stichprobe zentriert zeigte er ohne jeden Versatz im Mittel +0,38 Ringe Scheingewinn (LG σ 1,5 mm). Erst ab 10 Schuss, wenn L3 „echt“ sagt und die Mitte Ringe bringt; nie amtlich | Serie, Scheibe, Zeitraum | A | SP-1.10, SP-1.12 |
| L5 | Lageanteil am Fehler | **entfernt:** dieselbe Aussage wie der Lage-Verlust aus L4, nur in Prozent vom Quadrat; die Lesehilfe „10 %: kein Thema“ widersprach L3 | – | – | entfernt (SP-1.12) |
| L6 | Richtungsuhr | Zahl der Treffer je Uhrzeit (30°-Sektor) um die Mitte oder um m; aussagekräftig ab 30 Schuss, darunter nur ein Bild | Scheibe, Zeitraum | B | SP-1.10 |
| L7 | Ausreißerrichtung | je Scheibe ab 10 Schuss das weiteste Zehntel (mindestens einer), gemessen von ihrem eigenen Schwerpunkt, Richtung von dort, als Richtungsuhr über alle Scheiben; Vorzugsrichtung nach Rayleigh (Näherung nach Zar) ab 30 Ausreißern, p < 0,05 (B24). Misst das Ausreißen aus der Gruppe, nicht ihren Versatz (L10) | Zeitraum | B | SP-2.7, Fachkern (`outlierDirection`) |
| L8 | Drift in der Abgabefolge | von-Neumann-Verhältnis je Sprung normiert (≈ 2 unabhängig, < 2 Wandern); ohne Urteil, weil es bei kleinem n stark streut (B8). Ø und größter Sprung führt Spiegel nicht (im Mittel √π · σ) | Scheibe | C | SP-1.10 |
| L9 | Langzeit-Trefferbild | alle Schüsse eines Zeitraums, wo sie lagen: unter 50 als Treffer in Ringfarbe, bis 3.000 als Treffer in der Farbe der Dichte (sechs Stufen: 99 von 100 bis ein Zehntel der Masse), darüber nur als Umrisse (Hälfte und 9 von 10 der Schüsse, wie beim Vergleichen), je Familie; dazu die Form über mehrere Scheiben (Kovarianz je Scheibe um ihren eigenen Schwerpunkt, gepoolt, ν = Σ(nᵢ − 1)), die eine leichte Streckung (a/b 1,2–1,3) erst sichtbar macht; länglich nach Mauchly (exakt, p = W^((ν − 1)/2)) bei p < 0,05 und a/b ≥ 1,15, ab 100 Schuss aus 5 Scheiben (B23) | Zeitraum | B | SP-2.7, Fachkern (`periodShape`, `periodPattern`) |
| L10 | Lage über Zeit | Schwerpunkt je Scheibe (ab 3 Schuss mit Lage) als Wolke mit Pfad, nach n gezeichnet; die Mitte ist die aller Schüsse (der geviertelte Kreis im Bild); versetzt nach zwei Ebenen je Richtung ([[adr-034]], `levels.ts`): seitlich und in der Höhe je ein Vortest auf Wandern der Abende mit α 0,5, ohne Wandern alle Schüsse als eine Stichprobe, sonst jeder Abend; beide nach Bonferroni; dazu der Bereich, in dem die Mitte zu 95 % liegt (je Richtung t zu 97,5 %, `region`), er schließt die Mitte der Scheibe genau bei „versetzt“ aus; ohne gesicherten Versatz nennt der Satz die Lage und sagt, dass sie noch nicht sicher ist, nie „passt“; ab 5 Scheiben (B25). Eine Trefferlage nur als Summe (Ausdruck, [[adr-033]]) kann hier später zählen, nie in L9 und L7 | Zeitraum | B | SP-2.7, Fachkern (`positionPoints`, `positionOverTime`, `levelEstimate`) |
| L11 | Visierkorrektur in Klicks | **entfernt:** keine Hinweise zum Visier; Spiegel rechnet, was die Lage kostet (L4), nicht, was man verstellen soll | – | – | entfernt (SP-1.12) |

### 4 Verteilung

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| V1 | Ringverteilung (Zähler) | Anzahl je Ring 10…0 plus Innenzehner; Histogramm, keine Torte | Serie, Scheibe, Zeitraum | A | SP-1.10 |
| V2 | Zehntelverteilung | Histogramm der vᵢ in 0,1-Klassen; auf einer Scheibe zählt die Gesamtform, nicht die einzelne Säule; auch in ganzen Ringen gezeigt | Scheibe, Zeitraum | B | SP-1.10 |
| V3 | Abstandskurve | Anteil der Schüsse mit Teiler ≤ t | Zeitraum | B | SP-2.1 |
| V4 | Verteilung der Serien | Quartile der Serienergebnisse je Monat | Zeitraum | B | SP-2.1 |
| V5 | Ringanteile im Zeitverlauf | Anteil je Ring je Scheibe, gestapelt | Zeitraum | B | SP-2.1 |
| V6 | Ausreißer | schrittweise (verallgemeinerter ESD nach Rosner, in der Ebene): der weiteste Schuss gegen die übrigen m, T = d²/(2S²(1 + 1/(m−1))) gegen F(2, 2(m−2)) beim Quantil 1 − 0,04/m, dann ohne ihn weiter; höchstens max(2, ⌊n/10⌋) Schritte ab 10 Schuss, darunter einer; Ausreißer sind die bis zum letzten Schritt über seiner Grenze. Fehlalarm in einer runden Normalgruppe etwa 4 bis 5 % je Scheibe (Q3 + 1,5·IQR auf den Radien wären bis 47 %), bei gestreckten mehr (a/b 2: etwa 11–18 %, B2; ein affiner Test für gestreckte Gruppen ist offen). Zwei nahe Abreißer verdecken sich ab 10 Schuss nicht mehr (B14). Die Form (P8) rechnet ohne die markierten Schüsse. Nicht jeder Schuss einzeln mit α 0,05 (zwei gleich weite bei 10 Schuss: einer in 13,7 %). Ein Verhältnis Ø Abstand/R50 gibt es nicht: ohne Grenze, und es zählt Fehlschüsse anders als R50 | Scheibe, Zeitraum | B | SP-1.10, SP-1.12 |
| V7 | Ringverlust durch Ausreißer | Σ(Median der übrigen − vᵢ) über die von V6 markierten Schüsse, negativ möglich; unbekannt, wenn einem markierten Schuss der Wert fehlt (SF-07). Nicht über die schwächsten 10 %: Den großen Verlust dort hat jede normale Gruppe (LG σ 1,5 mm, 40 Schuss etwa 3 Ringe) | Scheibe, Zeitraum | B | SP-1.10, SP-1.12 |

### 5 Zeit und Rhythmus

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| Z1 | Tempo | Median der Intervalle ohne Pausen (Pause: über dem Doppelten des Medians der Abstände bis 180 s, mindestens 60 s, über 180 s immer; Schwelle der ganzen Karte; an echten Scheiben 18 Pausen in 789 Abständen; Version 4); über einen Zeitraum das Mittel je Scheibe, denn Mediane lassen sich nicht zusammenführen ([[adr-034]]) | Serie, Scheibe, Zeitraum | A | vorhanden |
| Z2 | Tempo-Konstanz | IQR (Q3 − Q1) der Abstände ohne Pausen (Pausen wie in Z1), auch relativ zum Median; konstanter ist nicht automatisch besser | Scheibe, Zeitraum | A | SP-1.10 |
| Z3 | Dauer | erster bis letzter Schuss (`time.duration`); Netto-Zeit (Σ Abstände) und Schüsse je Stunde (3600 / Ø Abstand) führt Spiegel nicht | Scheibe, Zeitraum | A | SP-1.10 |
| Z4 | Pausen und Wiedereinstieg | Pausen relativ zum Takt wie in Z1; Anzahl und Summe; Ø der bis zu drei Schüsse nach einer Pause gegen den Ø der übrigen, je Schuss (B10); „klar“ nach exaktem Permutationstest auf den Unterschied der Mittel (zweiseitig, 95 %, bei m Pausen 0,05/m je Pause), Richtung wie das Vorzeichen (B22). m zählt nur Pausen mit Werten danach. Liegen zwei Pausen weniger als drei Schuss auseinander, überlappen ihre Fenster „danach“, und jede zählt die Schüsse der anderen zu den übrigen; die Grenze 0,05/m gilt auch dann. Die Pausen kommen aus den Schüssen mit Zeit wie in Z5, die Schnitte nur aus Schüssen mit Wert (Prüfung, 9. Oktober 2026). Die längste Pause ist keine eigene Kennzahl | Scheibe, Zeitraum | A | SP-1.10 |
| Z5 | Rhythmus-Profil | Median der letzten fünf Abstände ohne Pausen (Pausen wie in Z1), über die Schussnummer | Scheibe | B | SP-1.10 |
| Z6 | Tempo und Wert | Ø vᵢ je Klasse des Intervalls davor; einige hundert Schuss | Zeitraum | B | SP-2.7 |
| Z7 | Tempo nach schwachem Schuss | Intervall nach schwachen gegen nach übrigen Schüssen | Zeitraum | C | SP-2.7 |
| Z8 | Zeitbedarf für die Disziplin | Netto-Tempo × Soll-Schusszahl gegen ein gepflegtes Zeitlimit | Scheibe, Zeitraum | C | später |

### 6 Verlauf in der Einheit

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| I1 | Serienkurve | Serienergebnisse in Reihenfolge; im Zeitraum Min/Max/Ø je Position | Scheibe, Zeitraum | A | SP-1.10 |
| I2 | Ermüdung | Ø der letzten zehn minus der ersten zehn, R50 ebenso; „klar“ nach Mann-Whitney über die Werte (zweiseitig, 95 %, zehn gegen zehn genau) und nur, wenn das Mittel dieselbe Richtung zeigt (B21); R50 ohne Urteil. Auch ein klares Urteil gilt nur für diese Scheibe | Scheibe, Zeitraum | A | SP-1.10 |
| I3 | Trend in der Scheibe | Steigung der Ausgleichsgeraden mal zehn: wie sich der Wert je Schuss alle zehn Schuss ändert (−0,24 heißt: ein Schuss zehn Schuss später 0,24 Ringe schwächer, eine Serie 2,4 Ringe); „klar“ nach Mann-Kendall mit Bindungs- und Stetigkeitskorrektur (95 %), mit Richtung (B6), und nur, wenn die Gerade dieselbe Richtung zeigt: Ein sehr schwacher Schuss am Rand kann sie kippen, dann stünde „klar steigend“ neben einer fallenden Zahl. Nicht Theil-Sen mit Sen-Intervall: Bei gleichen Werten liegt dessen Grenze auf 0, selbst die Stufe zehnmal 9, zehnmal 10 hieße „nicht klar“ | Scheibe | B | SP-1.10, SP-1.12 |
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
| S1 | Versatz Probe → Wertung | **entfernt:** Eine Scheibe ist reine Probe oder Wertung ([[adr-027]]): Meyton löscht die Probe mit dem ersten Wertungsschuss, in Spiegel ist sie eine eigene Scheibe davor. Probe neben Wertung derselben Scheibe gibt es nicht. Git hält die alte Definition; ein Vergleich über zwei Scheiben oder eine Quelle mit Probe neben Wertung (SP-4.4) bringt sie bei Bedarf zurück | – | – | entfernt |
| S2 | Probe-Umfang | **entfernt:** Eine Scheibe ist reine Probe oder Wertung ([[adr-027]]): Meyton löscht die Probe mit dem ersten Wertungsschuss, in Spiegel ist sie eine eigene Scheibe davor. Probe neben Wertung derselben Scheibe gibt es nicht. Git hält die alte Definition; ein Vergleich über zwei Scheiben oder eine Quelle mit Probe neben Wertung (SP-4.4) bringt sie bei Bedarf zurück | – | – | entfernt |
| S3 | Probe-Qualität | **entfernt:** Eine Scheibe ist reine Probe oder Wertung ([[adr-027]]): Meyton löscht die Probe mit dem ersten Wertungsschuss, in Spiegel ist sie eine eigene Scheibe davor. Probe neben Wertung derselben Scheibe gibt es nicht. Git hält die alte Definition; ein Vergleich über zwei Scheiben oder eine Quelle mit Probe neben Wertung (SP-4.4) bringt sie bei Bedarf zurück | – | – | entfernt |
| S4 | Eingeschossen? | **entfernt:** Eine Scheibe ist reine Probe oder Wertung ([[adr-027]]): Meyton löscht die Probe mit dem ersten Wertungsschuss, in Spiegel ist sie eine eigene Scheibe davor. Probe neben Wertung derselben Scheibe gibt es nicht. Git hält die alte Definition; ein Vergleich über zwei Scheiben oder eine Quelle mit Probe neben Wertung (SP-4.4) bringt sie bei Bedarf zurück | – | – | entfernt |
| S5 | Visierverstellungen | **entfernt:** Spiegel fragt keine Visierverstellung ab, das ist zu viel Komplexität für ihren Nutzen | – | – | entfernt (SP-1.8) |

### 8 Langzeit und Trend

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| T1 | Verlauf jeder Kennzahl | Wert je Scheibe aus der Registry über ihre Wertungsschüsse, gleitender Schnitt über die letzten fünf Scheiben, bei Kennzahlen mit Pooling über ihre Schüsse („bisher“, solange es keine fünf sind); Familie und Abschnitt (Woche, Monat) wählt der Aufrufer, n-abhängige Maße nur bei gleichem n | Zeitraum | A | SP-2.1, Fachkern (`cardValues`, `periodTrend`) |
| T2 | Formband | gleitender Schnitt ± 1,4826 · MAD der Abweichungen der Scheiben vom vollen Schnitt, ab zehn Scheiben, ohne Schwankung (MAD 0) kein Band; ein gleichbleibender Schütze liegt mit etwa zwei von drei Scheiben im Band (B20) | Zeitraum | A | SP-2.1, Fachkern (`periodTrend`) |
| T3 | Bedeutsame Veränderung | Δ der Mittel zweier Zeiträume gegen die gepoolte Standardabweichung der Scheibenwerte, bedeutsam ab 0,3 × (Hopkins), ab fünf Scheiben je Seite; zählt nur zusammen mit einem Urteil aus C3, denn ohne Veränderung trifft es bei 5 gegen 5 Scheiben in etwa sechs von zehn Fällen zu (B19). Bleibt je Scheibe: Hopkins misst die Schwankung von Scheibe zu Scheibe ([[adr-034]]) | Zeitraum | B | SP-2.7, Fachkern (`compareValues`, `meaningfulChange`) |
| T4 | Trendsteigung | Theil-Sen je Monat mit Intervall; nicht in die Zukunft verlängern | Zeitraum | B | SP-2.7 |
| T5 | Boden und Decke | P10, Median und P90 der Scheibenwerte je Abschnitt (Monat), P10 und P90 ab fünf Scheiben; Boden ist das schwächere Ende (beim Ø P10, bei σ P90), beim Tempo nur die Spanne (Prüfung, 9. Oktober 2026) | Zeitraum | B | SP-2.1, Fachkern (`periodBuckets`) |
| T6 | Trainingsumfang | Schüsse (Probe und Wertung), Scheiben und Tage je Woche; keine Netto-Zeit, sie folgt aus den Abständen | Zeitraum | A | SP-2.1, Fachkern (`trainingVolume`) |
| T7 | Kalender | Trainingstage als Kalender; je Abend (vor 4 Uhr der Vortag) wie Umfang und Liste, gerechnet über `trainingVolume`/`projectedVolume` (`periodModel.calendar`, 13. Oktober 2026) | Zeitraum | B | SP-2.1 |
| T8 | Erfolgsserien | Wochen in Folge mit Training, Scheiben über dem eigenen Schnitt | Zeitraum | C | SP-2.8 |

### 9 Rekorde und Meilensteine

Nur endgültige, vollständige Scheiben, ohne einen verdächtigen Schuss unter denen, die zählen (Wertung; bei nur Probe die Probe), und ohne die Merkmale nur-pdf, neu-gewertet und ausgenommen (SF-15, SF-66); je Familie und je Wertung, wahlweise nur Training oder nur Wettkampf. R1, R4 (volle Scheibe), R5, R6 (je Scheibe), R10 und R11 je Schusszahl, R2 und R6 (je Serie) je Serienlänge; die Oberfläche sagt deshalb „Scheibe zu 40 Schuss“ oder „Serie zu 10 Schuss“, nie nur „(10 Schuss)“; bei Gleichstand gilt der frühere; Zählungen (R5–R7) erst ab einem Treffer. Eine Scheibe nur mit Probe zählt nur auf Wunsch, dann ihre Probe wie Wertung in Serien zu zehn (SF-01); ebenso eine, deren Probe als Wertung gezählt ist (SF-05, Merkmal `als-wertung-gezaehlt`). Umgesetzt im Fachkern (`recordEligible`, `periodRecords`).

| ID | Kennzahl | Prio | Wo |
|---|---|---|---|
| R1 | Beste Scheibe je Schusszahl | A | SP-2.1, Fachkern |
| R2 | Beste Serie voller Länge (die häufigste Serienlänge der Scheibe), je Serienlänge | A | SP-2.1, Fachkern |
| R3 | Bester Teiler, zugleich der beste Schuss | A | SP-2.1, Fachkern |
| R4 | Engste Gruppe (Streukreis) über eine Serie zu zehn und über die volle Scheibe, nur wenn jeder Schuss eine Lage hat | A | SP-2.1, Fachkern |
| R5 | Meiste 10,9 (nur in Zehnteln); der beste Schuss ist der beste Teiler (R3) | B | SP-2.1, Fachkern |
| R6 | Meiste Zehner und Innenzehner, je Scheibe und in einer Serie voller Länge (die häufigste Serienlänge der Scheibe) | B | SP-2.1, Fachkern |
| R7 | Längste Zehnerfolge und längste Folge ohne Schuss unter 9 | B | SP-2.1, Fachkern |
| R8 | Beste Form (höchster voller Schnitt je Schuss über fünf Scheiben, über ihre Schüsse) | C | SP-2.1, Fachkern |
| R9 | Meilensteine (1 000 Schuss, erste 10,9, Abstand zum Rekord) | C | SP-2.8 |
| R10 | Bester schwächster Schuss je Schusszahl, in Ringen der Wertung; ein Schuss über der Soll-Zahl (SF-08, amtlich 0) zählt nicht; keiner, wenn einem Wertungsschuss der Wert fehlt | B | SP-2.1, Fachkern |
| R11 | Kleinste Spanne zwischen bester und schwächster Serie voller Länge je Schusszahl, ab zwei Serien, auf das Raster der Wertung gerundet; nur nach der Schusszahl der Scheibe geführt, nicht nach der Serienlänge (eine Familie mit gemischten Serienlängen vergleicht 40 Schuss in Serien zu fünf mit 40 Schuss in Serien zu zehn) | B | SP-2.1, Fachkern |

### 10 Vergleiche

| ID | Kennzahl | Definition | Prio | Wo |
|---|---|---|---|---|
| C1 | Serie gegen Serie | alle Serien mit jeder Kennzahl, beste und engste markiert | A | SP-1.8 |
| C2 | Scheibe gegen Scheibe | zwei Scheiben einer Familie Schuss für Schuss, die Wertungsschüsse wie am Ausdruck: Ergebnis über die Werte der Schüsse in der Wertung, Streuung über die Abstände zur Mitte der eigenen Scheibe (wie σ: mit Lage, ohne verdächtige), beide Mann-Whitney zweiseitig, α 0,05; Lage über Hotelling-T² für zwei Stichproben, F(2, n₁ + n₂ − 3); ein Urteil ab 5 Schuss je Scheibe; Fehlalarm höchstens etwa 5,5 % (B26–B28); Bild beider Scheiben übereinander in zwei Farben auf der Seite Vergleichen ([[spiegel-vergleichen]]) | A | SP-2.2, Fachkern (`compareShots`, `compareSides`, `compareCenters`, `comparePicture`) |
| C3 | Zeitraum gegen Zeitraum | Werte über alle Schüsse zweier Zeiträume ([[adr-034]]); Urteil über zwei Ebenen: Mittel (Ø, Quote) mit Vortest auf Wandern der Abende (α 0,5) und Welch über beide Seiten, Streuung über die Varianzen (F-Test der gepoolten, bei wandernder Präzision Welch-t über ln sⱼ², B29), zweiseitig, α 0,05; ohne Streuung der Schusswerte (Einheiten nur aus Serien) und ohne Pooling Mann-Whitney über die Werte je Scheibe, bis 20 Scheiben je Seite genau ausgezählt; Δ der Werte; Urteil höher, tiefer oder unklar ab fünf Scheiben je Seite, unklar auch, wenn Test und Mittel verschieden zeigen; Fehlalarm höchstens etwa 5 % (B19); die Lage über alle Schüsse und zwei Ebenen je Richtung nach Bonferroni (ab 5 Scheiben je Seite, B28); auf der Seite Vergleichen mit zwei Umrissen (Hälfte und 9 von 10 der Schüsse) ab 50 Schuss je Seite ([[spiegel-vergleichen]]); Scheiben in beiden Zeiträumen zählen nur in A | A | SP-2.2, Fachkern (`compareValues`, `compareSamples`, `compareCenterGroups`, `comparePicture`) |
| C4 | Gegen den eigenen Schnitt | Δ der neuesten Scheibe im Zeitraum zum Schnitt der 30 Tage davor (ab drei Scheiben), Perzentil unter den letzten 50 mit ihr (ab zehn, gleiche zur Hälfte), beides über alle Scheiben der Familie, nicht nur im Zeitraum | A | SP-2.2, Fachkern (`againstOwnAverage`); die Oberfläche zeigt seit U2 nur den Abstand zum Schnitt der fünf Scheiben davor, ein Bezug für eine Scheibe ([[spiegel-durchsicht]]) |
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
| K6 | Befinden | Korrelation mit Schlaf, Energie, Stress aus dem Tagebuch (Einflüsse) | C | [[adr-033]] Stufe 2 |

### 12 Wettkampf und Druck

| ID | Kennzahl | Definition | Prio | Wo |
|---|---|---|---|---|
| W1 | Wettkampf-Abschlag | Ø und R50 im Wettkampf minus Training (Meyton-Status); auf der Seite Vergleichen als „Wettkampf und Training“ in einem Zeitraum, gerechnet wie C3 | A | SP-2.7, Seite Vergleichen |
| W2 | Schlussphase | letzte Serie minus Ø der übrigen, Wettkampf gegen Training | B | SP-2.7 |
| W3 | Startphase | erste Serie minus Ø der übrigen | B | SP-2.7 |
| W4 | Tempo unter Druck | Tempo und Tempo-Konstanz im Wettkampf gegen Training | B | SP-2.7 |
| W5 | Soll-Schnitt zum Ziel | (Ziel − bisher) / Restschüsse; nachträglich, ab wann das Ziel außer Reichweite war | B | SP-2.8 |
| W6 | Zielwahrscheinlichkeit | Anteil der letzten N Scheiben, die das Ziel erreichten, mit Wilson | C | SP-2.8 |

### 13 Datenlage

| ID | Kennzahl | Definition | Prio | Wo |
|---|---|---|---|---|
| Q1 | Datenlage | Wertungs- und Probeschüsse, ohne Lage, ohne Zeit, ohne Wert, in Zehnteln ohne Zehntel, Merkmale; eine Scheibe nur mit Probe als Training; als dezente Zeile unter jeder Ansicht | A | SP-1.10 |

## Mit unseren Daten nicht möglich

- **Zielverlauf** (SCATT, Noptel): Halteraum, Zielweg, Zielzeit, Nachhalten, Durchsacken. Allein die Gewehrstabilität erklärt in einer Übersichtsarbeit gut die Hälfte der Varianz; für Spiegel ist sie unsichtbar.
- **Abzug:** Abzugsdruck, Sauberkeit der Auslösung.
- **Körper:** Herzfrequenz, Atmung, Körperschwankung.
- **Waffe und Umgebung:** Verkanten, Laufbewegung, Geschossgeschwindigkeit; Licht und Temperatur allenfalls als Tag.
- **Reine Zielzeit:** Wir kennen nur Abgabezeitpunkte; jedes Intervall enthält Laden, Absetzen und Zielen.
- **Mentales und Befinden:** bleiben in Treffsicher ([[adr-026]]).
- **Scheiben nur aus dem PDF:** ohne Lage und Zeit nur Wert-Kennzahlen.

## Ehrliche Zahlen

- **Mindestzahl, sonst „–“** (SF-61): Streukreis ab 3, aussagekräftig ab 10; R50 ab 5; Form ab 3, ihr Winkel nur bei gestreckter Gruppe ab 10; Richtungsuhr ab 30; Erkenntnisse über Zeiträume (Schussposition, Reaktion nach Fehler, Tempo gegen Wert) erst ab einigen hundert Schuss oder 20 Ereignissen.
- **Werte über die Schüsse, Urteile über Schüsse und Abende** ([[adr-034]]): Was sich über Schüsse mitteln lässt (Ø, Quoten, Streuung, Lage), zählt über einen Zeitraum jeden Schuss; eine Scheibe mit 10 Schuss wiegt ein Viertel einer mit 40. Ein Urteil prüft zuerst, ob die Abende stärker wandern, als der Zufall der Schüsse erklärt (α 0,5, die Lage je Richtung); dann zählt jeder Abend für sich. Je Scheibe bleibt, was Scheiben zeigt: Verlauf, Formband, Boden und Decke, Rekorde einer Scheibe, „bedeutsam“ und das Tempo.
- **Unsicherheit zeigen:** σ über χ², Lage über Hotelling, Quoten über Wilson, Trends über Mann-Kendall. Bei 10 Schuss reicht der 95-%-Bereich für σ von −26 % bis +46 %, ist also gut zwei Drittel so breit wie σ selbst; ±10 % erreicht er erst bei rund 120 Schuss.
- **Gleiches n:** Streukreis, Extreme Spread und längste Folge wachsen mit n, der beste Teiler sinkt mit n (Streukreis über 40 gegen 10 Schuss +32 %, B3); R50 fällt bei kleinem n leicht zu klein aus (bei 10 Schuss −4 %, B4; der Faktor √((n − 1)/n) gilt genau nur für den mittleren Radius). σ̂ ist das stabilste Maß für Verläufe über unterschiedliche Schusszahlen.
- **Robust als Standard in Verläufen:** Median, R50, MAD, Quantilbänder.
- **Nur Gleiches vergleichen:** gleiche Familie, gleiche Wertung; mm-Werte von LG und LP nie.
- **Viele Vergleiche erzeugen Zufallstreffer:** Mindest-n, Korrektur (Holm oder Benjamini-Hochberg) oder nur als Hinweis formulieren. Auf einer Scheibe laufen fünf Tests (Lage, Form, Ausreißer, Trend, Ermüdung), dazu einer je Pause: Etwa jede fünfte ganz normale Scheibe zeigt irgendwo einen Befund, mit einer Pause etwa jede vierte (B1).
- **Regression zur Mitte und Auswahl:** Nach einem Rekord ist die nächste Scheibe meist schwächer; „beste Serie“ und korrigiertes Ergebnis sind aus denselben Daten gewählt und optimistisch.
- **Bedeutsamkeit zusätzlich zur Signifikanz:** lohnend ab 0,3 × der Streuung der Scheiben (Hopkins), aber nur neben einem Urteil: Ohne Veränderung trifft es bei 5 gegen 5 Scheiben oft zu (T3, B19); „nicht nachweisbar“ ist ehrlich.
- **Transparenz:** jede Zahl mit n, Zeitraum, Filter und Kennzahl-Version; Modellwerte als Modell gekennzeichnet.

## Beobachtungen in Worten (Beispiele)

1. „Serie 3 war deine engste (R50 1,9 mm), Serie 4 streut 34 % weiter.“ — nur bei gleicher Schusszahl und wenn ein Test den Unterschied zeigt; 20 % Unterschied erreichen zwei gleich gute Zehnerserien oft zufällig (Nutzen-Prüfung, Oktober 2026).
2. „Dein Schwerpunkt liegt 1,8 mm links, bei 40 Schuss ist das kein Zufall. Läge die Gruppe in der Mitte, brächten 40 weitere Schuss zusammen etwa 2,4 Ringe mehr (rund 0,06 je Schuss).“ — nur wenn L3 „echt“ sagt und n ≥ 10 (L4, Leave-one-out).
3. „Die letzten zehn Schuss waren je Schuss 0,21 schwächer als die ersten zehn, in 6 deiner letzten 8 Trainings war das so.“ — als Muster erst ab fünf Scheiben.
4. „Drei Abreißer nach rechts unten kosteten dich 2,1 Ringe.“
5. ~~„Deine Probe war enger als die Wertung (R50 1,6 gegen 2,3 mm).“~~ — entfiel mit U4 (keine Probe neben Wertung).
6. „Diese Scheibe liegt über 85 % deiner letzten 50.“ — ab 10 Scheiben (C4); „besser“ nur, wo höher besser ist.
7. „Seit dem neuen Munitionslos ist dein σ 0,2 mm kleiner, das liegt noch in der normalen Schwankung.“

## Belege aus Simulationen

Jede Zahl aus einer Simulation, die ein Hilfetext nennt ([[spiegel-statistics-help]]), steht hier und lässt sich nachrechnen: `pnpm --filter @vereinsheim/shot-help simulate` (`packages/shot-help/scripts/simulate.ts`). Methode: mulberry32 mit Box-Muller, fester Seed je Fall, Lagen auf ganze µm, Wertung über `scoreFromCoordinates`, nur die echten Funktionen aus `shot-core`; 5 000 Wiederholungen je Fall, beim Mehrfachtest (B1) 20 000. Normalgruppen: Luftgewehr σ 1,5 mm, Luftpistole σ 15 mm je Richtung. B19 und B20 mit 2 000 Wiederholungen je Fall, je Scheibe 40 Schuss Luftgewehr; die Zahlen über einen Zeitraum
über Schüsse und Abende ([[adr-034]], 22. Oktober 2026: B19, B25, B28 der Zeiträume, B29) zusätzlich im Raster aus
Wandern der Abende (τ 0 bis 0,3 σ je Richtung, bei B29 Präzision × exp(N(0, w²)), w 0 bis 0,2), Schusszahlen (alle 40
oder jede dritte Scheibe 10) und 5, 10, 20 Scheiben, je Zelle 20 000 Wiederholungen; Abnahme Fehlalarm höchstens 6,5 %
je Zelle, höchstens 5,5 % ohne Wandern. Stand nach SP-1.12 (7. Oktober 2026), Ausreißer schrittweise, Form ohne Ausreißer, Zeiträume (8. Oktober 2026), B19 mit einer kleinen Veränderung und dem Unterschied je Schuss, B9 auch in ganzen Ringen, B21 neu (Prüfung, 9. Oktober 2026), Wertung mit Meytons Toleranz von 10 µm (SF-75, 9. Oktober 2026; dadurch neu B6, B10, B19, B20, alle übrigen Zeilen unverändert), B1 mit dem Urteil der Ermüdung und B21 neu (20. Oktober 2026), B1 mit Pause und B22 neu (21. Oktober 2026), B26–B28 neu für die Seite Vergleichen (zwei Scheiben zu 20, 40 und 60 Schuss, zwei Seiten zu 5, 10 und 20 Scheiben, 21. Oktober 2026):

```
B0   innerhalb σ 39,3 %, innerhalb 2σ 86,5 %
B1   20 Schuss: 19,4 % mit Befund, also etwa jede 5.
B1   40 Schuss: 18,9 % mit Befund, also etwa jede 5.
B1   60 Schuss: 20,0 % mit Befund, also etwa jede 5.
B1   40 Schuss mit einer Pause: 22,3 % mit Befund, also etwa jede 4.
B2   Ausreißer-Fehlalarm rund: 10: 4,7 %, 20: 4,1 %, 40: 4,2 %, 60: 4,1 %
B2   Ausreißer-Fehlalarm a/b 2: 10: 10,9 %, 20: 14,1 %, 40: 15,5 %, 60: 17,5 %
B3   Streukreis 40 gegen 10 Schuss: +32 %
B4   R50 bei 10 Schuss: -4,3 % gegen den Grenzwert
B5   LG σ 1,5 mm, 40 Schuss, ohne Versatz: Lage-Verlust im Mittel -0,38 Ringe
B5   LP σ 15 mm, 40 Schuss, ohne Versatz: Lage-Verlust im Mittel -1,20 Ringe
B5   LG, Versatz 0,5σ, 40 Schuss: angezeigt 1,45, Gewinn auf neuer Scheibe 1,47
B6   LG σ 1,5 mm, 20 Schuss: Fehlalarm Zehntel 4,0 %, ganze Ringe 3,7 %; Nachlassen erkannt Zehntel 15,6 %, ganze Ringe 14,4 %
B6   LG σ 1,5 mm, 40 Schuss: Fehlalarm Zehntel 4,8 %, ganze Ringe 4,8 %; Nachlassen erkannt Zehntel 29,6 %, ganze Ringe 27,2 %
B6   LP σ 15 mm, 20 Schuss: Fehlalarm Zehntel 4,5 %, ganze Ringe 4,7 %; Nachlassen erkannt Zehntel 15,9 %, ganze Ringe 16,6 %
B6   LP σ 15 mm, 40 Schuss: Fehlalarm Zehntel 5,0 %, ganze Ringe 4,9 %; Nachlassen erkannt Zehntel 30,9 %, ganze Ringe 30,2 %
B8   von Neumann, 10 Schuss: 1,15 bis 2,80
B8   von Neumann, 40 Schuss: 1,57 bis 2,41
B9   Ermüdung LG σ 1,5 mm: Δ Ø -0,34 bis 0,35 Ringe, Δ R50 -57 bis 57 %
B9   Ermüdung LG σ 1,5 mm, ganze Ringe: Δ Ø -0,40 bis 0,40 Ringe
B9   Ermüdung LP σ 15 mm: Δ Ø -1,07 bis 1,11 Ringe, Δ R50 -59 bis 57 %
B9   Ermüdung LP σ 15 mm, ganze Ringe: Δ Ø -1,10 bis 1,10 Ringe
B10  Wiedereinstieg LG σ 1,5 mm: -0,49 bis 0,42 Ringe
B10  Wiedereinstieg LP σ 15 mm: -1,52 bis 1,33 Ringe
B12  Serien-Versatz zur Scheibe: im Mittel 0,35 σ
B13  Richtungsuhr, 30 Schuss: stärkster Keil im Median ×2,0
B14  10 Schuss, 1 bei 5σ: mindestens einer erkannt in 86,2 %
B14  10 Schuss, 2 bei 5σ: mindestens einer erkannt in 76,9 %, beide in 76,1 %
B14  10 Schuss, 2 bei 5σ nah beieinander: mindestens einer erkannt in 81,8 %, beide in 81,8 %
B15  Wilson 20/40: 35,2 bis 64,8 %
B15  σ-Bereich 10 Schuss: -25,5 % bis +45,8 %
B15  σ-Bereich 30 Schuss: -15,7 % bis +21,7 %, bei σ̂ 1,12 mm: 0,94 bis 1,36 mm
B15  σ-Bereich 120 Schuss: -8,3 % bis +9,8 %
B16  Halbachse der Vertrauensellipse in σ: 5: 2,26, 10: 1,00, 20: 0,61, 40: 0,41, 60: 0,33
B17  runde Gruppe, Median a/b: 20 Schuss 1,32, 40 Schuss 1,21
B17  echte Streckung a/b 1,3 als gestreckt erkannt: 40 Schuss 25,8 %, 120 Schuss 71,0 %
B18  als gestreckt gemeldet, rund (alt → ohne Ausreißer): 10: 5,0 % → 4,1 %, 20: 5,6 % → 5,2 %, 40: 4,8 % → 4,6 %, 60: 4,7 % → 4,6 %
B18  als gestreckt gemeldet, a/b 2 (alt → ohne Ausreißer): 10: 35,5 % → 30,3 %, 20: 74,1 % → 68,7 %, 40: 97,4 % → 96,0 %
B18  als gestreckt gemeldet, a/b 3 (alt → ohne Ausreißer): 10: 77,8 % → 66,5 %, 20: 98,9 % → 96,7 %
B18  als gestreckt gemeldet, rund mit Abreißern (alt → ohne Ausreißer): 10: 13,4 % → 6,3 %, 20: 15,8 % → 7,6 %, 40: 13,0 % → 7,8 %
B19  gleich, Urteil trotz gleicher Streuung: 5/5 2,2 % (bedeutsam 62,3 %), 10/10 2,1 % (bedeutsam 50,7 %), 20/20 3,8 % (bedeutsam 36,2 %), 30/30 3,5 % (bedeutsam 24,1 %); Δ Ø je Schuss im Mittel 0,000
B19  σ 1,5 → 1,3 mm, „höher“ erkannt: 5/5 58,4 % (bedeutsam 99,1 %), 10/10 94,5 % (bedeutsam 99,8 %), 20/20 100,0 % (bedeutsam 100,0 %), 30/30 100,0 % (bedeutsam 100,0 %); Δ Ø je Schuss im Mittel 0,101
B19  σ 1,5 → 1,45 mm, „höher“ erkannt: 5/5 4,6 % (bedeutsam 69,3 %), 10/10 10,8 % (bedeutsam 63,3 %), 20/20 20,6 % (bedeutsam 64,2 %), 30/30 29,9 % (bedeutsam 65,5 %); Δ Ø je Schuss im Mittel 0,025
B20  Scheiben im Formband (60 Scheiben, ab der zehnten): Median 68,6 %, 95 % zwischen 56,9 % und 80,4 %
B21  Ermüdung LG σ 1,5 mm, 20 Schuss: Fehlalarm Zehntel 4,5 %, ganze Ringe 0,9 %; Nachlassen erkannt Zehntel 39,9 %, ganze Ringe 22,7 %
B21  Ermüdung LG σ 1,5 mm, 40 Schuss: Fehlalarm Zehntel 5,1 %, ganze Ringe 1,1 %; Nachlassen erkannt Zehntel 39,9 %, ganze Ringe 24,5 %
B21  Ermüdung LP σ 15 mm, 20 Schuss: Fehlalarm Zehntel 4,9 %, ganze Ringe 4,4 %; Nachlassen erkannt Zehntel 40,2 %, ganze Ringe 39,1 %
B21  Ermüdung LP σ 15 mm, 40 Schuss: Fehlalarm Zehntel 5,4 %, ganze Ringe 4,4 %; Nachlassen erkannt Zehntel 38,7 %, ganze Ringe 37,7 %
B22  Pause LG σ 1,5 mm: Fehlalarm Zehntel 5,0 %, ganze Ringe 1,8 %; danach σ ×1,6 erkannt Zehntel 42,2 %, ganze Ringe 26,9 %; σ ×2 erkannt Zehntel 66,9 %, ganze Ringe 51,1 %
B22  Pause LP σ 15 mm: Fehlalarm Zehntel 4,6 %, ganze Ringe 3,4 %; danach σ ×1,6 erkannt Zehntel 44,0 %, ganze Ringe 38,8 %; σ ×2 erkannt Zehntel 68,1 %, ganze Ringe 63,8 %
B23  Form rund, länglich gemeldet: 5: 4,9 %, 10: 2,2 %, 20: 0,0 %, 40: 0,0 %
B23  Form a/b 1,25 erkannt: 5: 78,9 %, 10: 96,8 %, 20: 99,4 %, 40: 100,0 %
B23  Form a/b 1,5 erkannt: 5: 100,0 %, 10: 100,0 %, 20: 100,0 %, 40: 100,0 %
B24  Ausreißerrichtung rund, Richtung gemeldet: 5: 0,0 %, 10: 1,6 %, 20: 1,7 %, 40: 1,8 %
B24  Ausreißerrichtung a/b 2, Richtung gemeldet: 5: 0,0 %, 10: 2,8 %, 20: 2,6 %, 40: 2,8 %
B24  Ausreißerrichtung jeder zehnte 2σ links unten, erkannt: 5: 0,0 %, 10: 26,9 %, 20: 57,2 %, 40: 90,9 %
B24  Ausreißerrichtung jeder zehnte 3σ links unten, erkannt: 5: 0,0 %, 10: 97,6 %, 20: 100,0 %, 40: 100,0 %
B25  Lage ohne Versatz, versetzt gemeldet, Wandern 0,0, alle 40: 5: 2,5 %, 10: 2,9 %, 20: 3,2 %
B25  Lage ohne Versatz, versetzt gemeldet, Wandern 0,0, jede dritte 10: 5: 2,8 %, 10: 2,8 %, 20: 3,2 %
B25  Lage ohne Versatz, versetzt gemeldet, Wandern 0,1, alle 40: 5: 4,2 %, 10: 4,2 %, 20: 4,4 %
B25  Lage ohne Versatz, versetzt gemeldet, Wandern 0,1, jede dritte 10: 5: 4,1 %, 10: 4,3 %, 20: 4,9 %
B25  Lage ohne Versatz, versetzt gemeldet, Wandern 0,2, alle 40: 5: 5,1 %, 10: 5,1 %, 20: 4,8 %
B25  Lage ohne Versatz, versetzt gemeldet, Wandern 0,2, jede dritte 10: 5: 5,8 %, 10: 5,5 %, 20: 5,6 %
B25  Lage ohne Versatz, versetzt gemeldet, Wandern 0,3, alle 40: 5: 5,3 %, 10: 5,0 %, 20: 5,0 %
B25  Lage ohne Versatz, versetzt gemeldet, Wandern 0,3, jede dritte 10: 5: 6,1 %, 10: 5,4 %, 20: 5,4 %
B25  Lage Versatz 0,3σ erkannt, Wandern 0,0, alle 40: 5: 74,4 %, 10: 99,7 %, 20: 100,0 %
B25  Lage Versatz 0,3σ erkannt, Wandern 0,0, jede dritte 10: 5: 67,0 %, 10: 98,5 %, 20: 100,0 %
B25  Lage Versatz 0,3σ erkannt, Wandern 0,1, alle 40: 5: 60,8 %, 10: 98,1 %, 20: 100,0 %
B25  Lage Versatz 0,3σ erkannt, Wandern 0,1, jede dritte 10: 5: 55,1 %, 10: 93,8 %, 20: 100,0 %
B25  Lage Versatz 0,3σ erkannt, Wandern 0,2, alle 40: 5: 36,6 %, 10: 83,3 %, 20: 99,6 %
B25  Lage Versatz 0,3σ erkannt, Wandern 0,2, jede dritte 10: 5: 34,4 %, 10: 74,8 %, 20: 98,4 %
B25  Lage Versatz 0,3σ erkannt, Wandern 0,3, alle 40: 5: 22,4 %, 10: 57,5 %, 20: 92,8 %
B25  Lage Versatz 0,3σ erkannt, Wandern 0,3, jede dritte 10: 5: 22,5 %, 10: 50,3 %, 20: 86,7 %
B25  Lage nur seitlich wandernd, ohne Versatz versetzt gemeldet, Wandern 0,3, alle 40: 5: 3,7 %, 10: 3,9 %, 20: 4,2 %
B25  Lage nur seitlich wandernd, ohne Versatz versetzt gemeldet, Wandern 0,3, jede dritte 10: 5: 4,4 %, 10: 4,2 %, 20: 4,2 %
B25  Lage nur seitlich wandernd, Versatz 0,3σ in der Höhe erkannt, Wandern 0,3, alle 40: 5: 75,6 %, 10: 99,8 %, 20: 100,0 %
B25  Lage nur seitlich wandernd, Versatz 0,3σ in der Höhe erkannt, Wandern 0,3, jede dritte 10: 5: 67,7 %, 10: 98,3 %, 20: 100,0 %
B25  Lage höchster Fehlalarm: 6,1 %, ohne Wandern 3,2 %
B26  Ergebnis zweier Scheiben LG σ 1,5 mm, Zehntel: Fehlalarm 20: 4,5 %, 40: 4,4 %, 60: 5,5 %
B26  Ergebnis zweier Scheiben LG σ 1,5 mm, Zehntel: B σ ×1,25 erkannt 20: 22,3 %, 40: 40,5 %, 60: 55,2 %
B26  Ergebnis zweier Scheiben LG σ 1,5 mm, ganze Ringe: Fehlalarm 20: 2,4 %, 40: 4,6 %, 60: 4,5 %
B26  Ergebnis zweier Scheiben LG σ 1,5 mm, ganze Ringe: B σ ×1,25 erkannt 20: 12,7 %, 40: 35,0 %, 60: 49,4 %
B26  Ergebnis zweier Scheiben LP σ 15 mm, Zehntel: Fehlalarm 20: 5,2 %, 40: 4,6 %, 60: 4,9 %
B26  Ergebnis zweier Scheiben LP σ 15 mm, Zehntel: B σ ×1,25 erkannt 20: 20,9 %, 40: 39,7 %, 60: 54,8 %
B26  Ergebnis zweier Scheiben LP σ 15 mm, ganze Ringe: Fehlalarm 20: 5,0 %, 40: 4,8 %, 60: 5,3 %
B26  Ergebnis zweier Scheiben LP σ 15 mm, ganze Ringe: B σ ×1,25 erkannt 20: 20,3 %, 40: 38,9 %, 60: 54,1 %
B27  Streuung zweier Scheiben rund, Urteil trotz gleicher Streuung: 20: 5,5 %, 40: 5,2 %, 60: 5,0 %
B27  Streuung zweier Scheiben a/b 2, Urteil trotz gleicher Streuung: 20: 5,6 %, 40: 4,9 %, 60: 5,2 %
B27  Streuung zweier Scheiben B σ ×1,25 erkannt: 20: 22,3 %, 40: 39,3 %, 60: 55,2 %
B27  Streuung zweier Scheiben B σ ×1,5 erkannt: 20: 55,7 %, 40: 85,6 %, 60: 96,3 %
B28  Lage Schuss für Schuss, ohne Versatz, versetzt gemeldet: 20: 5,4 %, 40: 5,0 %, 60: 4,9 %
B28  Lage Schuss für Schuss, Versatz 0,5σ erkannt: 20: 25,3 %, 40: 49,1 %, 60: 68,6 %
B28  Lage zweier Zeiträume ohne Versatz, versetzt gemeldet, Wandern 0,0, alle 40: 5: 1,9 %, 10: 2,6 %, 20: 3,4 %
B28  Lage zweier Zeiträume ohne Versatz, versetzt gemeldet, Wandern 0,0, jede dritte 10: 5: 2,0 %, 10: 2,5 %, 20: 3,1 %
B28  Lage zweier Zeiträume ohne Versatz, versetzt gemeldet, Wandern 0,1, alle 40: 5: 3,1 %, 10: 4,0 %, 20: 4,8 %
B28  Lage zweier Zeiträume ohne Versatz, versetzt gemeldet, Wandern 0,1, jede dritte 10: 5: 3,1 %, 10: 3,8 %, 20: 4,5 %
B28  Lage zweier Zeiträume ohne Versatz, versetzt gemeldet, Wandern 0,2, alle 40: 5: 4,0 %, 10: 4,4 %, 20: 4,8 %
B28  Lage zweier Zeiträume ohne Versatz, versetzt gemeldet, Wandern 0,2, jede dritte 10: 5: 4,3 %, 10: 5,1 %, 20: 5,0 %
B28  Lage zweier Zeiträume ohne Versatz, versetzt gemeldet, Wandern 0,3, alle 40: 5: 4,3 %, 10: 4,7 %, 20: 4,9 %
B28  Lage zweier Zeiträume ohne Versatz, versetzt gemeldet, Wandern 0,3, jede dritte 10: 5: 4,7 %, 10: 4,9 %, 20: 5,0 %
B28  Lage zweier Zeiträume Versatz 0,3σ erkannt, Wandern 0,0, alle 40: 5: 55,7 %, 10: 94,7 %, 20: 100,0 %
B28  Lage zweier Zeiträume Versatz 0,3σ erkannt, Wandern 0,0, jede dritte 10: 5: 45,8 %, 10: 85,5 %, 20: 99,7 %
B28  Lage zweier Zeiträume Versatz 0,3σ erkannt, Wandern 0,1, alle 40: 5: 42,1 %, 10: 85,4 %, 20: 99,6 %
B28  Lage zweier Zeiträume Versatz 0,3σ erkannt, Wandern 0,1, jede dritte 10: 5: 36,5 %, 10: 74,0 %, 20: 98,1 %
B28  Lage zweier Zeiträume Versatz 0,3σ erkannt, Wandern 0,2, alle 40: 5: 24,2 %, 10: 58,3 %, 20: 91,2 %
B28  Lage zweier Zeiträume Versatz 0,3σ erkannt, Wandern 0,2, jede dritte 10: 5: 22,5 %, 10: 48,9 %, 20: 84,4 %
B28  Lage zweier Zeiträume Versatz 0,3σ erkannt, Wandern 0,3, alle 40: 5: 14,5 %, 10: 35,9 %, 20: 68,9 %
B28  Lage zweier Zeiträume Versatz 0,3σ erkannt, Wandern 0,3, jede dritte 10: 5: 14,1 %, 10: 29,7 %, 20: 59,2 %
B28  Lage zweier Zeiträume höchster Fehlalarm: 5,1 %, ohne Wandern 3,4 %
B19  Ø je Schuss, Urteil trotz gleicher Streuung, Wandern 0,0, alle 40: 5: 2,2 %, 10: 3,0 %, 20: 3,5 %
B19  Ø je Schuss, Urteil trotz gleicher Streuung, Wandern 0,0, jede dritte 10: 5: 2,2 %, 10: 3,1 %, 20: 3,2 %
B19  Ø je Schuss, Urteil trotz gleicher Streuung, Wandern 0,1, alle 40: 5: 2,4 %, 10: 3,0 %, 20: 3,7 %
B19  Ø je Schuss, Urteil trotz gleicher Streuung, Wandern 0,1, jede dritte 10: 5: 2,4 %, 10: 3,0 %, 20: 3,4 %
B19  Ø je Schuss, Urteil trotz gleicher Streuung, Wandern 0,2, alle 40: 5: 2,4 %, 10: 3,3 %, 20: 3,5 %
B19  Ø je Schuss, Urteil trotz gleicher Streuung, Wandern 0,2, jede dritte 10: 5: 2,5 %, 10: 3,2 %, 20: 3,8 %
B19  Ø je Schuss, Urteil trotz gleicher Streuung, Wandern 0,3, alle 40: 5: 2,8 %, 10: 3,6 %, 20: 4,3 %
B19  Ø je Schuss, Urteil trotz gleicher Streuung, Wandern 0,3, jede dritte 10: 5: 2,9 %, 10: 3,7 %, 20: 4,2 %
B19  Ø je Schuss, σ 1,5 → 1,3 mm erkannt, Wandern 0,0, alle 40: 5: 59,6 %, 10: 94,1 %, 20: 100,0 %
B19  Ø je Schuss, σ 1,5 → 1,3 mm erkannt, Wandern 0,0, jede dritte 10: 5: 51,6 %, 10: 86,3 %, 20: 99,5 %
B19  Ø je Schuss, σ 1,5 → 1,3 mm erkannt, Wandern 0,1, alle 40: 5: 59,7 %, 10: 94,3 %, 20: 100,0 %
B19  Ø je Schuss, σ 1,5 → 1,3 mm erkannt, Wandern 0,1, jede dritte 10: 5: 51,1 %, 10: 86,2 %, 20: 99,6 %
B19  Ø je Schuss, σ 1,5 → 1,3 mm erkannt, Wandern 0,2, alle 40: 5: 58,8 %, 10: 93,3 %, 20: 99,9 %
B19  Ø je Schuss, σ 1,5 → 1,3 mm erkannt, Wandern 0,2, jede dritte 10: 5: 50,2 %, 10: 84,5 %, 20: 99,4 %
B19  Ø je Schuss, σ 1,5 → 1,3 mm erkannt, Wandern 0,3, alle 40: 5: 52,8 %, 10: 89,6 %, 20: 99,7 %
B19  Ø je Schuss, σ 1,5 → 1,3 mm erkannt, Wandern 0,3, jede dritte 10: 5: 44,6 %, 10: 80,3 %, 20: 98,7 %
B19  Ø je Schuss höchster Fehlalarm: 4,3 %, ohne Wandern 3,5 %
B29  Streuung, Urteil trotz gleicher Streuung, Wandern 0,0, alle 40: 5: 2,6 %, 10: 3,7 %, 20: 4,5 %
B29  Streuung, Urteil trotz gleicher Streuung, Wandern 0,0, jede dritte 10: 5: 2,4 %, 10: 3,6 %, 20: 4,1 %
B29  Streuung, Urteil trotz gleicher Streuung, Wandern 0,1, alle 40: 5: 4,3 %, 10: 4,9 %, 20: 5,0 %
B29  Streuung, Urteil trotz gleicher Streuung, Wandern 0,1, jede dritte 10: 5: 4,0 %, 10: 4,9 %, 20: 5,0 %
B29  Streuung, Urteil trotz gleicher Streuung, Wandern 0,2, alle 40: 5: 4,3 %, 10: 5,1 %, 20: 5,3 %
B29  Streuung, Urteil trotz gleicher Streuung, Wandern 0,2, jede dritte 10: 5: 4,4 %, 10: 4,8 %, 20: 5,2 %
B29  Streuung σ 1,5 → 1,3 mm erkannt, Wandern 0,0, alle 40: 5: 64,6 %, 10: 95,8 %, 20: 100,0 %
B29  Streuung σ 1,5 → 1,3 mm erkannt, Wandern 0,0, jede dritte 10: 5: 48,3 %, 10: 75,5 %, 20: 96,3 %
B29  Streuung σ 1,5 → 1,3 mm erkannt, Wandern 0,1, alle 40: 5: 31,6 %, 10: 64,9 %, 20: 93,0 %
B29  Streuung σ 1,5 → 1,3 mm erkannt, Wandern 0,1, jede dritte 10: 5: 26,1 %, 10: 50,7 %, 20: 82,3 %
B29  Streuung σ 1,5 → 1,3 mm erkannt, Wandern 0,2, alle 40: 5: 14,0 %, 10: 28,9 %, 20: 53,3 %
B29  Streuung σ 1,5 → 1,3 mm erkannt, Wandern 0,2, jede dritte 10: 5: 13,5 %, 10: 25,5 %, 20: 48,1 %
B29  Streuung höchster Fehlalarm: 5,3 %, ohne Wandern 4,5 %
```

Zusätzlich aus den drei Prüfungen vom 6./7. Oktober (nur lesend, eigene Skripte): Ausreißer-Fehlalarm bei a/b 1,5 und 3 (Einzeltest mit α 0,05), Trennschärfe der Form (a/b 1,3: 28 % bei 40 Schuss), Effizienz der Streumaße gegenüber σ̂ (Streukreis 0,77 bei 10 und 0,39 bei 60 Schuss, mittlerer Radius 0,92, Höhe/Breite 0,23–0,43), Teiler-Ø gegen Ø je Schuss r = −0,998.

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
