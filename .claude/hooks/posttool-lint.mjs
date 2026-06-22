#!/usr/bin/env node
// PostToolUse-Lint (ADR-018, non-blocking-ish): nach Edit/Write an einer
// App-Quelldatei eslint auf genau diese Datei laufen lassen und Befund an Claude
// surfacen (exit 2 = sichtbar, der Edit bleibt aber bestehen). Fail-open sonst.
import { readFileSync } from "node:fs"
import { execSync } from "node:child_process"

let input
try {
  input = JSON.parse(readFileSync(0, "utf8"))
} catch {
  process.exit(0)
}

const fp = input?.tool_input?.file_path
const m = fp && String(fp).match(/(?:^|\/)apps\/(ringwerk|treffsicher)\/(.+\.(?:ts|tsx))$/)
if (!m) process.exit(0) // nur App-TS/TSX-Quelldateien

const app = m[1]
const rel = m[2] // pfad relativ zur App-Wurzel
try {
  execSync(`pnpm --filter ${app} exec eslint ${JSON.stringify(rel)}`, {
    stdio: "pipe",
    timeout: 90000,
  })
  process.exit(0) // sauber
} catch (e) {
  if (e.code === "ENOENT" || /command not found|ELIFECYCLE.*ENOENT/.test(String(e.stderr))) {
    process.exit(0) // pnpm/eslint nicht da -> fail-open
  }
  const out = ((e.stdout && e.stdout.toString()) || "") + ((e.stderr && e.stderr.toString()) || "")
  console.error(`[posttool-lint] eslint-Befund in apps/${app}/${rel}:\n${out.slice(0, 1500)}`)
  process.exit(2) // an Claude surfacen (Edit bereits angewendet, nicht rückgängig)
}
