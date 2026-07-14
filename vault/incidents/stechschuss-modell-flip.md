---
id: stechschuss-modell-flip
type: incident
title: "stechschuss-modell-flip"
keywords: [Stechschuss, Gleichstand-Entscheid, Best-of-Liga, Spec-Änderung, stechschussOutcome, bestOf.ts, tiebreak shootout, Modell-Wechsel, Incident]
tags: [incident]
relates_to: ["[[ringwerk]]", "[[best-of-single]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 2026-06-18 (ringwerk, Best-of-Liga): Das Stechschuss-Modell wurde von 'reiner Match-Entscheid, Satz bleibt 1:1' auf 'Stechschuss-Duell zählt mit, also 2:1' gekippt, nachdem der Domänen-Owner es am echten Datensatz als unintuitiv empfand. Spec-Entscheid, revidierbar. Die Auflösung ist zentral in bestOf.ts gekapselt (stechschussOutcome, eigenes Maß statt league-scoringMode), damit ein erneuter Wechsel nur eine Stelle berührt.
