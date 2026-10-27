---
id: pruefen-reiter-lage-scroll-jump
type: incident
title: "Reiter Lage: Die Wahl einer Scheibe verschiebt die Seite"
keywords: [skriptprüfung, pruefen, reiter lage, zeitreihe, ablesung, scrollY, springt, seite bleibt stehen, fortschritt, liste der scheiben, alle zeigen, probe als training, demo-daten, detailtiefen, nicht im eigenen branch reparieren]
tags: [incident, spiegel, pruefen]
relates_to: ["[[spiegel-langzeit]]", "[[conventions]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 2026-10-27 (Spiegel, 1a-2): Die Skriptprüfung „Reiter Lage: ein Punkt der Zeitreihe wählt die Scheibe für die
Ablesung, die Seite bleibt stehen“ fiel, sobald `seed:own --demo` die erfundenen Scheiben jeder Detailtiefe anlegte. Die
Seite springt beim Wählen um gut 20 px nach oben. Mit dem Build von `main` gegen dieselben Daten derselbe FAIL mit
derselben Scheibe: ein älterer Fehler, den erst die neuen Daten treffen. Offen.

## Was passiert

Die Prüfung wählt in der Zeitreihe „links/rechts“ den ersten freistehenden Punkt, der nicht die Scheibe der Ablesung ist.
Mit den Demo-Scheiben kam ein Punkt dazu (eingetragene Schüsse mit Lage), und die Prüfung traf eine Trainings-Scheibe nur
aus Probe, die nicht unter den zehn neuesten Zeilen der Liste steht. Gemessen (1440 × 1400): Die Ablesung wird 24 px
kürzer (kein „liegt im Formband“), die Liste 23 px länger (die gewählte Zeile kommt dazu), die Seite insgesamt gleich
lang, `scrollY` sinkt von 1007 auf 984.

## Warum nicht hier repariert

Der Branch der Ansichten (1a-2) ändert weder Ablesung noch Liste für Scheiben mit Werten. Nach [[conventions]] §9 („Ein
neuer FAIL der Skriptprüfung ohne Codeänderung: erst an den Daten nachstellen“) nicht im fremden Branch reparieren, sondern
eigenen Branch aufmachen. Ansatz: die Höhe der Ablesung beim Wechsel halten oder die Verankerung des Scrollens an der
Zeitreihe festmachen; die Prüfung dazu wählt eigens eine Scheibe außerhalb der ersten zehn Zeilen.
