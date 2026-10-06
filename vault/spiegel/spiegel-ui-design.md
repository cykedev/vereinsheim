---
id: spiegel-ui-design
type: concept
title: "Spiegel — Design 2 und Bildschirme"
aliases: [spiegel-design, design-2, spiegel-ui]
keywords: [design, ui, ux, design 2, modern, zeichnen, haarlinie, non-scaling-stroke, zoom, schwerpunkt-symbol, geviertelt, streukreis-ring, ganze ringe, zehntel, zehntelwertung, ganzringwertung, umschalten, wertung umschalten, prototyp, bottom navigation, untere navigation, scannen, session-detail, trefferbild, wiedergabe, replay, serien, kacheln, hell, dunkel, farbskala, ringwert-farben, farbenblind, archivo, geist, typografie, pwa, mobil, desktop, sonderfälle, probe-blöcke, merkmale, als wertung zählen, nicht meine, trainingsabend]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-030]]"]
relates_to: ["[[component-canon]]", "[[navigation-pattern]]", "[[spiegel-metrics]]", "[[spiegel-edge-cases]]", "[[spiegel-target-library]]"]
---

**TL;DR** Spiegel ist modern, ruhig und datengetrieben: die Scheibe ist der Held, die Oberfläche bleibt kühl-neutral, Farbe kommt aus den Daten, hell und dunkel. Auf dem Handy gibt es eine untere Navigation mit zentraler Scan-Aktion, auf dem Desktop eine Analysezentrale. Der klickbare Prototyp liegt in `vault/_attachments/spiegel-konzept.html` und hat dem User gefallen.

## Grundsätze

- **Die Scheibe ist der Held.** Ergebnis groß daneben, Analyse darunter, Details auf Antippen.
- **Farbe kommt aus den Daten.** Die Oberfläche bleibt kühl-neutral (Blaugrau), damit Ringwerte, Serien und Vergleiche leuchten.
- **Daumenzone ohne Verdecken.** Navigation unten, Inhalte enden davor (die ShotsApp verdeckt dort Serienwerte).
- **Bewegung mit Bedeutung:** Wiedergabe in echter Reihenfolge, Zoom auf die Gruppe, weiche Übergänge von der Liste in die Scheibe; mit „Bewegung reduzieren“ springt alles.
- **Hell und dunkel:** dunkel für die Halle am Abend, hell für Tageslicht. Der Verein schießt nur in der 10-m-Halle; ob Phase 1 nur dunkel startet, ist offen ([[spiegel-open-questions]]).
- **Desktop ist die Analysezentrale:** Scheibe links, Kennzahlen rechts, Vergleiche nebeneinander.
- **Zahlen in Worten:** die wichtigste Beobachtung als Satz ([[spiegel-metrics]]).
- **Ganze Ringe oder Zehntel, jederzeit:** Jeder Wert lässt sich zwischen beiden Wertungen umschalten (unten).

## Navigation (Handy)

Start · Scheiben · **Scannen** (Meyton-QR, in der Mitte) · Fortschritt · Profil. Auf dem Desktop dieselben Bereiche als Seitenleiste. Abweichend vom heutigen Kopfzeilen-Schema ([[navigation-pattern]]), deshalb Teil von Design 2.

## Bildschirme

| Bildschirm | Inhalt |
|---|---|
| Start | letzte Scheibe groß, neu seit dem letzten Besuch, Aktivität, gebrochene Rekorde |
| Scheiben | Liste nach Tagen, Filter nach Disziplin und Art |
| Scheibe (Session-Detail) | Kopf mit Disziplin, Stand, Zeit, Ergebnis; Trefferbild mit Schaltern (Schwerpunkt, Streukreis, Nummern, Probe), Zoom Gruppe/Scheibe, Wiedergabe; Wertung ganze Ringe/Zehntel; Kennzahl-Kacheln mit Abstand zum 30-Tage-Schnitt; Beobachtung; Serien als kleine Scheiben im gleichen Maßstab; Schuss für Schuss (Wert, Tempo); Schusstabelle; Original-PDF |
| Vergleich | zwei Auswahlen auf einer Scheibe, Tabelle mit Differenz |
| Fortschritt | Verlauf jeder Kennzahl, Rekorde, Kalender |
| Profil | Zuordnung (Sportpass), Freigaben, Export, Löschen |
| Admin | Anlagen, Brücken-Status, Zuordnungen, Scheibenbilder, Nutzer |

## Wertung: ganze Ringe oder Zehntel

- **Überall umschaltbar:** Wo ein Wert steht (Schuss, Serie, Scheibe, Kacheln, Verläufe, Rekorde, Vergleiche), lässt er sich zwischen ganzen Ringen und Zehnteln umschalten. Der Schalter ist immer erreichbar.
- **Voreinstellung** ist die amtliche Wertung der Scheibe (Feld `Wertung` je Treffer, [[spiegel-target-library]]). Wer umschaltet, behält die Wahl, bis er zurückschaltet; die amtliche Wertung bleibt als Hinweis sichtbar.
- Wo Platz ist, steht die andere Wertung klein daneben („10 · 10,5 in Zehnteln“).
- **Fehlen die Zehntel** (Ganzring-Ausdruck ohne Lage), zeigt die Zehntel-Ansicht „–“ mit Grund, keine Schätzung (SF-18).
- Rekorde und Verläufe laufen je Wertung getrennt.
- Technisch hat jede wertbasierte Kennzahl ein Gegenstück in der anderen Wertung; ein Test erzwingt das ([[spiegel-metrics]]).

## Hilfe und Erklärungen

- **Jede Zahl ist erklärt.** An jeder Kachel und jeder Karte sitzt ein „?“; es öffnet die Erklärung aus [[spiegel-statistics-help]]: was die Zahl misst, wie man sie liest, was man tun kann, wo man sich täuscht. Auf dem Handy als Blatt von unten, auf dem Desktop als Karte daneben, nie nur als Tooltip.
- **Erst Worte, dann Formel.** Die Formel steht aufklappbar für Profis darunter, nie davor.
- **Auch „–“ und „unklar“ erklären:** „ab 10 Schuss“ sagt, warum ein Wert fehlt; „unklar“ sagt, was mehr Schüsse klären würden.
- **Einmal oben erklärt:** Ein Einstieg „So liest du die Analyse“ erklärt n, 95-%-Bereich, „echt“ und „unklar“ und die Wertung, damit die Karten kurz bleiben.
- **Ein Glossar** für die Begriffe (σ, R50, Median, Hotelling …), aus jeder Erklärung verlinkt.
- **Eine Quelle:** App und Doku zeigen dieselben Texte (SP-1.11).

## Zeichnen der Scheibe

Die Optik ist dem User besonders wichtig: minimal, scharf, nichts Klobiges, auch stark vergrößert.

- **Haarlinien, die nicht mitwachsen:** Ringlinien, Trefferränder und Streukreis sind 1 px breit und bleiben es in jeder Zoomstufe (`vector-effect: non-scaling-stroke`). Keine Schatten, kein Glühen, keine dicken Ränder.
- **Treffer** in Kalibergröße, gefüllt mit der Ringwert-Farbe, mit 1-px-Rand; der Rand trennt überlappende Treffer.
- **Alles, was etwas zeigt, liegt über den Treffern:** Streukreis, Vertrauensellipse, Markierungen und der Schwerpunkt (ganz oben). Unter den Treffern verschwänden sie gerade dort, wo die Gruppe dicht ist (Wunsch des Users, Oktober 2026). Linien, die durch die Treffer laufen (Vertrauensellipse), tragen einen schmalen hellen Saum, damit sie auf farbigen Treffern lesbar bleiben; der Streukreis liegt um die Treffer und bleibt eine Haarlinie ohne Saum, auf Schwarz sähe der Saum wie eine Doppellinie aus.
- **Schwerpunkt:** ein kleiner, schwarz-weiß geviertelter Kreis (vier Segmente im Wechsel), kleiner als ein Treffer (Radius 5–8 px) und **immer ganz oben** über allen Treffern. Eine 1-px-Kontur mit 1 px hellem Saum hält ihn auf Papier, Spiegel und Treffern lesbar.
- **Streukreis:** ein 1-px-Ring in einer Farbe, die keine Ringwert-Farbe ist (Blau), **um** die Treffer gezeichnet: der Kreis durch die Zentren plus ein halbes Kaliber und 2 px Luft. Durch die Zentren gezeichnet verschwände er bei einer engen Gruppe unter den Treffern; die Zahl dazu misst weiter Mitte zu Mitte. Er erscheint ab derselben Schusszahl, ab der die Kennzahl gilt.
- **Ringzahlen** in fester Bildschirmgröße (höchstens 12 px, nie größer als der Ring); sie wachsen beim Zoomen nicht mit.
- **Kein Dauer-Ring um den letzten Schuss:** In einer engen Gruppe verwirrt er. Ein neuer Schuss ploppt beim Setzen kurz auf; Ablesung und Liste nennen ihn.
- Die Spielwiese zum Fachkern zeigt diese Regeln; die echte Ansicht (SP-1.8, `packages/shot-ui`) übernimmt sie.

## Sonderfälle in der Oberfläche

Aus dem Sonderfall-Katalog ([[spiegel-edge-cases]]):

- **Probe beliebig lang:** gegliedert in Zehnerblöcke P1…Pn. Eine Scheibe nur mit Probe zeigt die volle Analyse ohne Ergebnis. Der Prototyp nimmt fünf Probeschüsse vor der Wertung an; das ist ein Beispiel, kein Modell (SF-02).
- **Merkmale als ruhige Hinweise** an der Scheibe (unvollständig, korrigiert, nur PDF, neu gewertet), Erklärung auf Antippen.
- **Aktionen an der Scheibe:** „Als Wertung zählen“ für eine vergessene Umschaltung (SF-05), „Disziplin korrigieren“, „Nicht meine“, „Aus Verläufen ausnehmen“, „An Schuss n teilen“.
- **Liste nach Trainingsabend:** kleine Scheiben (Aufwärmen, Abbruch) eingeklappt unter dem Abend (SF-11).
- **Wiedergabe mit Tempo-Wahl,** damit 100 Schuss nicht minutenlang dauern.
- **Leere Werte:** Eine Kennzahl ohne Wert zeigt „–“ mit Grund („zu wenige Schüsse“), nie 0.

## Farben und Schrift (aus dem Prototyp)

- **Ringwert-Skala:** 10 rot `#e5484d`, 9 gold `#e9b10c`, 8 türkis `#1fa3c8`, ≤ 7 violett `#7c5cd6`. Mit dem Dataviz-Validator geprüft: alle Paare auch bei Farbenblindheit unterscheidbar (CVD ΔE ≥ 13). Jeder Treffer hat einen dunklen 1-px-Rand (siehe „Zeichnen der Scheibe“). Offen ist, ob stattdessen das Meyton-Schema der Treffsicher-Statistik gelten soll ([[spiegel-open-questions]]).
- **Vergleichsfarben:** A blau, B orange (geprüft).
- **Schrift:** Archivo (breit, für Zahlen und Überschriften), Geist (Text, wie heute), Geist Mono (Tabellen, Achsen).
- Kein Tortendiagramm für die Ringverteilung, sondern ein Histogramm; Zeitachsen von links nach rechts.

## Verhältnis zu `@vereinsheim/ui`

Design 2 kommt als zusätzliche Schicht ins Paket (Tokens und Bausteine); Ringwerk und Treffsicher bleiben vorerst unverändert. Spiegel nimmt vorerst nicht am Drift-Gate teil. Das ist eine bewusste Ausnahme von [[conventions]] (byte-identische Schicht, fest dunkel) und in [[adr-030]] vorgeschlagen. Der Komponenten-Kanon ([[component-canon]]) gilt weiter: PageHeader, EmptyState, ConfirmDialog, Toasts.
