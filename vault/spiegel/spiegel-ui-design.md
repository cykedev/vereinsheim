---
id: spiegel-ui-design
type: concept
title: "Spiegel — Design 2 und Bildschirme"
aliases: [spiegel-design, design-2, spiegel-ui]
keywords: [design, ui, ux, design 2, modern, prototyp, bottom navigation, untere navigation, scannen, session-detail, trefferbild, wiedergabe, replay, serien, kacheln, hell, dunkel, farbskala, ringwert-farben, farbenblind, archivo, geist, typografie, pwa, mobil, desktop, sonderfälle, probe-blöcke, merkmale, als wertung zählen, nicht meine, trainingsabend]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-030]]"]
relates_to: ["[[component-canon]]", "[[navigation-pattern]]", "[[spiegel-metrics]]", "[[spiegel-edge-cases]]"]
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

## Navigation (Handy)

Start · Scheiben · **Scannen** (Meyton-QR, in der Mitte) · Fortschritt · Profil. Auf dem Desktop dieselben Bereiche als Seitenleiste. Abweichend vom heutigen Kopfzeilen-Schema ([[navigation-pattern]]), deshalb Teil von Design 2.

## Bildschirme

| Bildschirm | Inhalt |
|---|---|
| Start | letzte Scheibe groß, neu seit dem letzten Besuch, Aktivität, gebrochene Rekorde |
| Scheiben | Liste nach Tagen, Filter nach Disziplin und Art |
| Scheibe (Session-Detail) | Kopf mit Disziplin, Stand, Zeit, Ergebnis; Trefferbild mit Schaltern (Schwerpunkt, Streukreis, Nummern, Probe), Zoom Gruppe/Scheibe, Wiedergabe; Kennzahl-Kacheln mit Abstand zum 30-Tage-Schnitt; Beobachtung; Serien als kleine Scheiben im gleichen Maßstab; Schuss für Schuss (Wert, Tempo); Schusstabelle; Original-PDF |
| Vergleich | zwei Auswahlen auf einer Scheibe, Tabelle mit Differenz |
| Fortschritt | Verlauf jeder Kennzahl, Rekorde, Kalender |
| Profil | Zuordnung (Sportpass), Freigaben, Export, Löschen |
| Admin | Anlagen, Brücken-Status, Zuordnungen, Scheibenbilder, Nutzer |

## Sonderfälle in der Oberfläche

Aus dem Sonderfall-Katalog ([[spiegel-edge-cases]]):

- **Probe beliebig lang:** gegliedert in Zehnerblöcke P1…Pn. Eine Scheibe nur mit Probe zeigt die volle Analyse ohne Ergebnis. Der Prototyp nimmt fünf Probeschüsse vor der Wertung an; das ist ein Beispiel, kein Modell (SF-02).
- **Merkmale als ruhige Hinweise** an der Scheibe (unvollständig, korrigiert, nur PDF, neu gewertet), Erklärung auf Antippen.
- **Aktionen an der Scheibe:** „Als Wertung zählen“ für eine vergessene Umschaltung (SF-05), „Disziplin korrigieren“, „Nicht meine“, „Aus Verläufen ausnehmen“, „An Schuss n teilen“.
- **Liste nach Trainingsabend:** kleine Scheiben (Aufwärmen, Abbruch) eingeklappt unter dem Abend (SF-11).
- **Wiedergabe mit Tempo-Wahl,** damit 100 Schuss nicht minutenlang dauern.
- **Leere Werte:** Eine Kennzahl ohne Wert zeigt „–“ mit Grund („zu wenige Schüsse“), nie 0.

## Farben und Schrift (aus dem Prototyp)

- **Ringwert-Skala:** 10 rot `#e5484d`, 9 gold `#e9b10c`, 8 türkis `#1fa3c8`, ≤ 7 violett `#7c5cd6`. Mit dem Dataviz-Validator geprüft: alle Paare auch bei Farbenblindheit unterscheidbar (CVD ΔE ≥ 13). Auf weißem Papier bekommt jeder Treffer einen dunklen Rand. Offen ist, ob stattdessen das Meyton-Schema der Treffsicher-Statistik gelten soll ([[spiegel-open-questions]]).
- **Vergleichsfarben:** A blau, B orange (geprüft).
- **Schrift:** Archivo (breit, für Zahlen und Überschriften), Geist (Text, wie heute), Geist Mono (Tabellen, Achsen).
- Kein Tortendiagramm für die Ringverteilung, sondern ein Histogramm; Zeitachsen von links nach rechts.

## Verhältnis zu `@vereinsheim/ui`

Design 2 kommt als zusätzliche Schicht ins Paket (Tokens und Bausteine); Ringwerk und Treffsicher bleiben vorerst unverändert. Spiegel nimmt vorerst nicht am Drift-Gate teil. Das ist eine bewusste Ausnahme von [[conventions]] (byte-identische Schicht, fest dunkel) und in [[adr-030]] vorgeschlagen. Der Komponenten-Kanon ([[component-canon]]) gilt weiter: PageHeader, EmptyState, ConfirmDialog, Toasts.
