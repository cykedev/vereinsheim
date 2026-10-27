"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { formatWeekdayDate, zonedDayStartMs } from "@vereinsheim/lib/format"
import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"

import { cardFetchStop } from "@/lib/admin/consequences"
import { REQUEST_STATUS_TEXT } from "@/lib/card-requests/status"
import { stopCardFetch } from "@/lib/fetch-card/actions"
import type { LegacyRequest } from "@/lib/fetch-card/queries"

/**
 * Ältere Aufträge (vor „Scheibe holen“ ohne Scheibe angelegt), die noch auf die Anlage warten: je Zeile ID, Tag und
 * Zustand mit „Nicht mehr holen“. Sobald sie enden, steht nichts mehr da; neue Aufträge stehen an ihrer Scheibe.
 */
export function LegacyRequests({
  requests,
  timeZone,
}: {
  requests: readonly LegacyRequest[]
  timeZone: string
}) {
  const router = useRouter()
  const [stopping, setStopping] = useState<LegacyRequest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const dayText = (iso: string) =>
    formatWeekdayDate(new Date(zonedDayStartMs(iso, timeZone)), timeZone)
  if (!requests.length) return null

  return (
    <section
      data-legacy-requests
      aria-labelledby="legacy-requests-title"
      className="grid gap-3 rounded-2xl border border-border bg-card p-4"
    >
      <div className="grid gap-1">
        <h2 id="legacy-requests-title" className="text-[15px] font-semibold">
          Ältere Aufträge
        </h2>
        <p className="text-sm text-foreground-2">
          Diese Scheiben hat Spiegel noch nicht von der Anlage geholt.
        </p>
      </div>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {requests.map((request) => (
          <li
            key={request.id}
            data-legacy-request
            className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <span>
              <span className="font-mono">{request.hex}</span>
              {` · ${dayText(request.day)} · ${REQUEST_STATUS_TEXT.open}`}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null)
                setStopping(request)
              }}
              className="inline-flex h-10 items-center rounded-full px-3.5 text-[13px] font-semibold text-destructive hover:bg-destructive-wash focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
            >
              Nicht mehr holen
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {stopping && (
        <DecisionDialog
          decision={cardFetchStop({ id: stopping.hex, when: dayText(stopping.day), card: false })}
          open={stopping !== null}
          onOpenChange={(open) => {
            if (!open) setStopping(null)
          }}
          onConfirm={() =>
            startTransition(async () => {
              const result = await stopCardFetch(stopping.id)
              setStopping(null)
              if ("error" in result) {
                setError(getErrorMessage(result) ?? "Das ließ sich nicht ändern.")
                return
              }
              router.refresh()
            })
          }
        />
      )}
    </section>
  )
}
