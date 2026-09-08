---
id: treffsicher-actionresult-migration
type: incident
title: "treffsicher-actionresult-migration"
keywords: [ActionResult-Migration, offene Migration, diskriminierte Union, shared-conventions, Ringwerk-Muster, technical debt, offener Folgeschritt, Server-Action-Umbau, erledigt, getErrorMessage, T-08]
tags: [state]
relates_to: ["[[treffsicher]]", "[[action-result-convention]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** **ERLEDIGT (September 2026):** Treffsichers Server-Action-Module folgen dem ActionResult-Kanon (diskriminierte Union in `apps/treffsicher/src/lib/types.ts`, [[conventions]] §6, Ringwerk-Muster). Die drei lokalen `ActionResult`-Definitionen und die Aliase `GoalActionResult`/`AdminActionResult`/`AccountActionResult` sind weg; kein `success: false` mehr im Code. Konsumenten narrowen über `"error" in result` bzw. `"success" in state`; einzeiliger Fehlertext über den neuen Helfer `getErrorMessage` in `@vereinsheim/lib/forms/fieldErrors`.
