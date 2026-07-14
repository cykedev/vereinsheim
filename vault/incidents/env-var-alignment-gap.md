---
id: env-var-alignment-gap
type: incident
title: "env-var-alignment-gap"
keywords: [Umgebungsvariablen, Env-Vars, ADMIN_ SEED_ADMIN_, Angleichung, env vars, Konfiguration, Seed-Admin, environment]
tags: [state]
relates_to: ["[[overview]]", "[[ringwerk-auth-security]]"]
part_of: ["[[incidents]]"]
documented_in: ["[[monorepo#12. Offene Folgepunkte (nicht in dieser Migration)]]"]
---

**TL;DR** OFFEN: Seed-Admin-Env-Vars der beiden Apps angleichen (treffsicher ADMIN_* ↔ ringwerk SEED_ADMIN_*); deploy-breaking, daher als separater Schritt geführt.
