#!/usr/bin/env node
// PreToolUse Security-Guard (ADR-018). Verweigert Lesen/Schreiben echter Secrets
// (.env, .env.local, .vereinsheim.local) und katastrophale rekursive Deletes
// (/, ~, $HOME, ., *, Secrets). Erlaubt *.example / *.template / *.sample.
// Fail-open: jeder Parse-/Logikfehler -> exit 0 (erlauben, nie bricken).
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

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

  // Verwaiste Dev-/Watch-Server verhindern (ADR-018-Härtung, 22.06.2026): ein per
  // `&` (Job-Control) gebackgroundeter persistenter Server entkoppelt sich vom Harness
  // (nicht mehr per TaskStop killbar) und kann mit Builds/`pnpm check` die Maschine
  // überlasten — nutze stattdessen den run_in_background-Modus des Bash-Tools.
  // Heredoc-Bodies + gequotete Strings vorher ausblenden, damit NUR echte Kommandos
  // zählen (kein Block auf Commit-Messages/echo/Test-Fixtures, die das Pattern bloß
  // erwähnen). Ein realer, unquoted `pnpm dev &` überlebt diese Reduktion.
  const code = cmd
    .replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?^\s*\2\b/gm, " ") // Heredoc <<EOF … EOF
    .replace(/'[^']*'/g, " ")
    .replace(/"[^"]*"/g, " ")
  const bgAmp = /(^|[^&>])&(?![&>])/.test(code) // Job-Control-`&`, nicht `&&`/`&>`/`2>&1`
  const devServer =
    /\bpnpm\b[^&|;]*\bdev\b/.test(code) ||
    /\bnext\s+dev\b/.test(code) ||
    /\bturbo\s+(run\s+dev|watch)\b/.test(code)
  if (bgAmp && devServer) {
    deny(
      "Dev-/Watch-Server via `&` gebackgroundet → Orphan (harness-untrackbar, " +
        "Überlast-/Reboot-Risiko). Starte ihn im run_in_background-Modus des Bash-Tools.",
    )
  }
}

// ── Advisory-Nudge: CodeGraph statt grep/find/Read (User-Wunsch 22.06.2026) ──────
// Sanfter, EINMALIGER Reminder pro Session, dass der CodeGraph-Index existiert und für
// Symbol-/Struktur-/Call-Graph-Fragen die bessere erste Wahl ist als grep/find/Read.
// Advisory: blockt NICHTS, gibt nur additionalContext aus. Reine Textsuche (Doku/Logs/
// Strings) bleibt legitim. Marker im OS-Temp pro session_id verhindert Wiederholung +
// Token-Spam. Fail-open wie der Rest der Datei: IO-Fehler dürfen nie den Call stören.
const searchesCode =
  (tool === "Bash" && /\b(rg|ag|ack|fd|grep|egrep|fgrep|find)\b/.test(String(ti.command || ""))) ||
  tool === "Grep" ||
  tool === "Glob"

if (searchesCode) {
  try {
    const sid = String(input.session_id || "nosession").replace(/[^\w.-]/g, "_")
    const marker = join(tmpdir(), `vereinsheim-cg-nudge-${sid}`)
    if (!existsSync(marker)) {
      writeFileSync(marker, "")
      const msg =
        "CodeGraph ist in diesem Repo indiziert (.codegraph/). Für Symbol-, Struktur- " +
        "oder Call-Graph-Fragen ist codegraph_explore/codegraph_search meist die bessere " +
        "erste Wahl als grep/find/Read — ein Call statt einer Such-/Lese-Schleife. Reine " +
        "Textsuche (Doku, Logs, Strings) bleibt ok. (Einmalige Erinnerung pro Session.)"
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: msg },
        }),
      )
    }
  } catch {
    // best-effort: Marker-/IO-Fehler dürfen den Tool-Call nie stören (fail-open).
  }
}

process.exit(0)
