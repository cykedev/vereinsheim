#!/usr/bin/env node
// PreToolUse Security-Guard (ADR-018). Verweigert Lesen/Schreiben echter Secrets
// (.env, .env.local, .vereinsheim.local) und katastrophale rekursive Deletes
// (/, ~, $HOME, ., *, Secrets). Erlaubt *.example / *.template / *.sample.
// Fail-open: jeder Parse-/Logikfehler -> exit 0 (erlauben, nie bricken).
import { readFileSync } from "node:fs"

let input
try {
  input = JSON.parse(readFileSync(0, "utf8"))
} catch {
  process.exit(0)
}

const tool = input.tool_name || ""
const ti = input.tool_input || {}
const deny = (r) => {
  console.error(`[pretool-guard] DENY: ${r}`)
  process.exit(2)
}

const secretFile = (p) => {
  if (!p) return false
  const base = String(p).split(/[\\/]/).pop()
  if (/\.(example|template|sample)$/.test(base)) return false
  return base === ".env" || base === ".env.local" || base === ".vereinsheim.local"
}

if (["Read", "Edit", "Write", "NotebookEdit"].includes(tool) && secretFile(ti.file_path)) {
  deny(`Secret-Datei „${ti.file_path}" — nutze die .env.example statt der echten Datei.`)
}

if (tool === "Bash") {
  const cmd = String(ti.command || "")
  const rmSeg = cmd.split(/[\n;|&]+/).find((s) => /\brm\b/.test(s)) || ""
  const mentionsSecret = /(\.env|\.vereinsheim\.local)\b/.test(cmd) && !/\.(example|template|sample)/.test(cmd)
  const readsFile = /\b(cat|bat|less|more|head|tail|cp|mv|tee|sed|awk|grep|strings|xxd|od|vi|vim|nano|emacs)\b/.test(cmd)
  if (mentionsSecret && readsFile) deny("Shell-Zugriff auf eine echte Secret-Datei.")
  const recursive = /-[a-zA-Z]*r/.test(rmSeg)
  if (recursive && /(\s|^)(\/|~|\$HOME|\.|\.\/|\*)(\s|$)/.test(rmSeg)) {
    deny(`Gefährliches rekursives Löschen: „${rmSeg.trim().slice(0, 70)}".`)
  }
  if (recursive && mentionsSecret) deny("Rekursives Löschen einer Secret-Datei.")
}

process.exit(0)
