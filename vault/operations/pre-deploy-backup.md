---
id: pre-deploy-backup
type: operation
title: "pre-deploy-backup"
keywords: [Pre-Deploy-Backup, Datensicherung, Sicherung vor Deploy, automatisches Backup, backup, Absicherung, DB-Dump]
tags: [operation]
operation_of: ["[[overview]]"]
informed_by: ["[[adr-010]]"]
relates_to: ["[[deploy-flow]]"]
documented_in: ["[[operations#Pre-Deploy-Backup (eingebaut)]]"]
---

**TL;DR** Auto-Backup VOR jedem Deploy (außer SKIP_BACKUP=1); sichert beide DB-Dumps + treffsicher-Uploads.
