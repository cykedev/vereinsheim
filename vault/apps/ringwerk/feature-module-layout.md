---
id: feature-module-layout
type: subsystem
title: "feature-module-layout"
keywords: [Feature-Modul, Verzeichnisstruktur, Modul-Aufbau, actions.ts queries.ts, module layout, Code-Organisation, Ordnerstruktur, lib-Modul]
tags: [subsystem]
subsystem_of: ["[[ringwerk]]"]
relates_to: ["[[data-flow-principle]]"]
documented_in: ["[[ringwerk-architecture#Lib-Module]]"]
---

**TL;DR** Feature-Modul lib/<feature>/ folgt festem Muster: actions.ts (Server Actions), queries.ts (reine DB-Lesefunktionen), plus Komponenten/Schema je Feature.
