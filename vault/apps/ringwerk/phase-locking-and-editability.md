---
id: phase-locking-and-editability
type: concept
title: "phase-locking-and-editability"
keywords: [Sperrung, Bearbeitungssperre, Edit-Lock, Phasen-Sperre, rulesetLocked, isRulesetLocked, locking, Bearbeitbarkeit, gesperrt, Konfigurationssperre, Regelset, Formatwechsel, Spielplan neu erzeugen, erstes Ergebnis, Wettbewerb bearbeiten]
tags: [domain-rule]
relates_to: ["[[league-mode]]"]
part_of: ["[[ringwerk]]"]
documented_in: ["[[ringwerk-features#Konfiguration]]"]
---

**TL;DR** Das Regelset einer Liga (Wertungsmodus, Format, Gruppenphase, Schuss/Serie) ist bearbeitbar, bis ein Ergebnis existiert (`isRulesetLocked`, dieselbe Grenze wie „Spielplan neu generieren“); ein anderes Format erzeugt einen bestehenden Spielplan beim Speichern neu. Playoff-Settings bis Playoff-Start (playoffMatch.count>0). Die Disziplin ist nach dem Anlegen fix.

# Sperren beim Bearbeiten eines Wettbewerbs

Die Sperre einer Einstellung hängt an dem Zeitpunkt, ab dem sie wirkt ([[ruleset-lock-granularity]]).

## Regelset der Gruppenphase

Wertungsmodus, Format (Doppelrunde oder Best-of-Begegnung), Best-of-Zahl, „Alle Duelle ausspielen“, Tiebreaker und
Schuss/Serie sind bearbeitbar, solange kein Ergebnis eingetragen ist: keine entschiedene Paarung, kein Kampflos-Sieg,
keine Serie an einer Paarung, keine Playoffs. Die Regel steht einmal in `isRulesetLocked`
(`apps/ringwerk/src/lib/matchups/regeneration.ts`) und ist dieselbe wie für „Spielplan neu generieren“. Seite
(`competitions/[id]/edit`) und Action (`updateCompetition`) nutzen sie beide. Bis November 2026 sperrte schon der
Spielplan allein; eine frisch generierte Liga ließ sich dann nur noch neu anlegen.

Nur das Format ändert die Paarungen selbst. Alle anderen Felder bestimmen, wie Ergebnisse gewertet werden, und ohne
Ergebnis ändern sie am Spielplan nichts. Wechselt das Format bei bestehendem Spielplan, fragt „Speichern“ zuerst
(`leagueFormatChange` in `lib/consequences.ts`). Danach speichert `updateCompetition` die Einstellungen und erzeugt den
Spielplan mit `replaceSchedule` neu, in **einer** serialisierbaren Transaktion mit der Prüfung „kein Ergebnis“. Kann der
neue Spielplan nicht entstehen (etwa weniger als 4 aktive Teilnehmer), rollt alles zurück. Die Action verlangt dafür
das Feld `replaceSchedule=true`; fehlt es, weil der Spielplan erst nach dem Öffnen des Formulars entstand, lehnt sie ab.

Felder des Regelsets, die das Formular nicht abschickt (gesperrtes `fieldset`, ausgeblendete Felder), lassen die Spalte
unberührt. Das Schema setzt für fehlende Felder Vorgaben (Format Doppelrunde, 10 Schuss), die sonst still überschrieben.

## Playoffs und Finale

Best-of, Viertel- und Achtelfinale und die Kriterien des Finales bleiben bearbeitbar, bis die Playoffs gestartet sind
(`playoffMatch.count > 0`).

## Disziplin

Nach dem Anlegen fix, unabhängig vom Spielplan ([[factor-correction]], Einschreibungen mit Disziplin).
