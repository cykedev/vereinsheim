---
id: league-mode
type: subsystem
title: "league-mode"
keywords: [Liga-Modus, Ligabetrieb, Rundenturnier, Spielplan, Circle-Method, round robin, league mode, Tabellen, Doppelrunde, Heimrecht, Seitenverteilung, Berger-Tabelle, A/B-Ausgleich]
tags: [feature]
feature_of: ["[[ringwerk]]"]
documented_in: ["[[ringwerk-features#Liga-Modus (LEAGUE)]]"]
---

**TL;DR** Formate DOUBLE_ROUND_ROBIN oder BEST_OF_SINGLE; Spielplan nach Berger-Tabelle mit ausgeglichener A/B-Verteilung (Freilos=2 Pkt), optionale Playoffs.

## Spielplan-Konstruktion (seit 2026-10-03)

Beide Formate bauen die Einfachrunde über `roundRobinRounds` (`lib/matchups/roundRobin.ts`), die
kanonische 1-Faktorisierung (Berger-Tabelle). Ein Teilnehmer ist fest, die anderen stehen im
Kreis, die Seite folgt festen Regeln je Runde und Abstand. `BEST_OF_SINGLE` nutzt die Einfachrunde
direkt. `DOUBLE_ROUND_ROBIN` nimmt sie als Hinrunde und spiegelt sie für die Rückrunde (Freilose
bleiben).

- **A/B-Ausgleich:** Bei ungerader Teilnehmerzahl ist jeder genau gleich oft A wie B, bei gerader
  höchstens einmal öfter. Mehr ist nicht möglich, weil jeder dann ungerade viele Begegnungen hat.
  Das gilt je Runde, für jedes n von 2 bis 16 getestet (`roundRobin.test.ts`).
- **Vorher:** Die Circle-Method hielt den festen, zuerst eingeschriebenen Teilnehmer in jeder
  Runde links, er war also immer A. Gemeldet am 2026-10-02 an einer Best-of-Liga mit 5 Schützen.
- **Für die Wertung ist A/B bedeutungslos** (`scoring/bestOf.ts` ist symmetrisch). Der Ausgleich
  betrifft nur Darstellung und Vereinsgepflogenheit.
- **Bestehende Spielpläne bleiben unverändert.** Wirksam wird der Ausgleich nur beim
  (Neu-)Generieren, und neu generieren geht nur, solange keine Paarung abgeschlossen ist.

