---
id: spiegel-durchsicht
type: concept
title: "Spiegel-Durchsicht — Bedienbarkeit und Komplexität"
aliases: [usability-durchsicht, komplexität, drei-ebenen]
keywords: [bedienbarkeit, usability, komplexität, überfrachtet, zu viel, drei ebenen, antwort, belege, werkzeug, fachsprache, fachbegriffe, filter, doppelte zahlen, beobachtungen, sprungleiste, einfach ausführlich, experte]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-030]]"]
relates_to: ["[[spiegel-mobile]]", "[[spiegel-ui-design]]", "[[spiegel-navigation]]"]
---

**TL;DR** Am 9. Oktober 2026 haben wir das Labor ohne Labor-Kopf Seite für Seite auf dem Telefon geprüft. Start und
die Scheiben-Liste sind zugänglich, die Seite einer Scheibe und der Fortschritt sind zu voll. Meist liegt das nicht an
zu viel Tiefe: Antwort, Belege und Statistik stehen gleich laut nebeneinander, manche Zahl dreimal. Leitlinie sind
seitdem drei Ebenen: **Antwort, Belege, Werkzeug**. Umgesetzt wird in den Schritten U1–U3 und U5; U4 ist seit dem
9. Oktober die Probe wie am Ausdruck.

# Spiegel-Durchsicht

Die Seite mit Bildschirmfotos: https://claude.ai/artifact/5MYsm67LubHQTVQ6dk3myd (privat). Gemessen im Labor (Stand
9cc413a) mit der erfundenen Saison und der Beispielscheibe „40 Schuss mit Probe“.

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

## Messung auf dem Telefon

390 px breit; ein Bildschirm sind 772 px Inhalt über der unteren Leiste.

| Seite | Länge | Bedienelemente (1. Bildschirm) | Zahlen (1. Bildschirm) |
|---|---|---|---|
| Start | 2,1 | 11 (4) | 44 (20) |
| Scheiben | 6,7 | 99 (19) | 359 (43) |
| Fortschritt | 4,7 | 71 (21) | 214 (15) |
| Scheibe, nur „Überblick“ | 5,8 | 53 (9) | 166 (36) |
| Analyse, alle sechs Reiter | ≈ 15 | – | ≈ 300 |

Die Analyse hat 25 Karten:

| Reiter | Karten |
|---|---|
| Überblick | 1 |
| Ergebnis | 6 |
| Präzision | 4 |
| Lage | 4 |
| Zeit und Verlauf | 6 |
| Probe | 4 |

## Aufgaben

| Aufgabe | Urteil |
|---|---|
| Wie war mein letzter Abend? | gut: Start, erster Bildschirm |
| Werde ich besser? | mühsam: Form-Zeile erst auf dem zweiten Bildschirm, der Fortschritt spricht von der neuesten Scheibe |
| Was war an dieser Scheibe los? | mühsam: die Beobachtungen in Worten erst auf dem vierten Bildschirm |
| Wo habe ich Ringe verloren? | geht: Überblick, „Ringverlust“ |
| Wo ist die Scheibe vom 12. September? | gut: Scheiben, erster Bildschirm |

## Befunde

- **B1 Scheibe:**
  - „Trefferbild in Zahlen“ (10 Kacheln) und der Überblick (8 Kacheln) haben fünf Zahlen doppelt.
  - Die Lage steht dreimal in Worten.
- **B2 Scheibe:** Die Beobachtungen in Worten stehen unten, nach Schusstabelle und 18 Kacheln.
- **B3 Start und Fortschritt:** drei Bezugsgrößen für dieselbe Scheibe:
  - 5 Scheiben davor;
  - 30 Tage davor;
  - Platz unter den letzten 50.
- **B4 Fachsprache an der Oberfläche:**
  - σ, R50, „T² 17,6, Grenze 6,7“, IQR;
  - „95 % kein Zufall“, „bedeutsam“;
  - Kalenderwochen als Achse;
  - Kürzel W, T, P.
- **B5 Fortschritt und Liste:**
  - Bedienung vor dem Inhalt: im Fortschritt 21 Bedienelemente vor dem Diagramm;
  - in der Liste drei Zeilen Filter.
- **B6 Fortschritt:** 25 Zeilen Rekorde.
- **B7 Scheibe:** sieben Symbolknöpfe in den Ecken. **Verworfen:** Die Ecken bleiben (User, 9. Oktober 2026).
- **B8 Start:**
  - Satz und Zeile darunter sagen dasselbe;
  - der Wortlaut der Rekorde ist schwer;
  - die Form-Zeile ist dicht.
- **B9 Liste:** zwei Ergebnisse ohne Namen.

## Entscheidungen (User, 9. Oktober 2026)

1. Der Abschnitt „Zahlen“ auf der Scheibe entfällt, der Überblick der Analyse übernimmt. Das dreht die Sprungleiste
   aus Schritt 4 zurück.
2. Zehntel und ganze Ringe stehen nur noch auf der Scheibe und als Einstellung des Geräts in Profil. Die Liste zeigt
   weiter beide Wertungen.
3. Fachbegriffe wie σ und R50 nur im Blatt „?“.
4. Umsetzung in der Reihenfolge U1 bis U5 (U4 kam am 9. Oktober dazu, siehe unten).

## Umsetzung

- **U1 Scheibe entschlacken:**
  - B1 und B2 (`plans/2026-10-09-spiegel-scheibe-entschlacken.md`);
  - dazu der Fehler „Beispielscheibe öffnen springt zur Analyse“: Ein Anker beim Laden gilt nur für die erste
    Ansicht.
- **Offen nach U1** (Review, 9. Oktober 2026):
  - Die Lage steht weiter dreimal in Worten: im Kopf, in der Kachel „Lage“ und unter den Beobachtungen. Der Kopf
    wiederholt dieselben Zahlen (Regel „jede Zahl einmal“); gehört zu U3.
  - Kennzahlen einer gewählten Serie oder der Probe: Die Kacheln, die der Auswahl folgten, sind weg. „Serien im
    Vergleich“ zeigt je Serie nur Ergebnis, R50 und Versatz; Streukreis, σ, Ø, Zehnerquote und Tempo einer Serie
    fehlen. Erst entscheiden, wenn echte Daten zeigen, ob man sie braucht.
  - Auf dem Telefon steht im Kopf nur die erste Beobachtung (sonst rutscht die Scheibe unter die untere Leiste:
    gemessen bis 870 px bei 740 px Sicht auf 375 × 812); mit kürzeren Sätzen (U3) neu prüfen.
- **U2 Fortschritt beantwortet „Werde ich besser?“** (umgesetzt 9. Oktober 2026,
  `plans/2026-10-09-spiegel-fortschritt-besser.md`; dazu der Rahmen um das Formband auf Start):
  - B3: ein Bezug, der Satz zum Vergleich;
  - B5: Filter in einer Zeile;
  - B6: Rekorde gekürzt.
- **U3 Sprache** (umgesetzt 9. Oktober 2026, `plans/2026-10-09-spiegel-sprache.md`): B4 über alle Seiten und die
  Texte in `shot-help`.
  - Beobachtungen und Kacheln in Alltagsworten: „Deine Gruppe liegt …; das ist sicher kein Zufall.“, „Streuung“,
    „sicher zwischen …“, „meist 56 s“, Lage „versetzt“ mit Richtung oder „passt“. Die Kachel „Lage“ nennt nur die
    Richtung; die Zahlen stehen einmal, in der Beobachtung („Offen nach U1“: die Lage dreifach).
  - Urteile „deutlich besser“, „schwächer“, „kein klarer Unterschied“ statt „höher, besser · bedeutsam“.
  - Wochen als Datum des Montags, Art in den Listen als Pokal, ohne Zeichen oder „Probe“, eine Zeile unter dem
    Formband.
  - Ein Lage-Anteil bis null heißt „Lage kostet nichts“ (User-Frage zum negativen Ringverlust durch die Lage).
  - Fachbegriffe nur im Blatt „?“ und in den Reitern; die Skriptprüfung sucht sie auf den ersten beiden Ebenen.
  - Nicht in U3: die Kachel „Eingeschossen?“ und der Reiter Probe sagen noch „unklar“ und „echt“; U4 entfernt sie.
- **U4 Probe wie am Ausdruck** (umgesetzt 9. Oktober 2026, aus der Erkundung der Daten, [[adr-027]],
  `plans/2026-10-09-spiegel-probe-wie-ausdruck.md`): keine Scheibe mehr mit Probe und Wertung.
  - Weg sind die Probe-Kachel, „Ohne Probe“, der Reiter „Probe“, „P“-Nummern und der Satz zur Probe.
  - Im Überblick steht statt „Eingeschossen?“ die Kachel „Ausreißer“ (wie viele, welche).
  - Das Training nur aus Probe bleibt mit Probe-Eck; der Filter „Probe-Training einbeziehen“ im Fortschritt bleibt.
  - Auf dem Tablet sind die Serien-Kacheln breiter (vier statt fünf je Zeile): Unter etwa 700 px Höhe folgen die
    Serien unter der Scheibe statt neben die untere Leiste zu passen.
- **U5 Start und Liste** (umgesetzt 10. Oktober 2026, `plans/2026-10-09-spiegel-start-und-liste.md`; hieß bis zum
  9. Oktober U4): B8, B9 und die Filter der Liste wie in B5.
  - Formband als kleiner Verlauf (Zeit nach rechts, Band um den gleitenden Schnitt, der Abend mit Datum).
  - Unter der großen Zahl der Bezug statt noch einmal der Abstand; Form als Titel und ein Satz.
  - Rekorde in ganzen Worten („Meiste 10,9 (20 Schuss): 1“).
  - Ergebnisse mit Namen der Wertung: Liste „Ganze Ringe“ | „Zehntel“, amtliche fett; Kacheln „18,8 Zehntel · 18
    ganze Ringe“.
  - Filter der Liste in einer Zeile, Art und Merkmal im Blatt „Filter“.
  - Dazu das Formband auf Start (User, 9. Oktober 2026: „das formband ist irgendwie seltsam, ich verstehe es kaum,
    vor allem mit der ‚abend‘“). Woran es liegt:
    - Der Streifen ist eine Zahlenachse ohne Zeit (nach rechts der Ø je Schuss). Die grauen Punkte sind die letzten
      20 Scheiben, leicht übereinander versetzt; man liest eine Zeitachse hinein.
    - „Abend“ steht über dem Mittel der Scheiben des Abends, bei zwei Scheiben über der Lücke zwischen ihnen.
    - Band und gestrichelte Linie haben zwei Bezüge: das Band den gleitenden Schnitt, die Linie den Schnitt der fünf
      Scheiben davor.
  - Empfehlung: ein kleiner Verlauf wie im Fortschritt (Zeit nach rechts, das Band um den gleitenden Schnitt, die
    Scheiben des Abends rechts groß und mit Datum beschriftet). Dann lernt man das Formband einmal für Start und
    Fortschritt. Andernfalls entfällt der Streifen, und Satz und Zahl bleiben.
