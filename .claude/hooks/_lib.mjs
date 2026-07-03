// Gemeinsame Helper für die Hook-Skripte. Kein eigener Hook (Underscore-Präfix).
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

export async function readStdin() {
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return Buffer.concat(chunks).toString("utf8")
}

export async function readInput() {
  try {
    return JSON.parse((await readStdin()) || "{}")
  } catch {
    return {}
  }
}

// Hooks liegen in .claude/hooks → die Repo-Wurzel liegt zwei Ebenen höher.
export function repoRoot(importMetaUrl) {
  return resolve(dirname(fileURLToPath(importMetaUrl)), "..", "..")
}

// "Ist das ein echter Dotenv-/Secret-Pfad" — geteilt von pretool-guard.mjs (Lesezeit)
// und autopilot-guard.mjs (Autonomie-Durchsetzung), damit beide nie auseinanderdriften.
// Matched einen ganzen `.env`/`.env.*`-Pfadsegment, jeden Basename, der auf `.env` endet
// (z.B. `config.env`), oder unsere projektspezifische zweite Secret-Datei
// `.vereinsheim.local` — außer Basenames, die auf `.example`/`.sample`/`.template` enden.
export function isDotenvPath(p) {
  if (!p) return false
  const base = p.split("/").pop() || ""
  if (/\.(example|sample|template)$/.test(base)) return false
  if (base === ".vereinsheim.local") return true
  return /(^|\/)\.env(\.|$)/.test(p) || /\.env$/.test(base)
}
