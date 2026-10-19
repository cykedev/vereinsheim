---
id: statistics-visualization
type: subsystem
title: "statistics-visualization"
keywords: [Statistik, Auswertung, Seite eines Zeitraums, Fortschritt, Verlauf, Tabelle der Serien, Trefferlage, Einflüsse, Selbstbild, Ringverteilung, statistics, analytics]
tags: [subsystem]
subsystem_of: ["[[treffsicher]]"]
governed_by: ["[[adr-032]]"]
relates_to: ["[[spiegel-langzeit]]", "[[wellbeing-tracking]]"]
documented_in: ["[[treffsicher-requirements#Statistiken & Auswertung]]"]
---

**TL;DR** Treffsichers Statistik ist Spiegels Seite eines Zeitraums ([[spiegel-langzeit]]) über die Einheiten einer
Disziplin, gerechnet auf dem Server mit `shot-core`. Erhalten aus der alten Statistik: die Tabelle der Serien je
Einheit und die Trefferlage. Neu: Einflüsse, Selbstbild als Zeilen, Rekorde. Hochrechnung, Radar und Recharts entfallen.

# Statistik in Treffsicher

## Aufbau

- **Server** (`src/lib/statistics/`): `statisticsSessions` liest höchstens 1.200 Einheiten (Training und Wettkampf,
  [[treffsicher-dos-protection]]), `periodItems` macht aus jeder Einheit einen `PeriodItem` (Ø je Schuss, Zehner,
  Rekord-Kandidaten, Lage als Schwerpunkt-Abstand), `statisticsPage` rechnet `periodModel` für die gewählte Disziplin und
  dazu Einflüsse, Selbstbild, Tabelle, Trefferlage und Ringverteilung über die Einheiten der Seite (Zeitraum und Art).
  Der Browser bekommt das leichte Modell (`lightPeriodModel`).
- **Browser** (`src/components/app/statistics/`): `StatisticsScreen` wie Spiegels `ProgressScreen`. Filter schreiben die
  Adresse und rechnen auf dem Server neu, die Wahl einer Einheit bleibt im Browser (`pick` per `replaceState`).
- **Gemerkt wie in Spiegel** (`src/lib/statistics/memory.ts`): der im Blatt „Filter“ übernommene Zeitraum im Cookie
  `treffsicher-period` (gilt, wenn die Adresse außer der Disziplin keine Abfrage hat) und je Disziplin die Wertung im
  Cookie `treffsicher-scoring` (die Wertung steht nicht in der Adresse; Spiegel speichert sie je Familie in der
  Datenbank, Treffsicher auf dem Gerät, ohne Migration). Der Rahmen merkt sich die letzte Adresse der Statistik
  (ohne `pick`), „Statistik“ in der Navigation führt dorthin zurück.
- **Bausteine aus `shot-ui`** mit Treffsichers Wörtern: `PeriodWordsProvider` mit „Einheit“ statt „Scheibe“,
  `HelpTextsProvider` für Titel und Kurzsätze der Hilfe, eigene Kacheln (`tileKeys`) und Kennzahlen des Verlaufs
  (`metrics`), kein Schalter „Trainings nur aus Probe“, Ablesung ohne kleine Scheibe (`target: null`), kein Kalender.

## Alt → neu

| Alte Ansicht                                   | Neu                                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| Zeiträume Monat, 3, 6 Monate, alles, frei      | Blatt „Filter“: 30, 90 (Vorgabe), 182 Tage, 12 Monate, Alles, frei; Vergleich            |
| Filter Art und Disziplin („alle“ möglich)      | Disziplin Pflicht, Art im Blatt „Filter“                                                |
| Ringe/Schuss oder Hochrechnung                 | Ø je Schuss; Hochrechnung entfällt                                                      |
| Ergebnisverlauf mit Trend                      | Verlauf mit Schnitt der letzten fünf, Formband, Lineal, Werte als Tabelle               |
| Übersicht-Tabelle je Disziplin                 | **erhalten**: „Serien je Einheit“ unter „Zahlen“, dieselbe Rechnung (`aggregateOverview`) |
| Serienwertungen je Position                    | Ø-Zeilen der Tabelle                                                                    |
| Trefferlage: Wolke und Trend                   | **erhalten**: Reiter „Trefferlage“, Wolke mit Mittel, Verlauf je Achse                  |
| Schussverteilung im Zeitverlauf                | Ringverteilung des Zeitraums unter „Zahlen“, Zehnerquote im Verlauf                     |
| Befinden gegen Ergebnis, Qualität gegen Ringe  | Reiter „Einflüsse“: hohe gegen niedrige Gruppe, `comparePeriods`                         |
| Selbsteinschätzung als Radar                   | Reiter „Selbstbild“: Zeilen mit Prognose, Feedback, Abstand                             |
| keine Rekorde                                  | Rekorde (Einheiten mit Einzelschüssen in jeder Serie)                                   |

Der User hat am 19. Oktober 2026 festgelegt: Die alten Auswertungen gehen nicht verloren, sie nähern sich Spiegel in
Art und Darstellung an; die Tabelle und die Trefferlage bleiben.

## Hilfe

Jedes „?“ der Statistik öffnet eine Erklärung von Treffsicher (`src/lib/help/statisticsTopics.ts`, freigegeben im
Textbuch): unter denselben Ids wie in Spiegel, damit die Bausteine aus `shot-ui` sie finden (`HelpTextsProvider` für
Titel und Kurzsatz, das Blatt aus `helpTopic`). Ein Test hält fest, dass jede Id der Seite ein eigenes Thema hat und
keins von Spiegel kommt.

## Einflüsse

`influences` (`src/lib/statistics/influences.ts`): je Merkmal (Schlaf, Energie, Stress, Motivation, Ausführung als
Mittel der bewerteten Wertungsserien) die Einheiten über und unter dem Median; Einheiten auf dem Median zählen zur
kleineren Gruppe (Werte bleiben oft auf einer Stufe stehen), bei gleich großen Gruppen zu keiner.
`comparePeriods` mit der niedrigen Gruppe als a und der hohen als b, Urteil vom hohen Wert aus („Guter Schlaf: deutlich
besser“), ab fünf Einheiten je Seite. Sind alle Werte gleich, sagt die Karte das. Die Tests prüfen die Regeln per
Mutationsprobe (Gruppen tauschen, Probe mitzählen, Mitte nach Reihenfolge, gleiche Werte immer oben, nie unten oder
bei Gleichstand unten).

## Zahlenabgleich (19. Oktober 2026)

Vor dem Abbau der alten Statistik an der Dev-DB gemessen: Ø je Schuss je Konto, Disziplin und Zeitraum (30 und 90 Tage,
6 und 12 Monate, alles), 47 Gruppen. Die neue Seite zeigt in allen 47 dieselbe Zahl der Einheiten und denselben Ø. Eine
Abweichung war zu klären: Drei Serien in Disziplinen mit ganzen Ringen haben ein Ergebnis mit Zehntel. Die neue Rechnung
rundete die Summe zuerst auf ganze Ringe. Sie rundet jetzt nur auf Zehntel, wie gespeichert.
