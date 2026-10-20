---
id: playoffs-knockout-system
type: subsystem
title: "playoffs-knockout-system"
keywords: [Playoffs, K.o.-System, Endrunde, Finale, Knockout, playoff bracket, Ausscheidung, Best-of, Korrektur, Folgerunde, Halbfinale anlegen, Neu-Setzung]
tags: [feature]
feature_of: ["[[league-mode]]"]
relates_to: ["[[best-of-single]]"]
documented_in: ["[[ringwerk-features#Playoff-Phase (K.O.-System)]]"]
---

**TL;DR** Liga-K.o. nach Gruppenphase, Best-of-N (playoffBestOf), eigenes Finale-Format; playoffMatch.count>0 sperrt Edits (siehe ruleset-lock-granularity). Korrekturen je Runde: korrigierbar, solange die ganze Folgerunde kein Duell hat; ein anderer Ausgang entfernt die ganze Folgerunde (Neu-Setzung nach Rang).

# Finale und Sieger eines Duells

- **Verlängerung immer (E1, 20. Oktober 2026):** Steht ein Finale nach mindestens einem fertigen Duell gleich und hat
  kein offenes Duell, legt `settle` das Duell der Verlängerung an. Die Spalte `finaleHasSuddenDeath` bleibt im Schema,
  Ringwerk liest und schreibt sie nicht mehr.
- **Sieger eines Duells:** Turnierbaum, Karte und PDF der Playoffs markieren den Sieger mit `storedDuelOutcome`, der
  Regel, mit der `countWins` die Siege zählt: im Finale Hauptkriterium, dann die Stichkriterien, sonst Ringteiler,
  Ringe, Teiler. Beim Teiler zählt im gemischten Wettbewerb der korrigierte ([[factor-correction]]).
- **Höchste Ringzahl:** Der Ringteiler eines Duells rechnet mit der Schusszahl des Wettbewerbs (`getMaxRings`), wie
  Liga, Best-of, Saison und Event; nur der Stechschuss bleibt bei `MAX_RINGS`.
