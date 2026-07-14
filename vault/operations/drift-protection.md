---
id: drift-protection
type: concept
title: "drift-protection"
keywords: [Drift-Schutz, Quality-Gates, Konsistenz, lint format test build, consistency-check, drift protection, Gates, Code-Qualität, Prüfungen, Release-Gate]
tags: [ops-constraint]
relates_to: ["[[overview]]"]
part_of: ["[[operations]]"]
documented_in: ["[[conventions#8. Drift-Schutz (Prozess)]]"]
---

**TL;DR** Drift-Schutz: 5 Quality-Gates (lint/format/test/tsc/next build) vor jedem Commit + consistency-check.sh als fatales Release-Gate; Shared-Schicht in @vereinsheim/{ui,lib,config}.
