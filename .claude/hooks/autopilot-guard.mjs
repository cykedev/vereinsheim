#!/usr/bin/env node
// PreToolUse Autopilot-Guard (ADR-023, ENFORCE auf Harness-Ebene). Hart erzwungene
// Schutz-Schicht für den autonomen `/implement`-Modus: solange der Marker
// `.claude/.autopilot-active` existiert, darf der Autopilot NICHT an geschützte Pfade
// (Deploy-Vertrag, Schema/Migrationen, ADRs, Secrets, die Harness selbst, scripts/)
// und NICHT pushen/mergen/deployen/migrieren. So ist der Protected-Path-/Scope-Breaker
// ein Gate, kein Wunsch — eine *weiche* Regel versagt genau unter unbeaufsichtigtem Grinden.
//
// OHNE Marker (normaler interaktiver Betrieb, auch `/implement --step`) ist der Hook ein
// striktes No-Op. Fail-open wie der Rest der Hooks: jeder Parse-/IO-/Logikfehler -> exit 0
// (erlauben, nie bricken).
//
// Bash-Write-Erkennung ist quote-AWARE (siehe bashSegments): ein `>` innerhalb eines
// Strings ist literal, ein gequotetes Redirect-Ziel (`> "package.json"`) wird entquotet
// und geprüft. Command-Substitutionen ($( ) / Backticks) und Subshells ( ) laufen als
// eigene Segmente, sodass `foo $(rm scripts/x)` erkannt wird. writeTargets() listet jeden
// Pfad, den ein Segment SCHREIBEN würde — Redirect-Ziele (`>`, `>>`, `>|`), Datei-Argumente
// mutierender Kommandos (rm/mv/cp/tee/truncate/ln, sed -i) und dd's `of=`.
// Bekannte Restlücke (akzeptiert): ein Interpreter-One-Liner, der einen geschützten Pfad
// zur Laufzeit per String-Konkatenation baut, entgeht der Substring-Heuristik — der Guard
// ist ein Sicherheitsnetz für einen kooperativen Agenten, kein Sandbox.
import { existsSync, statSync } from "node:fs"
import { resolve, relative, isAbsolute } from "node:path"
import { fileURLToPath } from "node:url"
import { readInput, repoRoot, isDotenvPath } from "./_lib.mjs"

// Marker älter als das hier → als verwaist behandelt (fail-open). Schützt davor, dass ein
// abnormal beendeter Autopilot-Lauf (Crash/Kill/Ctrl-C vor HALT) den Guard im nächsten
// interaktiven Lauf scharf stehen lässt. Ergänzt seit diesem Sync durch
// autopilot-marker-reset.mjs (SessionStart löscht einen verwaisten Marker bei echtem
// Neustart automatisch); diese TTL bleibt als Netz für einen resumten/compacteten Lauf
// derselben Session, den der Reset-Hook nicht anfasst.
const MARKER_TTL_MS = 8 * 60 * 60 * 1000

// harness:protected-dirs — Verzeichnisse, in die kein autonomer Lauf schreiben darf.
const PROTECTED_DIRS = [".claude/", "scripts/"]
// Wortgrenzen-bewusste Varianten für den One-Liner-Blob-Check (interpreterOneLinerViolation):
// ein reiner Substring-Test (`w.includes(d)`) hätte z.B. `myscripts/foo.txt` fälschlich als
// Referenz auf `scripts/` erkannt (bestätigter False-Positive-Fund aus /review, Juli 2026).
// Der negative Lookbehind schließt aus, dass das Verzeichnis-Präfix direkt an ein
// Identifier-Zeichen geklebt ist — analog zur PLACEHOLDER-Regex in check-bindings.mjs.
const PROTECTED_DIR_RES = PROTECTED_DIRS.map((d) => new RegExp(`(?<![A-Za-z0-9_.])${d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`))

// harness:protected-files — Datei-MUSTER (nicht: flache Pfadliste), da beide Apps ihr
// eigenes prisma/schema.prisma unter apps/<app>/ tragen — ein Suffix-/Basename-Match ist
// nötig, keine Exact-Path-Gleichheit.
const PROTECTED_FILE_PATTERNS = [
  (rel) => rel.split("/").pop() === "compose.yml",
  (rel) => rel.split("/").pop() === "Caddyfile",
  (rel) => rel.split("/").pop() === "Dockerfile",
  (rel) => /(^|\/)db-init\//.test(rel),
  (rel) => /(^|\/)prisma\/schema\.prisma$/.test(rel),
  (rel) => /(^|\/)prisma\/migrations\//.test(rel),
  (rel) => rel === "docs/decisions.md",
]

// harness:protected-commands — Kommandos, die auch im Autopilot user-gated bleiben.
// [Regex, Label]-Tupel, damit deny() das konkret getroffene Kommando benennen kann.
// Das git-Pattern toleriert beliebige führende globale Flags (-c, -C, --no-pager,
// --git-dir=, --work-tree=) vor dem Subcommand, bricht aber an einem Non-Flag-Token
// (z.B. `commit -m "push"`), damit eine Message, die "push" nur erwähnt, nicht triggert.
const PROTECTED_CMDS = [
  [
    /\bgit\s+(-c\s+\S+\s+|-C\s+\S+\s+|--no-pager\s+|--git-dir=\S+\s+|--work-tree=\S+\s+)*(push|merge|rebase|reset\s+--hard)\b/,
    "git push/merge/rebase/reset --hard",
  ],
  [/\bvereinsheim\b[^|;&]*\b(deploy|build|release|backup|restore)\b/, "vereinsheim deploy/build/release/backup/restore"],
  [/\bdocker\s+(?:image\s+)?push\b/, "docker push"],
  [/\bprisma\s+migrate\b/, "prisma migrate"],
  [/\b(pnpm|npm|yarn)\s+publish\b/, "package publish"],
]

// Der eigene Lifecycle-Marker des Guards: ihn zu entfernen ist der dokumentierte
// HALT/FINALIZE-Schritt, daher nie als geschützter Write behandelt.
const MARKER_REL = ".claude/.autopilot-active"
// Interpreter, deren -c/-e/-p-One-Liner ohne Shell-Operator Dateien schreiben können.
const INTERPRETERS = /^(python[0-9.]*|node|deno|bun|perl|ruby|php|bash|sh|zsh)$/
const MUTATING = /^(rm|mv|cp|tee|truncate|ln)$/

// ── Pure, testbare Helper (exportiert für autopilot-guard.test.mjs) ──────────

// Quote-aware Tokenizer. Splittet eine Kommandozeile an UNQUOTEDEN ; | & Newline ( ) `
// und $( , und trennt pro Segment `words` von Redirect-`redirs`-Zielen. Quotes werden
// als literaler Inhalt konsumiert, sodass ein Operator innerhalb eines Strings nie
// Shell-Syntax ist, und ein gequotetes Redirect-Ziel wird ohne Quotes zurückgegeben.
// `>&n` Fd-Duplizierung ist kein Datei-Write.
export function bashSegments(cmd) {
  const segs = []
  let words = []
  let redirs = []
  let tok = ""
  let hasTok = false
  let redirNext = false
  const flush = () => {
    if (hasTok) {
      ;(redirNext ? redirs : words).push(tok)
      redirNext = false
    }
    tok = ""
    hasTok = false
  }
  const endSeg = () => {
    flush()
    if (words.length || redirs.length) segs.push({ words, redirs })
    words = []
    redirs = []
    redirNext = false
  }
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i]
    if (c === "\\") {
      tok += cmd[i + 1] || ""
      hasTok = true
      i++
      continue
    }
    if (c === "'" || c === '"') {
      const e = cmd.indexOf(c, i + 1)
      const end = e === -1 ? cmd.length : e
      tok += cmd.slice(i + 1, end)
      hasTok = true
      i = end
      continue
    }
    if (c === " " || c === "\t" || c === "\r") {
      flush()
      continue
    }
    if (c === "\n" || c === ";" || c === "(" || c === ")" || c === "`") {
      endSeg()
      continue
    }
    if (c === "|") {
      endSeg()
      if (cmd[i + 1] === "|") i++
      continue
    }
    if (c === "&") {
      endSeg()
      if (cmd[i + 1] === "&") i++
      continue
    }
    if (c === "$" && cmd[i + 1] === "(") {
      endSeg()
      i++
      continue
    }
    if (c === "<") {
      flush()
      continue
    }
    if (c === ">") {
      flush()
      let j = i + 1
      if (cmd[j] === ">" || cmd[j] === "|") j++
      if (cmd[j] === "&") {
        j++
        while (j < cmd.length && /\d/.test(cmd[j])) j++
        i = j - 1
        continue
      }
      redirNext = true
      i = j - 1
      continue
    }
    tok += c
    hasTok = true
  }
  endSeg()
  return segs
}

// Jeder Pfad, den ein Kommando SCHREIBEN würde. Pure — wendet keine Schutz-Policy an.
export function writeTargets(cmd) {
  const out = []
  for (const seg of bashSegments(cmd)) {
    for (const t of seg.redirs) out.push(t)
    const c0 = (seg.words[0] || "").replace(/.*\//, "")
    const sedInplace = c0 === "sed" && seg.words.some((w) => /^-i/.test(w))
    if (MUTATING.test(c0) || sedInplace) {
      for (const w of seg.words.slice(1)) if (!w.startsWith("-")) out.push(w)
    }
    if (c0 === "dd") {
      for (const w of seg.words) {
        const m = w.match(/^of=(.+)$/)
        if (m) out.push(m[1])
      }
    }
  }
  return out
}

// Interpreter-One-Liner (`bash -c "..."`, `python -c "..."`, ...), deren Script-Argument
// einen geschützten Pfad, ein .env-Secret oder ein geschütztes Kommando wörtlich enthält.
// Eine billige Defense-in-Depth-Heuristik, kein wasserdichter Schutz. Gibt eine
// Verletzungs-Beschreibung oder null zurück.
export function interpreterOneLinerViolation(cmd) {
  for (const seg of bashSegments(cmd)) {
    const c0 = (seg.words[0] || "").replace(/.*\//, "")
    if (!INTERPRETERS.test(c0) || !seg.words.some((w) => /^-[a-zA-Z]*[cepE]/.test(w))) continue
    for (const w of seg.words) {
      if (w === MARKER_REL) continue
      if (PROTECTED_DIR_RES.some((re) => re.test(w))) return "interpreter one-liner references a protected directory"
      if (PROTECTED_FILE_PATTERNS.some((fn) => fn(w))) return "interpreter one-liner references a protected file pattern"
      if (isDotenvPath(w)) return "interpreter one-liner references a .env/.vereinsheim.local secret"
      const blankedW = w.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""')
      if (PROTECTED_CMDS.some(([re]) => re.test(blankedW))) {
        return "interpreter one-liner runs a protected command (push/merge/rebase/reset --hard/deploy/publish/migrate)"
      }
    }
  }
  return null
}

function deny(r) {
  console.error(
    `[autopilot-guard] DENY: ${r}\n` +
      "Geschützter Pfad/Befehl im autonomen Modus — der Autopilot muss hier HALTEN, " +
      "das Ereignis ins Ledger schreiben und an den User übergeben.",
  )
  process.exit(2)
}

async function main() {
  try {
    const ROOT = repoRoot(import.meta.url)
    const marker = resolve(ROOT, ".claude", ".autopilot-active")
    if (!existsSync(marker)) process.exit(0)
    const ageMs = Date.now() - statSync(marker).mtimeMs
    if (ageMs > MARKER_TTL_MS) {
      console.error(
        `[autopilot-guard] Marker ist ${Math.round(ageMs / 3600000)}h alt → als verwaist behandelt ` +
          "(fail-open). Falls kein Autopilot läuft: `rm .claude/.autopilot-active`.",
      )
      process.exit(0)
    }

    const input = await readInput()
    const tool = input.tool_name || ""
    const ti = input.tool_input || {}

    // Pfad relativ zur Repo-Wurzel normalisieren (POSIX-Separatoren, kein führendes ./).
    const relPath = (p) => {
      if (!p) return ""
      const r = isAbsolute(String(p)) ? relative(ROOT, String(p)) : String(p)
      return r.replace(/\\/g, "/").replace(/^\.\//, "")
    }

    const isProtected = (rel, rawPath) => {
      if (!rel) return false
      // Pfad-Escape (`..` / absoluter Eltern-Tree-Pfad): NICHT als "out-of-scope"
      // durchwinken — die geschützten Ressourcen (.claude/, scripts/, compose.yml, ADRs,
      // Schema) liegen physisch auch im Eltern-Tree (der Worktree hängt unter
      // <repo>/.claude/worktrees/, ADR-024). Bei Escape gegen den vollen normalisierten
      // Pfad prüfen; unverdächtige Außen-Pfade (z.B. /tmp/x) matchen dann einfach nichts.
      const probe = rel.startsWith("..") ? String(rawPath).replace(/\\/g, "/").replace(/^\.\//, "") : rel
      if (isDotenvPath(probe)) return true
      if (PROTECTED_DIRS.some((d) => probe === d.slice(0, -1) || probe.startsWith(d))) return true
      return PROTECTED_FILE_PATTERNS.some((fn) => fn(probe))
    }

    // Ein geschriebenes Token, das auf einen geschützten Pfad zeigt (nie der Marker selbst).
    const hits = (rawPath) => {
      const rel = relPath(rawPath)
      if (!rel || rel === MARKER_REL) return false
      return isProtected(rel, rawPath)
    }

    if (["Edit", "Write", "NotebookEdit"].includes(tool)) {
      const raw = ti.file_path || ti.notebook_path || ""
      if (hits(raw)) deny(`Schreibzugriff auf geschützten Pfad „${relPath(raw)}".`)
    }

    if (tool === "Bash") {
      const cmd = String(ti.command || "")
      // Geschützte Kommandos: Quotes zuerst blanken, damit ein Verb innerhalb eines
      // Strings (eine Commit-Message, die "push" erwähnt) nie triggert.
      const blanked = cmd.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""')
      for (const [re, label] of PROTECTED_CMDS) {
        if (re.test(blanked)) deny(`verbotenes Kommando im autonomen Modus: „${label}".`)
      }

      // Direkte Writes: Redirect-Ziele + Datei-Argumente mutierender Kommandos + dd of=.
      for (const t of writeTargets(cmd)) {
        if (hits(t)) deny(`Shell-Write auf geschützten Pfad „${relPath(t)}".`)
      }

      // Interpreter-One-Liner (node -e / python -c / bash -c …) — siehe
      // interpreterOneLinerViolation für was das abdeckt und warum.
      const violation = interpreterOneLinerViolation(cmd)
      if (violation) deny(`${violation}.`)
    }
  } catch {
    // fail-open
  }
  process.exit(0)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
