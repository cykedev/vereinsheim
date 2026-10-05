---
id: spiegel-vision
type: guide
title: "Spiegel — Vision und Abgrenzung"
aliases: [spiegel-ziel, spiegel-produktvision]
keywords: [vision, ziel, zielgruppe, abgrenzung, leitprinzipien, nicht-ziele, shotsapp, disag, m-qnect, treffsicher, ringwerk, ambitionierte schützen, trainer]
part_of: ["[[spiegel]]"]
relates_to: ["[[treffsicher-requirements]]", "[[meyton-interfaces]]"]
---

**TL;DR** Spiegel zeigt jeden Schuss so, wie er gefallen ist, und macht aus den Rohdaten der Meyton-Anlage eine Auswertung, die schön, nützlich und intuitiv ist. Spiegel ist ein Messinstrument, kein Tagebuch; das Tagebuch bleibt Treffsicher.

# Spiegel — Vision und Abgrenzung

## Ziel

„Jeder Schuss, so wie er gefallen ist.“ Spiegel übernimmt automatisch die Rohdaten jeder Scheibe aus der Meyton-Anlage und macht daraus:

- **Details einer Session:** Trefferbild mit Schwerpunkt und Streukreis, Wiedergabe in echter Reihenfolge, Serien einzeln und nebeneinander, Schuss für Schuss mit Teiler, Richtung und Intervall.
- **Verläufe jeder Kennzahl** über Wochen und Monate, mit Rekorden.
- **Direkte Vergleiche:** Serie gegen Serie, Scheibe gegen Scheibe, Zeitraum gegen Zeitraum, Merkmal gegen Merkmal, gegen den eigenen Schnitt.

## Warum

- Die PDF-Importe in Treffsicher und Ringwerk liefern Serienwerte, aber keine Trefferlage je Schuss und keine Zeiten, und sie brechen bei Formatwechseln ([[meyton-pdf-format-change]]).
- Die Meyton-Datenbank SSMDB2 enthält die echten Rohdaten ([[meyton-ssmdb2]]).
- Ambitionierte Schützen wollen mehr als ein Ergebnis: Wo liegt mein Schwerpunkt, wie entwickelt sich meine Streuung, warum fällt Serie 4 ab?

## Zielgruppen

- **Ambitionierte Schützen** — Auswertung, Verläufe, Vergleiche; im Verein etwa 10 bis 15. Gäste und Jugendliche unterstützt Spiegel vorerst nicht.
- **Trainer** — sehen, was ihre Schützen freigeben, später auch live.
- **Verein** — betreibt Spiegel selbst, auf eigener Hardware und eigenem Server.
- **Andere Vereine mit Meyton** — betreiben eine eigene Installation (Open Source, [[adr-029]]).

## Was Spiegel nicht ist

- **Kein Tagebuch.** Absicht, Reflexion, Befinden und Ziele bleiben in Treffsicher ([[treffsicher-requirements]]); Treffsicher übernimmt Ergebnisse aus Spiegel.
- **Keine Ligaverwaltung.** Das ist Ringwerk; Ringwerk kann später Ergebnisse aus Spiegel beziehen.
- **Keine Stand-Anzeige für Monitore.** Das leisten Meyton selbst und Projekte wie Meyton-Live-Display ([[meyton-interfaces]]).
- **Kein Ersatz für die amtliche Wertung.** Ring, Zehntel und Teiler zeigt Spiegel so, wie Meyton sie gewertet hat.

## Messlatte: DISAG ShotsApp mit M-Qnect

Mit DISAG M-Qnect (kostenloses Tablet im Meyton-Netz, fragt die SSMDB2 alle 30 s ab) funktioniert die DISAG ShotsApp schon heute mit Meyton. Basis kostenlos, Analyse mit Diagrammen, Schussgruppe und Wiedergabe im Premium-Abo (2,49 € im Monat). Spiegel lohnt sich für das, was das nicht liefert:

- die eigenen Daten auf dem Vereinsserver, Export jederzeit;
- jede Kennzahl als Verlauf und im direkten Vergleich, ohne Abo;
- Desktop-Analyse neben der Handy-Ansicht;
- Trainer- und Vereinsfunktionen;
- die Verbindung zu Treffsicher und Ringwerk;
- automatische Übernahme statt Scannen, wo die Zuordnung feststeht.

Übernehmen wollen wir von der ShotsApp: die Scheibe als großes Bild ganz oben, Serien zum Durchwischen, die Schussliste mit Richtungspfeil, kleine Chips für Schwerpunkt-Versatz und Streukreis, eine zentrale Scan-Aktion. Anders machen: Navigation, die nie Werte verdeckt; Histogramm statt Torte; Training oder Wettkampf automatisch aus Meyton; Zeitachsen von links nach rechts; eine farbenblind geprüfte Farbskala.

## Leitprinzipien

- **Rohdaten bleiben unverändert**, alles andere ist daraus abgeleitet und neu berechenbar.
- **Meyton-Werte sind amtlich**; eigene Rechnung nur für Geometrie und als Gegenprobe.
- **Quellen-neutral:** Meyton ist der erste Adapter, weitere Systeme sollen ohne Modelländerung andocken.
- **Datensparsamkeit beginnt in der Brücke.**
- **Verdeckt bleibt verdeckt.**
- **Zeit hat immer eine Zone.**
- **Schön, nützlich, intuitiv:** die Scheibe ist der Held, Zahlen in Worten, Details auf Antippen ([[spiegel-ui-design]]).
