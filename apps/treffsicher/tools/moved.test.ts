import { describe, expect, it, vi } from "vitest"

import { setMovedByEmail } from "./moved"

vi.mock("./pruefen-account", () => ({ testDb: vi.fn(), closeTestDb: vi.fn() }))

/** eine Datenbank mit einem Konto, das umgezogen ist oder nicht; sucht wie Prisma nach der E-Mail */
function fakeDb(movedToSpiegelAt: Date | null) {
  const update = vi.fn(async () => ({}))
  const findUnique = vi.fn(async ({ where }: { where: { email: string } }) =>
    where.email === "konto@treffsicher.test" ? { id: "u1", movedToSpiegelAt } : null
  )
  return { db: { user: { findUnique, update } } as never, update }
}

describe("setMovedByEmail", () => {
  it("setzt das Merkmal an einem Konto, das nicht umgezogen ist", async () => {
    const { db, update } = fakeDb(null)
    expect(await setMovedByEmail(db, " Konto@Treffsicher.test ", true)).toBe("set")
    expect(update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { movedToSpiegelAt: expect.any(Date) },
    })
  })

  it("hebt es an einem umgezogenen Konto auf", async () => {
    const { db, update } = fakeDb(new Date())
    expect(await setMovedByEmail(db, "konto@treffsicher.test", false)).toBe("cleared")
    expect(update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { movedToSpiegelAt: null } })
  })

  it("schreibt nichts, wenn der Zustand schon stimmt", async () => {
    for (const [at, on] of [
      [null, false],
      [new Date(), true],
    ] as const) {
      const { db, update } = fakeDb(at)
      expect(await setMovedByEmail(db, "konto@treffsicher.test", on)).toBe("unchanged")
      expect(update).not.toHaveBeenCalled()
    }
  })

  it("kein Konto mit dieser E-Mail", async () => {
    const { db, update } = fakeDb(null)
    expect(await setMovedByEmail(db, "fremd@treffsicher.test", true)).toBe("missing")
    expect(update).not.toHaveBeenCalled()
  })
})
