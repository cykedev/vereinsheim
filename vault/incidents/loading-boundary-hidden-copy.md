---
id: loading-boundary-hidden-copy
type: incident
title: "loading.tsx: versteckte Kopie der Seite im Hintergrund-Tab"
keywords: [loading.tsx, Suspense, Streaming, Suspense-Grenze, div hidden, S:0, $RC, $RV, requestAnimationFrame, Hintergrund-Tab, visibilityState, doppelte Ids, zweite Kopie, versteckte Kopie, React 19.2, Skeleton, Platzhalter, noHiddenCopy, Skriptprüfung]
tags: [incident]
relates_to: ["[[treffsicher]]", "[[treffsicher-design2]]", "[[ringwerk]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 2026-10-19 (Treffsicher): Mit `loading.tsx` streamt Next eine Seite in eine Suspense-Grenze. React 19.2 legt
den Inhalt in ein `<div hidden id="S:0">` am Ende von `body` und setzt ihn erst im nächsten Animationsframe ein. In einem
Tab im Hintergrund kommt kein Frame: Der Client rendert die Seite trotzdem, und die Kopie bleibt mit doppelten Ids
liegen, bis der Tab sichtbar wird. Treffsicher hat deshalb keine `loading.tsx` mehr, wie Spiegel.

## Befund

Gemessen am Build (`next` 16.3.2, `react` 19.2.8) mit der Skriptprüfung:

- Sichtbarer Tab: Auf Start, Tagebuch, Ziele, Disziplinen, Abläufe und Statistik steht die Kopie nach dem Hydrieren
  noch bis zu etwa 350 ms im DOM, daneben schon der sichtbare Inhalt. Danach ist sie weg.
- Tab im Hintergrund (`document.visibilityState === "hidden"`): Die Kopie bleibt auf diesen Seiten und auf
  `/sessions/new` und der Seite einer Einheit, denn die `loading.tsx` eines Segments umschließt auch seine Unterseiten.
  Auf `/sessions/new` sind dabei die Ids der Formularfelder doppelt (`#type`, `#date`, `#location`), auf einer Einheit
  `#file`. Wird der Tab sichtbar, räumt React auf.
- Ob eine Seite überhaupt streamt, hängt davon ab, ob der Server vor dem ersten Senden fertig ist. Deshalb trat es nur
  „manchmal“ auf.

## Ursache

Das Skript `$RC` von React verschiebt den Inhalt nicht sofort. Es reiht ihn ein und ruft `$RV` per
`requestAnimationFrame` auf, nach der ersten Grenze gedrosselt auf etwa 300 ms. Erst `$RV` entfernt das versteckte
`div`. Ein Tab im Hintergrund bekommt keine Animationsframes. Der Client wartet aber nicht darauf und rendert die Seite
aus dem RSC-Payload selbst. So stehen sichtbarer Inhalt und versteckte Kopie nebeneinander. Das ist das Verhalten von
React, in der App nicht zu beheben, nur zu vermeiden.

## Folge

- Treffsicher hat keine `loading.tsx` mehr (Start, Tagebuch, Ziele, Disziplinen, Abläufe, Statistik). Eine Seite
  kommt jetzt in einem Stück. Beim Wechsel zwischen Seiten bleibt die alte stehen, bis die neue da ist.
- Die Skriptprüfung meldet eine Kopie: `noHiddenCopy` in `packages/pruefen/src/common.ts` lädt jede Seite in einem Tab im
  Hintergrund und sucht ein `h1` unter `[hidden]` und doppelte Ids. Gegenprobe mit den alten `loading.tsx`: 7 bis 8 von
  9 Seiten FAIL.
- Ringwerk hat noch drei `loading.tsx` (`competitions/[id]/{playoffs,ranking,standings}`). Beim Umzug auf Design 2
  dieselbe Prüfung laufen lassen.
