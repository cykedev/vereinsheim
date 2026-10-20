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

**TL;DR** Farbe trägt Bedeutung, ausgedrückt über **semantische Tokens** aus `@vereinsheim/ui/design2.css` (Design 2,
[[adr-032]]), in hell und dunkel mit je eigenem Wert: `success`=Sieg/abgeschlossen, `warning`=Unentschieden/offen,
`info`=neutral markiert, `rank-1|2|3`=Platz 1/2/3 (Gold/Silber/Bronze), `destructive`=Löschen, `muted`=neutral, Akzent
Messing über `data-app="ringwerk"`. **Keine Tailwind-Palette-Klassen** (`text-emerald-600` usw.) und keine
`dark:`-Varianten. Ringwerte und Treffer zeigen alle Apps in den Farben `score-*` ([[conventions]] §4). Der Test
`src/components/design2Tokens.test.ts` verbietet Klassen auf Tokens, die `design2.css` nicht kennt.
