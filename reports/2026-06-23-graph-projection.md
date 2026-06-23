# Report — Memory-Graph als gebauter Doku-Index (Zwischenstand)

> Zu [plans/2026-06-23-graph-projection.md](../plans/2026-06-23-graph-projection.md). Branch
> `feat/graph-projection`. PIV: implement (Kern fertig) → **hier**. Stand 2026-06-23.

## Erledigt & verifiziert (Tasks 1–6, 9–12, 14)

Die **Engine + Verankerung** steht und ist end-to-end belegt:

- **Fragment-Reader** `.claude/doc.mjs` + geteilte Slug-Lib `.claude/doc-index.mjs` —
  `node .claude/doc.mjs datei#slug` druckt nur den Abschnitt; Fake-Slug → Exit 1. (Task 1)
- **Builder** `.claude/build-graph.mjs` — parst ADRs deterministisch aus `decisions.md`, mergt
  Manifest + Captured, **validiert Integrität + jeden `→ datei#slug`-Pointer**. Idempotent
  (gleicher Hash bei Doppellauf). Negativtest: kaputter Pointer → Exit 1. (Tasks 2/3)
- **Quellen** `.claude/graph-projection.mjs` (47 Entities/66 Rel.) + `.claude/graph-captured.mjs`
  (3 Entities/6 Rel.), verlustfrei aus dem Hand-Stand geseedet. (Tasks 4/5)
- **Gebauter Store**: 72 Entities / 73 Relationen / 86 Pointer; ADR-022 erscheint automatisch beim
  Build (Pipeline-Kreislauf bewiesen). (Task 6)
- **ADR-022** dokumentiert die Architektur; Nachträge in ADR-016 §3 + ADR-021. (Task 10)
- **`/sync-graph`-Skill** (Docs→Manifest, modellgetrieben) + **Surface-Hook** aufgewertet (Index +
  Fragment-Reader-Anleitung) + **`/consolidate-lessons` REMEMBER** auf Quelle+Rebuild umgestellt. (Tasks 9/11/12)
- **Doc-Sync**: Knowledge-Abschnitte (CLAUDE.md, architecture.md) auf den gebauten Index; stale
  „Phase 4 offen" korrigiert (Phase 1–4 erledigt). (Task 14)

**Gates:** `pnpm check` → 17/17 cached, FULL TURBO grün (kein App-Code berührt).

## Demonstrierter Nutzen

```
mcp__memory__search_nodes "factor-correction"   → Essenz + "→ apps/ringwerk/docs/features.md#…"
node .claude/doc.mjs apps/ringwerk/docs/features.md#<slug>   → nur dieser Abschnitt (statt 595 Zeilen)
```

ADR-Pointer sind bereits **fragment-präzise** (22 Stück); der Index ist regenerierbar + selbst-validierend.

## Offen (Tasks 7, 8, 13) — bewusste Curation-Phase

- **Task 7 — Fragment-Pointer-Upgrade + Korpus-Erweiterung:** die 47 Topic-Pointer von Datei- auf
  `#slug`-Granularität heben und den Index auf das **ganze** lebende Doku-Korpus ausweiten (spec,
  shared-conventions, app code-conventions/ui-patterns/data-model/technical, packages-CLAUDE, README).
  Beste Umsetzung: via `/sync-graph` (dogfooding), da semantisches Heading-Matching = modellgetrieben.
- **Task 8 — Relationen anreichern:** `governed_by`/`contrasts_with`/`see_also`/`relates_to` dicht
  zwischen Topics/ADRs/Conventions/Incidents legen (traversierbares Netz).
- **Task 13 — `@import` schrumpfen (RISIKO, zuletzt):** kleiner „Rules of the road"-Kern bleibt
  always-loaded, architecture/conventions-Detail wandert in den Index. **Einziger Schritt mit echtem
  Regressionsrisiko** (Konventions-Treue ist nicht gate-erzwingbar) → eigener, explizit abgesegneter Schritt.

## Empfehlung

Kern ist merge-fähig als eigenständiger Wert (regenerierbarer, validierter Index + ADR-Fragment-Pointer).
Task 7/8 als fokussierte Curation-Pass über `/sync-graph`; Task 13 separat mit explizitem OK.
