---
id: manual-migration-intervention
type: operation
title: "manual-migration-intervention"
keywords: [manueller Migrationseingriff, Migrationsproblem, DB-Fix, Prisma migrate, manual intervention, Schema-Reparatur, _prisma_migrations]
tags: [operation]
operation_of: ["[[overview]]"]
documented_in: ["[[operations#Pfad 3 — Manueller Eingriff in der DB]]"]
---

**TL;DR** Diagnose via _prisma_migrations; Pfade A(--applied)/B(--rolled-back)/C(SQL-Fix); Worst-Case = restore aus Pre-Deploy-Backup.
