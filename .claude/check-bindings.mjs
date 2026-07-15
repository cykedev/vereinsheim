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
//      (stop-gate.mjs definiert seit v3 `const GATE` (ADR-025) → der GATE-No-op-Check
//      unten ist ein LIVE-Regressions-Netz und matcht nur, falls GATE je auf 'true'
//      zurückfällt. posttool-lint.mjs hat KEIN `const LINT` — der LINT-Check matcht nie.)
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
// Angepasst an unsere Monorepo-Struktur + den Vault (ADR-025: docs/ → vault/). Der
// ADR-Kanon vault/decisions/ bleibt bewusst ausgeschlossen (Meta-Kanon mit literalen
// Token-Referenzen über die Harness selbst).
//
// vault/conventions.md, vault/operations/operations.md, vault/overview.md und
// .claude/skills/sync-graph/SKILL.md sind EBENFALLS bewusst ausgeschlossen: sie tragen
// dauerhafte, legitime Doku-Konventionen, die derselben `<Großbuchstabe>`-Lexik folgen —
// JSX-Komponenten-Tags in Prosa (`<PageHeader .../>`, `<ConfirmDialog>` in conventions.md)
// und Runbook-/Instruktions-Substitutionsvariablen (`<TS>`, `<DOCKER_USER>`, `<DOMAIN>` in
// operations/overview; `<Synonyme>` als Beispiel-Template in sync-graph). Sie hier zu
// belassen würde den Checker permanent rot und damit wertlos als Regressions-Netz machen.
export const FILLABLE = [
  "CLAUDE.md",
  "vault/architecture/architecture.md",
  ".claude/skills/plan/SKILL.md",
  ".claude/skills/implement/SKILL.md",
  ".claude/skills/validate/SKILL.md",
  ".claude/skills/review/SKILL.md",
  ".claude/skills/check/SKILL.md",
  ".claude/skills/test/SKILL.md",
  ".claude/skills/debug/SKILL.md",
  ".claude/skills/commit-msg/SKILL.md",
  ".claude/skills/consolidate-lessons/SKILL.md",
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
  if (!/vault\\?\/decisions/.test(ag)) // backslash-tolerant: der Quelltext trägt das Muster als Regex-Literal (vault\/decisions\/)
    review.push("autopilot-guard.mjs (harness:protected-files) schützt den ADR-Kanon vault/decisions/ nicht mehr — das PROTECTED_FILE_PATTERN wiederherstellen.")
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
