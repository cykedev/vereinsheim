---
id: factor-correction
type: concept
title: "factor-correction"
keywords: [Faktor-Korrektur, Teilerfaktor, Disziplin-Gewichtung, gemischte Wettbewerbe, effectiveTeilerFaktor, scoring factor, Korrekturfaktor]
tags: [domain-rule]
relates_to: ["[[scoring-engine]]", "[[disciplines-and-factors]]"]
part_of: ["[[ringwerk]]"]
documented_in: ["[[ringwerk-features#Gemeinsame Konfiguration]]"]
---

**TL;DR** Teiler × Disziplin.teilerFaktor — greift NUR bei gemischten Wettbewerben (Competition.disciplineId === null), sonst Faktor 1.0; zentralisiert via effectiveTeilerFaktor(). Der korrigierte Teiler entscheidet überall, wo Teiler verglichen werden; der Faktor einer genutzten Disziplin ist gesperrt.

# Faktor-Korrektur

- **Wo sie greift:** im gemischten Wettbewerb (`Competition.disciplineId === null`) mit dem Faktor der Disziplin der
  Einschreibung bzw. der Serie, sonst Faktor 1 (`effectiveTeilerFaktor`).
- **Was sie ändert:** den Ringteiler (gespeichert, `höchste Ringzahl − Ringe + Teiler × Faktor`) und jeden Vergleich
  nach Teiler: Liga mit Hin- und Rückrunde (Duell, direkter Vergleich, Spielplan, PDF), Best-of, Playoff-Duelle, das
  Kriterium „Teiler“ im Finale, Saison und Event. Eine Stelle je Weg: `duelSide` (Tabelle), `pairingOutcome`
  (Spielplan, PDF), `storedDuelOutcome` mit `duelFactors` (Playoffs), `evaluateMatchState` (Best-of). Der korrigierte
  Teiler ist ungerundet; Luftpistole 90 ergibt 29,999997 und schlägt Luftgewehr 30,0, auch wo beide als „30,0“ stehen.
- **Angezeigt** wird der Teiler vom Ausdruck („T“), die Spalten „Teiler korr.“ in Saison und Event zeigen den
  korrigierten.
- **Faktor fest:** Sobald ein Wettbewerb, eine Einschreibung oder eine Serie die Disziplin verwendet, lässt sich der
  Faktor nicht mehr ändern (E3, [[disciplines-and-factors]]). Gespeicherte Ringteiler und der live gerechnete
  korrigierte Teiler können so nicht auseinanderlaufen.
