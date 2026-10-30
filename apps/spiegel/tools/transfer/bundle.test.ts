import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { build } from "esbuild"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { transferBuildOptions } from "../build-transfer"

// Das Bündel für den Container, gebaut mit denselben Optionen wie nach `next build`: ohne Argumente Exit 2, ein
// Probelauf mit einem erfundenen Konto ohne Einheiten gegen die Dev-Datenbank (nichts geschrieben, kein `saved`).

let dir: string
let bundle: string

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "spiegel-transfer-"))
  bundle = join(dir, "transfer.mjs")
  await build(transferBuildOptions(bundle))
}, 60_000)

afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})

/** wie im Container: `NODE_ENV` production, sonst nur die Umgebung des Aufrufs */
const run = (args: string[], env: Record<string, string | undefined>, input = "") =>
  spawnSync(process.execPath, [bundle, ...args], {
    cwd: dir,
    env: { PATH: process.env.PATH, NODE_ENV: "production", ...env },
    input,
    encoding: "utf8",
    timeout: 60_000,
  })

describe("transfer.mjs", () => {
  it("ohne Argumente: Exit 2", () => {
    expect(run([], {}).status).toBe(2)
  })

  it("Probelauf mit einem erfundenen Konto: Exit 0, Speicherzeile, kein saved", async () => {
    const work = join(dir, "work")
    const files = join(dir, "files")
    await mkdir(work)
    await mkdir(files)
    await writeFile(join(work, "owners.txt"), "")
    const email = "bundle@example.invalid"
    const account = {
      user: {
        id: "bundleuser",
        name: "Erfunden",
        email,
        passwordHash: "$2b$10$erfundenerHashDerNieZuEinemPasswortPasst000000000000",
        isActive: true,
        movedToSpiegelAt: null,
      },
      sessions: [],
      goals: [],
      routines: [],
    }
    const result = run(
      ["--from", email, "--to", email, "--dry-run"],
      {
        DATABASE_URL: process.env.DATABASE_URL,
        TRANSFER_DIR: work,
        TRANSFER_FILES: files,
      },
      `${JSON.stringify(account)}\n`
    )
    expect(result.stderr).toBe("")
    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Probelauf, nichts geschrieben")
    expect(result.stdout).toMatch(/Speicher: Spitze \d+ MiB/)
    expect(existsSync(join(work, "saved"))).toBe(false)
  }, 60_000)
})
