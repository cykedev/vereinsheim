// Nahtstelle für das Konto über beide Teile ([[adr-033]] „Export und Löschen umfassen beide Teile“): der Export als
// eine Datei mit dem Ergebnisteil und dem Tagebuch als eigenem Teil.

import { diaryExport } from "@/diary/export"
import type { Db } from "@/lib/db"
import { resultsExport, toJson } from "@/lib/export/results"

/** der Export als Strom: `{"format":"spiegel-export","version":1,…,"results":…,"diary":…}` */
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
    yield `,"diary":${toJson(await diaryExport(db, user.id))}}`
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
