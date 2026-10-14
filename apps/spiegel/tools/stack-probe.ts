// Grenzen von Spiegel hinter Caddy (P3, `plans/2026-10-14-spiegel-stack.md`, T9), gegen einen laufenden Stack aus
// `tools/stack-e2e/run.sh`: `BASE_URL` ist Spiegel hinter Caddy, `DATABASE_URL` seine Datenbank.
// - Grenze der App: Eine gekoppelte Brücke schickt einen Stapel mit 4,5 MiB, Spiegel antwortet 413 als JSON
//   (`too-large`), wie die Brücke es versteht.
// - Grenze von Caddy (5 MiB): Ein Körper ohne Längenangabe (chunked) mit 4,5 MiB kommt an der App an, einer mit 6 MiB
//   nicht (413). Die Anmeldung liest den ganzen Körper, darum dort.
// - Echte Adresse: Eine fehlgeschlagene Anmeldung mit gefälschtem `X-Real-IP` zählt die Ratenbegrenzung unter der
//   Adresse, die Caddy sieht, nie unter der gefälschten.
// Legt eine eigene Anlage an und räumt sie samt der gezählten Versuche wieder weg; darum nur gegen die
// Wegwerf-Datenbank des Stacks (Port 15432), sonst `--force`. Nicht im Gate.
//
//   BASE_URL=http://localhost:18082 DATABASE_URL=… pnpm --filter spiegel stack-probe

import { randomUUID } from "node:crypto"

import { createPrismaClient } from "../src/lib/db"
import { createPairing } from "../src/lib/ingest/bridges"

const out = (text = "") => process.stdout.write(`${text}\n`)
const BASE = process.env.BASE_URL
const DATABASE_URL = process.env.DATABASE_URL
const MIB = 1024 * 1024
const FORGED = "203.0.113.7"
const FORCE = process.argv.includes("--force")
/** IPv4 oder IPv6, so wie die Ratenbegrenzung sie normalisiert */
const IP = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]+$/i

/** ein Körper ohne Längenangabe: Node schickt einen Stream als `chunked` */
function chunked(bytes: number): ReadableStream<Uint8Array> {
  const piece = new TextEncoder().encode("a".repeat(64 * 1024))
  let sent = 0
  return new ReadableStream({
    pull(controller) {
      if (sent >= bytes) return controller.close()
      const next = piece.subarray(0, Math.min(piece.length, bytes - sent))
      sent += next.length
      controller.enqueue(next)
    },
  })
}

async function main() {
  if (!BASE || !DATABASE_URL) {
    out("BASE_URL und DATABASE_URL setzen (Spiegel hinter Caddy und seine Datenbank).")
    process.exit(2)
  }
  // das Aufräumen löscht alle in der Laufzeit gezählten Versuche: nie gegen eine Datenbank mit echten Konten
  if (new URL(DATABASE_URL).port !== "15432" && !FORCE) {
    out(
      "DATABASE_URL zeigt nicht auf die Wegwerf-Datenbank des Stacks (Port 15432); mit --force trotzdem."
    )
    process.exit(2)
  }
  const db = createPrismaClient(DATABASE_URL)
  const tag = randomUUID().slice(0, 8)
  const started = new Date()
  const problems: string[] = []
  const site = await db.site.create({ data: { name: `Probe ${tag}`, timeZone: "Europe/Berlin" } })
  try {
    // Grenze der App
    const { code } = await createPairing(db, {
      siteId: site.id,
      name: `Probe ${tag}`,
      createdById: null,
    })
    const pair = await fetch(`${BASE}/api/ingest/v1/pair`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contractVersion: 1, code, name: null, bridgeVersion: "probe" }),
    })
    if (!pair.ok) throw new Error(`Kopplung: ${pair.status}`)
    const { token } = (await pair.json()) as { token: string }
    const big = await fetch(`${BASE}/api/ingest/v1/snapshots`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: `{"x":"${"a".repeat(4.5 * MIB)}"}`,
    })
    const bigBody = await big.text()
    out(`Stapel 4,5 MiB: ${big.status} ${bigBody.slice(0, 80)}`)
    if (big.status !== 413 || !bigBody.includes('"too-large"'))
      problems.push(`Stapel über 4 MiB: erwartet 413 too-large, kam ${big.status}`)

    // Grenze von Caddy
    for (const [label, bytes, blocked] of [
      ["4,5 MiB", 4.5 * MIB, false],
      ["6 MiB", 6 * MIB, true],
    ] as const) {
      const response = await fetch(`${BASE}/api/auth/callback/credentials`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: chunked(bytes),
        redirect: "manual",
        duplex: "half",
      } as RequestInit & { duplex: "half" })
      const text = await response.text()
      out(`Anmeldung mit ${label} ohne Längenangabe: ${response.status}`)
      // die 413 von Caddy hat keinen JSON-Körper der App
      if (blocked && text.trimStart().startsWith("{"))
        problems.push(`Körper ${label}: 413 kam von der App, nicht von Caddy`)
      if (blocked !== (response.status === 413))
        problems.push(
          `Körper ${label}: ${blocked ? "erwartet 413 von Caddy" : "erwartet durchgelassen"}, kam ${response.status}`
        )
    }

    // echte Adresse
    const csrf = await fetch(`${BASE}/api/auth/csrf`, { headers: { "x-real-ip": FORGED } })
    const cookie = csrf.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ")
    const { csrfToken } = (await csrf.json()) as { csrfToken: string }
    const email = `probe-${tag}@example.com`
    const login = await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie,
        "x-real-ip": FORGED,
        "x-forwarded-for": FORGED,
      },
      body: new URLSearchParams({ csrfToken, email, password: "falsch", json: "true" }),
    })
    await login.arrayBuffer()
    const keys = (
      await db.loginRateLimitBucket.findMany({
        where: { lastAttemptAt: { gte: started } },
        select: { key: true },
      })
    ).map((b) => b.key)
    out(`gezählt: ${keys.join(", ") || "nichts"}`)
    if (!keys.includes(`email:${email}`)) problems.push("die Anmeldung wurde nicht gezählt")
    if (keys.some((key) => key.includes(FORGED)))
      problems.push(`die gefälschte Adresse ${FORGED} kam an`)
    const addresses = keys.filter((key) => key.startsWith("ip:")).map((key) => key.slice(3))
    if (!addresses.length) problems.push("keine Adresse gezählt")
    for (const address of addresses)
      if (!IP.test(address)) problems.push(`gezählt wurde keine Adresse: ${address}`)
  } finally {
    await db.loginRateLimitBucket.deleteMany({ where: { lastAttemptAt: { gte: started } } })
    await db.site.delete({ where: { id: site.id } })
    await db.$disconnect()
  }
  if (problems.length) {
    for (const problem of problems) out(`  FEHLER: ${problem}`)
    process.exit(1)
  }
  out("Grenzen hinter Caddy in Ordnung.")
}

main().catch((error: unknown) => {
  out(`Abbruch: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
