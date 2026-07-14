---
id: treffsicher-server-actions
type: concept
title: "treffsicher-server-actions"
keywords: [Server Actions, Aktionen, use server, statt API Routes, server actions, Fehler-Rückgaben, actions.ts, Mutationen]
tags: [domain-rule]
relates_to: ["[[treffsicher]]"]
part_of: ["[[treffsicher]]"]
documented_in: ["[[treffsicher-code-conventions#Server Actions]]"]
---

**TL;DR** Server Actions statt API Routes; je Feature actions.ts, strukturierte Fehler-Rückgaben statt throw. Next-Regel: 'use server' exportiert nur direkt deklarierte async-Funktionen.
