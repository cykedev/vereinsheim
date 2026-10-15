---
id: data-url-preview-blocks-anchors
type: incident
title: "data-url-preview-blocks-anchors"
keywords: [data-URL, Vorschau, Browser-Pane, Anker, Sprungleiste, Fragment, hash, localStorage, Sandbox, scrollIntoView, pushState, springt nicht, Labor, preview.html]
tags: [incident, ui, labor]
relates_to: ["[[spiegel-ui-design]]", "[[spiegel-mobile]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 2026-10-09: Die Sprungleiste des Labors sprang nirgends mehr hin. Ursache war nicht der Code: Die
Vorschau der Claude-App zeigt `tools/labor/dist/preview.html` als `data:`-Seite, und dort blockt der Browser die
Navigation zu einem Anker („Not allowed to navigate top frame to data URL“). `localStorage` wirft dort ebenfalls.

**Erledigt (13. Oktober 2026):** Das Labor ist entfernt; die Bedienung prüft `pnpm --filter spiegel pruefen` an der App. Die Note bleibt als Geschichte.

**Konsequenz:** Navigation innerhalb einer Seite nicht dem Browser überlassen, sondern selbst scrollen:
`event.preventDefault()`, `element.scrollIntoView({ block: "start" })` (respektiert `scroll-mt-*`), den Anker nur
in `try { history.pushState(…) } catch {}` schreiben; Klicks mit Taste (neuer Tab) dem Browser lassen
(`jumpToSection` in `packages/shot-ui/src/layout/SectionNav.tsx`). Das hilft auch in Rahmen mit Sandbox
(Artifact). Speicher immer in `try/catch`.

**Prüfen:** Ein Fehler, der nur in der App-Vorschau auftritt, zuerst in der Konsole des Browser-Pane suchen
(`read_console_messages`), dann in Chrome mit `file://` oder im Artifact gegenprüfen. Die Labor-Prüfung klickte
die Anker in einem `file://`-Rahmen und wäre auch vorher grün gewesen; nach dem Fix prüfte sie, dass der Klick
selbst springt (`defaultPrevented`).
