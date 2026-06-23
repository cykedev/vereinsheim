#!/usr/bin/env node
// Launcher für den Memory-MCP-Server (ADR-021-Addendum, 2026-06-23).
//
// Warum dieser Wrapper statt direkt `npx @modelcontextprotocol/server-memory`:
// `server-memory` löst einen RELATIVEN `MEMORY_FILE_PATH` gegen sein EIGENES
// dist-Verzeichnis auf (`import.meta.url`), NICHT gegen die Prozess-CWD. Und
// Claude Code füllt `CLAUDE_PROJECT_DIR` im MCP-Server-Env NICHT — der frühere
// `${CLAUDE_PROJECT_DIR:-.}`-Wert in `.mcp.json` kollabierte daher zu "." und der
// Store landete unter `<npx-dist>/.claude/knowledge-graph.json` (leerer Graph,
// ENOENT bei Writes). Empirisch belegt am 2026-06-23.
//
// Fix: einen ABSOLUTEN Store-Pfad aus der EIGENEN Lage dieses Launchers ableiten
// (liegt im Repo unter .claude/hooks/) und per Env an den echten Server übergeben.
// Portabel über Maschinen hinweg — kein hartkodierter Absolutpfad (Team-Readiness,
// monorepo-plan.md §11).
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const here = dirname(fileURLToPath(import.meta.url)) // <repo>/.claude/hooks
const storePath = join(here, "..", "knowledge-graph.json") // <repo>/.claude/knowledge-graph.json

// MCP spricht JSON-RPC über stdio — die Pipes 1:1 durchreichen, damit Claude Code
// direkt mit dem Server redet; dieser Launcher sitzt nur als Env-Setzer dazwischen.
const child = spawn("npx", ["-y", "@modelcontextprotocol/server-memory"], {
  stdio: "inherit",
  env: { ...process.env, MEMORY_FILE_PATH: storePath },
})

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})

child.on("error", (err) => {
  process.stderr.write(`memory-server launcher: ${err.message}\n`)
  process.exit(1)
})
