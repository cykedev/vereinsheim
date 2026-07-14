---
id: role-based-access
type: subsystem
title: "role-based-access"
keywords: [Rollen, Rollenmodell, Zugriffskontrolle, Berechtigungen, rollenbasiert, ADMIN MANAGER USER, access control, permissions, authorization, Autorisierung, vereinsweite Sichtbarkeit]
tags: [subsystem]
subsystem_of: ["[[ringwerk]]"]
contrasts_with: ["[[treffsicher-access-model]]"]
documented_in: ["[[ringwerk-architecture#`(app)/admin/layout.tsx` – Rollen-Guard]]"]
---

**TL;DR** Rollen ADMIN/MANAGER/USER, vereinsweite Sichtbarkeit (KEIN userId-Filter) — Kontrast zu treffsicher (per-User). Auth via proxy.ts + Layout-Guards.
