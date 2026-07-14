---
id: action-result-convention
type: subsystem
title: "action-result-convention"
keywords: [ActionResult, Server-Action-Rückgabe, Fehlerbehandlung, diskriminierte Union, Zod, useActionState, result convention, error handling]
tags: [subsystem]
subsystem_of: ["[[ringwerk]]"]
relates_to: ["[[data-formatting-rules]]"]
documented_in: ["[[conventions#6. Daten & Formatierung]]"]
---

**TL;DR** Ringwerk-Kanon (Zielform für treffsicher): { success:true; data?:T } | { error: string|Record<string,string[]> }; Zod + useActionState. Siehe treffsicher-actionresult-migration.
