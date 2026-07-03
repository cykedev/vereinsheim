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
