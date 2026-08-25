---
id: deadline-wipe-on-hidden-form-fields
type: incident
title: "deadline-wipe-on-hidden-form-fields"
keywords: [Stichtag verschwunden, Hinrunde, Rückrunde, hinrundeDeadline, rueckrundeDeadline, lautlos gelöscht, stiller Datenverlust, ausgeblendetes Formularfeld, hidden field, FormData null, parseDateForUpdate, drei Wege Semantik, BEST_OF_SINGLE, updateCompetition]
tags: [incident, ringwerk]
relates_to: ["[[ringwerk]]", "[[server-action-pattern]]", "[[best-of-single]]"]
part_of: ["[[incidents]]"]
documented_in: ["[[conventions#9. Aus Lernlog übernommen]]"]
---

**TL;DR** 2026-08-25 (ringwerk): `updateCompetition` löschte gespeicherte Hin-/Rückrunde-Stichtage
lautlos, sobald das Formular die Felder ausblendete. Behoben mit `parseDateForUpdate`
(Drei-Wege-Semantik) + Regressionstests — **bereits verlorene Werte stellt der Fix nicht wieder her**,
die müssen nach dem Deploy neu eingetragen werden.

Gemeldet über die Wettbewerbs-Karte: „Hinrunde bis 26.02.2027 · Rückrunde bis —", obwohl im
Edit-Formular ein Rückrunde-Stichtag stand. Die Karte war korrekt — der Wert war in der DB `NULL`.
Lese- und Schreibpfad waren für beide Stichtage symmetrisch, der Verlust lag am ausgeblendeten Feld.

**Mechanismus:** `LeagueFieldsSection` rendert die beiden Stichtag-Inputs nur bei `!isBestOfSingle`
(und die ganze Liga-Sektion nur für `type = LEAGUE`). Ausgeblendete Inputs fehlen in der FormData →
`formData.get("rueckrundeDeadline")` ist `null` → `parseDate(null)` ist `null` → `updateCompetition`
schrieb dieses `null` bedingungslos. Alle anderen bedingten Felder im selben `update()` waren mit
`undefined` geschützt („Spalte nicht anfassen") — nur die beiden Stichtage nicht. Ein einziges
Speichern im Best-of-Single-Zustand genügte, um beide Stichtage zu verlieren.

**Fix** (`feat/fix-deadline-wipe`): `parseDateForUpdate` in
`apps/ringwerk/src/lib/competitions/actions/_shared.ts` — Feld fehlt → `undefined`, leer → `null`,
Wert → Datum; drei Regressionstests in `actions.test.ts`. Die generische Regel steht in [[conventions]] §9.

**Offener Zustand:** `eventDate`/`seasonStart`/`seasonEnd` nutzen in `update.ts` weiter `parseDate` —
heute kein Bug, weil über `type === "EVENT"`/`"SEASON"` geschützt, aber dieselbe Fehlerklasse, falls
diese Sektionen je bedingt gerendert werden. Ein Anti-Pattern-Grep im Drift-Gate wurde bewusst **nicht**
gesetzt: er würde genau diese drei als False Positives melden.
