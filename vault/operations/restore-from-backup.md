---
id: restore-from-backup
type: operation
title: "restore-from-backup"
keywords: [Wiederherstellung, Restore, Backup einspielen, Recovery, Datenrücksicherung, restore, pg_restore, Rollback, Notfall-Wiederherstellung]
tags: [operation]
operation_of: ["[[overview]]"]
informed_by: ["[[adr-009]]"]
relates_to: ["[[image-tag-rollback]]"]
documented_in: ["[[operations#Recovery aus Backup (gleicher VPS)]]"]
---

**TL;DR** ./vereinsheim restore (stop→pg_restore --clean→up); Uploads nur treffsicher. Voll-Rollback: erst restore, dann rollback (Reihenfolge!).
