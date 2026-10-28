// Nahtstelle für die Aufgaben beim Start und stündlich: was das Tagebuch selbst aufräumt ([[adr-033]]).

import { purgeExpiredDiaryTrash } from "@/diary/trash"
import type { Db } from "@/lib/db"

/** abgelaufene Einträge im Papierkorb endgültig löschen; ins Log nur die Zahl und den Namen eines Fehlers */
export function diaryJobs(db: Db): void {
  void purgeExpiredDiaryTrash(db, { nowMs: Date.now() })
    .then((count) => {
      if (count) console.warn(`${count} Einträge aus dem Papierkorb endgültig gelöscht`)
    })
    .catch((error: unknown) =>
      console.error(
        "Papierkorb des Tagebuchs nicht geleert:",
        error instanceof Error ? error.name : "unbekannter Fehler"
      )
    )
}
