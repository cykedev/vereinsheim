"use client"

import type { CardEntryInfo } from "@/lib/entered/queries"
import type { CardEvidenceInfo } from "@/lib/evidence/queries"
import type { CardFetchInfo } from "@/lib/fetch-card/queries"
import type { Share } from "@/lib/share-actions"

import { CardDiscipline } from "./CardDiscipline"
import { CardEntry } from "./CardEntry"
import { CardEvidence } from "./CardEvidence"
import { CardFetch } from "./CardFetch"
import { CardPlace } from "./CardPlace"
import { CardPrintout } from "./CardPrintout"
import { DeleteCard } from "./DeleteCard"
import { ShareCard } from "./ShareCard"

/**
 * Kasten „Diese Scheibe“ am Ende der Seite einer Scheibe, nur für den Besitzer: Eintrag (eingetragene Scheiben), Ausdruck
 * (mit ID oder PDF), der Auftrag an die Anlage (solange es etwas zu sagen gibt), Ort (vom Ausdruck), Belege (jede Scheibe),
 * Disziplin, Teilen und Löschen als Zeilen, fachlich vor destruktiv. Am Ende statt oben (Ausnahme zu conventions §2):
 * Der Kopf der Seite ist voll, die Aktionen braucht man selten, und jede Zeile zeigt, was gerade gilt.
 */
export function CardActions({
  cardId,
  when,
  timeZone,
  discipline,
  fetch,
  entry,
  evidence = [],
  share,
  onShareChange,
  back,
}: {
  cardId: string
  /** Tag und Uhrzeit der Scheibe wie in Listen, für die Rückfragen */
  when: string
  timeZone: string
  discipline: Omit<Parameters<typeof CardDiscipline>[0], "cardId" | "when">
  /** Ausdruck und Holen (`cardFetchInfo`); null ohne */
  fetch: CardFetchInfo | null
  /** Eintrag und Ort (`cardEntryInfo`); null bei Scheiben der Anlage */
  entry?: CardEntryInfo | null
  /** die Belege in der Folge des Anhängens (`cardEvidenceList`) */
  evidence?: readonly CardEvidenceInfo[]
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
        {entry?.kind === "entered" && (
          <CardEntry cardId={cardId} from={entry.from} editable={entry.editable} />
        )}
        {fetch && (fetch.hex || fetch.printouts.length > 0) && (
          <CardPrintout hex={fetch.hex} printouts={fetch.printouts} timeZone={timeZone} />
        )}
        {fetch?.request && <CardFetch request={fetch.request} when={when} />}
        {entry?.kind === "place" && (
          <CardPlace cardId={cardId} place={entry.place} places={entry.places} />
        )}
        <CardEvidence cardId={cardId} when={when} evidence={evidence} timeZone={timeZone} />
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
