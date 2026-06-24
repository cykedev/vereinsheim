#!/usr/bin/env node
// Builder für den Doku-Index (ADR-022).
//
// Mergt drei eingecheckte Quellen zu .claude/knowledge-graph.json (dem Artefakt,
// das der Memory-MCP-Server liest — NIE von Hand editieren):
//   1. docs/decisions.md   → ADR-Entities + supersedes-Relationen (deterministisch geparst)
//   2. .claude/graph-projection.mjs → kuratiertes Manifest (project/app/feature/…)
//   3. .claude/graph-captured.mjs   → Session-Provenance (incident/state)
//
// Deterministisch + idempotent: gleiche Quellen → byte-gleiche Ausgabe. Validiert
// Integrität UND jeden `→ datei#slug`-Pointer (toter Pointer = Build-Fehler, kein
// stiller Drift). Aufruf: `node .claude/build-graph.mjs`.
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { slugify, headingSlugs } from "./doc-index.mjs"

const STORE = ".claude/knowledge-graph.json"
const DECISIONS = "docs/decisions.md"

// ── 1. ADRs aus decisions.md parsen ──────────────────────────────────────────
function parseAdrs(markdown) {
  const lines = markdown.split("\n")
  const entities = []
  const relations = []
  let cur = null
  const flush = () => {
    if (!cur) return
    entities.push({
      name: cur.name,
      entityType: "decision",
      observations: [`Titel: ${cur.title}`, `Status: ${cur.status || "—"}`, `→ ${DECISIONS}#${cur.slug}`],
    })
    const sup = cur.title.match(/\(supersedes ADR-(\d+)\)/)
    if (sup) relations.push({ from: cur.name, to: `ADR-${sup[1].padStart(3, "0")}`, relationType: "supersedes" })
    cur = null
  }
  for (const line of lines) {
    const h = line.match(/^## (ADR-(\d{3}) — (.+?))\s*$/)
    if (h) {
      flush()
      cur = { name: `ADR-${h[2]}`, title: h[3].trim(), slug: slugify(h[1]), status: null }
      continue
    }
    if (cur && cur.status === null) {
      const s = line.match(/^\*\*Status\*\*:\s*(.+?)\s*$/)
      if (s) cur.status = s[1]
    }
  }
  flush()
  return { entities, relations }
}

// ── 2./3. Quellen laden ──────────────────────────────────────────────────────
const adr = parseAdrs(readFileSync(DECISIONS, "utf8"))
const projection = (await import("./graph-projection.mjs")).default
const captured = (await import("./graph-captured.mjs")).default

// ── Merge (stabile, nach Quelle gruppierte Reihenfolge) ──────────────────────
const adrEntities = [...adr.entities].sort((a, b) => a.name.localeCompare(b.name))
const adrRelations = [...adr.relations].sort((a, b) => (a.from + a.to).localeCompare(b.from + b.to))
const entities = [...adrEntities, ...projection.entities, ...captured.entities]
const relations = [...adrRelations, ...projection.relations, ...captured.relations]

// ── Validierung ──────────────────────────────────────────────────────────────
const errors = []
const names = new Set()
for (const e of entities) {
  if (names.has(e.name)) errors.push(`Doppelter Entity-Name: ${e.name}`)
  names.add(e.name)
  if (!e.observations?.length) errors.push(`Entity ohne Observation: ${e.name}`)
}
for (const r of relations) {
  if (!names.has(r.from)) errors.push(`Dangling-Relation: ${r.from} → ${r.to} (from fehlt)`)
  if (!names.has(r.to)) errors.push(`Dangling-Relation: ${r.from} → ${r.to} (to fehlt)`)
}

// Pointer-Resolve: jeder `→ datei[#slug]` muss auflösen.
const slugCache = new Map()
const slugsOf = (file) => {
  if (!slugCache.has(file)) slugCache.set(file, new Set(headingSlugs(readFileSync(file, "utf8")).map((h) => h.slug)))
  return slugCache.get(file)
}
let pointerCount = 0
for (const e of entities) {
  for (const o of e.observations) {
    const m = o.match(/^→ (\S+)$/)
    if (!m) continue
    pointerCount++
    const target = m[1]
    const hashAt = target.indexOf("#")
    const file = hashAt === -1 ? target : target.slice(0, hashAt)
    const slug = hashAt === -1 ? null : target.slice(hashAt + 1)
    if (!existsSync(file)) {
      errors.push(`${e.name}: Pointer-Datei fehlt: ${file}`)
      continue
    }
    if (hashAt !== -1 && !slug) errors.push(`${e.name}: leerer Slug im Pointer '${target}'`)
    else if (slug && !slugsOf(file).has(slug)) errors.push(`${e.name}: kein Abschnitt '${slug}' in ${file}`)
  }
}

// Jede kuratierte Entity (projection + captured; ADRs werden auto-geparst) braucht eine
// `Keywords:`-Observation — Retrieval-Hilfe gegen das reine Substring-Matching von search_nodes.
for (const e of [...projection.entities, ...captured.entities]) {
  if (!e.observations?.some((o) => String(o).startsWith("Keywords:")))
    errors.push(`Entity ohne Keywords-Zeile: ${e.name} (Synonyme als 'Keywords: …'-Observation ergänzen)`)
}

if (errors.length) {
  process.stderr.write("build-graph: FEHLER\n  " + errors.join("\n  ") + "\n")
  process.exit(1)
}

// ── Serialisierung (kompaktes JSONL, UTF-8 literal, trailing \n) ─────────────
const out = [
  ...entities.map((e) => JSON.stringify({ type: "entity", name: e.name, entityType: e.entityType, observations: e.observations })),
  ...relations.map((r) => JSON.stringify({ type: "relation", from: r.from, to: r.to, relationType: r.relationType })),
]
writeFileSync(STORE, out.join("\n") + "\n")
console.log(`build-graph: ${entities.length} entities, ${relations.length} relations, ${pointerCount} pointers → ${STORE}`)
