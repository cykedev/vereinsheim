---
id: image-tag-rollback
type: operation
title: "image-tag-rollback"
keywords: [Rollback, Image-Rollback, Zurückrollen, vorherige Version, rollback, deploy-history, Tag-Rollback, Versionswechsel]
tags: [operation]
operation_of: ["[[overview]]"]
documented_in: ["[[operations#Variante A — Image-Tag-Rollback (Schema unverändert)]]"]
---

**TL;DR** ./vereinsheim rollback aus deploy-history.log (Tags aller Apps→.env), SKIP_BACKUP=1; Einträge von vor P4 ohne Spiegel-Tags lassen Spiegel auf dem aktuellen Tag; migrate deploy ist no-op (Schema schon korrekt).
