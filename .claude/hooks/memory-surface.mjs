#!/usr/bin/env node
// SessionStart-Hook: surface't den Memory-MCP-Graphen (ADR-016 Schicht 3, operationalisiert in
// ADR-021) ins Kontextfenster, damit das persistente Projektgedächtnis tatsächlich GENUTZT wird —
// analog zum CodeGraph (codegraph-ensure.mjs). Liest die JSONL-Store-Datei DIREKT (unabhängig vom
// MCP-Server, dessen relativer Pfad früher ins Leere zeigte) und gibt eine kompakte Übersicht +
// Abfrage-/Capture-Hinweis als additionalContext aus. Fail-open: fehlende/leere/kaputte Datei oder
// jeder Fehler → still exit 0 (nie den Session-Start stören oder verzögern).
import { readFileSync } from "node:fs"
import { join } from "node:path"

try {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
  const file = join(root, ".claude", "knowledge-graph.json")

  let raw
  try {
    raw = readFileSync(file, "utf8")
  } catch {
    process.exit(0) // keine Store-Datei → nichts zu surfacen
  }

  // JSONL: 1 JSON-Objekt pro Zeile ({"type":"entity"|"relation",…}) — KEIN JSON.parse der Gesamtdatei.
  const types = new Map()
  let entities = 0
  let relations = 0
  for (const line of raw.split("\n")) {
    const t = line.trim()
    if (!t) continue
    let obj
    try {
      obj = JSON.parse(t)
    } catch {
      continue // einzelne kaputte Zeile überspringen, nie bricken
    }
    if (obj.type === "entity") {
      entities++
      const k = obj.entityType || "?"
      types.set(k, (types.get(k) || 0) + 1)
    } else if (obj.type === "relation") {
      relations++
    }
  }

  if (entities === 0) process.exit(0) // leerer Graph → kein Rauschen

  const breakdown = [...types.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k}×${n}`)
    .join(", ")

  const msg =
    `Memory-Graph (Projektgedächtnis, .claude/knowledge-graph.json): ${entities} Entities ` +
    `(${breakdown}), ${relations} Relationen. ABFRAGEN mit mcp__memory__search_nodes/` +
    `open_nodes/read_graph, BEVOR du breit explorierst — projektspezifischer Kontext/Incidents/` +
    `Provenance, der nicht in den immer-geladenen Docs steht. NEUE projektspezifische Fakten ` +
    `(Incident, Entscheidungs-Provenance, sich ändernder Zustand, Relationen) mit ` +
    `mcp__memory__create_entities/add_observations festhalten UND .claude/knowledge-graph.json ` +
    `committen. Abgrenzung: Code-Struktur → CodeGraph; erzwingbare Regeln → docs/Gates; ` +
    `Maschinen-/Ops-lokales → natives Auto-Memory.`

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: msg },
    }),
  )
} catch {
  /* fail-open: jeder Fehler → Session ungestört starten */
}

process.exit(0)
