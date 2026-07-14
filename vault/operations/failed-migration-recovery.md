---
id: failed-migration-recovery
type: operation
title: "failed-migration-recovery"
keywords: [Migrationsfehler, fehlgeschlagene Migration, Recovery, Auto-Recovery, Prisma migrate, failed migration, Wiederherstellung, KNOWN_RECOVERY_HANDLERS]
tags: [operation]
operation_of: ["[[overview]]"]
informed_by: ["[[adr-008]]"]
relates_to: ["[[manual-migration-intervention]]"]
documented_in: ["[[operations#Eingebauter Recovery-Mechanismus]]"]
---

**TL;DR** Prisma blockt bis failed-state gelöst; Auto-Recovery known=true/unknown=false (ADR-008); neue Fälle als Handler in KNOWN_RECOVERY_HANDLERS (--applied/--rolled-back).
