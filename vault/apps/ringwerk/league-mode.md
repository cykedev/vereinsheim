---
id: league-mode
type: subsystem
title: "league-mode"
keywords: [Liga-Modus, Ligabetrieb, Rundenturnier, Spielplan, Circle-Method, round robin, league mode, Tabellen, Doppelrunde, Heimrecht, Seitenverteilung, Berger-Tabelle, A/B-Ausgleich]
tags: [feature]
feature_of: ["[[ringwerk]]"]
documented_in: ["[[ringwerk-features#Liga-Modus (LEAGUE)]]"]
---

**TL;DR** Formate DOUBLE_ROUND_ROBIN oder BEST_OF_SINGLE; Spielplan nach Berger-Tabelle mit ausgeglichener A/B-Verteilung (Freilos = 2 Pkt im DOUBLE_ROUND_ROBIN, im Best-of ohne Wertung), optionale Playoffs.

## Spielplan-Konstruktion (seit 2026-10-03)

Beide Formate bauen die Einfachrunde über `roundRobinRounds` (`lib/matchups/roundRobin.ts`), die
kanonische 1-Faktorisierung (Berger-Tabelle). Ein Platz ist fest (bei ungerader Zahl der
Freilos-Dummy, das Freilos wandert also durch den Kreis), die anderen stehen im Kreis. Die Seite
folgt festen Regeln je Runde und Abstand und wechselt dabei so oft wie möglich (getestet). `BEST_OF_SINGLE` nutzt die Einfachrunde
direkt. `DOUBLE_ROUND_ROBIN` nimmt sie als Hinrunde und spiegelt sie für die Rückrunde (Freilose
bleiben).

- **A/B-Ausgleich:** Bei ungerader Teilnehmerzahl ist jeder genau gleich oft A wie B, bei gerader
  höchstens einmal öfter. Mehr ist nicht möglich, weil jeder dann ungerade viele Begegnungen hat.
  Das gilt je Runde, für jedes n von 2 bis 16 getestet (`roundRobin.test.ts`).
- **Vorher:** Die Circle-Method hielt den festen, zuerst eingeschriebenen Teilnehmer in jeder
  Runde links, er war also immer A. Gemeldet am 2026-10-02 an einer Best-of-Liga mit 5 Schützen.
- **Für die Wertung ist A/B bedeutungslos** (`scoring/bestOf.ts` ist symmetrisch). Der Ausgleich
  betrifft nur Darstellung und Vereinsgepflogenheit.
- **Bestehende Spielpläne bleiben unverändert.** Wirksam wird der Ausgleich nur bei neu
  generierten Spielplänen. Die UI bietet „Spielplan generieren“ nur an, solange die Liga **gar
  keine** Paarungen hat (`getScheduleStatus().hasSchedule`). Ein bestehender Plan lässt sich dort
  also nicht neu generieren. Die Action selbst erlaubt es, solange nichts abgeschlossen ist, und
  löscht dabei seit 2026-10-03 auch die alten Freilose (vorher blieben BYE-Zeilen stehen, und
  jeder hatte danach zwei Freilose je Runde).

