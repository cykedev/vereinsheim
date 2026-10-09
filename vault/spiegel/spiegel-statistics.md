---
id: spiegel-statistics
type: concept
title: "Spiegel — Statistik-Katalog"
aliases: [statistik-katalog, statistiken, analyse-katalog, profi-analyse]
keywords: [statistik, statistiken, kennzahl, analyse, profi, systematisch trainieren, trefferbild, präzision, streuung, sigma, rayleigh, cep, r50, mittlerer radius, streukreis, trefferkreis, extreme spread, höhe, breite, ellipse, schwerpunkt, trefferlage, hotelling, vertrauensbereich, wilson, ringverlust, lageverlust, richtungsuhr, ausreißer, drift, von neumann, ringverteilung, zähler, histogramm, tempo, rhythmus, pause, ermüdung, trend, theil-sen, gleitender schnitt, serien, probe, eingeschossen, rekorde, verlauf, formband, vergleich, munitionslos, wettkampf, druck, soll-schnitt, beobachtungen, esta 5, ballistic manager, shotsapp, ring reader, targetscan, scatt, shotanalyzer, kongsberg, sius]
part_of: ["[[spiegel]]"]
relates_to: ["[[spiegel-metrics]]", "[[spiegel-ui-design]]", "[[spiegel-edge-cases]]", "[[spiegel-vision]]", "[[statistics-visualization]]", "[[meyton-printout]]"]
---

**TL;DR** Alle Statistiken, die Spiegel mit Meyton-Rohdaten sinnvoll zeigen kann: 99 Katalog-IDs in 13 Themen (6 davon entfernt), je mit Definition, Priorität und Platz in der Roadmap. Was eine einzelne Scheibe hergibt, rechnet der Fachkern seit SP-1.10; Verläufe, Rekorde und Vergleiche über Zeiträume folgen in Phase 2. Leitbild ist ein Profi-Werkzeug zum systematischen Trainieren und Analysieren, das jede Zahl ehrlich zeigt: mit n, Unsicherheit und dem Hinweis „unklar“, wenn die Daten nicht reichen.

# Spiegel — Statistik-Katalog

## Leitbild

Der User will ein Profi-Werkzeug, „das mir viele gute Informationen zeigt, mit denen ich systematisch trainieren kann und mit dem ich analysieren kann“ (6. Oktober 2026). Daraus folgt:

- **Viel, aber geordnet, und nichts doppelt:** Statistiken nach Themen, das Wichtigste (Priorität A) zuerst, der Rest auf Antippen. Eine Zahl, die aus einer anderen folgt oder dasselbe nur verrauschter misst, fällt weg (Oktober 2026, Maßstab Sa); die Zeile bleibt mit Grund, die ID wird nie wiederverwendet.
- **Ehrlich:** Jede Zahl steht auf einer sichtbaren Grundlage (n, Zeitraum, Filter). Unter der Mindestzahl steht „–“ mit Grund, Unsicherheit wird gezeigt, und „unklar“ ist ein normales Ergebnis.
- **Handlungsnah:** Wo es geht, sagt die Statistik, was zu tun ist („Lage echt, zentriert wären es 2,4 Ringe mehr“) statt nur Zahlen zu liefern.
- **Messdaten, kein Tagebuch:** Ziele, Absicht, Reflexion und Befinden bleiben laut [[adr-026]] in Treffsicher. Spiegel liefert die Messung, Übungen mit messbarem Kriterium und die Auswertung.

## Notation

vᵢ ist der Zehntelwert, Ringᵢ der ganze Ring, n die Zahl der zählenden Schüsse. Jede Statistik über Werte gibt es in beiden Wertungen; in ganzen Ringen steht Ringᵢ für vᵢ (Ausnahme: die Zehntelverteilung V2). Lage pᵢ in mm (Mitte 0, x rechts, y oben); Schwerpunkt m = (x̄, ȳ); rᵢ = |pᵢ − m|, dᵢ = |pᵢ| (Teiler = dᵢ in 1/100 mm). Sx, Sy mit n − 1. W ist der Ringabstand (LG 2,5 mm, LP 8 mm). Ebenen: Schuss, Serie, Scheibe, Zeitraum. Priorität A (früh, großer Nutzen), B (später), C (schön zu haben). Spalte „Wo“: Roadmap-Feature oder „vorhanden“ (seit SP-1.2 in der Registry).

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
| E2 | Ø je Schuss | Σ vᵢ / n, in beiden Wertungen | Serie, Scheibe, Zeitraum | A | vorhanden |
| E3 | Hochrechnung | Ø je Schuss × Soll-Schusszahl; nie als Rekord (SF-09) | Scheibe | B | SP-1.8 |
| E4 | Zehner und Zehnerquote | Anzahl Ring 10; Quote mit Wilson-Intervall | Serie, Scheibe, Zeitraum | A | vorhanden (Anzahl), SP-1.10 (Quote) |
| E5 | Innenzehner | Anzahl; LG und LP nicht vergleichbar. Die Quote mit Wilson-Intervall entfällt (Oktober 2026): Sie rechnete nur die Spielwiese selbst, und die Anzahl steht wie auf dem Ausdruck | Serie, Scheibe, Zeitraum | A | vorhanden |
| E6 | Bester und schwächster Schuss | **entfernt (Oktober 2026):** folgt aus E8, der kleinste Teiler ist der beste Schuss, der größte der schwächste | – | – | entfernt (SP-1.12) |
| E7 | Teiler-Schnitt und -Median | **entfernt (Oktober 2026):** läuft mit dem Ø je Schuss (E2) zu r = −0,998, weil der Zehntelwert linear im Abstand ist | – | – | entfernt (SP-1.12) |
| E8 | Beste und weiteste Teiler | je drei mit Schussnummer, wie auf dem Ausdruck | Serie, Scheibe | B | SP-1.10 |
| E9 | Ringverlust | n·10 − ΣRing bzw. n·10,9 − Σvᵢ; seit Oktober 2026 als `total` in L4 (Lage + Streuung), keine eigene Auswertung mehr; nur, wenn jeder Wertungsschuss eine Lage hat und keiner verdächtig ist, sonst wäre es eine Teilsumme (SF-07) | Serie, Scheibe | B | SP-1.10, SP-1.12 |
| E10 | Konstanz | SD und Spanne der Serien gleicher Länge, MAD der vᵢ | Scheibe, Zeitraum | A | SP-1.10 |
| E11 | Anteil über Schwelle | Anteil vᵢ ≥ s mit Wilson-Intervall | Serie, Scheibe, Zeitraum | B | SP-1.10 |

### 2 Trefferbild und Präzision

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| P1 | Streukreis (Meyton: Trefferkreis) | kleinster Kreis um alle Trefferzentren; wächst mit n | Serie, Scheibe | A | vorhanden |
| P2 | Extreme Spread | größter Abstand zweier Treffer | Serie, Scheibe | C | Funktion `extremeSpread` |
| P3 | Mittlerer Radius | **entfernt (Oktober 2026):** ≈ 1,24 · σ̂ mit mehr Rauschen (Effizienz 0,92), weder robust noch auf dem Ausdruck | – | – | entfernt (SP-1.12) |
| P4 | R50 (≈ CEP50) | Median der rᵢ ohne Fehlschüsse | Serie, Scheibe, Zeitraum | A | vorhanden |
| P5 | Rayleigh-σ | σ̂ = √(Σrᵢ²/(2(n−1)))/c4(2n−1), 95-%-Bereich über χ² mit 2(n−1) Freiheitsgraden; kaum n-abhängig. Den Wert vor der Korrektur nennt Meytons Ballistic Manager „Sa“ (bei 10 Schuss 1,4 % kleiner, bei 40 Schuss 0,3 %). Spiegel zeigt ihn nicht: kein Vorteil gegenüber σ̂, gegen Meyton nicht prüfbar (ESTA 5 und der Ausdruck nennen ihn nicht), zwei fast gleiche Zahlen verwirren (Entscheidung des Users, Oktober 2026) | Scheibe, Zeitraum | B | SP-1.10 |
| P6 | Streuung x und y | Sx und Sy | Serie, Scheibe, Zeitraum | A | vorhanden |
| P7 | Höhe und Breite | **entfernt (Oktober 2026):** Effizienz 0,23–0,43 gegenüber σ̂, ein Ausreißer macht die Breite 59–87 % größer; „senkrecht oder waagrecht?“ beantworten P6 und P8 | – | – | entfernt (SP-1.12) |
| P8 | Form der Gruppe | Halbachsen und Winkel der Kovarianz-Ellipse ohne die von V6 markierten Ausreißer (seit Oktober 2026; vorher streckte ein Abreißer die Ellipse in seine Richtung), Verhältnis a/b; gestreckt nur, wenn Mauchlys Test es mit 95 % zeigt (W = 4a²b²/(a²+b²)² unter 0,05^(2/(n−2)), für eine Normalgruppe exakt); dazu das a/b, ab dem das bei dieser Schusszahl gilt (12 Schuss 2,26, 20 Schuss 1,81, 40 Schuss 1,50, 120 Schuss 1,25). Eine runde Gruppe zeigt zufällig im Median a/b 1,32 bei 20 und 1,21 bei 40 Schuss; eine echte Streckung von 1,3 erkennt eine Scheibe mit 40 Schuss nur in 26 % der Fälle, über 120 Schuss in 71 % (B17). Ohne die Ausreißer ist der Test eine Näherung (B18): Eine runde Gruppe gilt in 4 bis 5 % der Scheiben als gestreckt, eine runde mit Abreißern in 6 bis 8 % statt 13 bis 16 % über alle Schüsse. Deutlich gestreckte, kurze Gruppen erkennt er seltener (a/b 3 bei 10 Schuss: 67 statt 78 %), weil der runde Ausreißer-Test dort einen Schuss an der Spitze herausnehmen kann. Winkel erst ab 10 Schuss | Scheibe, Zeitraum | B | SP-1.10 |
| P9 | Streuung in Ringbreiten | R50 / W (bis Oktober 2026 MR / W) | Scheibe, Zeitraum | B | SP-1.10, SP-1.12 |
| P10 | Erwartete Zehnerquote | P(d ≤ W) für eine Normalgruppe mit σ̂ und m (Modell) | Scheibe, Zeitraum | C | später |

### 3 Lage und Systematik

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| L1 | Schwerpunkt (Meyton: Trefferlage) | m mit Richtung; ohne Trennung nach Visierverstellungen, die Spiegel nicht abfragt (SF-63) | Serie, Scheibe, Zeitraum | A | SP-1.10 |
| L2 | Schwerpunkt-Abstand | |m|; der Schwerpunkt selbst ist unsicher (aus 10 Schuss ≈ 0,4σ) | Serie, Scheibe, Zeitraum | A | vorhanden |
| L3 | Ist die Lage echt? | Hotelling-T² gegen F(2, n−2), 95-%-Ellipse um m | Scheibe, Zeitraum | A | SP-1.10 |
| L4 | Ringe durch Lage gegen Streuung | jeder Treffer um den Schwerpunkt der übrigen verschoben (Leave-one-out, (pᵢ − m) · n/(n − 1)) und neu gewertet: Lage- und Streuungsverlust, zusammen E9. Schätzt, was eine Korrektur auf neuen Schüssen bringt (B5); in der Stichprobe zentriert zeigte er ohne jeden Versatz im Mittel +0,38 Ringe Scheingewinn (LG σ 1,5 mm). Erst ab 10 Schuss, wenn L3 „echt“ sagt und die Korrektur gewinnt; nie amtlich | Serie, Scheibe, Zeitraum | A | SP-1.10, SP-1.12 |
| L5 | Lageanteil am Fehler | **entfernt (Oktober 2026):** dieselbe Aussage wie der Lage-Verlust aus L4, nur in Prozent vom Quadrat; die Lesehilfe „10 %: kein Thema“ widersprach L3 | – | – | entfernt (SP-1.12) |
| L6 | Richtungsuhr | Anteil je Uhrzeit (30°-Sektor) um die Mitte oder um m; aussagekräftig ab 30 Schuss, darunter nur ein Bild | Scheibe, Zeitraum | B | SP-1.10 |
| L7 | Ausreißerrichtung | Richtungsuhr der schwächsten 10 % relativ zu m | Zeitraum | B | SP-2.7 |
| L8 | Drift in der Abgabefolge | von-Neumann-Verhältnis je Sprung normiert (≈ 2 unabhängig, < 2 Wandern); ohne Urteil, weil es bei kleinem n stark streut (B8). Ø und größter Sprung entfallen (Oktober 2026, im Mittel √π · σ) | Scheibe | C | SP-1.10 |
| L9 | Langzeit-Trefferbild | alle Schüsse eines Zeitraums als Dichte, je Familie; dazu die Form über mehrere Scheiben (Kovarianz je Scheibe um ihren eigenen Schwerpunkt, gepoolt), die eine leichte Streckung (a/b 1,2–1,3) erst sichtbar macht | Zeitraum | B | SP-2.7 |
| L10 | Lage über Zeit | Schwerpunkt je Scheibe als Wolke mit Pfad, nach n gewichtet | Zeitraum | B | SP-2.7 |
| L11 | Visierkorrektur in Klicks | −m / Klickweg; nur wenn L3 „echt“ sagt | Scheibe | C | SP-2.3 (Ausrüstung) |

### 4 Verteilung

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| V1 | Ringverteilung (Zähler) | Anzahl je Ring 10…0 plus Innenzehner; Histogramm, keine Torte | Serie, Scheibe, Zeitraum | A | SP-1.10 |
| V2 | Zehntelverteilung | Histogramm der vᵢ in 0,1-Klassen; geprüft Oktober 2026, bleibt (Wunsch des Users); auf einer Scheibe zählt die Gesamtform, nicht die einzelne Säule | Scheibe, Zeitraum | B | SP-1.10 |
| V3 | Abstandskurve | Anteil der Schüsse mit Teiler ≤ t | Zeitraum | B | SP-2.1 |
| V4 | Verteilung der Serien | Quartile der Serienergebnisse je Monat | Zeitraum | B | SP-2.1 |
| V5 | Ringanteile im Zeitverlauf | Anteil je Ring je Scheibe, gestapelt | Zeitraum | B | SP-2.1 |
| V6 | Ausreißer | schrittweise (verallgemeinerter ESD nach Rosner, in der Ebene): der weiteste Schuss gegen die übrigen m, T = d²/(2S²(1 + 1/(m−1))) gegen F(2, 2(m−2)) beim Quantil 1 − 0,04/m, dann ohne ihn weiter; höchstens max(2, ⌊n/10⌋) Schritte ab 10 Schuss, darunter einer; Ausreißer sind die bis zum letzten Schritt über seiner Grenze. Fehlalarm in einer runden Normalgruppe etwa 4 bis 5 % je Scheibe (Q3 + 1,5·IQR auf den Radien wären bis 47 %), bei gestreckten mehr (a/b 2: etwa 11–18 %, B2; ein affiner Test für gestreckte Gruppen ist offen). Zwei nahe Abreißer verdecken sich ab 10 Schuss nicht mehr (B14). Die Form (P8) rechnet ohne die markierten Schüsse. Bis Oktober 2026 jeder Schuss einzeln mit α 0,05 (zwei gleich weite bei 10 Schuss: einer in 13,7 %). Das Verhältnis Ø Abstand/R50 entfällt (Oktober 2026): ohne Grenze, und es zählt Fehlschüsse anders als R50 | Scheibe, Zeitraum | B | SP-1.10, SP-1.12 |
| V7 | Ringverlust durch Ausreißer | Σ(Median der übrigen − vᵢ) über die von V6 markierten Schüsse, negativ möglich; unbekannt, wenn einem markierten Schuss der Wert fehlt (SF-07). Bis Oktober 2026 über die schwächsten 10 %: Den großen Verlust dort hat jede normale Gruppe (LG σ 1,5 mm, 40 Schuss etwa 3 Ringe) | Scheibe, Zeitraum | B | SP-1.10, SP-1.12 |

### 5 Zeit und Rhythmus

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| Z1 | Tempo | Median der Intervalle ohne Pausen | Serie, Scheibe, Zeitraum | A | vorhanden |
| Z2 | Tempo-Konstanz | IQR der Intervalle, auch relativ zum Median; konstanter ist nicht automatisch besser | Scheibe, Zeitraum | A | SP-1.10 |
| Z3 | Dauer | erster bis letzter Schuss (`time.duration`); Netto-Zeit und Schüsse je Stunde entfernt (Oktober 2026): Σ Abstände und 3600 / Ø Abstand | Scheibe, Zeitraum | A | SP-1.10 |
| Z4 | Pausen und Wiedereinstieg | Anzahl und Summe; Ø der bis zu drei Schüsse nach einer Pause gegen den Ø der übrigen (B10). Die längste Pause als Kennzahl entfällt (Oktober 2026) | Scheibe, Zeitraum | A | SP-1.10 |
| Z5 | Rhythmus-Profil | gleitender Median der Intervalle über die Schussnummer | Scheibe | B | SP-1.10 |
| Z6 | Tempo und Wert | Ø vᵢ je Klasse des Intervalls davor; einige hundert Schuss | Zeitraum | B | SP-2.7 |
| Z7 | Tempo nach schwachem Schuss | Intervall nach schwachen gegen nach übrigen Schüssen | Zeitraum | C | SP-2.7 |
| Z8 | Zeitbedarf für die Disziplin | Netto-Tempo × Soll-Schusszahl gegen ein gepflegtes Zeitlimit | Scheibe, Zeitraum | C | später |

### 6 Verlauf in der Einheit

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| I1 | Serienkurve | Serienergebnisse in Reihenfolge; im Zeitraum Min/Max/Ø je Position | Scheibe, Zeitraum | A | SP-1.10 |
| I2 | Ermüdung | Ø der letzten zehn minus der ersten zehn, R50 ebenso; als Muster erst über mehrere Scheiben | Scheibe, Zeitraum | A | SP-1.10 |
| I3 | Trend in der Scheibe | Steigung der Ausgleichsgeraden je zehn Schuss; „klar“ nach Mann-Kendall mit Bindungs- und Stetigkeitskorrektur (95 %), mit Richtung (B6), und nur, wenn die Gerade dieselbe Richtung zeigt: Ein sehr schwacher Schuss am Rand kann sie kippen, dann stünde „klar steigend“ neben einer fallenden Zahl. Bis Oktober 2026 Theil-Sen mit Sen-Intervall: Bei gleichen Werten lag die Grenze auf 0, selbst die Stufe zehnmal 9, zehnmal 10 hieß „nicht klar“ | Scheibe | B | SP-1.10, SP-1.12 |
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
| S1 | Versatz Probe → Wertung | Schwerpunkt der letzten fünf Probeschüsse mit Lage gegen die Wertung, in S4 (`matchOffsetUm`); bis Oktober 2026 eine eigene Registry-Kennzahl | Scheibe | A | SP-1.12 |
| S2 | Probe-Umfang | Zahl bis zum ersten Wertungsschuss, Blöcke à zehn, Dauer, Zeit bis zum ersten Wertungsschuss | Scheibe, Zeitraum | A | SP-1.10 |
| S3 | Probe-Qualität | Ø, R50 und σ̂ der ganzen Probe vor der Wertung gegen die Wertung; R50 hängt an n, σ̂ kaum | Scheibe, Zeitraum | B | SP-1.10 |
| S4 | Eingeschossen? | Lage der letzten fünf Probeschüsse mit Lage, Vertrauensbereich wie L3; „kein Versatz nachweisbar“ heißt nicht „eingeschossen“ | Scheibe | C | SP-1.10 |
| S5 | Visierverstellungen | **entfernt (Oktober 2026):** Spiegel fragt keine Visierverstellung ab, das ist zu viel Komplexität für ihren Nutzen (User, 8. Oktober 2026) | – | – | entfernt (SP-1.8) |

### 8 Langzeit und Trend

| ID | Kennzahl | Definition | Ebene | Prio | Wo |
|---|---|---|---|---|---|
| T1 | Verlauf jeder Kennzahl | Wert je Scheibe aus der Registry über ihre Wertungsschüsse, gleitender Schnitt über die letzten fünf Scheiben („bisher“, solange es keine fünf sind); Familie und Abschnitt (Woche, Monat) wählt der Aufrufer, n-abhängige Maße nur bei gleichem n | Zeitraum | A | SP-2.1, Fachkern L2 (`cardValues`, `periodTrend`) |
| T2 | Formband | gleitender Schnitt ± 1,4826 · MAD der Abweichungen der Scheiben vom vollen Schnitt, ab zehn Scheiben, ohne Schwankung (MAD 0) kein Band; ein gleichbleibender Schütze liegt mit etwa zwei von drei Scheiben im Band (B20) | Zeitraum | A | SP-2.1, Fachkern L2 (`periodTrend`) |
| T3 | Bedeutsame Veränderung | Δ der Mittel zweier Zeiträume gegen die gepoolte Standardabweichung der Scheibenwerte, bedeutsam ab 0,3 × (Hopkins), ab fünf Scheiben je Seite; zählt nur zusammen mit einem Urteil aus C3, denn ohne Veränderung trifft es bei 5 gegen 5 Scheiben in etwa sechs von zehn Fällen zu (B19) | Zeitraum | B | SP-2.7, Fachkern L2 (`comparePeriods`) |
| T4 | Trendsteigung | Theil-Sen je Monat mit Intervall; nicht in die Zukunft verlängern | Zeitraum | B | SP-2.7 |
| T5 | Boden und Decke | P10, Median und P90 der Scheibenwerte je Abschnitt (Monat), P10 und P90 ab fünf Scheiben | Zeitraum | B | SP-2.1, Fachkern L2 (`periodBuckets`) |
| T6 | Trainingsumfang | Schüsse (Probe und Wertung), Scheiben und Tage je Woche; keine Netto-Zeit, sie folgt aus den Abständen | Zeitraum | A | SP-2.1, Fachkern L2 (`trainingVolume`) |
| T7 | Kalender | Trainingstage als Kalender | Zeitraum | B | SP-2.1 |
| T8 | Erfolgsserien | Wochen in Folge mit Training, Scheiben über dem eigenen Schnitt | Zeitraum | C | SP-2.8 |

### 9 Rekorde und Meilensteine

Nur endgültige, vollständige Scheiben, ohne einen verdächtigen Schuss unter denen, die zählen (Wertung; bei nur Probe die Probe), und ohne die Merkmale nur-pdf, neu-gewertet und ausgenommen (SF-15, SF-66); je Familie und je Wertung, wahlweise nur Training oder nur Wettkampf. R1, R4 (volle Scheibe), R5 und R6 je Schusszahl, R2 je Serienlänge; bei Gleichstand gilt der frühere; Zählungen (R5–R7) erst ab einem Treffer. Eine Scheibe nur mit Probe zählt nur auf Wunsch, dann ihre Probe wie Wertung in Serien zu zehn (SF-01); ebenso eine, deren Probe als Wertung gezählt ist (SF-05, Merkmal `als-wertung-gezaehlt`, User, 9. Oktober 2026). Umgesetzt im Fachkern L2 (`recordEligible`, `periodRecords`).

| ID | Kennzahl | Prio | Wo |
|---|---|---|---|
| R1 | Beste Scheibe je Schusszahl | A | SP-2.1, Fachkern L2 |
| R2 | Beste Serie voller Länge (die häufigste Serienlänge der Scheibe), je Serienlänge | A | SP-2.1, Fachkern L2 |
| R3 | Bester Teiler, zugleich der beste Schuss | A | SP-2.1, Fachkern L2 |
| R4 | Engste Gruppe (Streukreis) über eine Serie zu zehn und über die volle Scheibe, nur wenn jeder Schuss eine Lage hat | A | SP-2.1, Fachkern L2 |
| R5 | Meiste 10,9 (nur in Zehnteln); der beste Schuss ist der beste Teiler (R3) | B | SP-2.1, Fachkern L2 |
| R6 | Meiste Zehner und Innenzehner | B | SP-2.1, Fachkern L2 |
| R7 | Längste Zehnerfolge | B | SP-2.1, Fachkern L2 |
| R8 | Beste Form (höchster voller Schnitt je Schuss über fünf Scheiben) | C | SP-2.1, Fachkern L2 |
| R9 | Meilensteine (1 000 Schuss, erste 10,9, Abstand zum Rekord) | C | SP-2.8 |

### 10 Vergleiche

| ID | Kennzahl | Definition | Prio | Wo |
|---|---|---|---|---|
| C1 | Serie gegen Serie | alle Serien mit jeder Kennzahl, beste und engste markiert | A | SP-1.8 |
| C2 | Scheibe gegen Scheibe | zwei Gruppen auf einer Scheibe, Tabelle mit Δ | A | SP-2.2 |
| C3 | Zeitraum gegen Zeitraum | Werte je Scheibe zweier Zeiträume, Einheit ist die Scheibe: Mann-Whitney zweiseitig, α 0,05, bis 20 Scheiben je Seite genau ausgezählt; Δ der Mittel; Urteil höher, tiefer oder unklar ab fünf Scheiben je Seite, unklar auch, wenn Test und Mittel verschieden zeigen; Fehlalarm höchstens etwa 5 % (B19); Abstandskurven übereinander mit der Oberfläche (L3) | A | SP-2.2, Fachkern L2 (`comparePeriods`) |
| C4 | Gegen den eigenen Schnitt | Δ der letzten Scheibe zum Schnitt der 30 Tage davor (ab drei Scheiben), Perzentil unter den letzten 50 mit ihr (ab zehn, gleiche zur Hälfte) | A | SP-2.2, Fachkern L2 (`againstOwnAverage`) |
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

- **Mindestzahl, sonst „–“** (SF-61): Streukreis ab 3, aussagekräftig ab 10; R50 ab 5; Form ab 3, ihr Winkel nur bei gestreckter Gruppe ab 10; Richtungsuhr ab 30; Erkenntnisse über Zeiträume (Schussposition, Reaktion nach Fehler, Tempo gegen Wert) erst ab einigen hundert Schuss oder 20 Ereignissen.
- **Unsicherheit zeigen:** σ über χ², Lage über Hotelling, Quoten über Wilson, Trends über Mann-Kendall. Bei 10 Schuss reicht der 95-%-Bereich für σ von −26 % bis +46 %, ist also gut zwei Drittel so breit wie σ selbst; ±10 % erreicht er erst bei rund 120 Schuss.
- **Gleiches n:** Streukreis, Extreme Spread, bester Teiler und längste Folge wachsen mit n (Streukreis über 40 gegen 10 Schuss +32 %, B3); R50 fällt bei kleinem n leicht zu klein aus (bei 10 Schuss −4 %, B4; der Faktor √((n − 1)/n) gilt genau nur für den mittleren Radius). σ̂ ist das stabilste Maß für Verläufe über unterschiedliche Schusszahlen.
- **Robust als Standard in Verläufen:** Median, R50, MAD, Quantilbänder.
- **Nur Gleiches vergleichen:** gleiche Familie, gleiche Wertung; mm-Werte von LG und LP nie.
- **Viele Vergleiche erzeugen Zufallstreffer:** Mindest-n, Korrektur (Holm oder Benjamini-Hochberg) oder nur als Hinweis formulieren. Auf einer Scheibe laufen fünf Tests (Lage, Form, Ausreißer, Trend, Probe): Etwa jede fünfte ganz normale Scheibe zeigt irgendwo einen Befund (B1).
- **Regression zur Mitte und Auswahl:** Nach einem Rekord ist die nächste Scheibe meist schwächer; „beste Serie“ und korrigiertes Ergebnis sind aus denselben Daten gewählt und optimistisch.
- **Bedeutsamkeit statt Signifikanz:** lohnend ab 0,3 × der typischen Schwankung (Hopkins); „unklar“ ist ehrlich.
- **Transparenz:** jede Zahl mit n, Zeitraum, Filter und Kennzahl-Version; Modellwerte als Modell gekennzeichnet.

## Beobachtungen in Worten (Beispiele)

1. „Serie 3 war deine engste (R50 1,9 mm), Serie 4 streut 34 % weiter.“ — nur bei gleicher Schusszahl und wenn ein Test den Unterschied zeigt; 20 % Unterschied erreichen zwei gleich gute Zehnerserien oft zufällig (Nutzen-Prüfung, Oktober 2026).
2. „Dein Schwerpunkt liegt 1,8 mm links, bei 40 Schuss ist das kein Zufall. Mit korrigiertem Visier brächten die nächsten Schüsse etwa 2,4 Ringe mehr.“ — nur wenn L3 „echt“ sagt und n ≥ 10 (L4, Leave-one-out).
3. „Die letzten zehn Schuss waren je Schuss 0,21 schwächer als die ersten zehn, in 6 deiner letzten 8 Trainings war das so.“ — als Muster erst ab fünf Scheiben.
4. „Drei Abreißer nach rechts unten kosteten dich 2,1 Ringe.“
5. „Deine Probe war enger als die Wertung (R50 1,6 gegen 2,3 mm).“ — gleiches n.
6. „Diese Scheibe ist besser als 85 % deiner letzten 50.“ — ab 20 Vergleichsscheiben.
7. „Seit dem neuen Munitionslos ist dein σ 0,2 mm kleiner, das liegt noch in der normalen Schwankung.“

## Belege aus Simulationen

Jede Zahl aus einer Simulation, die ein Hilfetext nennt ([[spiegel-statistics-help]]), steht hier und lässt sich nachrechnen: `pnpm --filter @vereinsheim/shot-help simulate` (`packages/shot-help/scripts/simulate.ts`). Methode: mulberry32 mit Box-Muller, fester Seed je Fall, Lagen auf ganze µm, Wertung über `scoreFromCoordinates`, nur die echten Funktionen aus `shot-core`; 5 000 Wiederholungen je Fall, beim Mehrfachtest (B1) 20 000. Normalgruppen: Luftgewehr σ 1,5 mm, Luftpistole σ 15 mm je Richtung. B19 und B20 mit 2 000 Wiederholungen je Fall, je Scheibe 40 Schuss Luftgewehr. Stand nach SP-1.12 (7. Oktober 2026), Ausreißer schrittweise, Form ohne Ausreißer, Zeiträume (8. Oktober 2026):

```
B0   innerhalb σ 39,3 %, innerhalb 2σ 86,5 %
B1   20 Schuss: 21,6 % mit Befund, also etwa jede 5.
B1   40 Schuss: 21,4 % mit Befund, also etwa jede 5.
B1   60 Schuss: 22,0 % mit Befund, also etwa jede 5.
B2   Ausreißer-Fehlalarm rund: 10: 4,7 %, 20: 4,1 %, 40: 4,2 %, 60: 4,1 %
B2   Ausreißer-Fehlalarm a/b 2: 10: 10,9 %, 20: 14,1 %, 40: 15,5 %, 60: 17,5 %
B3   Streukreis 40 gegen 10 Schuss: +32 %
B4   R50 bei 10 Schuss: -4,3 % gegen den Grenzwert
B5   LG σ 1,5 mm, 40 Schuss, ohne Versatz: Lage-Verlust im Mittel -0,38 Ringe
B5   LP σ 15 mm, 40 Schuss, ohne Versatz: Lage-Verlust im Mittel -1,20 Ringe
B5   LG, Versatz 0,5σ, 40 Schuss: angezeigt 1,45, Gewinn auf neuer Scheibe 1,47
B6   LG σ 1,5 mm, 20 Schuss: Fehlalarm Zehntel 3,8 %, ganze Ringe 3,7 %; Nachlassen erkannt Zehntel 15,6 %, ganze Ringe 14,4 %
B6   LG σ 1,5 mm, 40 Schuss: Fehlalarm Zehntel 4,7 %, ganze Ringe 4,8 %; Nachlassen erkannt Zehntel 29,6 %, ganze Ringe 27,3 %
B6   LP σ 15 mm, 20 Schuss: Fehlalarm Zehntel 4,6 %, ganze Ringe 4,7 %; Nachlassen erkannt Zehntel 15,9 %, ganze Ringe 16,6 %
B6   LP σ 15 mm, 40 Schuss: Fehlalarm Zehntel 5,0 %, ganze Ringe 4,9 %; Nachlassen erkannt Zehntel 30,9 %, ganze Ringe 30,2 %
B7   5 Probeschüsse, Versatz 1σ: echt in 21,8 %
B7   5 Probeschüsse, Versatz 2σ: echt in 62,9 %
B8   von Neumann, 10 Schuss: 1,15 bis 2,80
B8   von Neumann, 40 Schuss: 1,57 bis 2,41
B9   Ermüdung LG σ 1,5 mm: Δ Ø -0,34 bis 0,35 Ringe, Δ R50 -57 bis 57 %
B9   Ermüdung LP σ 15 mm: Δ Ø -1,07 bis 1,11 Ringe, Δ R50 -59 bis 57 %
B10  Wiedereinstieg LG σ 1,5 mm: -0,49 bis 0,42 Ringe
B10  Wiedereinstieg LP σ 15 mm: -1,52 bis 1,32 Ringe
B11  σ Probe/Wertung (5 gegen 40): 0,54 bis 1,57
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
B19  gleich, Urteil trotz gleicher Streuung: 5/5 3,6 % (bedeutsam 61,5 %), 10/10 3,8 % (bedeutsam 50,5 %), 20/20 5,3 % (bedeutsam 36,4 %), 30/30 4,9 % (bedeutsam 23,7 %)
B19  σ 1,5 → 1,3 mm, „höher“ erkannt: 5/5 55,5 % (bedeutsam 99,0 %), 10/10 94,3 % (bedeutsam 99,8 %), 20/20 100,0 % (bedeutsam 100,0 %), 30/30 100,0 % (bedeutsam 100,0 %)
B20  Scheiben im Formband (60 Scheiben, ab der zehnten): Median 68,6 %, 95 % zwischen 58,8 % und 80,4 %
```

Zusätzlich aus den drei Prüfungen vom 6./7. Oktober (nur lesend, eigene Skripte): Ausreißer-Fehlalarm bei a/b 1,5 und 3 (Einzeltest mit α 0,05, bis Oktober 2026), Trennschärfe der Form (a/b 1,3: 28 % bei 40 Schuss), Effizienz der Streumaße gegenüber σ̂ (Streukreis 0,77 bei 10 und 0,39 bei 60 Schuss, mittlerer Radius 0,92, Höhe/Breite 0,23–0,43), Teiler-Ø gegen Ø je Schuss r = −0,998.

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
