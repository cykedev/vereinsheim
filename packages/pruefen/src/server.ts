// Den gebauten Stand einer App dieses Checkouts als Produktions-Server starten, für die Skriptprüfung (`pruefen --start`)
// und Lastskripte (`ingest-load --start`): So sehen sie den eigenen Code und keinen Dev-Server eines anderen Checkouts.

import { spawn, type ChildProcess } from "node:child_process"
import { randomBytes } from "node:crypto"
import { existsSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

/** Wurzel des Monorepos (dieses Paket liegt unter `packages/pruefen/src`) */
const ROOT = fileURLToPath(new URL("../../..", import.meta.url))

/** Ordner einer App, etwa `appDir("spiegel")` */
export const appDir = (app: string) => join(ROOT, "apps", app)

/**
 * Eigener Secret (Produktion verweigert den Beispielwert), die Datenbank aus `.env`. Bricht ab, wenn der Port schon
 * belegt ist oder der Server sich beendet; die letzten Zeilen seiner Fehlerausgabe stehen in der Meldung.
 */
export async function startServer({
  app,
  port,
  base = `http://localhost:${port}`,
  secret = randomBytes(32).toString("hex"),
  hostname,
  out,
}: {
  app: string
  port: number
  /** Adresse, unter der der Server antwortet; Vorgabe `http://localhost:<port>` */
  base?: string
  /** `NEXTAUTH_SECRET` des Servers; Vorgabe ein zufälliger. Wer ihn kennt, kann selbst Sitzungen ausstellen */
  secret?: string
  /** Adresse, an die der Server bindet, etwa `127.0.0.1`; Vorgabe wie `next start` (alle) */
  hostname?: string
  out: (text: string) => void
}): Promise<ChildProcess> {
  const dir = appDir(app)
  const buildId = join(dir, ".next", "BUILD_ID")
  if (!existsSync(buildId))
    throw new Error(`kein Build: erst pnpm --filter ${app} build (oder pnpm check)`)
  const minutes = Math.round((Date.now() - statSync(buildId).mtimeMs) / 60_000)
  out(`Build von vor ${minutes} min (pnpm --filter ${app} build für den aktuellen Stand)`)
  // antwortet auf dem Port schon etwas, prüfte die Prüfung still einen fremden Stand
  const taken = await fetch(`${base}/login`).then(
    () => true,
    () => false
  )
  if (taken) throw new Error(`${base} ist schon belegt; den anderen Server erst beenden`)
  const server = spawn(
    join(dir, "node_modules", ".bin", "next"),
    ["start", "--port", String(port), ...(hostname ? ["--hostname", hostname] : [])],
    {
      cwd: dir,
      env: {
        ...process.env,
        NODE_ENV: "production",
        NEXTAUTH_SECRET: secret,
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
