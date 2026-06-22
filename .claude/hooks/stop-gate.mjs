#!/usr/bin/env node
// Stop-Gate (ADR-018, ENFORCE auf Harness-Ebene): blockt das Turn-Ende, bis
// `pnpm check` grün ist (lint/format/test/tsc/next build, turbo-gecacht → billig
// bei No-Change). stop_hook_active-Guard verhindert Endlosschleifen.
// Fail-open: pnpm fehlt ODER Dev-Postgres nicht erreichbar → erlauben (nie bricken).
import { readFileSync } from "node:fs"
import { execSync } from "node:child_process"

let input = {}
try {
  input = JSON.parse(readFileSync(0, "utf8"))
} catch {
  /* fail-open weiter unten */
}

if (input.stop_hook_active) process.exit(0) // schon in einer Stop-Hook-Schleife → erlauben

try {
  execSync("pnpm check", { stdio: "pipe", timeout: 600000 })
  process.exit(0) // alle Gates grün → Stoppen erlaubt
} catch (e) {
  if (e.code === "ENOENT") process.exit(0) // kein pnpm → fail-open
  const out = ((e.stdout && e.stdout.toString()) || "") + ((e.stderr && e.stderr.toString()) || "")
  if (/ECONNREFUSED|SASL|password authentication|could not connect|Connection terminated|getaddrinfo/i.test(out)) {
    console.error(
      "[stop-gate] Dev-Postgres nicht erreichbar — Gate übersprungen (fail-open). " +
        "Starte: docker compose -f docker-compose.dev.yml up -d",
    )
    process.exit(0) // Infra (DB down) → fail-open, nicht blocken
  }
  console.error(`[stop-gate] Gates sind ROT — bitte grün ziehen, bevor du aufhörst:\n${out.slice(-2200)}`)
  process.exit(2) // blockt das Turn-Ende
}
