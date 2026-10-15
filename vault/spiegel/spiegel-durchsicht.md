---
id: spiegel-durchsicht
type: concept
title: "Spiegel-Durchsicht — Bedienbarkeit und Komplexität"
aliases: [usability-durchsicht, komplexität, drei-ebenen]
keywords: [bedienbarkeit, usability, komplexität, überfrachtet, zu viel, drei ebenen, antwort, belege, werkzeug, fachsprache, fachbegriffe, alltagsworte, filter, doppelte zahlen, beobachtungen, sprungleiste, einfach ausführlich, experte]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-030]]"]
relates_to: ["[[spiegel-mobile]]", "[[spiegel-ui-design]]", "[[spiegel-navigation]]", "[[spiegel-langzeit]]"]
---

**TL;DR** Jede Seite von Spiegel folgt drei Ebenen: **Antwort, Belege, Werkzeug**. Die Antwort steht als Satz und
Zahl auf dem ersten Bildschirm, die Belege in Alltagsworten darunter, alle Kennzahlen, Filter und Fachbegriffe erst
auf Antippen. Jede Zahl steht einmal auf einer Seite, vor dem Inhalt höchstens eine Zeile Bedienung; einen Schalter
„Einfach / Ausführlich“ gibt es nicht. Begründet ist das mit einer Messung am Telefon vom 9. Oktober 2026: Antwort,
Belege und Statistik standen gleich laut nebeneinander, manche Zahl dreimal.

# Spiegel-Durchsicht

## Leitlinie: drei Ebenen

1. **Antwort:** ein Satz und eine Zahl auf dem ersten Bildschirm.
   - Start: der letzte Abend.
   - Fortschritt: besser oder nicht.
   - Scheibe: was los war.
2. **Belege:** eine Grafik und wenige Kennzahlen, sichtbar und in Alltagsworten.
3. **Werkzeug:** alle Kennzahlen, Statistik, Filter und Fachbegriffe, auf Antippen: Reiter, Blatt, „?“.

Drei Regeln für jede Seite und jeden neuen Baustein:

- Jede Zahl steht einmal auf einer Seite.
- Höchstens eine Zeile Bedienung vor dem Inhalt.
- Fachbegriffe (σ, R50, T², IQR) nur im Blatt „?“, auf der Seite das Alltagswort.

**Kein Schalter „Einfach / Ausführlich“.** Er hieße, jede Seite in zwei Fassungen zu bauen und zu prüfen.
Ambitionierte Schützen stellen ohnehin auf „Ausführlich“. Die Ebenen geben beiden, was sie brauchen.

## Was daraus auf den Seiten folgt

- **Scheibe** (Aufbau in [[spiegel-ui-design]], „Seitenaufbau“):
  - Kein Abschnitt „Zahlen“: Der Überblick der Analyse ist die Zahlen-Ansicht, die Sprungleiste hat „Scheibe ·
    Schüsse · Analyse“ (B1).
  - Die Antwort steht oben: Der Kopf zeigt die wichtigsten Beobachtungen in Worten (höchstens drei, die Lage zuerst,
    je ihr erster Satz) und „Alle Beobachtungen ›“ (B2). Auf dem Telefon nur die erste, sonst rutscht die Scheibe
    unter die untere Leiste (gemessen bis 870 px bei 740 px Sicht auf 375 × 812).
  - Die Lage nennt ihre Zahlen in der Beobachtung; die Kachel „Lage“ sagt nur „passt“ oder „versetzt“ mit Richtung.
  - Im Überblick zählt die Kachel „Ausreißer“, wie viele aus der Gruppe fallen. Probe neben Wertung gibt es nicht
    (wie am Ausdruck, [[adr-027]]): keine Probe-Kachel, kein „Ohne Probe“, kein Reiter „Probe“, keine „P“-Nummern.
  - Ein Lage-Anteil bis null am Ringverlust heißt „Lage kostet nichts“.
  - Die Symbolknöpfe bleiben in den Ecken der Scheibe (B7).
- **Start:**
  - Unter der großen Zahl steht der Bezug (der Schnitt der fünf Scheiben davor), nicht noch einmal der Abstand (B8).
  - Das Formband ist ein kleiner Verlauf wie im Fortschritt: Zeit nach rechts, das Band um den gleitenden Schnitt,
    die Scheiben des Abends rechts groß und mit Datum. So liest man es auf Start und im Fortschritt gleich.
  - Form als Titel und ein Satz.
  - Rekorde in ganzen Worten („Meiste 10,9 (20 Schuss): 1“).
  - Ergebnisse mit Namen der Wertung („18,8 Zehntel · 18 ganze Ringe“, B9).
- **Fortschritt** beantwortet „Werde ich besser?“ ([[spiegel-langzeit]]):
  - Ein Bezug: Der Satz vergleicht mit dem Zeitraum davor, eine einzelne Scheibe mit dem Schnitt der fünf davor (B3).
  - Eine Zeile Bedienung: Familie, ein Chip für das Blatt „Filter“, der Chip der Wertung (B5).
  - Rekorde: oben höchstens fünf aus dem Zeitraum, die übrigen zugeklappt (B6).
- **Scheiben-Liste:**
  - Filter in einer Zeile: Familie und ein Chip; Art, Liste und Merkmal stehen im Blatt „Filter“ (B5).
  - Ergebnisse mit Namen der Wertung: Spalten „Ganze Ringe“ und „Zehntel“, die Wertung der Scheibe fett (B9).
  - Die Art als Zeichen: Wettkampf als Pokal, Training ohne Zeichen, ein Training nur aus Probe als „Probe“.
- **Wertung:** keine Wertung des Geräts; jede Scheibe und jede Familie hat ihre, umstellbar und gespeichert
  ([[spiegel-navigation]], „Wertung je Scheibe und je Familie“).
- **Sprache auf allen Seiten und in `shot-help`** (B4):
  - Beobachtungen und Kacheln in Alltagsworten: „Deine Gruppe liegt …; das ist sicher kein Zufall.“, „Streuung“,
    „sicher zwischen …“, Lage „passt“ oder „versetzt“ mit Richtung.
  - Urteile „deutlich besser“, „schwächer“, „kein klarer Unterschied“.
  - Wochen nach ihrem Montag („Woche ab 06.07.“), keine Kalenderwochen.
  - Fachbegriffe (σ, R50, T², Median, „95 %“, „echt“, „unklar“) nur im Blatt „?“ und in den Karten der Reiter.
    `pnpm --filter spiegel pruefen` sucht sie auf den ersten beiden Ebenen der App (`JARGON` in
    `apps/spiegel/tools/pruefen.ts`).

## Offen

- **Kennzahlen einer gewählten Serie:** Die Analyse rechnet über die ganze Scheibe. Für eine Serie zeigt „Serien im
  Vergleich“ (Reiter „Zeit und Verlauf“) nur Ergebnis, R50 und Versatz; Streukreis, σ, Ø, Zehnerquote und Tempo einer
  Serie fehlen. Erst entscheiden, wenn echte Daten zeigen, ob man sie braucht.
- **Beobachtungen im Kopf am Telefon:** prüfen, ob mit den kurzen Sätzen mehr als die erste passt.

## Messung auf dem Telefon (9. Oktober 2026)

Gemessen an einer Beispielsaison mit der Beispielscheibe „40 Schuss mit Probe“; Bildschirmfotos:
https://claude.ai/artifact/5MYsm67LubHQTVQ6dk3myd (privat). 390 px breit; ein Bildschirm sind 772 px Inhalt über der
unteren Leiste.

| Seite | Länge | Bedienelemente (1. Bildschirm) | Zahlen (1. Bildschirm) |
|---|---|---|---|
| Start | 2,1 | 11 (4) | 44 (20) |
| Scheiben | 6,7 | 99 (19) | 359 (43) |
| Fortschritt | 4,7 | 71 (21) | 214 (15) |
| Scheibe, nur „Überblick“ | 5,8 | 53 (9) | 166 (36) |
| Analyse, alle sechs Reiter | ≈ 15 | – | ≈ 300 |

Die Analyse hatte 25 Karten in sechs Reitern: Überblick 1, Ergebnis 6, Präzision 4, Lage 4, Zeit und Verlauf 6,
Probe 4.

| Aufgabe | Urteil |
|---|---|
| Wie war mein letzter Abend? | gut: Start, erster Bildschirm |
| Werde ich besser? | mühsam: Form-Zeile erst auf dem zweiten Bildschirm, der Fortschritt spricht von der neuesten Scheibe |
| Was war an dieser Scheibe los? | mühsam: die Beobachtungen in Worten erst auf dem vierten Bildschirm |
| Wo habe ich Ringe verloren? | geht: Überblick, „Ringverlust“ |
| Wo ist die Scheibe vom 12. September? | gut: Scheiben, erster Bildschirm |

Befunde:

- **B1 Scheibe:** „Trefferbild in Zahlen“ (10 Kacheln) und der Überblick (8 Kacheln) hatten fünf Zahlen doppelt; die
  Lage stand dreimal in Worten.
- **B2 Scheibe:** Die Beobachtungen in Worten standen unten, nach Schusstabelle und 18 Kacheln.
- **B3 Start und Fortschritt:** drei Bezugsgrößen für dieselbe Scheibe (5 Scheiben davor, 30 Tage davor, Platz unter
  den letzten 50).
- **B4 Fachsprache an der Oberfläche:** σ, R50, „T² 17,6, Grenze 6,7“, IQR; „95 % kein Zufall“, „bedeutsam“;
  Kalenderwochen als Achse; Kürzel W, T, P.
- **B5 Fortschritt und Liste:** im Fortschritt 21 Bedienelemente vor dem Diagramm, in der Liste drei Zeilen Filter.
- **B6 Fortschritt:** 25 Zeilen Rekorde.
- **B7 Scheibe:** sieben Symbolknöpfe in den Ecken.
- **B8 Start:** Satz und Zeile darunter sagten dasselbe, der Wortlaut der Rekorde war schwer, die Form-Zeile dicht.
- **B9 Liste:** zwei Ergebnisse ohne Namen.
