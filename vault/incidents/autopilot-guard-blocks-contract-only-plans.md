---
id: autopilot-guard-blocks-contract-only-plans
type: incident
title: "autopilot-guard-blocks-contract-only-plans"
keywords: [autopilot-guard, geschützte Pfade, protected paths, autonomes implement, implement HALT, Deploy-Vertrag, Dockerfile, scripts, PIV-Planung, --step, interaktiv statt autonom, Circuit-Breaker, Marker, no-op]
tags: [incident, harness, workflow]
relates_to: ["[[adr-023]]", "[[adr-024]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 2026-07-15: Ein PIV-Plan, dessen Tasks **ausschließlich** in vom `autopilot-guard`
geschützten Pfaden liegen (Deploy-Vertrag: `Dockerfile`/`compose.yml`/`Caddyfile`/`db-init`;
`scripts/`; `vault/decisions/`; `.claude/`; Secrets; Schema/Migrationen), kann **autonom-by-default**
(`/implement`, [[adr-023]]) **nicht** laufen — der marker-gated Guard verweigert schon den ersten
Schreibzugriff, und `/implement` HALTet beim ersten Task (Breaker „geschützter Pfad").

**Konsequenz für die Planung:** Bevor ein Plan zu `/implement` geht, prüfen, ob **alle** Ziel-Dateien
geschützt sind. Wenn ja, von vornherein **interaktiv** fahren (Marker weglassen bzw. `/implement --step`
→ Guard ist No-Op) mit sichtbaren Diffs + Commit-Messages (Hard Rule 4), statt den autonomen Lauf zu
starten und ihn sofort abbrechen zu lassen. Die geschützte-Pfade-Liste ist bewusst breit (Build-/
Deploy-Vertrag soll **nie** unbeaufsichtigt geändert werden) — reine Infrastruktur-/Vertrags-Pläne sind
damit der **Normalfall** für interaktives Implementieren, nicht die Ausnahme.

Konkret aufgetreten am Plan „faster-release-build" (Tasks nur `Dockerfile` + `scripts/build-and-push.sh`,
beide geschützt): autonomes `/implement` HALTete bei Task 1, danach interaktiv umgesetzt (identisches
Ergebnis, nur mit vorab gezeigten Diffs/Messages).
