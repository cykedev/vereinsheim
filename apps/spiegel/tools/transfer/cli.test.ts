import { randomUUID } from "node:crypto"
import { existsSync, readdirSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterAll, afterEach, describe, expect, it, vi } from "vitest"

import { createPrismaClient } from "../../src/lib/db"
import { transferCli, type TransferCliSetup } from "./cli"

// Die Wege vor der Datenbank (Aufruf, Dateien) und die Datei `saved` gegen die Dev-Datenbank: ein erfundenes Konto ohne
// Einheiten, nach dem Test gelöscht. Die Läufe selbst prüft `run.test.ts`, das Bündel `bundle.test.ts`.

const db = createPrismaClient()
const emails: string[] = []
const dirs: string[] = []

afterAll(async () => {
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.$disconnect()
  for (const dir of dirs) await rm(dir, { recursive: true, force: true })
})

const setup = (over: Partial<TransferCliSetup> = {}): TransferCliSetup => ({
  call: "Aufruf: erfunden",
  source: {
    readAccount: () => Promise.reject(new Error("nicht erwartet")),
    sessionOwners: () => Promise.reject(new Error("nicht erwartet")),
  },
  files: () => Promise.resolve(null),
  databaseUrl: "postgresql://nie@localhost:1/nie",
  reportDir: "/nie",
  savedFile: null,
  memoryLine: false,
  ...over,
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("transferCli", () => {
  it("ohne Argumente: Exit 2 mit dem Aufruf", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true)
    expect(await transferCli([], setup())).toBe(2)
    expect(stderr).toHaveBeenCalledWith("Aufruf: erfunden\n")
  })

  it("lehnen die Dateien den Aufruf ab (etwa --files im Container): Exit 2 mit ihrer Meldung", async () => {
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true)
    const code = await transferCli(
      ["--from", "a@example.invalid", "--to", "a@example.invalid", "--files", "x"],
      setup({ files: () => Promise.reject(new Error("--files gibt es nur in Dev")) })
    )
    expect(code).toBe(2)
    expect(stderr).toHaveBeenCalledWith("--files gibt es nur in Dev\n")
  })

  /** ein erfundenes Konto ohne Einheiten in einer Quelle ohne `markMoved`, Bericht und `saved` in einem Temp-Ordner */
  async function realSetup(readAccount?: () => Promise<unknown>) {
    const email = `cli-${randomUUID().slice(0, 8)}@example.invalid`
    emails.push(email)
    const dir = await mkdtemp(join(tmpdir(), "spiegel-transfer-cli-"))
    dirs.push(dir)
    const account = {
      user: {
        id: `cli${randomUUID().slice(0, 8)}`,
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
    return {
      email,
      dir,
      setup: setup({
        source: {
          readAccount: readAccount ?? (() => Promise.resolve(account)),
          sessionOwners: () => Promise.resolve(new Map()),
        },
        databaseUrl: process.env.DATABASE_URL!,
        reportDir: dir,
        savedFile: join(dir, "saved"),
      }),
    }
  }

  it("ein echter, gespeicherter Lauf legt saved an und schreibt den Bericht", async () => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true)
    const { email, dir, setup: real } = await realSetup()
    expect(await transferCli(["--from", email, "--to", email], real)).toBe(0)
    expect(existsSync(join(dir, "saved"))).toBe(true)
    expect(readdirSync(dir).filter((name) => name.endsWith(".md"))).toHaveLength(1)
    expect(await db.transferRun.count({ where: { user: { email } } })).toBe(1)
  })

  it("scheitert das Lesen des Kontos, gibt es kein saved", async () => {
    const {
      email,
      dir,
      setup: failing,
    } = await realSetup(() => Promise.reject(new Error("Export passt nicht zur E-Mail")))
    await expect(transferCli(["--from", email, "--to", email], failing)).rejects.toThrow(
      "Export passt nicht zur E-Mail"
    )
    expect(existsSync(join(dir, "saved"))).toBe(false)
  })
})
