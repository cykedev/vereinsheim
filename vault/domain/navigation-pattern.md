---
id: navigation-pattern
type: concept
title: "navigation-pattern"
keywords: [Navigation, Menü, Navigationsleiste, mobile Navigation, navigation, Nav, untere Leiste, Seitenleiste, schmale Leiste, AppFrame, areaOf, Profil, Menüführung, Shield, Admin-Link, Reiter, Hamburger-Menü, Kopfzeile]
tags: [domain-rule]
relates_to: ["[[overview]]"]
part_of: ["[[domain]]"]
documented_in: ["[[conventions#5. Navigation]]"]
governed_by: ["[[adr-032]]"]
---

**TL;DR** Alle drei Apps nutzen den Rahmen `AppFrame` aus `@vereinsheim/ui/design2/app-frame` ([[adr-032]]): am
Telefon eine untere Leiste mit höchstens fünf Einträgen, im Querformat eine schmale Leiste, ab 1024 px eine
Seitenleiste mit Trenner vor Profil und Admin (`Shield`, als letzter Eintrag). Was nicht in die Leiste passt, steht am
Telefon in Profil. Aktiv-Erkennung über eine reine Funktion der App (`areaOf`, Start exakt). Treffsicher hat die
Aktion „Neue Einheit“ in der Mitte, Ringwerk keine Mitte und Bereiche je Rolle, die Seiten eines Wettbewerbs als Reiter
unter dem Namen ([[ringwerk-design2]]). Das frühere Kopfzeilen-Schema mit Hamburger-Menü und Konto-Dropdown ist in
keiner App mehr in Gebrauch.
