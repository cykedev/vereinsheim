"use client"

import type { Share } from "@/lib/share-actions"

import { CardDiscipline } from "./CardDiscipline"
import { DeleteCard } from "./DeleteCard"
import { ShareCard } from "./ShareCard"

/**
 * Kasten „Diese Scheibe“ am Ende der Seite einer Scheibe, nur für den Besitzer: Disziplin, Teilen und Löschen als
 * Zeilen, fachlich vor destruktiv. Am Ende statt oben (Ausnahme zu conventions §2): Der Kopf der Seite ist voll, die
 * Aktionen braucht man selten, und jede Zeile zeigt, was gerade gilt.
 */
export function CardActions({
  cardId,
  when,
  timeZone,
  discipline,
  share,
  onShareChange,
  back,
}: {
  cardId: string
  /** Tag und Uhrzeit der Scheibe wie in Listen, für die Rückfragen */
  when: string
  timeZone: string
  discipline: Omit<Parameters<typeof CardDiscipline>[0], "cardId" | "when">
  share: Share | null
  onShareChange: (share: Share | null) => void
  /** der Rückweg nach dem Löschen */
  back: string
}) {
  return (
    <section
      data-card-actions
      aria-labelledby="card-actions-title"
      className="rounded-2xl border border-border bg-card p-4"
    >
      <h2 id="card-actions-title" className="mb-3 text-[15px] font-semibold">
        Diese Scheibe
      </h2>
      <div className="grid divide-y divide-border">
        <CardDiscipline cardId={cardId} when={when} {...discipline} />
        <ShareCard
          cardId={cardId}
          when={when}
          share={share}
          onChange={onShareChange}
          timeZone={timeZone}
        />
        <DeleteCard cardId={cardId} when={when} back={back} shared={share !== null} />
      </div>
    </section>
  )
}
