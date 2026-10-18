import type { Prisma } from "@/generated/prisma/client"
import { db } from "@/lib/db"

const ATTEMPTS = 3

/**
 * Ob Postgres die Transaktion wegen einer gleichzeitigen Änderung abgebrochen hat (SQLSTATE 40001, Deadlock 40P01).
 * Prisma meldet das in zwei Formen: bei einer Abfrage als `P2034`, beim Abschluss einer interaktiven Transaktion über
 * `@prisma/adapter-pg` als `DriverAdapterError` mit `cause.kind = "TransactionWriteConflict"` (Meldung ebenso).
 */
export function isConflict(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const { code, cause, message } = error as { code?: unknown; cause?: unknown; message?: unknown }
  const { kind, code: causeCode } = (typeof cause === "object" && cause !== null ? cause : {}) as {
    kind?: unknown
    code?: unknown
  }
  return (
    code === "P2034" ||
    kind === "TransactionWriteConflict" ||
    causeCode === "40001" ||
    causeCode === "40P01" ||
    /could not serialize|deadlock detected|TransactionWriteConflict/i.test(String(message ?? ""))
  )
}

/**
 * Führt `fn` in einer serialisierbaren Transaktion aus und wiederholt sie bis zu dreimal, wenn Postgres sie wegen einer
 * gleichzeitigen Änderung abbricht. Postgres bricht auch ab, wenn zwei Personen zugleich Unabhängiges speichern (etwa in
 * verschiedenen Matches oder Wettbewerben): Die Tabellen sind klein und werden ganz gelesen. Wiederholen ist nur sicher,
 * wenn `fn` alles, wovon es abhängt, selbst in der Transaktion liest.
 */
export async function serializable<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.$transaction(fn, { isolationLevel: "Serializable" })
    } catch (error) {
      if (attempt >= ATTEMPTS || !isConflict(error)) throw error
    }
  }
}
