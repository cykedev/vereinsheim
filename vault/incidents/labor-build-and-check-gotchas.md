---
id: labor-build-and-check-gotchas
type: incident
title: "labor-build-and-check-gotchas"
keywords: [Labor, Stand-Stempel, Turbo-Cache, dist, preview.html, pnpm check, Kein Bericht, virtual-time-budget, Headless-Chrome, pruefen, loadWorkspaceState, Unexpected end of JSON input, parallele pnpm-Läufe, Sub-Agenten]
tags: [incident, labor, harness]
relates_to: ["[[spiegel-ui-design]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** Drei Fallen beim Bauen und Prüfen des Labors (`tools/labor`), alle am 9. Oktober 2026 aufgetreten:

**Erledigt (13. Oktober 2026):** Das Labor ist entfernt (Plan `plans/2026-10-13-aufraeumen-labor.md`); die Bedienung prüft `pnpm --filter spiegel pruefen` an der App. Die Note bleibt als Geschichte.

1. **Alter Stand-Stempel nach `pnpm check`:** Das Gate baut das Labor über Turbo und stellt `dist/labor.html` und
   `dist/preview.html` aus dem Cache wieder her, wenn sich die Eingaben nicht geändert haben, samt Stempel des
   Laufs, der den Cache gefüllt hat (etwa `e10ff16-dirty`). Für das Artifact oder eine Sichtprüfung deshalb direkt
   bauen: `pnpm --filter @vereinsheim/labor build`, und vor dem Veröffentlichen den Stempel prüfen
   (`grep -o 'data-commit="[^"]*"' tools/labor/dist/labor.html`).
2. **„Kein Bericht“ bei `pruefen`:** Die Skriptprüfung läuft in Headless-Chrome mit `--virtual-time-budget`. Reicht
   die virtuelle Zeit nicht für alle `wait()`, gibt Chrome das DOM aus, bevor der Bericht steht. Das ist kein
   Absturz; mit der Seite eines Zeitraums stieg das Budget von 40 auf 90 s (`tools/labor/scripts/pruefen.ts`).
3. **`loadWorkspaceState`, „Unexpected end of JSON input“:** Laufen mehrere pnpm-Prozesse gleichzeitig (etwa
   Prüf-Agenten mit `pnpm exec tsx` neben dem Gate), kann pnpm den Zustand des Workspace halb geschrieben lesen. Der
   Fehler ist flüchtig: Gate noch einmal laufen lassen, nichts reparieren.
