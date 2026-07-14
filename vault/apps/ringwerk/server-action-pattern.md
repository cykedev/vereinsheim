---
id: server-action-pattern
type: concept
title: "server-action-pattern"
keywords: [Server Actions, Mutationen, Aktionsmuster, Auth Validierung DB, server action, statt API Routes, actions.ts, Datenfluss]
tags: [domain-rule]
relates_to: ["[[ringwerk]]", "[[treffsicher-server-actions]]"]
part_of: ["[[ringwerk]]"]
documented_in: ["[[ringwerk-code-conventions#Server Actions]]"]
---

**TL;DR** Server Actions in actions.ts des Feature-Ordners, Aufbau immer Auth → Validierung → DB; Mutationen statt API Routes.
