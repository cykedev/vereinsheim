---
id: treffsicher-durchsicht
type: concept
title: "Treffsicher-Durchsicht — drei Ebenen am Telefon"
aliases: [treffsicher-usability-durchsicht]
keywords: [durchsicht, bedienbarkeit, usability, drei ebenen, antwort, belege, werkzeug, telefon, erster bildschirm, start, dashboard, einheit, tagebuch, statistik, dezimalpunkt, komma, toFixed, formatierung, schreibregeln, semikolon, bedienzeile, messkonto]
feature_of: ["[[treffsicher]]"]
governed_by: ["[[adr-032]]"]
relates_to: ["[[spiegel-durchsicht]]", "[[treffsicher-design2]]", "[[statistics-visualization]]", "[[ringwerk-durchsicht]]"]
---

**TL;DR** Gemessen am 20. Oktober 2026 am Telefon (390 × 844, 772 px Inhalt über der Leiste) mit einem Messkonto über
eine Saison (52 Einheiten in 26 Wochen, Ziele, Abläufe; `pnpm --filter treffsicher durchsicht`). Die Statistik folgt
schon den drei Ebenen (Zahl und Satz zuerst). Start und Einheit zeigen Ergebnisse ohne Bezug, die Antwort auf „Wie war
meine letzte Einheit?“ fehlt. Ein echter Fehler, Ergebnisse und Schüsse mit Dezimalpunkt statt Komma, ist behoben.
Mit [[adr-033]] betrifft Treffsicher nur, was das Tagebuch nach Spiegel mitnimmt; die übrigen Befunde stehen unter
„Offen“.

# Treffsicher-Durchsicht

Methode wie [[spiegel-durchsicht]]: je Hauptseite Länge in Bildschirmen, Bedienelemente und Zahlen gesamt und im
ersten Bildschirm, mehrfach gezeigte Werte, Fachbegriffe (`@vereinsheim/pruefen/measure`). Das Werkzeug legt das
Messkonto in der Dev-Datenbank an und entfernt es danach wieder.

## Messung (20. Oktober 2026)

| Seite | Länge | Bedienelemente (1. Bildschirm) | Zahlen (1. Bildschirm) |
|---|---|---|---|
| Start | 2,1 | 9 (3) | 33 (18) |
| Tagebuch | 12,8 | 54 (6) | 261 (16) |
| Einheit | 4,5 | 14 (6) | 102 (31) |
| Statistik | 4,5 | 55 (14) | 276 (16) |
| Ziele / ein Ziel | 1 / 1 | 4 (4) / 4 (4) | 10 (10) / 4 (4) |
| Abläufe | 1 | 3 (3) | 4 (4) |
| Disziplinen | 1 | 6 (6) | 10 (10) |
| Profil | 1,2 | 12 (11) | 0 |
| Neue Einheit | 1 | 8 (8) | 1 (1) |

Fachbegriffe: nur „Ø“ in der Statistik. Mehrfach gezeigte Werte: nur in der Statistik (Ø je Schuss im Verlauf, in der
Liste und in der Tabelle der Werte), dort gewollt.

| Frage | Urteil |
|---|---|
| Wie war meine letzte Einheit? | mühsam: Start zeigt zuerst zwei Zähler (Einheiten in 30 Tagen, gesamt), dann die letzten Einheiten mit Ergebnis ohne Bezug. Kein Satz, kein Vergleich mit dem eigenen Schnitt. |
| Werde ich besser? | gut: Statistik, erster Bildschirm, Zahl und Satz („0,20 höher als im Zeitraum davor“) |
| Was war an dieser Einheit los? | geht: Ergebnis und Serien oben, aber ohne Bezug und ohne Beobachtung in Worten |

## Befunde

- **T1 Dezimalpunkt statt Komma (Fehler, behoben am 20. Oktober 2026):** Ergebnisse, Höchstwerte und Schüsse standen
  als „392.2 von 436.0“ und „10.5“, weil die Anzeige `toFixed` nutzte statt `@vereinsheim/lib/format` (conventions
  §6). Jetzt `formatDecimal` aus dem Paket (Liste, Einheit, Schüsse, Höchstwert im Formular, Größe beim Hochladen);
  `ShotValues.test.tsx` hält das fest. Das PDF der Einheit setzt weiter einen Punkt, PDFs bleiben, wie sie sind.
- **T2 Start ohne Antwort:** Die erste Fläche gehört zwei Zählern. Spiegels Start zeigt den letzten Abend groß, mit
  Satz und dem Bezug zum Schnitt der fünf davor, darunter die Form der letzten 90 Tage ([[spiegel-navigation]]).
- **T3 Einheit ohne Bezug:** Das Ergebnis steht allein. Ein Satz mit dem Abstand zum Schnitt der fünf Einheiten davor
  (Spiegels Ablesung in der Liste) gäbe die Antwort; die Rechnung liegt in `shot-core` (`periodModel`).
- **T4 Statistik mit zwei Zeilen Bedienung vor der Antwort:** Disziplin als Segment, darunter Zeitraum und Wertung.
  Die Leitlinie ist eine Zeile ([[spiegel-durchsicht]]); in Spiegel stehen Familie, „Filter“ und Wertung in einer.
- **T5 Satz mit Semikolon (umgesetzt am 20. Oktober 2026, samt Beobachtungen und Hinweisen in `shot-ui`):** „…; das ist ein klarer Unterschied.“ widerspricht den Schreibregeln (conventions §10).
  Der Satz kommt aus `shot-ui` (`period/sentence.ts`) und steht so auch in Spiegel.
- **T6 Tagebuch lang:** 12,8 Bildschirme bei 52 Einheiten, alle Einheiten untereinander. Spiegels Liste zeigt je Abend
  gruppiert und kürzt am Telefon („Alle zeigen“).

Nicht gemessen: die Kopie der echten Daten (Treffsicher-Konten gehören Mitgliedern); die Längen hängen an der Zahl der
Einheiten.

## Offen

- **T2, T3, T6** (Start, Einheit, Tagebuch): kommen mit [[adr-033]] Stufe 2 aus Spiegel.
- **T4 eine Zeile Bedienung:** Die Familie als Segment bricht am Telefon mit langen Namen um (`PeriodControls` in
  `shot-ui`); eine kompakte Familienwahl ändert Spiegel mit, deshalb zu [[adr-033]] Stufe 2.
- **Hilfetexte in `shot-help`:** noch 51 Semikolons; eigener Durchgang über das Textbuch.
