---
id: off-site-backup-gap
type: concept
title: "off-site-backup-gap"
keywords: [Off-Site-Backup, externe Sicherung, Datensicherung extern, Disaster Recovery, off-site, Auslagerung, rclone borg, Backup-Lücke]
tags: [ops-constraint]
relates_to: ["[[overview]]", "[[nightly-backup-cron]]"]
part_of: ["[[operations]]"]
documented_in: ["[[operations#Was wird gesichert]]"]
---

**TL;DR** 14-Tage-Lokal-Backups decken keine Hardware-/VPS-Verluste; Off-Site (rclone/borg/Snapshot) ist offene Folge-ADR.
