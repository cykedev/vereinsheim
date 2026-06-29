---
name: sync-graph
description: Refresh the memory-graph doc index from the documentation — update the curated manifest/captured sources when docs change or new project knowledge appears, then rebuild and validate the store. Use after editing docs/ADRs, after a feature lands, or whenever the graph has drifted from the docs.
invocation: [user, Claude]
---

Der Memory-Graph ist ein **gebauter Index** über die Doku (ADR-022): `.claude/knowledge-graph.json`
wird aus drei eingecheckten Quellen erzeugt. Dieser Skill ist der **modellgetriebene** Schritt
„Docs → Manifest"; das Bauen selbst (`build-graph.mjs`) ist deterministisch.

> **Nie** `.claude/knowledge-graph.json` von Hand editieren — es ist das Artefakt. Immer die Quelle.

## Quellen

| Quelle | Inhalt | Wann anfassen |
| --- | --- | --- |
| `docs/decisions.md` | ADRs | **gar nicht hier** — ADRs werden beim Build geparst; neuen ADR direkt in decisions.md schreiben |
| `.claude/graph-projection.mjs` | project/app/feature/subsystem/domain-rule/operation/ops-constraint + Relationen | abgeleitete Fakten aus den Docs |
| `.claude/graph-captured.mjs` | incident/state (steht in **keiner** Doc) | Session-Provenance/Incidents |

## Ablauf

1. **Diff sichten** — was hat sich an den Docs geändert? `git diff --stat` über `docs/` + `apps/*/docs/`.
   Welche Manifest-Topics betrifft das (neue/geänderte Abschnitte, neue Features/Operations)?
2. **Manifest nachziehen** (`graph-projection.mjs`) — pro betroffenem Topic:
   - Entity = **Essenz (1–2 Zeilen)** + **Fragment-Pointer** `→ datei#slug`. **Kein Volltext** (der lebt
     kanonisch in der Doc). Mehrere Pointer erlaubt, wenn ein Topic in mehrere Docs zeigt.
   - Den richtigen Slug holen/prüfen: `node .claude/doc.mjs <datei>` listet alle Slugs;
     `node .claude/doc.mjs <datei>#<slug>` druckt den Abschnitt zur Kontrolle.
   - **`Keywords:`-Zeile (Pflicht, vom Builder erzwungen)** — zusätzlich eine Observation
     `Keywords: <Synonyme>`: deutsche Synonyme + englische Tech-Begriffe, die ein Agent sucht,
     die aber in der Essenz fehlen (heben den Rank im BM25-/Synonym-Matching von search_nodes).
     Kein `→`-Pointer → Plain-Text.
   - Neue, klar abgrenzbare Doc-Abschnitte → neue Topic-Entity. Relationen dicht halten:
     `feature_of`/`subsystem_of`/`operation_of`/`constraint_of` (Zugehörigkeit), `governed_by`
     (Topic → ADR/Konvention), `contrasts_with`/`see_also`/`relates_to` (Navigation), `informed_by`
     (Operation → motivierende ADR).
3. **Captured nachziehen** (`graph-captured.mjs`) — nur für Provenance, die in keiner Doc steht
   (Incident: was kippte warum, revidierbar?; sich ändernder Zustand; cross-App/ADR-Relationen).
   **Reine Regeln gehören NICHT hierher** → die wandern nach `/consolidate-lessons` DOCUMENT in die Docs.
4. **Bauen** — `node .claude/build-graph.mjs`. Validiert Integrität (keine Dup/Dangling/leer) **und jeden
   `→ datei#slug`-Pointer**. Bei Fehler: **die Quelle** korrigieren (Slug umbenannt? Datei verschoben?),
   nie das Artefakt. Bei verschobener Überschrift Pointer auf den neuen Slug ziehen.
5. **Round-Trip** (optional) — `mcp__memory__read_graph`/`search_nodes` zeigt den gebauten Stand
   (der Server liest die Datei pro Operation; kein Reload nötig).
6. **Committen** — geänderte Quelle(n) **+** das regenerierte `.claude/knowledge-graph.json` zusammen.

## Determinismus-Grenze

`Docs → Manifest` ist **modellgetrieben** (dieser Skill, weil Prosa kein AST hat). `Manifest+ADRs+Captured
→ Graph` ist **deterministisch** (`build-graph.mjs`, idempotent). Kein Schritt „Doc ändert sich → Graph baut
sich ohne Modell neu" — der Build ist billig und manuell/skill-getrieben.
