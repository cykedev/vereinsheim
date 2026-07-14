---
id: seed-script-orphaned
type: incident
title: "seed-script-orphaned"
keywords: [Seed-Skript, prisma/seed.ts fehlt, verwaister Seed, db-reset, /seed schlägt fehl, seed script missing, technical debt, Dev-DB, Incident]
tags: [state]
relates_to: ["[[ringwerk]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 2026-06-17 (ringwerk): prisma.config.ts referenziert 'tsx prisma/seed.ts', aber prisma/seed.ts existiert nicht (weder FS noch git) → /seed bzw. der /db-reset-Seed würde fehlschlagen. Dev-DB-Daten stammen aus manueller App-Eingabe, nicht aus einem Seed-Skript. Vor Verlassen auf /seed prüfen, ob prisma/seed.ts existiert; der Seed-Mechanismus ist aktuell verwaist.
