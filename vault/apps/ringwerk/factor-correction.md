---
id: factor-correction
type: concept
title: "factor-correction"
keywords: [Faktor-Korrektur, Teilerfaktor, Disziplin-Gewichtung, gemischte Wettbewerbe, effectiveTeilerFaktor, scoring factor, Korrekturfaktor]
tags: [domain-rule]
relates_to: ["[[scoring-engine]]", "[[disciplines-and-factors]]"]
part_of: ["[[ringwerk]]"]
documented_in: ["[[ringwerk-features#Gemeinsame Konfiguration]]"]
---

**TL;DR** Teiler × Disziplin.teilerFaktor — greift NUR bei gemischten Wettbewerben (Competition.disciplineId === null), sonst Faktor 1.0; zentralisiert via effectiveTeilerFaktor(), nicht rückwirkend.
