// Schreibt den erzeugten Hauptteil in den Vault-Leitfaden: pnpm --filter @vereinsheim/shot-help docs.
// Nur der Abschnitt zwischen den Markern ändert sich; fehlen sie, bricht das Skript ab.

import { readFileSync, writeFileSync } from "node:fs"

import { GUIDE_FILE, guideSection, renderGuideMarkdown, replaceGuideSection } from "../src/markdown"

const out = (text = "") => process.stdout.write(`${text}\n`)

const file = new URL(`../../../${GUIDE_FILE}`, import.meta.url)
const note = readFileSync(file, "utf8")

if (guideSection(note) === null) {
  console.error(`${GUIDE_FILE}: Marker fehlen oder sind doppelt, nichts geschrieben.`)
  process.exitCode = 1
} else {
  const next = replaceGuideSection(note, renderGuideMarkdown())
  if (next === note) out(`${GUIDE_FILE} ist aktuell.`)
  else {
    writeFileSync(file, next)
    out(`${GUIDE_FILE} neu geschrieben.`)
  }
}
