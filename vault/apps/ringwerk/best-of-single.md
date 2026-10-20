---
id: best-of-single
type: subsystem
title: "best-of-single"
keywords: [Best-of-Modus, Best-of-N, Duelle, Gruppenphase, Stechschuss, Gleichstand, tiebreak, best of single, groupBestOf]
tags: [feature]
feature_of: ["[[league-mode]]"]
documented_in: ["[[ringwerk-features#Liga-Modus BEST_OF_SINGLE ✓ IMPLEMENTIERT]]"]
---

**TL;DR** Liga-Gruppenphase mit N Duellen je Begegnung (groupBestOf, default 3); Stechschuss bei Gleichstand (siehe Incident stechschuss-modell-flip).

# Gleichstand

Steht eine Begegnung nach allen Duellen gleich, entscheidet immer der Stechschuss. Ein Wiederholungsduell gibt es nicht;
die Option „Gleichstand per Stechschuss“ ist aus dem Formular entfernt (E4, 20. Oktober 2026), die Spalte
`groupHasSuddenDeath` bleibt im Schema und wird weder gelesen noch geschrieben. Der Ringteiler eines Duells rechnet mit
der Schusszahl des Wettbewerbs (`getMaxRings`).
