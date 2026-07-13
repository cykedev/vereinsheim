# The Knowledge System — design & roadmap

*How the harness stores, serves, and grows project knowledge.*

This is the dev-facing design doc for the harness's knowledge layer (the counterpart to
[README.md](README.md) for *using* the harness and [BLUEPRINT.md](BLUEPRINT.md) for
maintaining it). The authoritative decision is
[ADR-011](vault/decisions/adr-011.md); the authoring contract is
[vault/SCHEMA.md](vault/SCHEMA.md). This doc is the map that ties them together.

---

## 1. Overview

Project knowledge lives as a **git-backed Markdown knowledge graph** — one note per
entity, typed frontmatter links as edges — that is **simultaneously a real Obsidian
vault** and the corpus a headless, zero-dependency MCP server serves to Claude Code.

Two design commitments define it:

- **The vault *is* the graph.** There is no build step and no separate store: the notes
  under `vault/` are the source of truth *and* the served graph. Edit a note and the
  change is live.
- **Obsidian compatibility is a property of the format, not the runtime.** Nothing in
  the harness needs Obsidian installed or running. Notes are written the way Obsidian
  expects (flat frontmatter, `[[wikilink]]` edges, heading-text anchors) so a human
  *may* open `vault/` for graph view and backlinks — but the serving path never touches
  Obsidian.

## 2. Use cases

| # | Use case | How |
|---|---|---|
| 1 | *"Where is this decided / documented?"* — orient before broad exploration | `search_nodes` (ranked) → `document_map` → `section_read` |
| 2 | *"What does this change affect / what links here?"* | `backlinks` / `traverse` over typed edges; CodeGraph for code structure |
| 3 | *"Capture what we just learned"* | the lessons ladder → a rule (gate/conventions) or an `incident` note |
| 4 | *"Ingest external reference knowledge"* (a project's domain docs) | `/ingest` → `source` notes + linked atomic notes (see §6) |

## 3. Architecture

```
 Claude Code
     │  MCP over stdio (newline-delimited JSON-RPC)
     ▼
 ┌──────────────────────────────────────────────────────────┐
 │ memory-server.mjs  — vendored, ZERO dependency, EN/DE     │
 │   tools: read_graph · open_nodes · search_nodes           │
 │          document_map · section_read · backlinks · traverse│
 │   in-memory at startup: BM25 index + edge adjacency        │
 └───────────────┬────────────────────────────────────────────┘
                 │ vault-loader.mjs  (parse frontmatter + body + edges)
                 ▼
 ┌──────────────────────────────────────────────────────────┐
 │ vault/  — Markdown-as-graph, also a browsable Obsidian vault│
 │   architecture/ workflow/ gates/ knowledge/ guardrails/    │
 │   operations/ decisions/ incidents/  · conventions.md      │
 │   · overview.md · index.md · SCHEMA.md · _templates/       │
 └──────────────────────────────────────────────────────────┘

 search-index.mjs  BM25 + EN/DE stopwords/synonyms/prefix (from ADR-008, unchanged)
 vault-lint.mjs    schema validation + orphan health check (the graph-sync Stop hook)
 doc-index.mjs     heading slugs + fragment read (backs document_map / section_read)
```

No process stays resident, no port, no npm install: the MCP server is spawned by
`.mcp.json` and builds its index in memory from the vault on startup.

## 4. Data model

Full contract in [vault/SCHEMA.md](vault/SCHEMA.md). In brief:

- **One note = one entity.** Filename (kebab, no `.md`) is the id.
- **Folder = topic** (`architecture/`, `workflow/`, `gates/`, …); each topic folder has
  a **MOC hub** note that links its atomic notes.
- **`type` = kind** (frontmatter, decoupled from folder): `guide` (narrative / MOC),
  `subsystem` · `operation` · `concept` (atomic), `decision` (an ADR), `incident`
  (REMEMBER-tier), `source` (provenance for ingested content). `type` drives search
  weighting — a targeted query surfaces the atomic note before its MOC or its ADR.
- **Edges are flat top-level list properties** of quoted `"[[note-id]]"` — one property
  per edge type (`subsystem_of`/`part_of`/`governed_by`/`documented_in`/`supersedes`/
  `relates_to`/…). Flat (not a nested `edges:` object) so Obsidian resolves them as real
  links. A `documented_in` anchor uses the heading's **text** (`[[guide#The section]]`).

## 5. Retrieval

All deterministic, EN/DE, zero-dependency:

1. **Find** — `search_nodes` (natural-language, BM25-ranked; synonyms + prefix, no lossy
   stemmer, EN+DE stopwords).
2. **Map** — `document_map <id>` lists a note's heading paths, without the body.
3. **Read** — `section_read <id> <heading>` returns just that section.
4. **Graph** — `open_nodes`, `backlinks`, `traverse`, `read_graph`.

Frugal by construction: search → map → read, never whole-file-on-spec. Ranking is
guarded by `search-selftest.mjs` in the gate.

## 6. Ingest (authored now; `/ingest` capability)

Most harness knowledge is **authored** (ADRs, guides, conventions) — there is no
external source to ingest. But a project's vault often *should* hold **ingested
reference knowledge** (vendor API docs, a partner tool's manual, runbooks). The harness
supports this as a first-class capability, modeled on the sibling project's pattern:

- **`.raw/`** — immutable source snapshots; never edited. (Absent until a project needs it.)
- **`source` type** — one note per origin document, holding the URL + retrieved date;
  every ingested claim cites back to a `source` via `documented_in`. Provenance is one
  hop away.
- **`/ingest`** — read a source (a `.raw/` file or pasted content) → produce structured,
  linked atomic notes (subsystems/concepts/procedures) with a `source` note; dedupe
  against `index.md`; update the topic MOCs and index. Writes files directly (no REST,
  no running Obsidian) so it works headless / in CI.

Status: **shipped** — the `source` type, the `.raw/` convention, and the `/ingest` skill
(`.claude/skills/ingest/SKILL.md`) with the `alternative_to` / `depends_on` edges that
give an ingested corpus real graph payoff over plain RAG.

## 7. Decisions

- [ADR-011](vault/decisions/adr-011.md) — documentation as an Obsidian-compatible vault
  graph (supersedes ADR-004's built index and ADR-008's built store).
- [ADR-008](vault/decisions/adr-008.md) — the BM25/EN+DE ranked search **engine**, kept
  verbatim; only its *source* changed (built store → vault).
- [ADR-003](vault/decisions/adr-003.md) — the lessons ladder (REMEMBER → `incident` note).

## 8. Roadmap

- [x] Vault-as-graph substrate; headless zero-dep MCP; the seven tools.
- [x] Topic folders + MOC hubs; flat Obsidian-resolvable edges + heading-text anchors.
- [x] `vault-lint` schema + orphan health check; `_templates/` per type.
- [ ] **Fatten the atomic notes** — distribute the `harness-walkthrough` monolith's
  detail into the atomic notes (fat notes, thin hubs); refresh all prose to this model.
- [x] **`/ingest` skill** — the ingest capability in §6, over `.raw/` + `source` notes.
- [ ] Optional: an off-by-default semantic reranker (the seam ADR-008 left open), only
  if BM25 recall proves insufficient as a project's vault grows past a few hundred notes.

## 9. Relationship to the sibling project (`cs-knowledge-graph`)

This design **borrows the substrate** from `cs-knowledge-graph` (Markdown-as-graph,
`[[wikilink]]` edges, Obsidian dual-consumption, `source`/provenance, `/kb-ingest` and
`/kb-lint` patterns) but **diverges on serving**: cs-knowledge-graph is a deployed
product with an HTTP + MiniSearch server and (in prod) an auth gate; the harness is a
clone-and-go blueprint, so it keeps a **headless, zero-dependency stdio server with the
BM25/EN+DE engine** instead — no running process, no npm deps, better German recall.
Compatibility with Obsidian is format-only; the Obsidian "Local REST API" plugin is
deliberately *not* a dependency.

## 10. Tech

Node ≥ 18, pure `.mjs`, **no runtime npm dependencies**. Everything (loader, lint,
search, MCP server, heading indexer) is vendored under `.claude/`.
