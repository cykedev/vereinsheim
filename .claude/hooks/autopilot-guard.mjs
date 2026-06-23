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
import { readFileSync, existsSync, statSync } from "node:fs"
import { join, relative, isAbsolute } from "node:path"

// Marker älter als das hier → als verwaist behandeln (fail-open). Schützt davor, dass ein
// abnormal beendeter Autopilot-Lauf (Crash/Kill/Ctrl-C vor HALT) den Guard im nächsten
// interaktiven Lauf scharf stehen lässt; die SKILL „touched" den Marker pro Iteration.
const MARKER_TTL_MS = 8 * 60 * 60 * 1000

let input
try {
  input = JSON.parse(readFileSync(0, "utf8"))
} catch {
  process.exit(0) // kein parsbarer Input -> fail-open
}

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()

// Marker-Gate: ohne aktiven (frischen) Autopilot ist dieser Hook ein No-Op.
try {
  const marker = join(root, ".claude", ".autopilot-active")
  if (!existsSync(marker)) process.exit(0)
  const ageMs = Date.now() - statSync(marker).mtimeMs
  if (ageMs > MARKER_TTL_MS) {
    console.error(
      `[autopilot-guard] Marker ist ${Math.round(ageMs / 3600000)}h alt → als verwaist behandelt ` +
        "(fail-open). Falls kein Autopilot läuft: `rm .claude/.autopilot-active`.",
    )
    process.exit(0)
  }
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
  if (!rel) return false
  // Pfad-Escape (`..` / absoluter Eltern-Tree-Pfad): NICHT als „out-of-scope" durchwinken —
  // die geschützten Ressourcen (.claude/, scripts/, compose.yml, ADRs, Schema) liegen physisch
  // auch im Eltern-Tree (der Worktree hängt unter <repo>/.claude/worktrees/). Bei Escape gegen
  // den vollen normalisierten Pfad prüfen; unverdächtige Außen-Pfade (z.B. /tmp/x) matchen nichts.
  const probe = rel.startsWith("..") ? String(p).replace(/\\/g, "/").replace(/^\.\//, "") : rel
  const base = probe.split("/").pop()
  return (
    base === "compose.yml" ||
    base === "Caddyfile" ||
    base === "Dockerfile" ||
    /(^|\/)db-init\//.test(probe) ||
    /(^|\/)prisma\/schema\.prisma$/.test(probe) ||
    /(^|\/)prisma\/migrations\//.test(probe) ||
    /(^|\/)docs\/decisions\.md$/.test(probe) ||
    base === ".env" ||
    base === ".env.local" ||
    base === ".vereinsheim.local" ||
    /(^|\/)\.claude\//.test(probe) || // Harness-Selbstmodifikation
    /(^|\/)scripts\//.test(probe) // Ops-CLI + Deploy-/Gate-Skripte
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

  // `git\s+(?:-C\s+\S+\s+)?` toleriert das realistische `git -C <path> <verb>` (sonst Bypass).
  const FORBIDDEN = [
    [/\bgit\s+(?:-C\s+\S+\s+)?push\b/, "git push"],
    [/\bgit\s+(?:-C\s+\S+\s+)?merge\b/, "git merge"],
    [/\bgit\s+(?:-C\s+\S+\s+)?rebase\b/, "git rebase"],
    [/\bgit\s+(?:-C\s+\S+\s+)?reset\s+--hard\b/, "git reset --hard"],
    [/\bvereinsheim\b[^|;&]*\b(deploy|build|release|backup|restore)\b/, "vereinsheim deploy/build/release/backup/restore"],
    [/\bdocker\s+(?:image\s+)?push\b/, "docker push"],
    [/\bprisma\s+migrate\b/, "prisma migrate"],
  ]
  for (const [re, label] of FORBIDDEN) {
    if (re.test(code)) deny(`verbotenes Kommando im autonomen Modus: „${label}".`)
  }
}

process.exit(0)
