---
id: prisma7-conventions
type: subsystem
title: "prisma7-conventions"
keywords: [Prisma 7, Prisma-Konventionen, generierter Client, prisma.config, adapter-pg, Prisma ORM, Datenbankzugriff, database, ORM]
tags: [subsystem]
subsystem_of: ["[[ringwerk]]"]
documented_in: ["[[ringwerk-technical#Prisma 7 – kritische Abweichungen]]"]
---

**TL;DR** Prisma-7-Abweichungen: generierter Client unter src/generated/prisma/, kein url-Feld in datasource (prisma.config.ts), DB via @prisma/adapter-pg mit pg.Pool.
