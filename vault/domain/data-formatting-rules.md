---
id: data-formatting-rules
type: concept
title: "data-formatting-rules"
keywords: [Datenformatierung, Datum Zeit Zahl, Formatierung, Zeitzone, Europe/Berlin, data formatting, Intl, dateTime, Lokalisierung, Zahlenformat, de-DE, format, getDisplayTimeZone, isomorph, Locale]
tags: [domain-rule]
relates_to: ["[[overview]]"]
part_of: ["[[domain]]"]
documented_in: ["[[conventions#6. Daten & Formatierung]]"]
---

**TL;DR** Datum/Zeit/Zahl über **@vereinsheim/lib/format** (isomorph, Zeitzone immer als Parameter; kein inline `Intl.*Format` in Seiten/Komponenten), Locale **de-DE**, TZ-Default Europe/Berlin (server-seitig aus `getDisplayTimeZone()`); ActionResult-Kanon als diskriminierte Union — seit September 2026 in **beiden** Apps.
