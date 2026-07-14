#!/usr/bin/env node
// PreToolUse Security-Guard (ADR-018). Verweigert Lesen/Schreiben echter Secrets
// (.env, .env.local, .vereinsheim.local, generisch .env.* / *.env) und katastrophale
// rekursive Deletes (/, ~, $HOME, ., *, Secrets). Erlaubt *.example / *.template / *.sample.
// Fail-open: jeder Parse-/Logikfehler -> exit 0 (erlauben, nie bricken).
//
// Der rm-Guard und der .env-Read-Guard sind beide quote-AWARE, nicht quote-blankend: sie
// nutzen autopilot-guard.mjs's Tokenizer (bashSegments), um die Kommandozeile in Segmente
// zu splitten, und prüfen nur Segmente, deren erstes echtes Wort (nach einem optionalen
// `sudo`/`doas`-Präfix) wörtlich `rm` bzw. eines der Read-Verben ist. Das lässt eine
// Commit-Message, die `rm -rf /` oder `source .env` nur ERWÄHNT, passieren (ihr Segment
// beginnt mit `git`, nicht `rm`/`source`), ohne vorher global Quotes zu blanken — was
// früher sowohl ein legitim gequotetes Ziel wie `rm -rf "$HOME"` gelöscht hat (bestätigter
// Bypass) als auch eine Commit-Message wie `git commit -m "fix: source .env handling"`
// fälschlich geblockt hat. Der Dev-Server-Check nutzt weiterhin String-Level-Quote-Blanking
// (siehe dessen Kommentar).
import { existsSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"
import { fileURLToPath } from "node:url"
import { readInput, repoRoot, isDotenvPath } from "./_lib.mjs"
import { bashSegments } from "./autopilot-guard.mjs"

// harness:dev-servers — langlaufende Server, die nie mit `&` gebackgrounded werden
// dürfen (Orphan-Risiko; stattdessen run_in_background des Bash-Tools). Projektspezifisch
// auf unser pnpm-only-Monorepo zugeschnitten (kein npm/yarn im Einsatz).
const DEV_SERVER = /\bpnpm\b[^&|;]*\bdev\b|\bnext\s+dev\b|\bturbo\s+(run\s+dev|watch)\b/

// Katastrophal breite rm-Ziele: /, /*, ~, ~/, ~/*, $HOME(/|/*), ${HOME}(/|/*), ., ./, *.
// Ein eingegrenzter Pfad (./build, /etc/x, node_modules, ~/project) matcht bewusst nicht
// — jede Alternative matched ein GANZES Ziel-Wort, keinen Substring (Caller wenden das
// auf bereits tokenisierte Wörter an).
const DANGEROUS_TARGET = /^(\/\*?|~\/?\*?|\$\{?HOME\}?\/?\*?|\.\/?\*?|\*)$/

// Kommandos, die ihr erstes echtes Argument als eigentliches Kommando ausführen, ohne
// Interpreter-One-Liner-Quoting (bashSegments sieht `rm` also schon als eigenes Wort —
// nichts auszupacken).
const CMD_WRAPPER = /^(sudo|doas)$/
// Wertnehmende sudo/doas-Flags: das Argument NACH diesen Flags gehört noch zum Wrapper,
// nicht zum eigentlichen Kommando (`sudo -u root rm ...` — ohne diesen Sonderfall würde
// die Skip-Schleife unten bei "root" hängen bleiben und "rm" nie als c0 sehen; bestätigter
// Regressions-Fund aus /review, Juli 2026 — der alte String-weite Check hatte das per
// Zufall via `\brm\b`-Substring-Suche noch erkannt).
const CMD_WRAPPER_VALUE_FLAG = /^-[ug]$/

// Kommandos, deren Non-Flag-Argumente dieser Hook als gelesene/berührte Dateien behandelt.
const ENV_READ_VERBS = /^(cat|less|more|head|tail|nano|vim|vi|sed|awk|grep|rg|xxd|od|strings|cp|mv|source)$/

// ── Pure, testbare Helper (exportiert für pretool-guard.test.mjs) ────────────

// Jeder `rm`-Aufruf einer Kommandozeile, mit gemergten Flags und Non-Flag-Zielen. Flags
// werden über ALLE Flag-Wörter eines Segments gesammelt (sodass `rm -r -f /` erkannt
// wird, nicht nur `rm -rf /`) und case-insensitiv auf Rekursion geprüft (BSD/macOS `-R`
// zählt, nicht nur GNU `-r`). Ein optionaler führender `sudo`/`doas`-Präfix (samt dessen
// eigenen Flags) wird übersprungen, bevor auf `rm` geprüft wird.
// Nicht Interpreter-aware: `bash -c "rm -rf /"` ist für bashSegments EIN Wort (das ganze
// gequotete Script), nie ein eigenes `rm`-Segment — wird hier also nicht erkannt.
// autopilot-guard.mjs's `interpreterOneLinerViolation` schließt das für geschützte
// Pfade/Kommandos im Autopilot; dieser Hook packt One-Liner grundsätzlich nicht aus.
export function rmInvocations(cmd) {
  const out = []
  for (const seg of bashSegments(cmd)) {
    let i = 0
    while (CMD_WRAPPER.test((seg.words[i] || "").replace(/.*\//, ""))) {
      i++
      while (i < seg.words.length && seg.words[i].startsWith("-")) {
        const isValueFlag = CMD_WRAPPER_VALUE_FLAG.test(seg.words[i])
        i++
        if (isValueFlag) i++ // das Argument des Flags gehört noch zum Wrapper, nicht zum Kommando
      }
    }
    const c0 = (seg.words[i] || "").replace(/.*\//, "")
    if (c0 !== "rm") continue
    let recursive = false
    let force = false
    const targets = []
    for (const w of seg.words.slice(i + 1)) {
      if (w === "--recursive") {
        recursive = true
        continue
      }
      if (w === "--force") {
        force = true
        continue
      }
      if (/^-[a-zA-Z]+$/.test(w)) {
        if (/[rR]/.test(w)) recursive = true
        if (/f/i.test(w)) force = true
        continue
      }
      targets.push(w)
    }
    out.push({ recursive, force, targets })
  }
  return out
}

// True, wenn das Kommando einen `rm`-Aufruf enthält, der rekursiv UND force ist UND
// mindestens ein katastrophal breites Ziel benennt.
export function isDangerousRm(cmd) {
  return rmInvocations(cmd).some((inv) => inv.recursive && inv.force && inv.targets.some((t) => DANGEROUS_TARGET.test(t)))
}

// True, wenn das Kommando einen ENV_READ_VERBS-Aufruf mit einem echten .env-artigen
// Argument enthält. Segment-/Erstes-Wort-basiert wie isDangerousRm, sodass ein gequotetes
// `cat ".env"` weiterhin erkannt wird (bashSegments entquotet es zu seinem eigenen Wort),
// während ein Kommando, dessen erstes Wort KEIN Read-Verb ist — z.B.
// `git commit -m "fix: source .env handling"`, dessen Segment mit `git` beginnt — den
// Wort-Check gar nicht erst erreicht, egal was der gequotete String zufällig erwähnt.
// Nutzt isDotenvPath (aus _lib.mjs) pro Wort, deckt also automatisch auch unser
// projektspezifisches `.vereinsheim.local` ab, ohne eigene Regex dafür.
export function isEnvReadViolation(cmd) {
  for (const seg of bashSegments(cmd)) {
    let i = 0
    while (CMD_WRAPPER.test((seg.words[i] || "").replace(/.*\//, ""))) {
      i++
      while (i < seg.words.length && seg.words[i].startsWith("-")) {
        const isValueFlag = CMD_WRAPPER_VALUE_FLAG.test(seg.words[i])
        i++
        if (isValueFlag) i++ // das Argument des Flags gehört noch zum Wrapper, nicht zum Kommando
      }
    }
    const c0 = (seg.words[i] || "").replace(/.*\//, "")
    if (!ENV_READ_VERBS.test(c0)) continue
    if (seg.words.slice(i + 1).some((w) => isDotenvPath(w))) return true
  }
  return false
}

// Reiner Check (exportiert für pretool.mjs-Dispatcher + pretool-guard.test.mjs). Liefert
// { deny, reason } bei einer Verletzung, sonst { deny:false } — plus optional
// { context, contextMarker } für den einmaligen CodeGraph-Nudge (der Aufrufer schreibt den
// Marker, damit die Prüfung selbst seiteneffektfrei bleibt).
export function evaluate(input) {
  const tool = input.tool_name || ""
  const ti = input.tool_input || {}
  const ROOT = repoRoot(import.meta.url)

  if (["Read", "Edit", "Write", "NotebookEdit"].includes(tool)) {
    const p = ti.file_path || ti.notebook_path || ""
    if (isDotenvPath(p)) {
      return { deny: true, reason: `Blocked: ${p} sieht wie eine echte Secret-Datei aus. Nutze .env.example oder besorge den Wert anders.` }
    }
  }

  if (tool === "Bash") {
    const cmd = String(ti.command || "")
    // Heredoc-Bodies einmalig entfernen. Quotes bleiben erhalten für den Secret-Check
    // (ein gequoteter Pfad wie `cat ".env"` muss weiterhin erkannt werden).
    const noHeredoc = cmd.replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?^\s*\2\b/gm, "")

    if (isEnvReadViolation(noHeredoc)) {
      return { deny: true, reason: "Blocked: das Kommando greift auf eine echte Secret-Datei zu (.env* / .vereinsheim.local). Nutze .env.example oder einen anderen Pfad." }
    }
    if (isDangerousRm(noHeredoc)) {
      return { deny: true, reason: "Blocked: `rm` rekursiv+force auf ein gefährliches Ziel (/, /*, ~, $HOME, *, .). Pfad eingrenzen." }
    }

    // Backgrounding eines Dev-/Watch-Servers mit einem einzelnen `&` (nicht `&&`, nicht `2>&1`).
    // Quote-geblankt, damit eine Erwähnung von "&" in einem String nicht triggert.
    const stripped = noHeredoc.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""')
    const backgrounded = /(^|[^&>])&(?![&>])/.test(stripped)
    if (backgrounded && DEV_SERVER.test(stripped)) {
      return { deny: true, reason: "Blocked: Dev-/Watch-Server nicht mit `&` backgrounden (Orphan-Risiko). Nutze stattdessen run_in_background des Bash-Tools." }
    }
  }

  // ── Advisory-Nudge: CodeGraph statt grep/find/Read (User-Wunsch 22.06.2026) ────
  const bashSearch =
    tool === "Bash" &&
    /\b(rg|ag|ack|fd|grep|egrep|fgrep|find)\b/.test(
      String(ti.command || "")
        .replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?^\s*\2\b/gm, " ")
        .replace(/'[^']*'/g, " ")
        .replace(/"[^"]*"/g, " "),
    )
  const searchesCode = bashSearch || tool === "Grep" || tool === "Glob"

  if (searchesCode && existsSync(resolve(ROOT, ".codegraph"))) {
    const sid = String(input.session_id || "nosession").replace(/[^\w.-]/g, "_")
    const marker = join(tmpdir(), `vereinsheim-cg-nudge-${sid}`)
    if (!existsSync(marker)) {
      const msg =
        "CodeGraph ist in diesem Repo indiziert (.codegraph/). Für Symbol-, Struktur- " +
        "oder Call-Graph-Fragen ist codegraph_explore/codegraph_search meist die bessere " +
        "erste Wahl als grep/find/Read — ein Call statt einer Such-/Lese-Schleife. Reine " +
        "Textsuche (Doku, Logs, Strings) bleibt ok. (Einmalige Erinnerung pro Session.)"
      return { deny: false, context: msg, contextMarker: marker }
    }
  }
  return { deny: false }
}

async function main() {
  try {
    const input = await readInput()
    const r = evaluate(input)
    if (r.deny) {
      process.stderr.write(`${r.reason}\n`)
      process.exit(2)
    }
    if (r.context) {
      if (r.contextMarker) {
        try {
          writeFileSync(r.contextMarker, "")
        } catch {
          // best-effort: Marker-/IO-Fehler dürfen den Tool-Call nie stören (fail-open).
        }
      }
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: r.context },
        }),
      )
    }
  } catch {
    // fail-open
  }
  process.exit(0)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
