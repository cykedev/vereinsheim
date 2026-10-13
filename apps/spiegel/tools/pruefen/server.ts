// Den gebauten Stand dieses Checkouts als Produktions-Server starten, für die Skriptprüfung (`pruefen --start`) und das
// Lastskript (`ingest-load --start`): So sehen sie den eigenen Code und keinen Dev-Server eines anderen Checkouts.

import { spawn, type ChildProcess } from "node:child_process"
import { randomBytes } from "node:crypto"
import { existsSync, statSync } from "node:fs"
import { join } from "node:path"

export const APP_DIR = join(__dirname, "..", "..")

/**
 * Eigener Secret (Produktion verweigert den Beispielwert), die Datenbank aus `.env`. Bricht ab, wenn der Port schon
 * belegt ist oder der Server sich beendet; die letzten Zeilen seiner Fehlerausgabe stehen in der Meldung.
 */
export async function startServer(
  base: string,
  port: number,
  out: (text: string) => void
): Promise<ChildProcess> {
  const buildId = join(APP_DIR, ".next", "BUILD_ID")
  if (!existsSync(buildId))
    throw new Error("kein Build: erst pnpm --filter spiegel build (oder pnpm check)")
  const minutes = Math.round((Date.now() - statSync(buildId).mtimeMs) / 60_000)
  out(`Build von vor ${minutes} min (pnpm --filter spiegel build für den aktuellen Stand)`)
  // antwortet auf dem Port schon etwas, prüfte die Prüfung still einen fremden Stand (Review)
  const taken = await fetch(`${base}/login`).then(
    () => true,
    () => false
  )
  if (taken) throw new Error(`${base} ist schon belegt; den anderen Server erst beenden`)
  const server = spawn(
    join(APP_DIR, "node_modules", ".bin", "next"),
    ["start", "--port", String(port)],
    {
      cwd: APP_DIR,
      env: {
        ...process.env,
        NODE_ENV: "production",
        NEXTAUTH_SECRET: randomBytes(32).toString("hex"),
        NEXTAUTH_URL: base,
      },
      stdio: ["ignore", "ignore", "pipe"],
    }
  )
  // die letzten Zeilen der Fehlerausgabe, damit ein Fehlstart sagt, warum (fehlende .env, Datenbank)
  let stderr = ""
  server.stderr?.on("data", (chunk: Buffer) => {
    stderr = (stderr + chunk.toString()).slice(-2_000)
  })
  for (let i = 0; i < 120 && server.exitCode === null; i++) {
    try {
      if ((await fetch(`${base}/login`)).ok) return server
    } catch {
      // noch nicht bereit
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  server.kill()
  throw new Error(`Server auf ${base} startet nicht${stderr ? `: ${stderr.trim()}` : ""}`)
}
