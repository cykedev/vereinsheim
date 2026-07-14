---
id: network-segmentation
type: concept
title: "network-segmentation"
keywords: [Netzwerk-Segmentierung, Docker-Netze, Netzwerksicherheit, web data Netz, network segmentation, Isolation, DB nicht exponiert, Netztrennung]
tags: [ops-constraint]
relates_to: ["[[overview]]"]
governed_by: ["[[adr-003]]"]
part_of: ["[[architecture]]"]
documented_in: ["[[architecture#Build & Deploy (ADR-005/006/007/015)]]"]
---

**TL;DR** Zwei Docker-Netze web {caddy, app-*} und data {db, app-*, migrate-*}; db NICHT im web-Netz — kein direkter Außenkontakt zur DB.
