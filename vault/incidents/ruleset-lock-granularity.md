---
id: ruleset-lock-granularity
type: incident
title: "ruleset-lock-granularity"
keywords: [Regelset-Sperre, Sperr-Granularität, Deadlock, Playoff-Bracket gesperrt, matchupCount, hasPlayoffsStarted, locking, Incident, Bearbeitungssperre]
tags: [incident]
relates_to: ["[[ringwerk]]"]
refines: ["[[phase-locking-and-editability]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 2026-06-18 (ringwerk): Das Liga-Regelset wurde komplett gesperrt, sobald Paarungen existierten (rulesetLocked = matchupCount>0) — inklusive der Playoff-Bracket-Wahl, was einen nicht mehr korrigierbaren Deadlock erzeugte. Lösung: Sperr-Granularität an den Wirk-Zeitpunkt koppeln (Gruppenphase/Format ab matchupCount>0; Playoff/Finale erst ab hasPlayoffsStarted).
