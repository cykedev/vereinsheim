---
id: restore-from-backup
type: operation
title: "restore-from-backup"
keywords: [Wiederherstellung, Restore, Backup einspielen, Recovery, Datenrücksicherung, restore, pg_restore, Rollback, Notfall-Wiederherstellung]
tags: [operation]
operation_of: ["[[overview]]"]
informed_by: ["[[adr-009]]"]
relates_to: ["[[image-tag-rollback]]", "[[restore-clean-mixed-schema]]"]
documented_in: ["[[operations#Recovery aus Backup (gleicher VPS)]]"]
---

**TL;DR** ./vereinsheim restore (App aus der Liste, stop→pg_restore in eine frische Datenbank→Tausch→up; ein kaputter Dump lässt die laufende unberührt); Uploads nur treffsicher (restore.sh lehnt sie für Ringwerk und Spiegel ab). Voll-Rollback: erst restore, dann rollback (Reihenfolge!).
