---
name: ingest
description: Ingest an external source (a .raw/ file, pasted content, or a URL) into the vault as structured, cited notes. Use when adding reference/domain knowledge — vendor docs, a partner tool's manual, runbooks — that the project should be able to query. Not for the harness's own governance docs (those are authored).
---

# /ingest

Turn an external source into structured, linked, **cited** vault notes (KNOWLEDGE.md §6).
The rule: **extract, never copy** (copyright + it goes stale), and **every ingested
claim cites a `source`** so an answer is always one hop from its provenance.

1. **Capture the raw.** Put the original under `.raw/` — immutable, never edited. For a
   URL, fetch it (WebFetch) and save the cleaned markdown there. `.raw/` is dot-prefixed,
   so the loader ignores it.
2. **Read it fully**, then discuss the key takeaways with the user (skip if they say
   "just ingest it").
3. **Create the `source` note** — `vault/sources/src-<id>.md` from
   `_templates/source.md` (title · url · `retrieved` date · a TL;DR extract). This is the
   provenance anchor everything cites.
4. **Extract entities into atomic notes.** For each significant capability / concept /
   procedure, create **or update** an atomic note (`subsystem` / `operation` / `concept`)
   in the right **topic folder**, from the matching `_templates/`. Each carries:
   - a `**TL;DR**` + an **extract** (decision-relevant facts, tables over prose — *not* a
     doc copy), a curated `keywords:` line, and `aliases`;
   - **flat** typed edges (quoted `"[[id]]"`): `part_of` its topic MOC,
     `documented_in: ["[[src-<id>]]"]` (cite the source), and where they apply
     `alternative_to` (the "what methods exist for X" mesh — author it on **both** notes),
     `depends_on`, `relates_to`. Heading-TEXT anchors, never slugs.
5. **Dedupe** against `vault/index.md` — update an existing note rather than creating a
   near-duplicate, and add the new source to its `documented_in`.
6. **Wire & update** — link the new notes into their topic MOC hub; update `vault/index.md`.
7. **Validate & commit** — `node .claude/vault-lint.mjs` (fix the note it names). No build
   step; the notes are live. Commit the `.raw/` original + the new/updated notes together.

> **Scale note:** ingesting many sources at once is fine — process each fully, then do
> one cross-reference + `index.md` pass at the end, and report what was created/updated.
> If BM25 recall ever weakens on a large ingested corpus, the semantic-reranker seam
> (KNOWLEDGE.md §8) is the escalation, not a rewrite.
