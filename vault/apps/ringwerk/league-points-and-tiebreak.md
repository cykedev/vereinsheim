---
id: league-points-and-tiebreak
type: concept
title: "league-points-and-tiebreak"
keywords: [Liga-Punkte, Punktevergabe, Tabellensortierung, Sieg Unentschieden, tiebreak, points, Tabellenstand, Freilos, Wertungspunkte]
tags: [domain-rule]
relates_to: ["[[league-mode]]"]
part_of: ["[[ringwerk]]"]
documented_in: ["[[ringwerk-data-model#Liga-spezifisch: Punktevergabe (Gruppenphase)]]"]
---

**TL;DR** Liga-Gruppenphase-Punktevergabe (Sieg 2 / Unentschieden je 1 / Freilos 2) als Basis der Tabellensortierung im DOUBLE_ROUND_ROBIN.

# Duell, direkter Vergleich und Spalte bei Gleichstand

- **Duell:** `determineOutcome` nach der Wertung der Liga (Ringteiler, Ringe oder Teiler). Beim Teiler zählt im
  gemischten Wettbewerb der korrigierte (`correctedTeiler`, [[factor-correction]]), in Tabelle, direktem Vergleich,
  Spielplan und PDF des Spielplans (`pairingOutcome`).
- **Reihenfolge:** Punkte, dann Punkte aus den Duellen der Punktgleichen untereinander, dann bei Wertung nach Ringen die
  meisten Ringe, sonst der beste Ringteiler; wer erst am Namen hängt, teilt sich den Platz.
- **Spalte:** `leagueTieColumn` gibt Bildschirm und PDF Kopf, Wert und Format: „Best. Ringe“ bei Wertung nach Ringen,
  sonst „Best. RT“ (mit „?“ zum Ringteiler).
