// Wann Ringwerk eine serialisierbare Transaktion wiederholt. Die Fehler sind so gebaut, wie Prisma 7 mit
// `@prisma/adapter-pg` sie wirft; die Form beim Abschluss der Transaktion fiel erst in `pruefen:ablaeufe` auf, als zwei
// Personen zugleich speicherten und das Wiederholen nie griff.

import { beforeEach, describe, expect, it, vi } from "vitest"

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }))
vi.mock("@/lib/db", () => ({ db: { $transaction: transaction } }))

import { isConflict, serializable } from "./serializable"

/** so wirft `@prisma/adapter-pg` einen Abbruch beim COMMIT (`DriverAdapterError` aus driver-adapter-utils) */
function adapterError(cause: Record<string, unknown>) {
  const error = new Error(typeof cause.message === "string" ? cause.message : String(cause.kind))
  error.name = "DriverAdapterError"
  return Object.assign(error, { cause })
}

describe("isConflict", () => {
  it("erkennt den Abbruch beim Abschluss der Transaktion über den Adapter", () => {
    expect(isConflict(adapterError({ kind: "TransactionWriteConflict" }))).toBe(true)
  })

  it("erkennt einen Deadlock über den Adapter", () => {
    expect(
      isConflict(adapterError({ kind: "postgres", code: "40P01", message: "deadlock detected" }))
    ).toBe(true)
  })

  it("erkennt P2034 aus einer Abfrage", () => {
    expect(isConflict(Object.assign(new Error("Transaction failed"), { code: "P2034" }))).toBe(true)
  })

  it("nicht andere Fehler", () => {
    expect(isConflict(adapterError({ kind: "UniqueConstraintViolation" }))).toBe(false)
    expect(isConflict(Object.assign(new Error("Unique"), { code: "P2002" }))).toBe(false)
    expect(isConflict(new Error("kaputt"))).toBe(false)
    expect(isConflict(null)).toBe(false)
  })
})

describe("serializable", () => {
  beforeEach(() => {
    transaction.mockReset()
  })

  it("wiederholt nach einem Abbruch beim Abschluss und liefert das Ergebnis", async () => {
    transaction
      .mockRejectedValueOnce(adapterError({ kind: "TransactionWriteConflict" }))
      .mockResolvedValueOnce("ok")
    expect(await serializable(async () => "ok")).toBe("ok")
    expect(transaction).toHaveBeenCalledTimes(2)
    expect(transaction).toHaveBeenLastCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    })
  })

  it("gibt nach drei Abbrüchen auf", async () => {
    transaction.mockRejectedValue(adapterError({ kind: "TransactionWriteConflict" }))
    await expect(serializable(async () => "ok")).rejects.toThrow("TransactionWriteConflict")
    expect(transaction).toHaveBeenCalledTimes(3)
  })

  it("wiederholt andere Fehler nicht", async () => {
    transaction.mockRejectedValue(new Error("kaputt"))
    await expect(serializable(async () => "ok")).rejects.toThrow("kaputt")
    expect(transaction).toHaveBeenCalledTimes(1)
  })
})
