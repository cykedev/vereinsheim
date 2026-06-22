#!/usr/bin/env node
// SessionStart-Hook: hält den CodeGraph-Index ohne manuelles Zutun aktuell
// (User-Präferenz: "immer indizieren, nicht selbst steuern müssen"; ADR-016 §11 —
// reproduzierbares CodeGraph-Onboarding, jetzt auf Harness-Ebene). Fehlt der Index
// (.codegraph/) → `init`, sonst `sync` (billig). Läuft DETACHED im Hintergrund, der
// Session-Start wartet nie darauf. Fail-open: fehlendes CLI / jeder Fehler → still
// exit 0, nie den Session-Start verzögern oder bricken.
import { spawn, spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

try {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()

  // codegraph ist Dev-Komfort, keine Pflicht-Abhängigkeit: ohne CLI nichts tun.
  const probe = spawnSync("codegraph", ["--version"], { stdio: "ignore" })
  if (probe.error || probe.status !== 0) process.exit(0)

  const cmd = existsSync(join(root, ".codegraph")) ? "sync" : "init"

  // Detached + unref → Indizierung läuft im Hintergrund weiter, Session startet sofort.
  const child = spawn("codegraph", [cmd], {
    cwd: root,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, CODEGRAPH_TELEMETRY: "0" },
  })
  child.unref()
} catch {
  /* fail-open: jeder Fehler → Session ungestört starten */
}

process.exit(0)
