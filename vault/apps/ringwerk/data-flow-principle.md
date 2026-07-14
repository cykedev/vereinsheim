---
id: data-flow-principle
type: subsystem
title: "data-flow-principle"
keywords: [Datenfluss, Datenflussprinzip, Architektur, Server Action, useActionState, revalidatePath, data flow, Lesen Schreiben, queries.ts, Mutation]
tags: [subsystem]
subsystem_of: ["[[ringwerk]]"]
relates_to: ["[[server-action-pattern]]"]
documented_in: ["[[ringwerk-architecture#Datenflussprinzip]]"]
---

**TL;DR** Kanonischer Datenfluss: Formular → useActionState → Server Action (Auth→Zod→db→revalidatePath→ActionResult); Lesen via lib/<feature>/queries.ts in Server Components.
