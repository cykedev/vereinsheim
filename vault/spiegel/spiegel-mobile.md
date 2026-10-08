---
id: spiegel-mobile
type: concept
title: "Spiegel auf dem Telefon — Usability-Konzept"
aliases: [spiegel-telefon, spiegel-handy, mobil-konzept]
keywords: [mobil, handy, telefon, smartphone, touch, tippen, daumenzone, sprungleiste, reiter, tabs, seitlich scrollen, querformat, tablet, desktop, sticky, hover, tooltip, lineal, touch-ziel, 44 px, wcag, kontrast, screenreader, blatt, bottom sheet, abstände, raster, spalten]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-030]]"]
relates_to: ["[[spiegel-ui-design]]", "[[spiegel-roadmap]]", "[[spiegel-statistics-help]]"]
---

**TL;DR** Jede Zahl von Spiegel soll auf dem Telefon erreichbar sein: ohne seitliches Scrollen, ohne Hover, mit einer Hand, das Häufigste zuerst. Gemessen am 8. Oktober 2026 mit den echten Bausteinen bei 375 × 812 px. Umgesetzt sind die kleinen Korrekturen (Schritt 3) und der Seitenaufbau mit Sprungleiste, Hilfe als Blatt und Rücksprung (Schritt 4, [[spiegel-ui-design]]). Offen ist nur das Diagramm-Lineal (Schritt 5).

## Nutzungssituationen

| Situation | Gerät, Haltung | Frage |
|---|---|---|
| Am Stand, direkt danach | Telefon, eine Hand, stehend | Wie war's, wo lag's, welcher Schuss war schlecht? (10–30 s) |
| Zuhause | Telefon oder Desktop, sitzend | Warum? Präzision, Lage, Zeit, Probe (5–20 min) |
| Trainer und Schütze | ein Gerät, zwei Personen | „Schau, Schuss 23“ |

## Ebenen der Information

1. **Auf einen Blick:** Ergebnis, Serienwerte, Trefferbild, letzter oder angetippter Schuss, ein Satz.
2. **Genauer:** zehn Kacheln (folgen der Auswahl), Schusstabelle, Analyse in sechs Reitern mit etwa 23 Karten und neun Diagrammen.
3. **Erklärung:** Kurzsatz, „Was heißt das?“, Formel, Einstieg, Datenlage, Glossar, Fehlschlüsse ([[spiegel-statistics-help]]).

## Prinzipien

1. **Antwort zuerst:** Der erste Bildschirm zeigt Ebene 1 ganz.
2. **Die Scheibe bleibt der Bezug:** Was die Scheibe ändert (Schuss, Serie, Ellipse), zeigt seine Wirkung oder führt zur Scheibe.
3. **Die Seite scrollt nie seitlich:** Breites scrollt in sich oder bricht um.
4. **Antippen ersetzt Hover:** kein Inhalt nur in `title` oder SVG-`<title>`.
5. **Erklärung auf Abruf:** lange Texte stehen nicht zwischen den Zahlen.
6. **Grundlage sichtbar:** Jede Zahlengruppe nennt im Kopf, worüber sie rechnet.
7. **Gleicher Inhalt, andere Anordnung:** keine Zahl nur auf dem Desktop.

## Befunde der Messung

- **Reiterleiste 512 px breit:** Sie ließ die ganze Seite 102 px seitlich scrollen, weil der Abschnitt mit seinem Inhalt wuchs. Behoben.
- **Analyse weit unten:** Bis zur Analyse sind es im Labor über 3.000 px, in der App geschätzt vier Bildschirme. Was eine Karte an der Scheibe schaltet (Ellipse, Zeile der Tabelle), passiert außer Sicht.
- **Werte nur per Hover:** Die Einzelwerte der Diagramme stehen nur in SVG-`<title>`; `role="img"` verbirgt sie auch vor dem Screenreader.
- **Schrift und Kontrast:** Achsenschrift 11 px, Gold und Türkis als Grafik auf weißer Karte unter 3:1, Ausreißer nur über die Farbe. Behoben: 12 px, dunkler Punktrand, Ring um Ausreißer.
- **Abstände bei zwei Spalten:** CSS-Spalten verschluckten den Rand am Spaltenende (0 px zum nächsten Block) und ließen unter der kürzeren Spalte bis zu 360 px frei. Behoben: Raster in Zeilen.

## Entscheidungen des Users (8. Oktober 2026)

- **Optik wie am Desktop:** Bedienelemente behalten auf dem Telefon ihre Desktop-Höhe (rund 30 px, WCAG-AA 24 px erfüllt), auch „Was heißt das?“ bekommt keine größere Tippfläche. Die zuerst eingebauten 44 px Mindesthöhe und die umgebrochene Reiterleiste wirkten zu hoch.
- **Reiter in einer Zeile:** Auf schmalen Bildschirmen scrollt die Reiterleiste seitlich in sich, der gewählte Reiter rückt ins Bild.
- **Karten im Raster aus Zeilen:** zwei Spalten erst, wenn der Kartenbereich 820 px breit ist (beide Karten einer Zeile gleich hoch, eine einzelne letzte Karte über die volle Breite); jeder Abstand 16 px, die Skriptprüfung des Labors misst das. Auf der Seite steht die Analyse ab 768 px in voller Breite unter der Scheibe, die Karten stehen dort zu zweit.

## Empfehlung für den Seitenaufbau

**Eine Seite mit Sprungleiste.** Sobald der Kopf weggescrollt ist, erscheint oben „Scheibe · Schüsse · Zahlen · Analyse“; in der Analyse zeigt dieselbe Leiste die Themen (nie zwei Leisten). Aktionen mit Wirkung auf die Scheibe springen zur Scheibe und blenden „Zurück zu …“ ein. Abschnitt und Thema stehen in der Adresse (`#lage`), damit Zurück und geteilte Links gehen. Eine untere Abschnittsleiste scheidet aus, dort sitzt die App-Navigation ([[spiegel-ui-design]]). Ausweg, falls die Seite zu lang wirkt: die Analyse als eigene Ansicht.

Reihenfolge auf dem Telefon: Kopf mit Ergebnis, Scheibe mit Ablesezeile, Serien und Übersicht, Schüsse (ohne eigenen Scrollkasten, „Alle zeigen“), Kacheln, Analyse mit Überblick.

**Diagramme:** Ablesen durch Antippen oder Ziehen (Lineal), die Werte stehen fest über dem Diagramm, im Verlauf wählt das zugleich den Schuss auf der Scheibe. Jedes Diagramm bekommt seine Kernaussage als Label und „Werte als Tabelle“.

**Tablet und Desktop:** Ab 768 px links die Scheibe mit den Serien darunter, rechts daneben Schuss, Übersicht und Schüsse; Kacheln und Analyse folgen in voller Breite darunter (siehe unten).

## Entschieden mit dem Plan für Schritt 4 (8. Oktober 2026)

Die vier Fragen sind mit der Empfehlung entschieden (Plan `plans/2026-10-08-spiegel-mobile-seitenaufbau.md`,
freigegeben vom User):

1. **Analyse auf derselben Seite** mit Sprungleiste.
2. **Erster Bildschirm:** Kopf mit Ergebnis und einem Satz, Scheibe mit Ablesezeile; die Serien folgen direkt
   (bei 375 × 812 px passen Kopf und Scheibe, die Serien beginnen knapp darunter).
3. **Hilfe als Blatt** über „?“, „Erklärungen“ zeigt die Kurzsätze; ersetzt das Aufklappen unter der Karte.
4. **σ und Zehnerquote zweimal**, jede Gruppe nennt ihre Grundlage („über Serie 2“, „Analyse über …“).

Abweichend von der Empfehlung springt die Seite zur Scheibe sofort statt gleitend: Glattes Scrollen über
Tausende Pixel kam in einem verborgenen Fenster verspätet an und lief in der Skriptprüfung nicht. Aus demselben
Grund misst die Sprungleiste den aktiven Abschnitt beim Scrollen statt über einen `IntersectionObserver`.

## Nachgeschärft nach dem ersten Blick (8. Oktober 2026)

- **Neben der Scheibe nur, was zu ihr gehört:** Schuss, Serien und Schusstabelle sind beim Blick auf die Scheibe
  immer sinnvoll und stehen rechts daneben. Kacheln und Analyse brauchen Platz: In der rechten Spalte standen
  die zehn Kacheln zu fünf auf knapp 100 px und schnitten Werte ab. Sie stehen jetzt darunter in voller Breite,
  ihre Spalten richten sich nach der Breite des Bereichs. Die Sprungleiste folgt der neuen Reihenfolge.
- **Nichts angeschnitten:** Die Schalter der Scheibe liefen ab 768 px als Zeile, die in sich scrollte, und waren
  rechts abgeschnitten, die Reiterleiste in der schmalen Spalte ebenso. Die Schalter liegen jetzt als runde
  Knöpfe in den Ecken der Scheibe, wie an einer DISAG-Anzeige (Vorschlag des Users), „Übrige blass/aus“ als
  einer davon; die Labor-Schalter (Ansehen/Setzen) stehen im Labor-Kopf, die App hat sie nicht. Die
  Reiterleiste hat in voller Breite Platz. Auf dem Telefon teilt die Sprungleiste die Breite in vier Felder.
- **Serien unter der Scheibe** (User): links Scheibe und Serien, zusammen so groß, dass beide ins Fenster passen;
  die Scheibe wird dafür kleiner, aber nicht unter 280 px (bei 1280 × 900 rund 560 px, bei 1024 × 768 knapp
  450 px; bei 1024 × 600 passt nur die Scheibe allein). Rechts reicht die Schusstabelle bis zur Unterkante der
  Serien und scrollt in sich, so steht die obere Hälfte der Seite wie ein Bildschirm da.
- **Aktiver Abschnitt an der Leiste:** Mit 45 % der Fensterhöhe galt nach einem Sprung zu den kurzen Zahlen
  schon die Analyse als aktiv. Es zählt jetzt der Abschnitt, dessen Anfang die Leiste erreicht hat.

## Offen

- **Diagramm-Lineal** (Schritt 5): Werte per Antippen oder Ziehen, fest über dem Diagramm, Kopplung an die
  Scheibe; Kernaussage als Label und „Werte als Tabelle“ für Screenreader.
- Test mit VoiceOver.
