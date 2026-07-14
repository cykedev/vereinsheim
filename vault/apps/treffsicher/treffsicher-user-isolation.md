---
id: treffsicher-user-isolation
type: concept
title: "treffsicher-user-isolation"
keywords: [Datenisolation, Per-User-Isolation, userId-Filter, Datentrennung, Mandantentrennung, user isolation, Datenschutz, Prisma where, Privatsphäre]
tags: [domain-rule]
relates_to: ["[[treffsicher]]", "[[treffsicher-access-model]]"]
part_of: ["[[treffsicher]]"]
documented_in: ["[[treffsicher-code-conventions#Datenbankzugriffe (Prisma)]]"]
---

**TL;DR** Per-User-Datenisolation: jede Prisma-Query filtert zwingend where:{ userId }; kein direkter Prisma-Zugriff in Komponenten.
