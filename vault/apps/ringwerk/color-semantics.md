---
id: color-semantics
type: concept
title: "color-semantics"
keywords: [Farben, Farbsemantik, Farbcodierung, UI-Farben, Bedeutung Grün Gelb, color semantics, Statusfarben, Design, Farbpalette, Theme-Tokens, success, warning, rank-1, Palette-Klassen, semantische Farben]
tags: [domain-rule]
relates_to: ["[[ringwerk]]", "[[component-canon]]"]
part_of: ["[[ringwerk]]"]
documented_in: ["[[ringwerk-ui-patterns#Farbpalette (Bedeutungsträger)]]"]
---

**TL;DR** Farbe trägt Bedeutung, ausgedrückt über **semantische Theme-Tokens** in `@vereinsheim/ui/theme.css` (September 2026): `success`=Sieg/abgeschlossen, `warning`=Unentschieden/offen, `info`=neutral markiert, `rank-1|2|3`=Platz 1/2/3 (Gold/Silber/Bronze), `destructive`=Löschen, `muted`=neutral. **Keine Tailwind-Palette-Klassen** (`text-emerald-600` usw.) und keine `dark:`-Varianten — die Apps laufen fest im Dark Mode. Ausnahme: die Hex-Skala der Trefferlage-Charts in Treffsicher (Datenskala, keine UI-Semantik).
