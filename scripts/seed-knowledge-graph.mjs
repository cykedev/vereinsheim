#!/usr/bin/env node
// Seedet den Memory-Graph (.claude/knowledge-graph.json — JSONL-Format des
// @modelcontextprotocol/server-memory) aus den ADRs in docs/decisions.md plus
// ein paar Kern-Projekt-Entities (ADR-016, Schicht 3). Idempotent: schreibt die
// Datei neu. Aufruf:  node scripts/seed-knowledge-graph.mjs
import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const decisions = readFileSync(join(root, "docs/decisions.md"), "utf8")

const nodes = []
const entity = (name, entityType, observations) =>
  nodes.push(JSON.stringify({ type: "entity", name, entityType, observations }))
const relation = (from, to, relationType) =>
  nodes.push(JSON.stringify({ type: "relation", from, to, relationType }))

// --- Kern-Entities ---
entity("vereinsheim", "project", [
  "Code- + Deployment-Monorepo (pnpm + Turborepo) für zwei Next.js-Apps auf einem VPS.",
  "Migration: Phase 1 (Struktur) + 3 (Build aus Monorepo) live; Phase 2 (Harness/Knowledge + packages/config) und Phase 4 (packages/ui) offen.",
  "Build: turbo prune + Root-Dockerfile → Docker Hub; VPS pullt. Deploy-Vertrag (compose.yml/Caddy/db-init) unverändert.",
])
entity("ringwerk", "app", ["Liga- & Wettkampf-Verwaltung. apps/ringwerk, Dev-Port 3000."])
entity("treffsicher", "app", [
  "Trainings-App (Tagebuch, Ergebnisse, Statistik, Mentaltraining). apps/treffsicher, Dev-Port 3001, Dark-Mode-only.",
])
relation("ringwerk", "vereinsheim", "part_of")
relation("treffsicher", "vereinsheim", "part_of")

// --- ADRs aus decisions.md ---
const headers = [...decisions.matchAll(/^## (ADR-\d+) — (.+)$/gm)]
let count = 0
for (let i = 0; i < headers.length; i++) {
  const h = headers[i]
  const sec = decisions.slice(h.index, i + 1 < headers.length ? headers[i + 1].index : decisions.length)
  const id = h[1]
  const title = h[2].trim()
  const status = (sec.match(/\*\*Status\*\*:\s*(.+)/) || [])[1]?.trim()
  const decision = (sec.match(/\*\*Entscheidung\*\*:\s*([^\n]+(?:\n(?!\s*\n)[^\n]+)*)/) || [])[1]
    ?.replace(/\s+/g, " ")
    .trim()
    .slice(0, 320)
  const obs = [`Titel: ${title}`]
  if (status) obs.push(`Status: ${status}`)
  if (decision) obs.push(`Entscheidung: ${decision}`)
  entity(id, "decision", obs)
  const sup = status && status.match(/durch (ADR-\d+)/)
  if (sup) relation(sup[1], id, "supersedes")
  count++
}

writeFileSync(join(root, ".claude/knowledge-graph.json"), nodes.join("\n") + "\n")
console.log(`Seeded ${count} ADRs + 3 Kern-Entities → .claude/knowledge-graph.json (${nodes.length} Knoten/Kanten)`)
