#!/usr/bin/env node
// Fragment-Reader für den Doku-Index (ADR-022).
//
// Statt eine ganze Doc-Datei zu lesen, druckt dies NUR den Abschnitt, auf den ein
// Graph-Pointer `→ datei.md#slug` zeigt — der Token-sparsame Einstieg. Agenten rufen
// es per Bash auf; es liest nur, hat keine Abhängigkeiten.
//
//   node .claude/doc.mjs apps/ringwerk/docs/features.md#ringteiler   # druckt den Abschnitt
//   node .claude/doc.mjs apps/ringwerk/docs/features.md              # listet alle Slugs
//
// Exit 1 + stderr, wenn die Datei fehlt oder der Slug nicht existiert (Caller merkt es).
import { readFileSync } from "node:fs"
import { headingSlugs, readFragment } from "./doc-index.mjs"

const arg = process.argv[2]
if (!arg) {
  process.stderr.write("usage: node .claude/doc.mjs <datei.md>[#<slug>]\n")
  process.exit(1)
}

const hashAt = arg.indexOf("#")
const file = hashAt === -1 ? arg : arg.slice(0, hashAt)
const slug = hashAt === -1 ? "" : arg.slice(hashAt + 1)

let md
try {
  md = readFileSync(file, "utf8")
} catch {
  process.stderr.write(`doc: Datei nicht lesbar: ${file}\n`)
  process.exit(1)
}

if (!slug) {
  // Kein Slug → alle Überschriften-Slugs auflisten (für Autoren + Tests).
  for (const h of headingSlugs(md)) {
    process.stdout.write(`${"  ".repeat(h.level - 1)}${h.slug}\n`)
  }
  process.exit(0)
}

const fragment = readFragment(md, slug)
if (fragment === null) {
  process.stderr.write(`doc: kein Abschnitt '${slug}' in ${file}\n`)
  process.exit(1)
}
process.stdout.write(fragment)
