# Harness-Guard-Sync: Upstream-Bugfixes in unsere gebundene `.claude/`-Kopie portieren

## Kontext (Warum)

Dieses Repo wurde von der `basic-harness`-Blueprint (neteleven/basic-harness) abgeleitet und
per `/harness-init` an dieses Projekt gebunden. Seit dem letzten Sync hat der Upstream (lokal
unter `/Users/christian/repos/basic-harness`, Commits `850772e..ae6774a`) vier real ausnutzbare
Bypässe in den PreToolUse-Guards geschlossen:

1. **BSD-`-Rf`-Bypass** — die Rekursions-Erkennung verlangte ein lowercase `r`; `rm -Rf /`
   (macOS/BSD-Großschreibung) rutschte durch.
2. **Quoted-Target-Bypass** — `rm -rf "$HOME"` rutschte durch, weil das globale
   Quote-Blanking das gequotete Ziel vor der Zielprüfung zerstörte.
3. **Interpreter-One-Liner-Bypass** — `bash -c "git push"` wurde nicht als verbotenes
   Kommando erkannt, weil dasselbe globale Quote-Blanking den Inhalt der Anführungszeichen
   (den eigentlichen `git push`) vor dem Verbots-Check bereits gelöscht hatte.
4. **Zu enger `.env`-Scope** — nur exakt `.env`/`.env.local`/`.vereinsheim.local` als
   Basename wurden erkannt; `.env.production` oder ein `config.env`-artiger Name liefen
   bei Read/Edit/Write durch.

**Verifiziert**: Alle vier Bugs reproduzieren sich unabhängig auch in unserer lokalen Kopie
von `.claude/hooks/pretool-guard.mjs` und `.claude/hooks/autopilot-guard.mjs` — trotz
struktureller Divergenz vom Blueprint (unsere Dateien sind komplett auf Deutsch neu
geschrieben, mit eigener Quote-Blanking-Architektur statt Upstreams `bashSegments`-Tokenizer).

**Zusätzlich festgestellt** (User-Entscheidung, siehe unten): unsere Kopie hat gegenüber dem
aktuellen Blueprint-Stand strukturell gefehlt:
- `.claude/hooks/_lib.mjs` (gemeinsamer `readInput()`/`repoRoot()`/`isDotenvPath()`-Helper)
- `.claude/check-bindings.mjs` (Bindungs-Vollständigkeits-Checker)
- jegliche `*.test.mjs`-Testdateien unter `.claude/`
- `.claude/hooks/autopilot-marker-reset.mjs` (neuer SessionStart-Hook, räumt einen
  verwaisten Autopilot-Marker bei echtem Sessionstart auf)

`docs/harness.md`/`BLUEPRINT.md` existieren in diesem Repo nicht (nie übernommen) — die
zugehörigen Upstream-Doku-Fix-Commits (`850772e`, `9ada9dc`, `c5f7c51`) sind für uns **N/A**
und werden nicht portiert.

## Bereits getroffene Entscheidungen (User, nicht erneut aufmachen)

1. **Volle Architektur-Übernahme**: `_lib.mjs` + `bashSegments`-Tokenizer +
   exportierte Pure-Functions (`rmInvocations`/`isDangerousRm`/`writeTargets`/
   `interpreterOneLinerViolation`) werden eingeführt; unsere Guard-Dateien werden darauf
   umgebaut (nicht nur In-place-Regex-Patches).
2. **Test-Infra wird neu eingeführt**: `check-bindings.mjs` + alle `*.test.mjs`, obwohl bisher
   nicht vorhanden.
3. **`autopilot-marker-reset.mjs` wird zusätzlich eingeführt**, ergänzend zu unserer
   bestehenden 8h-TTL-Behandlung (kein Widerspruch, kein Ersatz).

## Design-Entscheidungen dieses Plans (begründet, damit keine offene Frage bleibt)

- **Sprache/Stil neuer & umgebauter Dateien**: deutsche Kommentare + unser bestehender
  Code-Stil (doppelte Anführungszeichen, keine Semikolons) — das ist die durchgängige
  Konvention aller bestehenden `.claude/*.mjs`-Dateien (`build-graph.mjs`, `doc.mjs`,
  `pretool-guard.mjs`, `autopilot-guard.mjs`, …). Funktions-/Variablennamen bleiben
  **Englisch**, damit sie 1:1 zu den 1:1 portierten Testdateien passen (die englische
  Namen importieren, z.B. `isDangerousRm`, `bashSegments`).
- **`.claude/*.mjs` ist NICHT Teil von `pnpm check`/Turborepo**: verifiziert —
  `turbo run format:check`/`lint`/`test` laufen nur über registrierte Workspace-Packages
  (`apps/*`, `packages/*`); `.claude/` ist keines. Syntax-Checks laufen daher separat über
  `node --check <datei>.mjs`, **nicht** über `bash -n` (das ist für Shell-Skripte unter
  `scripts/`, nicht für Node-`.mjs`-Hooks — CLAUDE.mds `bash -n`-Regel gilt hier nicht 1:1).
- **DEV_SERVER-Pattern in `pretool-guard.mjs` bleibt unverändert** (pnpm/next/turbo-spezifisch)
  statt auf Upstreams generischere npm/yarn/vite-Liste zu erweitern — wir nutzen in diesem
  pnpm-only-Monorepo nie npm/yarn/vite, eine Erweiterung brächte keinen Mehrwert und nur
  Regex-Komplexität.
- **`autopilot-guard.mjs`s `PROTECTED_FILES` wird zu `PROTECTED_FILE_PATTERNS`** (Array von
  Prädikat-Funktionen statt Upstreams flacher String-Liste): zwingend, weil beide Apps ihr
  eigenes `prisma/schema.prisma` unter `apps/<app>/` tragen — eine Exact-Path-Liste kann
  „endet auf `prisma/schema.prisma`, egal unter welcher App" nicht ausdrücken.
- **`PROTECTED_CMDS` bleibt `[Regex, Label]`-Tupel** (statt Upstreams flacher Regex-Liste),
  damit `deny()` weiterhin das konkret getroffene Kommando benennt (bestehende UX). Das
  git-Pattern wird dabei auf Upstreams generischere Variante angehoben (beliebige
  Kombination/Reihenfolge globaler Git-Flags vor dem Subcommand statt nur `-C`) — echte
  Verbesserung, schließt eine zusätzliche Lücke (`git --no-pager push` z.B.).
- **Pfad-Escape-Handling in `autopilot-guard.mjs` bleibt unser strengeres Verhalten**:
  Upstream behandelt jeden Pfad, der mit `..` beginnt, pauschal als „nicht geschützt"
  (`rel.startsWith('..') → return false`). Das ist für uns eine bekannte Lücke, die wir
  bereits vorher geschlossen hatten (ADR-024: Worktrees hängen unter
  `<repo>/.claude/worktrees/`, ein Escape kann dort geschützte Ressourcen im Eltern-Tree
  treffen) — **wird NICHT von Upstream übernommen**, unsere Probe-Logik bleibt bestehen.
- **`.env`-Bash-Check wird präziser** (Bonus-Fix beim Portieren): unser bisheriger Check
  prüfte `mentionsSecret` und `readsFile` unabhängig voneinander irgendwo im ganzen Kommando
  — das kann fälschlich blocken (`echo ".env ist geheim" && cat README.md`). Die neue
  Version verlangt wie Upstream, dass das Lese-Kommando und die Secret-Erwähnung im selben
  Pipeline-Segment zusammenhängen (`[^|;&]*`-Anker) — plus `source` in der Kommandoliste
  (Upstream-Fix) und `.vereinsheim.local` explizit ergänzt.
- **`check-bindings.mjs`s `FILLABLE`-Liste wird an unsere echte Monorepo-Struktur angepasst**
  (nicht 1:1 vom Blueprint übernommen, der geht von einem Single-App-Projekt mit
  `docs/overview.md`/`docs/conventions.md`/`.claude/launch.json` aus, die wir nicht haben).
  Siehe Task 5 für die konkrete Liste.
- **Die No-op-/Review-Checks in `check-bindings.mjs`** (`GATE`/`LINT`/`PROTECTED_FILES`
  auf Blueprint-Default) werden **unverändert 1:1** übernommen, obwohl sie für uns
  strukturell inert sind — unsere `stop-gate.mjs`/`posttool-lint.mjs` folgen von Anfang an
  nicht der Blueprint-Variablennamens-Konvention (`GATE`/`LINT` existieren bei uns gar
  nicht), daher matchen diese Regexe nie. Das ist sicher (kein False-Block), wird aber
  explizit im Code kommentiert, damit ein leeres Ergebnis hier nicht wie ein stiller Bug
  aussieht.
- **SessionStart-Reihenfolge**: `autopilot-marker-reset.mjs` läuft als **erster** Eintrag
  vor `codegraph-ensure.mjs`/`memory-surface.mjs` — inhaltlich ohne Wechselwirkung
  (SessionStart-Hooks laufen alle vor dem ersten Tool-Call), aber „Zustand aufräumen, bevor
  Kontext aufgebaut wird" ist die sauberere Reihenfolge.

## Required Docs (vor der Umsetzung lesen)

- [`CLAUDE.md`](../CLAUDE.md) — Hard Rules 2–4 (Feature-Branch, kein Co-Authored-By,
  Commit-Message als Fenced Block), Hard Rule 7 (PIV-Workflow, autonomer `/implement`).
- [`docs/decisions.md`](../docs/decisions.md) — ADR-016 (Harness-Herkunft), ADR-018
  (Security-Guard/Stop-Gate ENFORCE-Ebene), ADR-023 (Autopilot-Guard, autonomer
  `/implement`), ADR-024 (Worktree-Entscheidung liegt bei der Hauptsession).
- [`.claude/CLAUDE.md`](../.claude/CLAUDE.md) — CodeGraph-Hinweis (betrifft den
  CodeGraph-Nudge-Teil von `pretool-guard.mjs`, der unverändert bleibt).

## Betroffene Dateien

| Datei | Art |
|---|---|
| `.claude/hooks/_lib.mjs` | NEU |
| `.claude/hooks/autopilot-guard.mjs` | Kompletter Umbau |
| `.claude/hooks/pretool-guard.mjs` | Kompletter Umbau |
| `.claude/hooks/autopilot-guard.test.mjs` | NEU |
| `.claude/hooks/pretool-guard.test.mjs` | NEU |
| `.claude/hooks/autopilot-marker-reset.mjs` | NEU |
| `.claude/check-bindings.mjs` | NEU |
| `.claude/check-bindings.test.mjs` | NEU |
| `.claude/settings.json` | Edit (SessionStart-Hook ergänzen) |

## Branch

`feat/harness-guard-sync`, ff-only-Merge nach `main` erst nach User-OK (Hard Rule 2).
Dieser Plan ist der **erste Commit** auf dem Branch (Hard Rule / Plan-Skill-Konvention).
Sicherheitsrelevanter Guard-Code — kein direkter Patch auf `main`.

---

## Task 1 — `.claude/hooks/_lib.mjs` neu anlegen

Neue Datei, gemeinsamer Helper für alle Hooks:

```js
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
```

**Verifikation:**
```bash
node --check .claude/hooks/_lib.mjs
```

**Commit:** `feat(hooks): add shared _lib.mjs helper (readInput, repoRoot, isDotenvPath)`

---

## Task 2 — `.claude/hooks/autopilot-guard.mjs` komplett umbauen

Ersetzt den kompletten Dateiinhalt durch:

```js
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
      if (PROTECTED_DIRS.some((d) => w.includes(d))) return "interpreter one-liner references a protected directory"
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
```

**Verifikation:**
```bash
node --check .claude/hooks/autopilot-guard.mjs

# Manueller Smoke-Test: verbotenes Kommando im aktiven Autopilot wird geblockt
touch .claude/.autopilot-active
echo '{"tool_name":"Bash","tool_input":{"command":"bash -c \"git push\""}}' | node .claude/hooks/autopilot-guard.mjs; echo "exit:$?"
# erwartet: exit:2 (DENY) — vorher (altes Quote-Blanking) wäre das exit:0 (Bypass) gewesen

echo '{"tool_name":"Bash","tool_input":{"command":"echo hi"}}' | node .claude/hooks/autopilot-guard.mjs; echo "exit:$?"
# erwartet: exit:0 (harmlos)

rm .claude/.autopilot-active
echo '{"tool_name":"Bash","tool_input":{"command":"bash -c \"git push\""}}' | node .claude/hooks/autopilot-guard.mjs; echo "exit:$?"
# erwartet: exit:0 (kein Marker → No-Op)
```

**Commit:** `fix(hooks): rebuild autopilot-guard on bashSegments architecture, close interpreter one-liner bypass`

---

## Task 3 — `.claude/hooks/pretool-guard.mjs` komplett umbauen

Ersetzt den kompletten Dateiinhalt durch:

```js
#!/usr/bin/env node
// PreToolUse Security-Guard (ADR-018). Verweigert Lesen/Schreiben echter Secrets
// (.env, .env.local, .vereinsheim.local, generisch .env.* / *.env) und katastrophale
// rekursive Deletes (/, ~, $HOME, ., *, Secrets). Erlaubt *.example / *.template / *.sample.
// Fail-open: jeder Parse-/Logikfehler -> exit 0 (erlauben, nie bricken).
//
// Der rm-Guard ist quote-AWARE, nicht quote-blankend: er nutzt autopilot-guard.mjs's
// Tokenizer (bashSegments), um die Kommandozeile in Segmente zu splitten, und prüft nur
// Segmente, deren erstes Wort wörtlich `rm` ist. Das lässt eine Commit-Message, die
// `rm -rf /` nur ERWÄHNT, passieren (ihr Segment beginnt mit `git`, nicht `rm`), ohne
// vorher global Quotes zu blanken — was früher auch ein legitim gequotetes Ziel wie
// `rm -rf "$HOME"` gelöscht hat (bestätigter Bypass). Die .env-Read- und
// Dev-Server-Checks nutzen weiterhin String-Level-Matching (siehe deren Kommentare).
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

// ── Pure, testbare Helper (exportiert für pretool-guard.test.mjs) ────────────

// Jeder `rm`-Aufruf einer Kommandozeile, mit gemergten Flags und Non-Flag-Zielen. Flags
// werden über ALLE Flag-Wörter eines Segments gesammelt (sodass `rm -r -f /` erkannt
// wird, nicht nur `rm -rf /`) und case-insensitiv auf Rekursion geprüft (BSD/macOS `-R`
// zählt, nicht nur GNU `-r`).
// Nicht Interpreter-aware: `bash -c "rm -rf /"` ist für bashSegments EIN Wort (das ganze
// gequotete Script), nie ein eigenes `rm`-Segment — wird hier also nicht erkannt.
// autopilot-guard.mjs's `interpreterOneLinerViolation` schließt das für geschützte
// Pfade/Kommandos im Autopilot; dieser Hook packt One-Liner grundsätzlich nicht aus.
export function rmInvocations(cmd) {
  const out = []
  for (const seg of bashSegments(cmd)) {
    const c0 = (seg.words[0] || "").replace(/.*\//, "")
    if (c0 !== "rm") continue
    let recursive = false
    let force = false
    const targets = []
    for (const w of seg.words.slice(1)) {
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

function block(msg) {
  process.stderr.write(`${msg}\n`)
  process.exit(2)
}

async function main() {
  try {
    const input = await readInput()
    const tool = input.tool_name || ""
    const ti = input.tool_input || {}
    const ROOT = repoRoot(import.meta.url)

    if (["Read", "Edit", "Write", "NotebookEdit"].includes(tool)) {
      const p = ti.file_path || ti.notebook_path || ""
      if (isDotenvPath(p)) {
        block(`Blocked: ${p} sieht wie eine echte Secret-Datei aus. Nutze .env.example oder besorge den Wert anders.`)
      }
    }

    if (tool === "Bash") {
      const cmd = String(ti.command || "")
      // Heredoc-Bodies einmalig entfernen. Quotes bleiben erhalten für den Secret-Check
      // (ein gequoteter Pfad wie `cat ".env"` muss weiterhin erkannt werden).
      const noHeredoc = cmd.replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?^\s*\2\b/gm, "")

      const touchesSecret =
        /\b(cat|less|more|head|tail|nano|vim|vi|sed|awk|grep|rg|xxd|od|strings|cp|mv|source)\b[^|;&]*(\.env(\b|\.)|\.vereinsheim\.local\b)/.test(
          noHeredoc,
        )
      if (touchesSecret && !/\.(example|sample|template)/.test(noHeredoc)) {
        block("Blocked: das Kommando greift auf eine echte Secret-Datei zu (.env* / .vereinsheim.local). Nutze .env.example oder einen anderen Pfad.")
      }

      if (isDangerousRm(noHeredoc)) {
        block("Blocked: `rm` rekursiv+force auf ein gefährliches Ziel (/, /*, ~, $HOME, *, .). Pfad eingrenzen.")
      }

      // Backgrounding eines Dev-/Watch-Servers mit einem einzelnen `&` (nicht `&&`, nicht `2>&1`).
      // Quote-geblankt, damit eine Erwähnung von "&" in einem String nicht triggert.
      const stripped = noHeredoc.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""')
      const backgrounded = /(^|[^&>])&(?![&>])/.test(stripped)
      if (backgrounded && DEV_SERVER.test(stripped)) {
        block("Blocked: Dev-/Watch-Server nicht mit `&` backgrounden (Orphan-Risiko). Nutze stattdessen run_in_background des Bash-Tools.")
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
        try {
          writeFileSync(marker, "")
        } catch {
          // best-effort: Marker-/IO-Fehler dürfen den Tool-Call nie stören (fail-open).
        }
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
    }
  } catch {
    // fail-open
  }
  process.exit(0)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
```

**Verifikation:**
```bash
node --check .claude/hooks/pretool-guard.mjs

# BSD -Rf-Bypass (Bug 1) — muss jetzt blocken
echo '{"tool_name":"Bash","tool_input":{"command":"rm -Rf /"}}' | node .claude/hooks/pretool-guard.mjs; echo "exit:$?"
# erwartet: exit:2

# Quoted-$HOME-Bypass (Bug 2) — muss jetzt blocken
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf \"$HOME\""}}' | node .claude/hooks/pretool-guard.mjs; echo "exit:$?"
# erwartet: exit:2

# False-Positive-Regression-Check (Bonus-Fix) — darf NICHT mehr blocken
echo '{"tool_name":"Bash","tool_input":{"command":"echo \".env ist geheim\" && cat README.md"}}' | node .claude/hooks/pretool-guard.mjs; echo "exit:$?"
# erwartet: exit:0

# Narrowed path — darf nicht blocken
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf ./build"}}' | node .claude/hooks/pretool-guard.mjs; echo "exit:$?"
# erwartet: exit:0
```

**Commit:** `fix(hooks): rebuild pretool-guard on bashSegments architecture, close rm bypasses`

---

## Task 4 — Testdateien für die zwei Guards

**`.claude/hooks/pretool-guard.test.mjs`** — 1:1 aus dem Blueprint (rein generische
Pure-Function-Coverage, keine projektspezifischen Bindings):

```js
// Regression tests for pretool-guard's rm-guard. Pure-function coverage — no
// process.exit / stdin side effects. Run:
// node --test .claude/hooks/pretool-guard.test.mjs
//
// These lock in the three confirmed bypasses found in review: a quoted dangerous
// target ("$HOME"), split flags (-r -f), and BSD/macOS-style -Rf.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isDangerousRm } from './pretool-guard.mjs';

// Commands that MUST be blocked.
const MUST_BLOCK = [
	['plain', 'rm -rf /'],
	['quoted $HOME (bypass 1)', 'rm -rf "$HOME"'],
	['single-quoted $HOME', "rm -rf '$HOME'"],
	['unquoted $HOME', 'rm -rf $HOME'],
	['split flags -r -f (bypass 2)', 'rm -r -f /'],
	['split flags -f -r', 'rm -f -r /'],
	['uppercase -Rf (bypass 3)', 'rm -Rf /'],
	['uppercase -R with separate -f', 'rm -R -f /'],
	['long flags', 'rm --recursive --force /'],
	['mixed long + short', 'rm --recursive -f /'],
	['tilde', 'rm -rf ~'],
	['tilde slash', 'rm -rf ~/'],
	['bare dot', 'rm -rf .'],
	['star', 'rm -rf *'],
	['braced HOME', 'rm -rf ${HOME}'],
	['after &&', 'yarn build && rm -rf /'],
];

for (const [label, cmd] of MUST_BLOCK) {
	test(`isDangerousRm blocks: ${label}`, () => {
		assert.ok(isDangerousRm(cmd), `expected ${JSON.stringify(cmd)} to be flagged`);
	});
}

// Commands that MUST NOT be blocked — narrowed paths and non-rm mentions.
const MUST_ALLOW = [
	['narrowed relative path', 'rm -rf ./build'],
	['node_modules', 'rm -rf node_modules'],
	['narrowed home subdir', 'rm -rf ~/project'],
	['narrowed absolute path', 'rm -rf /etc/x'],
	['force only, not recursive', 'rm -f /'],
	['recursive only, not force', 'rm -r /'],
	['commit message mentions rm -rf /', 'git commit -m "fix: don\'t rm -rf / by accident"'],
	['commit message mentions -Rf', 'git commit -m "note: -Rf is dangerous"'],
	['no rm at all', 'echo "$HOME"'],
];

for (const [label, cmd] of MUST_ALLOW) {
	test(`isDangerousRm allows: ${label}`, () => {
		assert.ok(!isDangerousRm(cmd), `did not expect ${JSON.stringify(cmd)} to be flagged`);
	});
}
```

**`.claude/hooks/autopilot-guard.test.mjs`** — aus dem Blueprint übernommen **plus zwei
zusätzliche Tests** für unser projektspezifisches `.vereinsheim.local` (nicht im
Blueprint, da das unsere eigene Erweiterung von `isDotenvPath` ist):

```js
// Regression tests for the autopilot-guard Bash write-detection.
// Pure-function coverage — no marker side effects. Run:
// node --test .claude/hooks/autopilot-guard.test.mjs
// These lock in the bypasses found in review (>|, quoted targets, dd/ln, subshell,
// command substitution) and guard against false-positives on read-only commands.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bashSegments, writeTargets, interpreterOneLinerViolation } from './autopilot-guard.mjs';
import { isDotenvPath } from './_lib.mjs';

const P = 'package.json'; // stand-in protected path

// Commands whose WRITE target is the protected path — writeTargets must surface it.
const MUST_CATCH = [
	['redirect', `echo x > ${P}`],
	['append', `echo x >> ${P}`],
	['no space', `echo x >${P}`],
	['force clobber >|', `echo x >| ${P}`],
	['double-quoted target', `echo x > "${P}"`],
	["single-quoted target", `echo x > '${P}'`],
	['dd of=', `dd if=/dev/zero of=${P}`],
	['ln -sf link name', `ln -sf /evil ${P}`],
	['subshell redirect', `(echo x > ${P})`],
	['command substitution', `echo hi $(rm ${P})`],
	['backtick substitution', 'echo hi `rm ' + P + '`'],
	['tee', `cat foo | tee ${P}`],
	['sed -i', `sed -i s/a/b/ ${P}`],
	['rm after &&', `yarn build && rm -f ${P}`],
	['cp destination', `cp evil.js ${P}`],
	['fd-redirect then write', `node x 2>&1 > ${P}`],
];

for (const [label, cmd] of MUST_CATCH) {
	test(`catches write: ${label}`, () => {
		assert.ok(writeTargets(cmd).includes(P), `expected ${P} among write targets of: ${cmd}`);
	});
}

// Read-only / benign commands that merely MENTION the path — must NOT be flagged.
const MUST_ALLOW = [
	['git diff', `git diff --stat ${P}`],
	['cat', `cat ${P}`],
	['ls', `ls -la ${P}`],
	['grep for it in lock', `grep ${P} yarn.lock`],
	['echo mention', `echo "see ${P} for details"`],
	['commit message mention', `git commit -m "bump ${P} deps"`],
	['commit message with > inside', `git commit -m "a > b in ${P}"`],
	['pipeline with fd redirect', `yarn up -R form-data qs 2>&1 | tail -12`],
	['read redirect to /dev/null', `yarn check >/dev/null 2>&1`],
];

for (const [label, cmd] of MUST_ALLOW) {
	test(`allows read-only: ${label}`, () => {
		assert.ok(!writeTargets(cmd).includes(P), `did not expect ${P} among write targets of: ${cmd}`);
	});
}

test('fd-duplication is not a redirect target', () => {
	const redirs = bashSegments('echo x 2>&1').flatMap((s) => s.redirs);
	assert.deepEqual(redirs, []);
});

test('operator inside quotes stays literal (one token, no redirect)', () => {
	const segs = bashSegments('git commit -m "a > b"');
	assert.deepEqual(
		segs.flatMap((s) => s.redirs),
		[],
	);
	assert.ok(segs[0].words.includes('a > b'), 'quoted content should be a single literal word');
});

test('the autopilot marker is still surfaced by writeTargets (exemption is applied downstream)', () => {
	assert.ok(writeTargets('rm -f .claude/.autopilot-active').includes('.claude/.autopilot-active'));
});

// isDotenvPath: shared by pretool-guard.mjs and autopilot-guard.mjs — regression
// coverage for the config.env drift found in review (only pretool-guard's Bash
// command check caught it; the read-time path check and autopilot-guard's own
// check both missed it since they required a whole `.env`/`.env.*` path segment).
test('isDotenvPath catches a whole .env segment', () => {
	assert.equal(isDotenvPath('.env'), true);
	assert.equal(isDotenvPath('.env.local'), true);
	assert.equal(isDotenvPath('server/.env'), true);
});

test('isDotenvPath catches a basename ending in .env (e.g. config.env)', () => {
	assert.equal(isDotenvPath('config.env'), true);
	assert.equal(isDotenvPath('server/config.env'), true);
});

test('isDotenvPath exempts example/sample/template basenames', () => {
	assert.equal(isDotenvPath('.env.example'), false);
	assert.equal(isDotenvPath('config.env.sample'), false);
});

test('isDotenvPath does not false-positive on a filename merely containing "env"', () => {
	assert.equal(isDotenvPath('foo.env.ts'), false);
	assert.equal(isDotenvPath('environment.ts'), false);
});

// Projektspezifisch (vereinsheim): .vereinsheim.local ist unsere zweite Secret-Datei,
// nicht Teil des Blueprints — eigene Regressionsabdeckung dafür.
test('isDotenvPath catches our project-specific .vereinsheim.local', () => {
	assert.equal(isDotenvPath('.vereinsheim.local'), true);
});

test('isDotenvPath exempts a .vereinsheim.local example variant', () => {
	assert.equal(isDotenvPath('.vereinsheim.local.example'), false);
});

// interpreterOneLinerViolation: regression coverage for the confirmed bash -c / sh -c
// bypass — a bare `git push` was DENYed but wrapping it in an interpreter -c one-liner
// wasn't checked against PROTECTED_CMDS at all, only against protected paths/.env.
test('interpreterOneLinerViolation catches bash -c wrapping a protected command', () => {
	assert.ok(interpreterOneLinerViolation('bash -c "git push"'));
});

test('interpreterOneLinerViolation catches sh -c wrapping a protected command with args', () => {
	assert.ok(interpreterOneLinerViolation('sh -c "git push origin main"'));
});

test('interpreterOneLinerViolation catches zsh -c wrapping docker push', () => {
	assert.ok(interpreterOneLinerViolation('zsh -c "docker push myimage"'));
});

test('interpreterOneLinerViolation allows a benign interpreter one-liner', () => {
	assert.equal(interpreterOneLinerViolation('node -e "console.log(1)"'), null);
});

test('interpreterOneLinerViolation still catches a protected-path one-liner (no prior test coverage)', () => {
	assert.ok(interpreterOneLinerViolation('python -c "open(\'.claude/settings.json\', \'w\')"'));
});

test('interpreterOneLinerViolation does not flag a command without -c/-e/-p/-E', () => {
	assert.equal(interpreterOneLinerViolation('bash script.sh'), null);
});

test('interpreterOneLinerViolation catches a combined short-flag cluster (bash -lc, found in review)', () => {
	assert.ok(interpreterOneLinerViolation('bash -lc "git push"'));
});

test('interpreterOneLinerViolation catches -xc and node -pe combined clusters', () => {
	assert.ok(interpreterOneLinerViolation('bash -xc "git push"'));
	assert.ok(interpreterOneLinerViolation('node -pe "require(\'.claude/settings.json\')"'));
});

test('interpreterOneLinerViolation does not flag a flag cluster without c/e/p/E', () => {
	assert.equal(interpreterOneLinerViolation('bash -lx script.sh'), null);
});
```

**Verifikation:**
```bash
node --check .claude/hooks/pretool-guard.test.mjs
node --check .claude/hooks/autopilot-guard.test.mjs
node --test .claude/hooks/pretool-guard.test.mjs .claude/hooks/autopilot-guard.test.mjs
# erwartet: alle Tests grün, inkl. der 2 neuen .vereinsheim.local-Fälle
```

**Commit:** `test(hooks): add regression coverage for pretool-guard and autopilot-guard`

---

## Task 5 — `.claude/check-bindings.mjs` neu anlegen (an unsere Monorepo-Struktur angepasst)

```js
#!/usr/bin/env node
// Bindungs-Vollständigkeits-Checker (aus der basic-harness-Blueprint übernommen,
// ADR-016-Herkunft). Meldet jeden Platzhalter, den /harness-init füllen sollte, damit
// ein Setup VERIFIZIERT statt nur versprochen ist. Für dieses bereits produktiv
// gebundene Projekt dient er primär als Regressions-Netz: eine spätere Doku-Änderung
// darf keinen `<Platzhalter>`-Token stehen lassen.
//
// Vier Arten offener Bindung:
//   1. Prosa-Platzhalter — `<` + Großbuchstabe, z.B. `<GATE_FULL>` oder mehrzeilige
//      `<Satz-Prompts>`. Literale Kleinschreibung wie `feat/<topic>` oder `<file>#<slug>`
//      ist KEIN Platzhalter und wird bewusst ignoriert.
//   2. No-op Code-Bindings — die schnelle Gate ist noch `true`, das Lint-Kommando leer.
//      (Für dieses Projekt strukturell inert: unsere stop-gate.mjs/posttool-lint.mjs
//      folgen von Anfang an NICHT der Blueprint-Variablennamenskonvention, GATE/LINT
//      existieren bei uns nicht — dieser Check matcht daher nie, was hier korrekt ist.)
//   3. Stack-gekoppelte Guards noch auf dem Ausliefer-Default — exakt erkennbar, weil
//      sie Replace-Semantik haben (protected-files schützt nur docs/decisions.md).
//   4. Advisory — Judgment-Bindings, die der Checker nicht verifizieren kann, weil
//      init sie ERWEITERT statt ersetzt (Dev-Server-/Publish-Guard): zur Sichtprüfung.
//
// Exit 0 nur, wenn 1–3 alle sauber sind ("fully bound"); sonst Exit 1. NICHT in den
// Stop-Hook verdrahtet (würde bei jedem Turn triggern) — das ist ein Setup-/Audit-Gate,
// auf Zuruf laufen lassen: `node .claude/check-bindings.mjs`.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

// Dateien, die /harness-init füllt bzw. die aus dem Blueprint-Doku-Skelett stammen.
// Angepasst an unsere tatsächliche Monorepo-Struktur (nicht 1:1 vom Blueprint — der
// geht von einem Single-App-Projekt mit docs/overview.md, docs/conventions.md und
// .claude/launch.json aus, die es hier nicht gibt). docs/decisions.md bleibt bewusst
// ausgeschlossen (Meta-/ADR-Kanon mit literalen Token-Referenzen über die Harness selbst).
export const FILLABLE = [
  "CLAUDE.md",
  "docs/architecture.md",
  "docs/shared-conventions.md",
  "docs/operations.md",
  "docs/spec.md",
  ".claude/skills/plan/SKILL.md",
  ".claude/skills/implement/SKILL.md",
  ".claude/skills/validate/SKILL.md",
  ".claude/skills/review/SKILL.md",
  ".claude/skills/check/SKILL.md",
  ".claude/skills/test/SKILL.md",
  ".claude/skills/debug/SKILL.md",
  ".claude/skills/commit-msg/SKILL.md",
  ".claude/skills/consolidate-lessons/SKILL.md",
  ".claude/skills/sync-graph/SKILL.md",
  ".claude/skills/cleanup-todos/SKILL.md",
  ".claude/skills/migrate/SKILL.md",
  ".claude/skills/db-reset/SKILL.md",
  ".claude/skills/seed/SKILL.md",
]

// `<` + Großbuchstabe, dann alles bis zum nächsten `>` (kein verschachteltes `<`/`>`) —
// spannt mehrzeilige Prompts, stoppt aber am ersten Close. `<!-- Kommentare -->` starten
// mit `<!`, literales `<topic>`/`<file>` startet klein — beides korrekt übersprungen.
// Der negative Lookbehind schließt ein `<...>` aus, das direkt an ein Identifier-Zeichen
// (Buchstabe/Ziffer/`_`) davor geklebt ist — das ist generische Typsyntax, die ein
// gebundenes Projekt in eigener Doku enthalten kann (`Vec<String>`, `Promise<T>`,
// `HashMap<K, V>`), lexikalisch identisch zu einem Platzhalter wie `<Name>`/`<T>` sonst.
// Jeder echte Platzhalter hier ist von Whitespace, einem Backtick, einem Pipe, Interpunktion
// oder Zeilenanfang umgeben — nie von einem Identifier.
export const PLACEHOLDER = /(?<![A-Za-z0-9_])<[A-Z][^<>]*>/g

const read = (p) => {
  try {
    return readFileSync(resolve(ROOT, p), "utf8")
  } catch {
    return null
  }
}

function main() {
  const unfilled = []
  for (const rel of FILLABLE) {
    const text = read(rel)
    if (text == null) continue
    for (const m of text.matchAll(PLACEHOLDER)) {
      const line = text.slice(0, m.index).split("\n").length
      const token = m[0].replace(/\s+/g, " ").slice(0, 60)
      unfilled.push({ file: rel, line, token })
    }
  }

  const noop = []
  const sg = read(".claude/hooks/stop-gate.mjs") ?? ""
  if (/const GATE = \{ command: 'true'/.test(sg))
    noop.push("stop-gate.mjs (harness:gate-fast) ist noch 'true' — die schnelle Gate ist ein NO-OP.")
  const pl = read(".claude/hooks/posttool-lint.mjs") ?? ""
  const lintOff = /const LINT = \{ command: ''/.test(pl)
  if (lintOff) noop.push("posttool-lint.mjs (harness:lint) ist noch '' — der Edit-Linter ist AUS.")

  const review = []
  const ag = read(".claude/hooks/autopilot-guard.mjs") ?? ""
  if (/const PROTECTED_FILES = \['docs\/decisions\.md'\];/.test(ag))
    review.push("autopilot-guard.mjs (harness:protected-files) schützt nur docs/decisions.md — Lockfile/Manifest/Build-Config ergänzen.")
  if (!lintOff && /const LINT_EXT = \[\];/.test(pl))
    review.push("posttool-lint.mjs (harness:lint-ext) ist [] — der Linter läuft auf JEDER editierten Datei.")

  const advisory = [
    "dev-servers (pretool-guard, harness:dev-servers): läuft auf pnpm/next/turbo — bei neuem Toolchain-Teil ergänzen.",
    "protected-commands (autopilot-guard, harness:protected-commands): deckt git/vereinsheim/docker/prisma/publish ab — bei neuem Deploy-Pfad ergänzen.",
  ]

  const blocking = unfilled.length + noop.length + review.length

  if (!blocking) {
    process.stdout.write("✓ check-bindings: vollständig gebunden — keine Platzhalter oder unangetasteten Defaults.\n")
    process.stdout.write("  Per Auge bestätigen (der Checker kann das nicht verifizieren — init erweitert, ersetzt nicht):\n")
    for (const a of advisory) process.stdout.write(`  · ${a}\n`)
    process.exit(0)
  }

  if (unfilled.length) {
    process.stderr.write(`✖ ${unfilled.length} ungefüllte(r) Platzhalter:\n`)
    for (const u of unfilled) process.stderr.write(`  ${u.file}:${u.line}  ${u.token}\n`)
  }
  if (noop.length) {
    process.stderr.write("\n⚠ Code-Bindings noch auf permissivem No-op-Default:\n")
    for (const w of noop) process.stderr.write(`  - ${w}\n`)
  }
  if (review.length) {
    process.stderr.write("\n⚠ Stack-gekoppelte Guards noch auf Ausliefer-Default:\n")
    for (const w of review) process.stderr.write(`  - ${w}\n`)
  }
  process.stderr.write("\n· Zusätzlich per Auge bestätigen:\n")
  for (const a of advisory) process.stderr.write(`  · ${a}\n`)
  process.stderr.write(
    "\nJeden Punkt oben beheben — oder, falls ein Wert noch nicht existieren kann,\n" +
      "eine Zeile in .claude/tasks/todo.md ergänzen, damit es nicht stillschweigend vergessen wird.\n",
  )
  process.exit(1)
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
```

**`.claude/check-bindings.test.mjs`** — 1:1 aus dem Blueprint (reine Regex-Regression, keine
projektspezifischen Bindings):

```js
// Regression tests for check-bindings' placeholder regex. Run:
// node --test .claude/check-bindings.test.mjs
//
// Locks in the fix for a confirmed false-positive: a bound project's own docs may
// contain generic-type syntax (Vec<String>, Promise<T>) that is lexically identical
// to a placeholder like <Name> or <T> — distinguished only by whether the `<` is
// glued directly to an identifier character.
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PLACEHOLDER } from './check-bindings.mjs';

const matches = (text) => [...text.matchAll(PLACEHOLDER)].map((m) => m[0]);

test('does not flag generic-type syntax glued to an identifier', () => {
	assert.deepEqual(matches('Vec<String>'), []);
	assert.deepEqual(matches('Promise<T>'), []);
	assert.deepEqual(matches('HashMap<K, V>'), []);
	assert.deepEqual(matches('a function returning Array<Number>'), []);
});

test('still flags a real UPPER_SNAKE placeholder', () => {
	assert.deepEqual(matches('<GATE_FULL>'), ['<GATE_FULL>']);
	assert.deepEqual(matches('the command `<DEV_CMD>` runs'), ['<DEV_CMD>']);
});

test('still flags a table-row Capitalized placeholder', () => {
	assert.deepEqual(matches('| <Name> | <What it owns> | <Path> |'), ['<Name>', '<What it owns>', '<Path>']);
});

test('still flags a multi-line prose prompt', () => {
	const text = '<One paragraph: what it does.\nMore detail on the next line.>';
	assert.deepEqual(matches(text), [text]);
});

test('does not flag literal lowercase forms (pre-existing exclusion, unaffected by the lookbehind)', () => {
	assert.deepEqual(matches('feat/<topic>'), []);
	assert.deepEqual(matches('<file>#<slug>'), []);
});
```

**Verifikation:**
```bash
node --check .claude/check-bindings.mjs
node --check .claude/check-bindings.test.mjs
node --test .claude/check-bindings.test.mjs
# erwartet: alle 5 Tests grün

node .claude/check-bindings.mjs
# Beobachten, nicht blind grün erwarten: da wir seit Monaten produktiv sind, ist exit 0
# wahrscheinlich, aber falls hier etwas gemeldet wird, ist das ein ECHTER Befund (z.B. ein
# vergessener Platzhalter in einem SKILL.md) — untersuchen, nicht stillschweigend ignorieren.
```

**Commit:** `feat(hooks): add check-bindings.mjs adapted to the monorepo FILLABLE set`

---

## Task 6 — `autopilot-marker-reset.mjs` neu anlegen + in `settings.json` verdrahten

**`.claude/hooks/autopilot-marker-reset.mjs`** (NEU):

```js
#!/usr/bin/env node
// SessionStart-Ergänzung zu ADR-023: ein wirklich frischer Sessionstart
// (source === "startup") ist per Definition nie mitten in einem Autopilot-Lauf — daher
// einen verwaisten .claude/.autopilot-active-Marker aufräumen, den ein abgestürzter
// Autopilot-Lauf (Crash/Kill/Ctrl-C) vor FINALIZE/HALT hinterlassen hat. Ein
// `resume`/`compact` DERSELBEN Session wird NICHT angefasst — die kann legitim noch
// autonom laufen. Ergänzt (ersetzt nicht) die bestehende 8h-TTL-Behandlung in
// autopilot-guard.mjs, die einen resumten/compacteten Lauf derselben Session weiter
// als fail-open behandelt. Fail-open.
import { existsSync, rmSync } from "node:fs"
import { resolve } from "node:path"
import { readInput, repoRoot } from "./_lib.mjs"

try {
  const input = await readInput()
  if (input.source === "startup") {
    const marker = resolve(repoRoot(import.meta.url), ".claude", ".autopilot-active")
    if (existsSync(marker)) rmSync(marker)
  }
} catch {
  // fail-open
}
process.exit(0)
```

**`.claude/settings.json`** — SessionStart-Array erweitern (bestehende Einträge bleiben,
neuer Hook läuft zuerst):

Ersetze im bestehenden `"SessionStart"`-Block:
```json
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/codegraph-ensure.mjs\""
          },
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/memory-surface.mjs\""
          }
        ]
      }
    ],
```
durch:
```json
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/autopilot-marker-reset.mjs\""
          },
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/codegraph-ensure.mjs\""
          },
          {
            "type": "command",
            "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/memory-surface.mjs\""
          }
        ]
      }
    ],
```
Alle anderen Hook-Blöcke (`PreToolUse`, `PostToolUse`, `Stop`) und der `permissions`-Block
bleiben unverändert.

**Verifikation:**
```bash
node --check .claude/hooks/autopilot-marker-reset.mjs
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')); console.log('valid JSON')"

# Fresh-Session-Reset: Marker wird gelöscht
touch .claude/.autopilot-active
echo '{"source":"startup"}' | node .claude/hooks/autopilot-marker-reset.mjs
test -f .claude/.autopilot-active && echo "FAIL: Marker noch da" || echo "OK: Marker entfernt"

# Resume/Compact: Marker bleibt
touch .claude/.autopilot-active
echo '{"source":"resume"}' | node .claude/hooks/autopilot-marker-reset.mjs
test -f .claude/.autopilot-active && echo "OK: Marker erhalten" || echo "FAIL: Marker fälschlich entfernt"
rm -f .claude/.autopilot-active
```

**Commit:** `feat(hooks): add autopilot-marker-reset SessionStart hook, wire into settings.json`

---

## Task 7 — Gesamt-Verifikation (Abschluss von `/implement`, vor `/validate`)

```bash
# Alle Hook-Dateien syntaktisch valide
node --check .claude/hooks/_lib.mjs .claude/hooks/pretool-guard.mjs \
  .claude/hooks/autopilot-guard.mjs .claude/hooks/autopilot-marker-reset.mjs \
  .claude/check-bindings.mjs

# Komplette Testsuite grün
node --test .claude/hooks/pretool-guard.test.mjs .claude/hooks/autopilot-guard.test.mjs \
  .claude/check-bindings.test.mjs

# Bindungs-Check läuft durch (Befund beobachten, siehe Task 5)
node .claude/check-bindings.mjs

# Die vier ursprünglichen Bugs erneut end-to-end bestätigen
echo '{"tool_name":"Bash","tool_input":{"command":"rm -Rf /"}}' | node .claude/hooks/pretool-guard.mjs; echo "Bug1 exit:$?"        # erwartet 2
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf \"$HOME\""}}' | node .claude/hooks/pretool-guard.mjs; echo "Bug2 exit:$?"  # erwartet 2
touch .claude/.autopilot-active
echo '{"tool_name":"Bash","tool_input":{"command":"bash -c \"git push\""}}' | node .claude/hooks/autopilot-guard.mjs; echo "Bug3 exit:$?"  # erwartet 2
rm .claude/.autopilot-active
echo '{"tool_name":"Edit","tool_input":{"file_path":"config.env"}}' | node .claude/hooks/pretool-guard.mjs; echo "Bug4 exit:$?"      # erwartet 2

# Turborepo-Gates unverändert grün (Sanity — .claude/ ist nicht Teil davon, darf also nicht
# kaputtgehen)
pnpm check
```

Kein separater Commit nötig, sofern alles grün ist (reine Verifikation). Falls
`node .claude/check-bindings.mjs` einen echten Befund liefert (z.B. eine vergessene
`<Platzhalter>`-Stelle in einem SKILL.md), diesen Befund dem User im Übergabe-Ledger
explizit nennen — nicht stillschweigend „grün melden".

---

## Nächste PIV-Schritte (nicht Teil dieses Plans)

Nach erfolgreichem `/implement` folgt `/validate` (End-to-End-Verhalten der Guards im
echten Claude-Code-Reload gegenprüfen — Hooks greifen erst ab dem nächsten Reload) und
danach `/review` (adversarial gegen den Branch-Diff, insbesondere Blick auf die
projektspezifischen Abweichungen von Upstream: `PROTECTED_FILE_PATTERNS`,
`PROTECTED_CMDS`-Tupel, Pfad-Escape-Probe, FILLABLE-Liste). Merge nach `main` erst nach
explizitem User-OK (Hard Rule 2).
