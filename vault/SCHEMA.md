# Vault Schema — the authoring contract

This vault **is** the knowledge graph and it **is** an Obsidian vault, at once. There
is no build step and no separate store: `.claude/vault-loader.mjs` reads these notes
directly into the graph the `memory` MCP server serves. Change a note and the change
is live. This file is the schema the loader, `vault-lint.mjs`, and the skills rely on —
change it deliberately (see `decisions/adr-011.md`).

> **Obsidian compatibility is a property of the format, not the runtime.** Nothing in
> the harness needs Obsidian installed or running. A human *may* open `vault/` in
> Obsidian and get graph view, backlinks, and clickable links for free — because the
> notes are written the way Obsidian expects.

## 1. One note = one entity

Every Markdown file under `vault/` is a single **node** in the graph, except the meta
files `index.md`, `SCHEMA.md`, and `README.md` (skipped: no `id`/`type`). The filename
(without `.md`) **is** the node id.

- **`id`**: kebab-case, globally unique, stable, `== filename`. Wikilinks are
  filename-based, so ids must be unique across all folders. (Note: the filesystem may
  be case-insensitive — treat ids as case-insensitively unique too.)
- Renaming an id means renaming the file **and** every `edges` reference to it —
  prefer `aliases` over renames.

## 2. Folder = topic; `type` = kind

**Folders are TOPICS**, one big topic per folder (`architecture/`, `workflow/`,
`gates/`, `knowledge/`, `guardrails/`, `operations/`, `decisions/`, `incidents/` …).
Each topic folder holds a **MOC hub note** (`type: guide`, usually `<topic>.md`) that
orients and links, plus the atomic notes for that topic. Add a topic by creating a
folder + its MOC.

A note's **`type`** (frontmatter) is its **kind**, decoupled from the folder:

| `type` | Kind | Search weight |
|---|---|---|
| `guide` | narrative / a topic MOC hub — links atomic notes, doesn't restate them | 0.7 (below the atomic note) |
| `subsystem` | an atomic part of the system (one concept per note) | 1.0 |
| `operation` | an atomic workflow/procedure (one per note) | 1.0 |
| `concept` | a reusable building block referenced by several notes | 1.0 |
| `decision` | one ADR (Context/Decision/Alternatives/Consequences) | 0.8 |
| `incident` | project-specific state to **REMEMBER** ([[adr-003]]) | 0.75 |
| `source` | provenance for ingested content — one note per origin doc (KNOWLEDGE.md §6) | 0.6 |

`type` drives search weighting (a targeted query surfaces the atomic note before its
topic MOC / the ADR that governs it) and semantics. Add a kind by extending the loader's
`NODE_TYPES`. Raw ingested originals live under **`.raw/`** (immutable, dot-prefixed →
the loader skips them); `source` notes cite them and are cited via `documented_in`. `conventions.md`, `overview.md`, `SCHEMA.md`, `index.md` live at the vault
root; `conventions.md` (the `@`-imported rules) and `overview.md` are `guide`s.

**Reserved `_`-prefixed dirs** (ignored by the loader, Obsidian convention):
`_templates/` holds one copy-paste frontmatter stub per type (wired to Obsidian's
Templates core plugin via `.obsidian/templates.json`) — the authoring aid that pairs
with §3; `_attachments/` holds images/PDFs. Anything under a `_`- or `.`-prefixed
directory is never an entity.

## 3. Frontmatter schema

```yaml
---
# --- required ---
id: quality-gates                 # kebab, unique, == filename (no .md)
type: subsystem                   # the note's KIND (see §2) — decoupled from folder
title: Quality gates              # human-facing display name

# --- optional ---
aliases: [gate, gates]            # alternate names; boosted in search (Obsidian-native)
tags: [harness, ci]               # flat topic tags (Obsidian-native)
keywords: [lint, typecheck, build] # CURATED synonyms/jargon the body omits — feeds search
status: Accepted                  # decisions only: Accepted | Superseded | Proposed
# typed graph edges — FLAT top-level properties named by edge type, so each is BOTH a
# machine edge AND a real Obsidian link (graph view / backlinks). NOT nested under an
# `edges:` key — Obsidian ignores object-valued properties (see §4).
subsystem_of: ["[[harness]]"]
governed_by: ["[[adr-002]]"]
documented_in: ["[[operations#Quality gates]]"]   # anchor = the heading TEXT (see below)
---
**TL;DR** one or two sentences — often answers a query without a further read.

Body prose. The loader extracts search keywords from the whole body automatically, so
the richer the note, the better it is found — no manual keyword upkeep beyond the
curated `keywords` line for true synonyms.
```

**Field notes**

- `keywords` replaces the old `Keywords:` observation line — curated synonyms/jargon
  the prose does not spell out (e.g. `sso` next to "single sign-on"). Everything the
  body already says is auto-extracted; `keywords` covers only what it omits.
- Each edge is a **top-level list property** whose values are quoted `"[[note-id]]"`
  strings — never bare ids (`[[` starts a YAML flow sequence otherwise, so each item is
  a quoted string). Inline (`["[[a]]", "[[b]]"]`) or YAML block (`- "[[a]]"`) both work;
  Obsidian's Properties UI writes the block form. Omit an edge property rather than
  giving it an empty list.
- An edge target **may carry a section anchor**, and the anchor MUST be the heading's
  **exact text**, not a slug: `"[[harness-walkthrough#The knowledge system]]"` — **not**
  `#the-knowledge-system`. Obsidian resolves `#` against the literal heading text; a slug
  anchor is a dead link in Obsidian. The loader slugifies the anchor itself when it reads
  the section, so heading-text works on both sides. For traversal the loader uses the
  note id; for search it pulls that exact section's keywords — this is how a thin atomic
  note inherits the depth of the guide section that documents it, with **no duplicated
  prose** (single source of truth). `vault-lint` fails a `documented_in` anchor that
  matches no heading in the target.

## 4. Edge vocabulary

Edges are **directed**; store them on the note they originate from, as **flat
top-level frontmatter properties** — one property per edge type.

> **Why flat, not a nested `edges:` object.** Obsidian only resolves `[[wikilinks]]`
> into real links (backlinks, graph view) when they sit in a **top-level list
> property**. A nested map — `edges:` → `refines:` → `[...]` — is an *object-valued*
> property, which Obsidian's Properties system does not support: the wikilinks inside
> it are inert (no backlink, no graph edge). Flattening each edge type to its own
> top-level list property is what makes the SAME frontmatter drive both the machine
> graph (the loader) and Obsidian's native graph — the actual point of the vault.

| Edge | Meaning |
|---|---|
| `subsystem_of` / `operation_of` / `feature_of` / `part_of` | membership — X is a part/operation/feature of Y (`part_of` is the generic form, e.g. a note → its topic MOC) |
| `governed_by` | X is decided by a `decision` note (→ an `adr-NNN`) |
| `informed_by` | X is influenced (not governed) by a decision |
| `documented_in` | X's prose lives in `[[guide#section]]` — the frugal-read + keyword source |
| `supersedes` / `refines` | between `decision` notes |
| `alternative_to` | X is another way to achieve Y's goal — the "what methods exist to build X?" payoff for ingested domain knowledge. Conceptually symmetric: author it on both notes. |
| `depends_on` | X requires Y (prerequisite chains) |
| `relates_to` / `see_also` / `contrasts_with` | navigation |

## 5. `index.md` (and why no `hot.md` / `log.md`)

- **`index.md`** — the master catalog (all notes grouped by type) + the "read in this
  order" onboarding path, and the human map-of-content in Obsidian. Not a node (skipped
  by the loader). Update it on add/remove/rename.
- **No `hot.md`, no `log.md`.** Content-KB wikis keep a current-focus cache and an
  append-only change journal; this is a small, stable *governance* graph, not a growing
  content corpus. The change journal is **git** (commits + ADR supersession); transient
  "current focus" lives in `.claude/tasks/todo.md` + `lessons.md`. Vault copies would
  duplicate git history — and `log.md` is a known multi-writer merge-conflict hotspot.

## 6. Guides vs atomic notes (single source of truth)

`guides/` hold the **narrative**; atomic notes (`subsystems/`, `operations/`,
`concepts/`) hold **one concept each** and are the canonical definition of that
concept. A guide *links* atomic notes; it does not restate them. When detail about a
concept grows, it belongs in that concept's note — the guide points at it with a
`[[note]]` link. This keeps prose un-duplicated while letting the long-form reading
path survive (the `guide` type is exactly the affordance for that).

## 7. Retrieval (how an agent reads this vault)

Via the `memory` MCP server (all deterministic, zero-dependency, EN/DE):

1. **Find** — `search_nodes` (natural-language, BM25-ranked) → ranked entities.
2. **Map** — `document_map` on a note → its heading paths, without the body.
3. **Read** — `section_read` on a note + heading → just that section.
4. **Graph** — `open_nodes` (exact ids + their relations), `backlinks`/`traverse`
   (who links here / walk typed edges), `read_graph` (the whole small graph).

Prefer find → map → read over reading whole notes on spec.
