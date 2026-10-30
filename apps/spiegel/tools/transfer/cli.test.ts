import { afterEach, describe, expect, it, vi } from "vitest"

import { transferCli, type TransferCliSetup } from "./cli"

// Nur die Wege vor der Datenbank: Aufruf und Dateien. Die Läufe prüft `run.test.ts`, das Bündel `bundle.test.ts`.

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
})
