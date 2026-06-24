# Autopilot-Ledger: best-of-direktvergleich

- **Plan:** plans/2026-06-24-best-of-direktvergleich.md
- **Branch:** feat/best-of-direktvergleich
- **Modus:** Haupt-Tree (KEIN Worktree — docs/worktrees.md schließt Worktrees für dieses Projekt aus;
  daher kein `autopilot-guard`-Marker). Disziplin manuell gehalten: ein Commit/Task, `pnpm check` als
  Gate, Halt an Breakern, Merge user-gated.
- **Cap:** 20 Iterationen
- **Start:** 2026-06-24

## Fortschritt (Checkliste)

- [x] 1. Typen + Format-Helfer (`DirectComparison`/`DirectResult`/`HeadToHead`, Feld `directComparison`,
  `formatDirectComparison.ts` + Test) — **ef282a7**, check grün
- [x] 2. H2H + Sort-Logik (Kern) + Tests (`bestOfStandingsSort.test.ts` neu, `calculateBestOfStandings.test.ts`
  Test 6/7 umgeschrieben + Kommentare) — **2e59d5d**, check grün (77 Standings-Tests)
- [x] 3. Tabelle (`BestOfStandingsTable.tsx` + 2 Aufrufer, `scoringMode`-Prop entfernt) — **db9bb97**, check grün
- [x] 4. PDF (`BestOfSchedulePdf.tsx` + `WS`-Breiten + 2 Routen, `scoringType`-Prop entfernt) — **a313e0e**, check grün
- [x] 5. Doku + Graph (`features.md`, `ui-patterns.md`-Lesson, `graph-captured.mjs` → `build-graph.mjs`,
  `knowledge-graph.json`: 115 Entities/165 Relationen) — **c5e927a**, check grün

## Ergebnis

Alle 5 Tasks abgearbeitet, jedes mit grünem `pnpm check`. Keine Circuit-Breaker. Commits auf
`feat/best-of-direktvergleich`: ef282a7 (Typen+Helfer), 2e59d5d (Sort-Kern+Tests), db9bb97 (Tabelle),
a313e0e (PDF), c5e927a (Doku+Graph) — plus 07a4d09 (Plan). FINALIZE → `/validate`.

## Ereignis-Log

- 2026-06-24: Branch + Plan-Commit (07a4d09). Lauf im Haupt-Tree gestartet (Worktree projektseitig
  ausgeschlossen). Marker bewusst NICHT gesetzt.
- 2026-06-24: Tasks 1–5 grün durchgelaufen, kein Breaker. → FINALIZE.
