---
id: spiegel-mobile
type: concept
title: "Spiegel auf dem Telefon — Usability-Konzept"
aliases: [spiegel-telefon, spiegel-handy, mobil-konzept]
keywords: [mobil, handy, telefon, smartphone, touch, tippen, daumenzone, sprungleiste, reiter, tabs, seitlich scrollen, querformat, tablet, desktop, sticky, hover, tooltip, lineal, touch-ziel, 44 px, wcag, kontrast, screenreader, blatt, bottom sheet, abstände, raster, spalten]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-030]]"]
relates_to: ["[[spiegel-ui-design]]", "[[spiegel-roadmap]]", "[[spiegel-statistics-help]]", "[[spiegel-durchsicht]]"]
---

**TL;DR** Jede Zahl von Spiegel ist auf dem Telefon erreichbar: ohne seitliches Scrollen, ohne Hover, mit einer Hand,
das Häufigste zuerst. Die Seite einer Scheibe ist eine Seite mit Sprungleiste, Hilfe als Blatt, Sprung zur Scheibe mit
Rücksprung und einem Lineal an den Diagrammen ([[spiegel-ui-design]]). Gemessen wurde am 8. Oktober 2026 mit den
echten Bausteinen bei 375 × 812 px; heute prüft `pnpm --filter spiegel pruefen` die Bedienung an der App.

## Nutzungssituationen

| Situation | Gerät, Haltung | Frage |
|---|---|---|
| Am Stand, direkt danach | Telefon, eine Hand, stehend | Wie war's, wo lag's, welcher Schuss war schlecht? (10–30 s) |
| Zuhause | Telefon oder Desktop, sitzend | Warum? Präzision, Lage, Zeit, Probe (5–20 min) |
| Trainer und Schütze | ein Gerät, zwei Personen | „Schau, Schuss 23“ |

## Ebenen der Information

1. **Auf einen Blick:** Ergebnis, Serienwerte, Trefferbild, letzter oder angetippter Schuss, die wichtigsten
   Beobachtungen in Worten (bis zu drei, die Lage zuerst; auf dem Telefon nur die erste).
2. **Genauer:** Schusstabelle, Analyse in fünf Reitern; der Überblick ist die Zahlen-Ansicht.
3. **Erklärung:** Kurzsatz, Erklärung im Blatt „?“, Formel, Einstieg, Datenlage, Glossar, Fehlschlüsse ([[spiegel-statistics-help]]).

Darüber gilt die Leitlinie „drei Ebenen“ (Antwort, Belege, Werkzeug) aus [[spiegel-durchsicht]].

## Prinzipien

1. **Antwort zuerst:** Der erste Bildschirm zeigt Ebene 1 ganz.
2. **Die Scheibe bleibt der Bezug:** Was die Scheibe ändert (Schuss, Serie, Ellipse), zeigt seine Wirkung oder führt zur Scheibe.
3. **Die Seite scrollt nie seitlich:** Breites scrollt in sich oder bricht um.
4. **Antippen ersetzt Hover:** kein Inhalt nur in `title` oder SVG-`<title>`.
5. **Erklärung auf Abruf:** lange Texte stehen nicht zwischen den Zahlen.
6. **Grundlage sichtbar:** Jede Zahlengruppe nennt im Kopf, worüber sie rechnet („Analyse über alle Schüsse“).
7. **Gleicher Inhalt, andere Anordnung:** keine Zahl nur auf dem Desktop.

## Was die Messung zeigte (8. Oktober 2026)

- **Seitliches Scrollen:** Eine 512 px breite Reiterleiste ließ die ganze Seite 102 px seitlich scrollen, weil der
  Abschnitt mit seinem Inhalt wuchs. Der Abschnitt wächst nicht mit, die Reiterleiste scrollt in sich.
- **Analyse weit unten:** Bis zur Analyse waren es über 3.000 px. Was eine Karte an der Scheibe schaltet (Ellipse,
  Zeile der Tabelle), passierte außer Sicht. Daher Sprungleiste und Sprung zur Scheibe mit Rücksprung (unten).
- **Werte nur per Hover:** Die Einzelwerte der Diagramme standen nur in SVG-`<title>`; `role="img"` verbarg sie auch
  vor dem Screenreader. Daher das Lineal und „Werte als Tabelle“ (unten).
- **Schrift und Kontrast:** Achsenschrift 11 px, Gold und Türkis als Grafik auf weißer Karte unter 3:1, Ausreißer nur
  über die Farbe. Heute: Diagrammschrift 12 px, Punkte mit dunklem Rand, ein Ring um Ausreißer.
- **Abstände bei zwei Spalten:** CSS-Spalten verschluckten den Rand am Spaltenende (0 px zum nächsten Block) und
  ließen unter der kürzeren Spalte bis zu 360 px frei. Heute: Raster in Zeilen.

## Bedienelemente

- **Optik wie am Desktop:** Bedienelemente behalten auf dem Telefon ihre Desktop-Höhe (rund 30 px, WCAG-AA 24 px
  erfüllt). 44 px Mindesthöhe und eine umgebrochene
  Reiterleiste wirken zu hoch.
- **Reiter in einer Zeile:** Auf schmalen Bildschirmen scrollt die Reiterleiste seitlich in sich, der gewählte Reiter
  rückt ins Bild.
- **Karten im Raster aus Zeilen:** zwei Spalten erst, wenn der Kartenbereich 820 px breit ist (beide Karten einer
  Zeile gleich hoch, eine einzelne letzte Karte über die volle Breite); jeder Abstand 16 px. Auf der Seite steht die
  Analyse ab 768 px in voller Breite unter der Scheibe, die Karten stehen dort zu zweit.

## Seitenaufbau

**Eine Seite mit Sprungleiste**, die Analyse auf derselben Seite. Sobald der Kopf weggescrollt ist, erscheint oben
„Scheibe · Schüsse · Analyse“, auf dem Telefon in gleich breiten Feldern. In der Analyse deckt auf dem Telefon ihre
Reiterleiste die Sprungleiste ab (nie zwei Leisten), ab 768 px klebt sie darunter. Abschnitt und Reiter stehen in der
Adresse (`#position`, englisch wie alle Anker, [[spiegel-navigation]]), damit Zurück und geteilte Links gehen. Eine
untere Abschnittsleiste scheidet aus, dort sitzt die App-Navigation ([[spiegel-ui-design]]). Ausweg, falls die Seite zu
lang wirkt: die Analyse als eigene Ansicht.

- **Erster Bildschirm (Telefon):** Kopf mit Ergebnis und der ersten Beobachtung, Scheibe mit Ablesezeile; die Serien
  folgen direkt (bei 375 × 812 px passen Kopf und Scheibe, die Serien beginnen knapp darunter).
- **Reihenfolge auf dem Telefon:** Kopf, Scheibe mit Ablesezeile, Serien, Schüsse (ohne eigenen Scrollkasten, „Alle
  zeigen“), Analyse mit Überblick.
- **Ab 768 px neben der Scheibe nur, was zu ihr gehört:** links die Scheibe mit den Serien darunter, rechts Ergebnis,
  Ablesung und Schusstabelle. Was Platz braucht, steht darunter in voller Breite: die Analyse mit den Kacheln des
  Überblicks, ihre Spalten nach der Breite des Bereichs; in der schmalen Spalte neben der Scheibe würden Kacheln
  Werte abschneiden.
- **Serien unter der Scheibe:** Scheibe und Serien zusammen so groß, dass beide ins Fenster passen; die Scheibe wird
  dafür kleiner, aber nicht unter 280 px (bei 1280 × 900 rund 560 px, bei 1024 × 768 knapp 450 px; bei 1024 × 600
  passt nur die Scheibe allein). Rechts reicht die Schusstabelle bis zur Unterkante der Serien und scrollt in sich, so
  steht die obere Hälfte der Seite wie ein Bildschirm da.
- **Ergebnis als Box, Kopf im Raster:** Ab 768 px steht das Ergebnis (Schusszahl, Zehner, Innenzehner, bester
  Teiler, die Kreise für Art und Wertung) als Box rechts über der Ablesung, der Kopf mit Titel und Beobachtungen über
  der Scheibe; eine eigene Übersicht gibt es nicht, die Ablesung ist eine Zeile ohne x/y. Auf dem Telefon steht das
  Ergebnis im Kopf, damit es auf dem ersten Bildschirm steht.
- **Nichts angeschnitten:** Die Schalter der Scheibe liegen als runde Knöpfe in den Ecken der Scheibe, wie an einer
  DISAG-Anzeige, „Übrige blass/aus“ als einer davon; eine Zeile über der Scheibe würde in der schmalen Spalte
  angeschnitten. Die Reiterleiste hat in voller Breite Platz.
- **Keine leeren Gerüste:** Ohne Schüsse nur die Scheibe und „Noch kein Schuss“; die Schusstabelle wird nur so hoch
  wie ihre Zeilen.
- **Hilfe als Blatt** über „?“; „Erklärungen“ zeigt die Kurzsätze unter dem Titel. Nichts klappt unter einer Karte
  auf.
- **Sprung zur Scheibe mit Rücksprung:** Aktionen mit Wirkung auf die Scheibe springen zur Scheibe und blenden
  „Zurück zu …“ ein. Die Seite springt sofort statt gleitend: Glattes Scrollen über Tausende Pixel kommt in einem
  verborgenen Fenster verspätet an, eine Skriptprüfung im Browser sähe es nicht. Aus demselben Grund misst die
  Sprungleiste den aktiven Abschnitt beim Scrollen statt über einen `IntersectionObserver`.
- **Aktiver Abschnitt an der Leiste:** Aktiv ist der späteste Abschnitt, dessen Anfang die Leiste erreicht hat. So
  ist nach einem Sprung genau dieser aktiv, auch wenn er kürzer ist als das Fenster.

**Tablet und Desktop:** Ab 768 px links die Scheibe mit den Serien darunter, rechts daneben Ergebnis, Schuss und
Schüsse; die Analyse folgt in voller Breite darunter.

## Diagramm-Lineal

- **Umfang:** Verlauf, Rhythmus und Zehntel-Säulen haben ein Lineal, diese drei und die Richtungsuhr „Werte als
  Tabelle“ (zugeklappt, auch für Screenreader). Kein Wert steht nur im SVG-`<title>`; jedes Diagramm hat einen Namen
  für Screenreader.
- **Bedienung:** Tippen wählt den nächsten Wert, waagrechtes Ziehen wandert mit, senkrecht scrollt die Seite
  weiter (`touch-action: pan-y`), ein zweites Tippen hebt auf. Übernimmt der Browser das Scrollen
  (`pointercancel`), gilt die Wahl davor. Mit der Tastatur Pfeile, Pos1, Ende, Escape; mit Alt, Strg oder
  Befehl bleibt die Taste dem Browser. Für Screenreader ist das Diagramm ein Schieberegler mit dem Wert in
  Worten (APG-Muster).
- **Werte fest über dem Diagramm** in einer Zeile mit fester Höhe von zwei Zeilen, für den Hinweis und jede Wahl
  gleich, damit das Diagramm beim Ziehen nicht springt; der Knopf hält seinen Platz. Ohne Wahl steht ein Hinweis.
- **Je Scheibe neu:** Die Seite hängt die Analyse je Scheibe neu ein; eine Wahl im Lineal wandert nicht mit.
- **Kopplung:** Ziehen ändert die Scheibe nicht, sonst spränge die Seite bei jeder Bewegung. Der Knopf „Auf
  der Scheibe“ wählt den Schuss dort und springt mit Rücksprung; ein auf der Scheibe gewählter Schuss steht
  schon im Lineal.

## Offen

- Test mit VoiceOver.
