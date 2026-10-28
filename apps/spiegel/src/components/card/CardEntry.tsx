"use client"

import { Pencil } from "lucide-react"
import Link from "next/link"

import { ActionRow } from "./ActionRow"

const LINK =
  "inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-foreground hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"

/**
 * Eintrag als Zeile im Kasten „Diese Scheibe“, nur bei eingetragenen Scheiben (von Hand oder aus Treffsicher): woher die
 * Werte kommen und „Ändern“ zum Formular. Ohne „Ändern“, wenn das Formular nicht alle Angaben zeigen kann.
 */
export function CardEntry({
  cardId,
  from,
  editable,
}: {
  cardId: string
  from: "manual" | "treffsicher"
  editable: boolean
}) {
  return (
    <ActionRow
      data-card-entry={from}
      title="Eintrag"
      state={from === "manual" ? "Von Hand eingetragen" : "Aus Treffsicher übernommen"}
      action={
        editable && (
          <Link
            href={`/cards/${encodeURIComponent(cardId)}/edit`}
            aria-label="Eintrag ändern"
            className={LINK}
          >
            <Pencil aria-hidden className="size-4" />
            Ändern
          </Link>
        )
      }
    />
  )
}
