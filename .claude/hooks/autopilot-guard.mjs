#!/usr/bin/env node
// PreToolUse Autopilot-Guard (ADR-022, ENFORCE auf Harness-Ebene). Hart erzwungene
// Schutz-Schicht für den autonomen `/implement`-Modus: solange der Marker
// `.claude/.autopilot-active` existiert, darf der Autopilot NICHT an geschützte Pfade
// (Deploy-Vertrag, Schema/Migrationen, ADRs, Secrets, die Harness selbst, scripts/)
// und NICHT pushen/mergen/deployen/migrieren. So ist der Protected-Path-/Scope-Breaker
// ein Gate, kein Wunsch — eine *weiche* Regel versagt genau unter unbeaufsichtigtem Grinden.
//
// OHNE Marker (normaler interaktiver Betrieb, auch `/implement --step`) ist der Hook ein
// striktes No-Op. Fail-open wie der Rest der Hooks: jeder Parse-/IO-/Logikfehler -> exit 0
// (erlauben, nie bricken).
import { readFileSync, existsSync } from "node:fs"
import { join, relative, isAbsolute } from "node:path"

let input
try {
  input = JSON.parse(readFileSync(0, "utf8"))
} catch {
  process.exit(0) // kein parsbarer Input -> fail-open
}

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()

// Marker-Gate: ohne aktiven Autopilot ist dieser Hook ein No-Op.
try {
  if (!existsSync(join(root, ".claude", ".autopilot-active"))) process.exit(0)
} catch {
  process.exit(0) // IO-Fehler beim Marker-Check -> fail-open
}

const tool = input.tool_name || ""
const ti = input.tool_input || {}
const deny = (r) => {
  console.error(
    `[autopilot-guard] DENY: ${r}\n` +
      "Geschützter Pfad/Befehl im autonomen Modus — der Autopilot muss hier HALTEN, " +
      "das Ereignis ins Ledger schreiben und an den User übergeben.",
  )
  process.exit(2)
}

// Pfad relativ zur Repo-Wurzel normalisieren (POSIX-Separatoren, kein führendes ./).
const relPath = (p) => {
  if (!p) return ""
  const r = isAbsolute(String(p)) ? relative(root, String(p)) : String(p)
  return r.replace(/\\/g, "/").replace(/^\.\//, "")
}

const PROTECTED_PATH = (p) => {
  const rel = relPath(p)
  if (!rel || rel.startsWith("..")) return false // außerhalb des Repos -> nicht unser Scope
  const base = rel.split("/").pop()
  return (
    base === "compose.yml" ||
    base === "Caddyfile" ||
    base === "Dockerfile" ||
    /(^|\/)db-init\//.test(rel) ||
    /(^|\/)prisma\/schema\.prisma$/.test(rel) ||
    /(^|\/)prisma\/migrations\//.test(rel) ||
    rel === "docs/decisions.md" ||
    base === ".env" ||
    base === ".env.local" ||
    base === ".vereinsheim.local" ||
    /(^|\/)\.claude\//.test(rel) || // Harness-Selbstmodifikation
    /(^|\/)scripts\//.test(rel) // Ops-CLI + Deploy-/Gate-Skripte
  )
}

if (["Edit", "Write", "NotebookEdit"].includes(tool) && PROTECTED_PATH(ti.file_path)) {
  deny(`Schreibzugriff auf geschützten Pfad „${relPath(ti.file_path)}".`)
}

if (tool === "Bash") {
  // Heredoc-Bodies + gequotete Strings ausblenden, damit NUR echte Kommandos zählen
  // (keine bloße Erwähnung in Commit-Messages/echo/Test-Fixtures) — wie pretool-guard.
  const code = String(ti.command || "")
    .replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?^\s*\2\b/gm, " ")
    .replace(/'[^']*'/g, " ")
    .replace(/"[^"]*"/g, " ")

  const FORBIDDEN = [
    [/\bgit\s+push\b/, "git push"],
    [/\bgit\s+merge\b/, "git merge"],
    [/\bgit\s+rebase\b/, "git rebase"],
    [/\bgit\s+reset\s+--hard\b/, "git reset --hard"],
    [/\bvereinsheim\b[^|;&]*\b(deploy|build|release|backup|restore)\b/, "vereinsheim deploy/build/release/backup/restore"],
    [/\bdocker\s+push\b/, "docker push"],
    [/\bprisma\s+migrate\b/, "prisma migrate"],
  ]
  for (const [re, label] of FORBIDDEN) {
    if (re.test(code)) deny(`verbotenes Kommando im autonomen Modus: „${label}".`)
  }
}

process.exit(0)
