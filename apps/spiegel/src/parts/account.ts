// Nahtstelle für das Konto über beide Teile ([[adr-033]] „Export und Löschen umfassen beide Teile“): der Export als
// eine Datei mit dem Ergebnisteil und dem Tagebuch als eigenem Teil, und das Löschen des Kontos.

import bcrypt from "bcryptjs"

import { diaryExport } from "@/diary/export"
import type { Prisma } from "@/generated/prisma/client"
import type { Db } from "@/lib/db"
import { purgeCards } from "@/lib/db/purge"
import { resultsExport, toJson } from "@/lib/export/results"

import { transferExport } from "./transfer/ledger"

/** der Export als Strom: `{"format":"spiegel-export","version":1,…,"results":…,"diary":…,"transfer":…}` */
export function accountExport(
  db: Db,
  user: { id: string; name: string | null; email: string; createdAt: Date },
  batch?: number
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  async function* parts(): AsyncGenerator<string> {
    yield `{"format":"spiegel-export","version":1,"exportedAt":${toJson(new Date())},"account":${toJson(
      {
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      }
    )},"results":`
    yield* resultsExport(db, user.id, batch)
    yield `,"diary":${toJson(await diaryExport(db, user.id))}`
    yield `,"transfer":${toJson({ runs: await transferExport(db, user.id) })}}`
  }
  const iterator = parts()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const next = await iterator.next()
      if (next.done) controller.close()
      else controller.enqueue(encoder.encode(next.value))
    },
    async cancel() {
      await iterator.return(undefined)
    },
  })
}

export type AccountDeleteResult = "deleted" | "wrongPassword" | "lastAdmin" | "gone" | "changed"

/**
 * Das eigene Konto löschen, mit dem Passwort bestätigt. Ein Admin-Konto nur, wenn ein anderes aktives bleibt. Eine
 * Transaktion: Kontozeile sperren (ein Admin sperrt alle aktiven Admin-Konten, sonst sähen zwei gleichzeitig je das
 * andere), Zustimmungen löschen (danach nimmt das Einlesen nichts mehr an), alle eigenen Scheiben über `purgeCards`
 * mit allem, was daran hängt, dann die Kontozeile. Die Kaskade nimmt Tagebuch, Zeiträume, Wertungen, Aufträge und
 * Sperren mit; Meldungen „nicht meine“ bleiben ohne Konto. Die Dateien räumt danach `sweepUploadsSoon` auf.
 */
export async function deleteAccount(
  db: Db,
  userId: string,
  password: string
): Promise<AccountDeleteResult> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  })
  if (!user) return "gone"
  if (!(await bcrypt.compare(password, user.passwordHash))) return "wrongPassword"
  return db.$transaction(
    (tx) => deleteAccountIn(tx, userId),
    // ein großes Konto hat Tausende Scheiben, jede mit Rohdaten
    { timeout: 300_000, maxWait: 10_000 }
  )
}

/**
 * der Teil von `deleteAccount` in der Transaktion, nach der Prüfung des Passworts. Die Sperren in einer Folge: Ist das
 * Konto ein Admin, alle aktiven Admin-Zeilen nach Kennung in einer Anweisung (auch die eigene), so warten zwei Admins,
 * die sich gleichzeitig löschen, aufeinander statt über Kreuz; dann die eigene Zeile. Hat sich die Rolle dazwischen
 * geändert, geht es nicht.
 */
export async function deleteAccountIn(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<AccountDeleteResult> {
  const before = await tx.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  })
  if (!before) return "gone"
  const admin = before.role === "ADMIN" && before.isActive
  if (admin) {
    const admins = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM "User" WHERE role = 'ADMIN' AND "isActive" ORDER BY id FOR UPDATE`
    if (!admins.some((row) => row.id !== userId)) return "lastAdmin"
  }
  const [row] = await tx.$queryRaw<{ role: string; isActive: boolean }[]>`
    SELECT role::text AS role, "isActive" FROM "User" WHERE id = ${userId} FOR UPDATE`
  if (!row) return "gone"
  if ((row.role === "ADMIN" && row.isActive) !== admin) return "changed"
  await tx.sportpassConsent.deleteMany({ where: { userId } })
  const cards = await tx.card.findMany({ where: { ownerId: userId }, select: { id: true } })
  await purgeCards(
    tx,
    cards.map((card) => card.id),
    { lock: true }
  )
  await tx.user.delete({ where: { id: userId } })
  return "deleted"
}
