import { describe, expect, it, vi } from "vitest"

vi.mock("next-auth/middleware", () => ({ withAuth: () => () => undefined }))

const { config } = await import("./proxy")

/** wie Next den Matcher liest: der ganze Pfad muss passen; was passt, braucht eine Anmeldung */
const guarded = (path: string) => new RegExp(`^${config.matcher[0]}$`).test(path)

describe("proxy: was ohne Anmeldung geht", () => {
  it("eine geteilte Scheibe und die Anmeldung", () => {
    expect(guarded("/share/3f2b8c1e-9a4d-4e7b-8c2a-1d5e6f7a8b9c")).toBe(false)
    expect(guarded("/share")).toBe(false)
    expect(guarded("/login")).toBe(false)
    expect(guarded("/api/ingest/v1/state")).toBe(false)
  })

  it("alles andere braucht eine Anmeldung, auch Pfade, die nur mit „share“ beginnen", () => {
    for (const path of ["/", "/cards", "/cards/c1", "/shares", "/sharex/1", "/admin", "/profile"])
      expect(guarded(path)).toBe(true)
  })
})
