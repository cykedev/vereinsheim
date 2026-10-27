// Gemeinsame Helper für die Hook-Skripte. Kein eigener Hook (Underscore-Präfix).
import { readFileSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { delimiter, dirname, join, resolve } from "node:path"
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

// Höchste installierte Version, die zur Angabe aus `.nvmrc` passt ("26", "v26.12", "26.12.1").
// `versions` sind die Ordnernamen unter `$NVM_DIR/versions/node` ("v26.12.1"). Aliase wie
// "lts/*" oder "node" löst das nicht auf → null.
export function pickNodeVersion(spec, versions) {
  const want = String(spec ?? "").trim().replace(/^v/, "")
  if (!/^\d+(\.\d+){0,2}$/.test(want)) return null
  const prefix = want.split(".").map(Number)
  const parse = (v) => (/^v\d+\.\d+\.\d+$/.test(v) ? v.slice(1).split(".").map(Number) : null)
  const matches = versions
    .map((v) => ({ v, n: parse(v) }))
    .filter(({ n }) => n && prefix.every((p, i) => n[i] === p))
    .sort((a, b) => b.n[1] - a.n[1] || b.n[2] - a.n[2]) // die Hauptversion ist bei allen gleich
  return matches[0]?.v ?? null
}

// Umgebung für Kindprozesse der Hooks (pnpm, node): der bin-Ordner der Node-Version aus
// `.nvmrc` steht vorn im PATH. Die Hooks selbst startet Claude mit dem Node, den die App
// vorfindet; der kann älter sein, und `engine-strict` (.npmrc) lässt pnpm dann abbrechen.
// Ohne passende Version bleibt die Umgebung, wie sie ist, und `note` sagt das.
export function nodeEnv(root, { env = process.env, home = homedir() } = {}) {
  let spec
  try {
    spec = readFileSync(join(root, ".nvmrc"), "utf8").trim()
  } catch {
    return { env }
  }
  const dir = join(env.NVM_DIR || join(home, ".nvm"), "versions", "node")
  let versions = []
  try {
    versions = readdirSync(dir)
  } catch {
    // kein nvm → Rückfall unten
  }
  const version = pickNodeVersion(spec, versions)
  if (!version) {
    return {
      env,
      note: `[hooks] Kein Node zu .nvmrc (${spec}) unter ${dir}; pnpm und node laufen mit dem Node aus PATH.`,
    }
  }
  const bin = join(dir, version, "bin")
  return { env: { ...env, PATH: env.PATH ? `${bin}${delimiter}${env.PATH}` : bin } }
}
