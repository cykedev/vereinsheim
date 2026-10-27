"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"

import { cardFetchDismiss, cardFetchStop } from "@/lib/admin/consequences"
import { requestRemovable, requestStateNote, requestStateText } from "@/lib/card-requests/status"
import { stopCardFetch } from "@/lib/fetch-card/actions"
import type { CardFetchInfo } from "@/lib/fetch-card/queries"

import { ActionRow } from "./ActionRow"

const BUTTON =
  "inline-flex h-10 items-center rounded-full px-3.5 text-[13px] font-semibold hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"

/**
 * „Von der Anlage“ als Zeile im Kasten „Diese Scheibe“: was mit dem Auftrag an die Brücke ist, mit einem Satz dazu.
 * Wartet er, lässt er sich beenden („Nicht mehr holen“); endete er ohne Werte, lässt sich der Hinweis entfernen. Beides
 * fragt mit Folgen, Scheibe und Ausdruck bleiben.
 */
export function CardFetch({
  request,
  when,
}: {
  request: NonNullable<CardFetchInfo["request"]>
  /** Tag und Uhrzeit der Scheibe wie in Listen, für die Rückfrage */
  when: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const { status, filled } = request
  const text = requestStateText(status, filled)
  const note = requestStateNote(status, filled)
  const removable = requestRemovable(status, filled)
  const waiting = status === "open"

  return (
    <ActionRow
      data-card-fetch
      data-fetch-status={status}
      title="Von der Anlage"
      state={
        <>
          <span className="font-semibold text-foreground">{text}</span>
          {note && <span className="block">{note}</span>}
        </>
      }
      action={
        removable && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null)
              setOpen(true)
            }}
            className={`${BUTTON} ${waiting ? "text-destructive hover:bg-destructive-wash" : "text-foreground"}`}
          >
            {waiting ? "Nicht mehr holen" : "Entfernen"}
          </button>
        )
      }
    >
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {removable && (
        <DecisionDialog
          decision={
            waiting
              ? cardFetchStop({ id: request.hex, when, card: true })
              : cardFetchDismiss({ id: request.hex, when, state: text })
          }
          open={open}
          onOpenChange={setOpen}
          onConfirm={() =>
            startTransition(async () => {
              const result = await stopCardFetch(request.id)
              if ("error" in result) {
                setError(getErrorMessage(result) ?? "Das ließ sich nicht ändern.")
                return
              }
              router.refresh()
            })
          }
        />
      )}
    </ActionRow>
  )
}
