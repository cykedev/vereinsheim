---
id: best-of-standings-direct-comparison-tiebreak
type: incident
title: "best-of-standings-direct-comparison-tiebreak"
keywords: [Direktvergleich, direkter Vergleich, head-to-head, Best-of-Liga, Tabellen-Tiebreak, Gleichstand-Sortierung, Sortierkriterium, bestOfStandingsSort, directComparison, formatDirectComparison, offen ausgeglichen, Sportleiter, Spec-Änderung, Nachvollziehbarkeit, Incident]
tags: [incident]
relates_to: ["[[ringwerk]]", "[[best-of-single]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 2026-06-24 (ringwerk, Best-of-Liga): Auf Sportleiter-Wunsch ersetzt der DIREKTE VERGLEICH (head-to-head) das bis dahin letzte Tabellen-Kriterium 'bestes Einzelergebnis' (bestRingteiler/bestRings). Neue Sortierkette: 1 Siege, 2 Satzdifferenz, 3 gewonnene Sätze, 4 direkter Vergleich (Mini-Liga-Bilanz in der punktgleichen Gruppe; Match-Sieger via status.winner, inkl. Stechschuss), 5 Nachname. Kann der direkte Vergleich nicht entscheiden (Begegnung noch offen ODER zyklischer N-Gleichstand A schlägt B schlägt C schlägt A), wird alphabetisch gewertet MIT sichtbarer Anmerkung in Tabelle+PDF ('offen' bzw. 'ausgeglichen'). Die letzte Spalte heißt jetzt 'Direktvergleich' (2er: Satz+Gegner, 3er+: Bilanz, sonst Gedankenstrich). bestRingteiler/bestRings bleiben berechnet (revert-fähig), sind aber kein Kriterium mehr. Zentral gekapselt in bestOfStandingsSort.ts (directComparison-Annotation) + formatDirectComparison (Tabelle/PDF byte-identisch). Spec-Entscheid, revidierbar — am echten Datensatz mit dem Sportleiter gegenzuprüfen.
