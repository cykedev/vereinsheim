"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { formatWeekdayDate, zonedDayStartMs } from "@vereinsheim/lib/format"
import { getErrorMessage, getFieldError, getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { FieldError } from "@vereinsheim/ui/field-error"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"

import type { CardRequestStatus } from "@/generated/prisma/client"
import { cardRequest, cardRequestRemove, cardRequestWithdraw } from "@/lib/admin/consequences"
import {
  removeCardRequest,
  requestCardAction,
  withdrawCardRequest,
  type CardRequestOutcome,
} from "@/lib/card-requests/actions"
import { parseCardId } from "@/lib/card-requests/id"
import type { OwnRequest } from "@/lib/card-requests/queries"
import type { ActionResult } from "@/lib/types"

/** der Zustand eines Auftrags in Worten */
export const REQUEST_STATUS_TEXT: Readonly<Record<CardRequestStatus, string>> = {
  open: "wartet auf die Anlage",
  done: "geholt",
  missing: "nicht gefunden",
  held: "lässt sich nicht holen",
  mismatch: "an diesem Tag nicht gefunden",
  taken: "gehört zu einem anderen Konto",
  withdrawn: "zurückgezogen",
  expired: "keine Antwort von der Anlage",
  printMismatch: "passt nicht zum Ausdruck",
}

/** der Zustand eines Auftrags in Worten; offen mit Scheibe: Sie ist geholt, weitere Schüsse kommen noch nach */
export const requestStatusText = (request: Pick<OwnRequest, "status" | "cardId">) =>
  request.status === "open" && request.cardId
    ? "geholt, wird noch ergänzt"
    : REQUEST_STATUS_TEXT[request.status]

/** was nach dem Anfragen unter dem Formular steht */
function outcomeText(outcome: CardRequestOutcome): string {
  if (outcome.kind === "created") return "Spiegel holt die Scheibe, sobald die Anlage läuft."
  if (outcome.kind === "pending") return "Die Scheibe wartet schon in „Offen“."
  return outcome.deleted
    ? "Die Scheibe liegt in deinem Papierkorb."
    : "Die Scheibe liegt schon in deinem Konto."
}

const LINK =
  "font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"

/** Knopf in einer Zeile der Aufträge: zurückziehen oder entfernen */
const ROW_ACTION =
  "inline-flex h-10 items-center rounded-full px-3.5 text-[13px] font-semibold text-destructive hover:bg-destructive-wash focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"

/**
 * Scheibe per ID holen (Profil, unter der Sportpassnummer): die ID vom Ausdruck und der Tag der Scheibe, Rückfrage mit
 * Folgen, darunter die Aufträge der letzten Wochen mit Zustand. Eine geholte Scheibe ist ein Link, ein wartender Auftrag
 * lässt sich zurückziehen, ein beendeter ohne Scheibe entfernen.
 */
export function CardRequests({
  requests,
  today,
  timeZone,
}: {
  requests: OwnRequest[]
  /** heute in der Anzeige-Zone (`YYYY-MM-DD`), Vorgabe und Grenze des Tags */
  today: string
  timeZone: string
}) {
  const router = useRouter()
  const [id, setId] = useState("")
  const [day, setDay] = useState(today)
  const [idError, setIdError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [withdrawing, setWithdrawing] = useState<OwnRequest | null>(null)
  const [removing, setRemoving] = useState<OwnRequest | null>(null)
  const [state, setState] = useState<ActionResult<CardRequestOutcome> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const parsed = parseCardId(id)
  const dayText = (iso: string) =>
    formatWeekdayDate(new Date(zonedDayStartMs(iso, timeZone)), timeZone)
  const serverIdError = getFieldError(state, "id")
  const dayError = getFieldError(state, "day")
  const shownIdError = idError ?? serverIdError

  return (
    <div data-card-requests className="grid gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="grid gap-1">
        <h2 className="text-[15px] font-semibold">Scheibe per ID holen</h2>
        <p className="text-sm text-foreground-2">
          Die ID steht unten auf dem Ausdruck, etwa „ID: ff914420“. Spiegel holt genau diese Scheibe
          von der Anlage, auch ohne Sportpassnummer.
        </p>
      </div>
      <form
        data-card-request-form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          setState(null)
          if (!parsed) {
            setIdError(
              "Die ID hat acht Zeichen aus Ziffern und a bis f, wie unten auf dem Ausdruck."
            )
            return
          }
          setIdError(null)
          setAsking(true)
        }}
      >
        <div className="flex flex-wrap gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="card-request-id">ID vom Ausdruck</Label>
            <Input
              id="card-request-id"
              name="id"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="ff914420"
              className="w-44"
              value={id}
              onChange={(e) => setId(e.target.value)}
              disabled={pending}
              {...(shownIdError
                ? { "aria-invalid": true, "aria-describedby": "card-request-id-error" }
                : {})}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="card-request-day">Tag der Scheibe</Label>
            <Input
              id="card-request-day"
              name="day"
              type="date"
              max={today}
              className="w-44"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              disabled={pending}
              {...(dayError
                ? { "aria-invalid": true, "aria-describedby": "card-request-day-error" }
                : {})}
            />
          </div>
        </div>
        <FieldError id="card-request-id-error" message={shownIdError} />
        <FieldError id="card-request-day-error" message={dayError} />
        <div>
          <Button type="submit" className="h-10" disabled={pending || !day}>
            {pending ? "Holen…" : "Scheibe holen"}
          </Button>
        </div>
        {getGeneralError(state) && (
          <p role="alert" className="text-sm text-destructive">
            {getGeneralError(state)}
          </p>
        )}
        {state && "success" in state && state.data && (
          <p role="status" data-card-request-outcome className="text-sm text-foreground-2">
            {outcomeText(state.data)}{" "}
            {state.data.kind === "exists" && !state.data.deleted && (
              <Link href={`/cards/${state.data.cardId}`} className={LINK}>
                Scheibe öffnen
              </Link>
            )}
            {state.data.kind === "exists" && state.data.deleted && (
              <Link href="/profile/trash" className={LINK}>
                Zum Papierkorb
              </Link>
            )}
            {state.data.kind === "pending" && (
              <Link href="/open" className={LINK}>
                Zu „Offen“
              </Link>
            )}
          </p>
        )}
      </form>

      {requests.length > 0 && (
        <ul
          data-card-request-list
          className="divide-y divide-border rounded-xl border border-border"
        >
          {requests.map((request) => (
            <li
              key={request.id}
              data-card-request={request.status}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <span className="grid">
                <span className="font-mono">{request.hex}</span>
                <span className="text-[13px] text-muted-foreground">
                  {`${dayText(request.day)} · ${requestStatusText(request)}`}
                </span>
              </span>
              {request.cardId && (
                <Link href={`/cards/${request.cardId}`} className={LINK}>
                  Scheibe öffnen
                </Link>
              )}
              {request.status === "open" && !request.cardId && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setWithdrawing(request)}
                  className={ROW_ACTION}
                >
                  Zurückziehen
                </button>
              )}
              {request.removable && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setRemoving(request)}
                  className={ROW_ACTION}
                >
                  Entfernen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {parsed && (
        <DecisionDialog
          decision={cardRequest({ id: parsed.hex, day: day ? dayText(day) : "" })}
          open={asking}
          onOpenChange={setAsking}
          onConfirm={() =>
            startTransition(async () => {
              const result = await requestCardAction(id, day)
              setState(result)
              if ("success" in result) {
                setId("")
                router.refresh()
              }
            })
          }
        />
      )}
      {withdrawing && (
        <DecisionDialog
          decision={cardRequestWithdraw({ id: withdrawing.hex, day: dayText(withdrawing.day) })}
          open={withdrawing !== null}
          onOpenChange={(open) => {
            if (!open) setWithdrawing(null)
          }}
          onConfirm={() =>
            startTransition(async () => {
              setError(null)
              const result = await withdrawCardRequest(withdrawing.id)
              setWithdrawing(null)
              if ("error" in result) {
                setError(getErrorMessage(result) ?? "Der Auftrag ließ sich nicht zurückziehen.")
                return
              }
              router.refresh()
            })
          }
        />
      )}
      {removing && (
        <DecisionDialog
          decision={cardRequestRemove({ id: removing.hex, day: dayText(removing.day) })}
          open={removing !== null}
          onOpenChange={(open) => {
            if (!open) setRemoving(null)
          }}
          onConfirm={() =>
            startTransition(async () => {
              setError(null)
              const result = await removeCardRequest(removing.id)
              setRemoving(null)
              if ("error" in result) {
                setError(getErrorMessage(result) ?? "Der Auftrag ließ sich nicht entfernen.")
                return
              }
              router.refresh()
            })
          }
        />
      )}
    </div>
  )
}
