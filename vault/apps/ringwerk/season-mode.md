---
id: season-mode
type: subsystem
title: "season-mode"
keywords: [Saison-Modus, Langzeitwertung, beste Serien, Mindestserien, Mehrfach-Ranking, season mode, Jahreswertung, alternierende Sortierung, Ringe/Teiler alternierend, Teiler/Ringe alternierend, seasonSortMode, sortSeasonStandings, Anzeigereihenfolge, Rangliste sortieren]
tags: [feature]
feature_of: ["[[ringwerk]]"]
documented_in: ["[[ringwerk-features#Saison-Modus (SEASON) ✓ IMPLEMENTIERT (Phase 5)]]"]
relates_to: ["[[factor-correction]]"]
---

**TL;DR** Langzeit; beste Serien zählen, Mehrfach-Ranking (Ringe/Teiler/Ringteiler), Mindestserien-Gate (minSeries default 20).

## Anzeigereihenfolge der Rangliste (September 2026)

`calculateSeasonStandings` berechnet **immer alle drei** Metriken samt Einzelrängen; die
**Reihenfolge** kommt seither ausschließlich aus der reinen Funktion `sortSeasonStandings`
(`lib/scoring/sortSeasonStandings.ts`) — genutzt von Tabelle, Wettbewerbs-PDF, öffentlichem PDF
und Dashboard. Vorher hatte jede Oberfläche ihre eigene Sortierung: das PDF sortierte **immer**
nach Ringteiler (auch bei Wertung „Ringe"/„Teiler"), und die Dashboard-Karte schnitt die Top-5
**vor** dem Umsortieren ab, zeigte also die falschen Zeilen.

`resolveSeasonSort(scoringMode, seasonSortMode)` liefert fünf Reihenfolgen:

- **klassisch** — `rings` / `teiler` / `ringteiler`, abgeleitet aus `scoringMode` (alles außer
  Ringe/Teiler fällt auf Ringteiler); Spaltenköpfe bleiben manuell sortierbar.
- **alternierend** — `alt-rings` / `alt-teiler` aus `Competition.seasonSortMode`
  (`ALT_RINGS_FIRST` / `ALT_TEILER_FIRST`, nullbar; null = klassisch). Die Rangliste wechselt
  zeilenweise zwischen **besten Ringen** und **bestem korrigiertem Teiler**
  ([[factor-correction]]): pro Platz der beste noch nicht platzierte Teilnehmer dieser Metrik,
  jeder genau einmal. Gleichstand → alphabetisch (`localeCompare "de"`). Blöcke wie gehabt:
  Qualifizierte, dann Nicht-Qualifizierte (jeder Block für sich alternierend), Teilnehmer ohne
  Serie alphabetisch am Ende. Der Ringteiler ist hier **kein** Kriterium, bleibt aber Spalte.

Jede Zeile trägt `alternatingBy` (`"rings" | "teiler" | null`); Tabelle und PDF heben damit den
Wert hervor, der den Platz ergeben hat, und nehmen die anderen zurück — sonst ist eine
alternierende Reihenfolge für Leser nicht überprüfbar (gleiche Linie wie
[[best-of-standings-direct-comparison-tiebreak]]). Manuelles Sortieren ist in diesen Modi
deaktiviert: die Reihenfolge **ist** die Wertung.

Im Formular führt **eine** Auswahl „Wertungsmodus" beide Felder: ein alternierender Eintrag setzt
`seasonSortMode` **und** `scoringMode = RINGTEILER` — der neutrale Wert, bei dem das
Ringe-Eingabeformat der Disziplin folgt (`getEffectiveScoringType`). Genau deshalb sind die
alternierenden Werte **kein** `ScoringMode`: das Enum ist exhaustive in `calculateScore` /
`SCORE_DIRECTION` und trägt zusätzlich Liga-Duelle und Playoff-Kriterien, wo „alternierend" keine
Bedeutung hätte. Bildschirm und PDF zeigen in diesen Modi das Sortier-Label statt des
Wertungsmodus, weil „Ringteiler" dort nur noch das Eingabeformat trägt.
