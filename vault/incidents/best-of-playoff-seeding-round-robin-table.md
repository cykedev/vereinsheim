---
id: best-of-playoff-seeding-round-robin-table
type: incident
title: "best-of-playoff-seeding-round-robin-table"
keywords: [Playoff-Setzung, Seeding, Best-of-Liga, BEST_OF_SINGLE, Setzliste, Qualifikation, Rundenturnier-Tabelle, calculateStandings, calculateBestOfStandings, getSeedingStandings, Neu-Setzung, Incident]
tags: [incident]
relates_to: ["[[ringwerk]]", "[[best-of-single]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 2026-09-23 (ringwerk): „Playoffs starten" und „nächste Runde anlegen" lasen bei Best-of-Ligen
die RUNDENTURNIER-Tabelle (`getStandingsForCompetition` → `calculateStandings`) statt der Best-of-Tabelle.
Die wertet pro Paarung nur die erste Serie je Schütze (meist Duell 1) wie ein Einzelduell, ignoriert
Stechschüsse und zählt Freilose mit 2 Punkten. Spec 2026-06-17 §9 („Seeding aus
`calculateBestOfStandings`") war nie umgesetzt. Behoben über `getSeedingStandings`
(`lib/playoffs/queries.ts`) als EINE Quelle für Start, Neu-Setzung und Playoff-Seite.

## Was passiert war

- **Fund:** im Code-Review des Branches „geteilte Plätze" (2026-09-23), nicht im Betrieb.
- **Nachgestellt:** Gewinnt der Stärkere jede Begegnung 2:1, verliert aber Duell 1, kehrt sich die
  Setzung vollständig um. Bei 6 Teilnehmern und Halbfinale wären die zwei Besten ausgeschieden.
- **Echte Daten** (archivierte Liga „Test 1-gegen-1"): Platz 2 und 3 vertauscht. Im Halbfinale
  unsichtbar, weil 1–4/2–3 dieselben Paarungen ergibt — darum wirkte ein Test des Users korrekt.
- **Stand beim Fix:** alle Ligen der Live-Kopie sind Best-of, 5 aktiv, keine hatte Playoffs
  gestartet → keine Bestandskorrektur nötig.

## Absicherung

`lib/playoffs/actions/seeding.test.ts` läuft mit echter Tabellenrechnung (nur DB/Auth gemockt):
Charakterisierung beider Formate (Halb-/Viertel-/Achtelfinale, Qualifikationsgrenze, Freilose,
Rückzüge, geteilter Platz, Schutzprüfungen, Neu-Setzung inkl. Überraschungssiegern) war VOR dem Fix
grün; die Best-of-Problemfälle waren rot mit genau der umgekehrten Setzung. Die Teilnehmernamen
stehen gegen die Stärke sortiert, damit eine Tabelle, die nichts wertet, auffällt.

## Lehre

Eine Format-Weiche gehört an **eine** Stelle; neue Aufrufer einer Tabelle gehen über sie. Hier hatten
Spielplan, PDFs und Vorschau die Weiche, die drei Playoff-Aufrufer nicht.
