---
id: vps-resource-sizing
type: concept
title: "vps-resource-sizing"
keywords: [Ressourcen, RAM, Sizing, Speicher, VPS-Größe, Arbeitsspeicher, resource sizing, memory, mem_limit, IONOS, Dimensionierung]
tags: [ops-constraint]
relates_to: ["[[overview]]"]
part_of: ["[[operations]]"]
documented_in: ["[[overview#VPS-Sizing]]"]
---

**TL;DR** RAM ist Engpass: ~0.9GB steady, ~1.85GB Deploy-Spitze; IONOS VPS S (2GB) via mem_limits tragbar, S+ (4GB) empfohlen. Gemessen am 5. Oktober 2026: 948 MiB verfügbar, Container zusammen ~320 MiB, kein Swap, keine OOM-Kills in 60 Tagen. Der VPS bleibt bei 2 GB; eine dritte App (Spiegel) passt mit 256 MiB Limit.
