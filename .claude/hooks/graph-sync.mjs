#!/usr/bin/env node
// Stop-Hook (ADR-022, ENFORCE auf Harness-Ebene): synct am Turn-Ende den Doku-Index.
//
// Ehrliche Zweiteilung der Determinismus-Grenze:
//  1. DETERMINISTISCH (erzwungen): `build-graph.mjs` ausführen. Schlägt die Validierung
//     fehl (toter Pointer / Dangling / Dup), wird das Turn-Ende GEBLOCKT — der Index muss
//     valide sein, bevor ein Agent aufhört. Der Build hält den Store außerdem frisch
//     (idempotent → bei unveränderten Quellen byte-gleich, also still).
//  2. MODELLGETRIEBEN (genudged): wurden indizierte Docs geändert, aber das Manifest NICHT,
//     gibt es einen nicht-blockierenden Hinweis Richtung `/sync-graph` (ein Hook kann den
//     semantischen Docs→Manifest-Sync nicht selbst erzeugen → kein Hard-Block, der bei
//     Typo-Fixes einsperrt).
//
// Fail-open: jeder unerwartete Fehler (kein node, Hook-Infra) → erlauben, nie bricken.
import { readFileSync } from "node:fs"
import { execSync } from "node:child_process"

let input = {}
try {
  input = JSON.parse(readFileSync(0, "utf8"))
} catch {
  /* fail-open */
}
if (input.stop_hook_active) process.exit(0) // schon in einer Stop-Schleife → erlauben

const run = (cmd) => execSync(cmd, { stdio: "pipe", timeout: 120000 }).toString()

try {
  // 1. Build (deterministisch). Non-zero = Integritäts-/Pointer-Fehler → blocken.
  try {
    run("node .claude/build-graph.mjs")
  } catch (e) {
    if (e.code === "ENOENT") process.exit(0) // kein node → fail-open
    const out = ((e.stdout && e.stdout.toString()) || "") + ((e.stderr && e.stderr.toString()) || "")
    console.error(
      "[graph-sync] Doku-Index ist INVALIDE — bitte die QUELLE fixen (graph-projection.mjs / " +
        "graph-captured.mjs / decisions.md), nicht den Store, dann erneut bauen:\n" +
        out.slice(-2000),
    )
    process.exit(2) // blockt das Turn-Ende
  }

  // git-Status für die nicht-blockierenden Hinweise (fail-open, wenn kein git).
  let porcelain = ""
  try {
    porcelain = run("git status --porcelain")
  } catch {
    process.exit(0)
  }
  const changed = porcelain
    .split("\n")
    .map((l) => l.slice(3).trim())
    .filter(Boolean)

  const notes = []

  // Store wurde (durch den Build oben) frisch geschrieben und weicht vom Commit ab → mit-committen.
  if (changed.includes(".claude/knowledge-graph.json")) {
    notes.push(
      "Graph-Store wurde neu gebaut und ist noch nicht committet → `.claude/knowledge-graph.json` " +
        "zusammen mit den geänderten Quellen committen.",
    )
  }

  // Indizierte Docs geändert, aber Manifest nicht → /sync-graph erwägen (Manifest nachziehen).
  const manifestTouched = changed.includes(".claude/graph-projection.mjs")
  const docRe = /^(docs\/|apps\/[^/]+\/docs\/|README\.md).*\.md$/
  const changedDocs = changed.filter(
    (f) => docRe.test(f) && !f.includes("/superpowers/") && f !== "docs/decisions.md", // ADRs werden auto-geparst
  )
  if (changedDocs.length && !manifestTouched) {
    notes.push(
      `Indizierte Doku geändert (${changedDocs.slice(0, 5).join(", ")}${changedDocs.length > 5 ? " …" : ""}) ` +
        "ohne Manifest-Update → `/sync-graph` ausführen, damit der Index die neue Prosa abbildet " +
        "(oder bewusst überspringen, wenn die Änderung kein Topic berührt).",
    )
  }

  if (notes.length) console.error("[graph-sync]\n- " + notes.join("\n- "))
  process.exit(0) // Hinweise sind nicht-blockierend
} catch {
  process.exit(0) // fail-open
}
