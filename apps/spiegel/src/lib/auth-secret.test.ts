import { afterEach, describe, expect, it, vi } from "vitest"

/** das Modul frisch laden: Es prüft beim Laden */
async function load(env: Record<string, string | undefined>) {
  vi.resetModules()
  for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value)
  return import("./auth-secret")
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("AUTH_SECRET", () => {
  it("lokal ohne eigenen Wert der Beispielwert, in Produktion keiner", async () => {
    const dev = await load({ NODE_ENV: "development", NEXTAUTH_SECRET: undefined })
    expect(dev.AUTH_SECRET).toMatch(/.{32}/)
    const prod = await load({ NODE_ENV: "production", NEXTAUTH_SECRET: undefined })
    expect(prod.AUTH_SECRET).toBeUndefined()
  })

  it("der Beispielwert läuft in Produktion nicht, baut aber (next build liest die lokale .env)", async () => {
    const { AUTH_SECRET: example } = await load({
      NODE_ENV: "development",
      NEXTAUTH_SECRET: undefined,
    })
    await expect(
      load({ NODE_ENV: "production", NEXTAUTH_SECRET: example, NEXT_PHASE: undefined })
    ).rejects.toThrow(/Beispielwert/)
    const building = await load({
      NODE_ENV: "production",
      NEXTAUTH_SECRET: example,
      NEXT_PHASE: "phase-production-build",
    })
    expect(building.AUTH_SECRET).toBe(example)
    const own = await load({
      NODE_ENV: "production",
      NEXTAUTH_SECRET: "ein-eigener-wert-fuer-den-server-xyz",
    })
    expect(own.AUTH_SECRET).toBe("ein-eigener-wert-fuer-den-server-xyz")
  })
})
