---
id: nightly-backup-cron
type: operation
title: "nightly-backup-cron"
keywords: [Nächtliches Backup, Cron, geplante Sicherung, Datensicherung, Retention, nightly backup, automatische Sicherung, 14 Tage]
tags: [operation]
operation_of: ["[[overview]]"]
informed_by: ["[[adr-009]]"]
documented_in: ["[[operations#Wann läuft Backup?]]"]
---

**TL;DR** ./vereinsheim cron, 03:00 UTC, Retention 14 Tage, /var/backups/vereinsheim/; on-VPS (kein Hardware-Schutz).
