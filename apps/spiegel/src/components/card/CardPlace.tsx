"use client"

import { MapPin } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getFieldError, getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { Sheet } from "@vereinsheim/ui/design2/sheet"
import { FieldError } from "@vereinsheim/ui/field-error"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"

import { setCardPlace } from "@/lib/card-place-actions"
import { PLACE_MAX } from "@/lib/entered/details"
import type { ActionResult } from "@/lib/types"

import { ActionRow } from "./ActionRow"

const BUTTON =
  "inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-foreground hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"

/**
 * Ort als Zeile im Kasten „Diese Scheibe“ einer Scheibe vom Ausdruck: der Freitext oder „Kein Ort angegeben“, „Ändern“
 * öffnet ein Blatt mit den eigenen Orten als Vorschlag. Eingetragene ändern den Ort im Formular, Scheiben der Anlage
 * tragen ihn über die Anlage.
 */
export function CardPlace({
  cardId,
  place,
  places,
}: {
  cardId: string
  place: string | null
  places: readonly string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(place ?? "")
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()
  const fieldError = getFieldError(result, "place")
  const general = result && "error" in result ? getGeneralError(result) : undefined

  return (
    <ActionRow
      data-card-place
      title="Ort"
      state={
        place ? (
          <span data-place-name className="font-semibold text-foreground">
            {place}
          </span>
        ) : (
          "Kein Ort angegeben"
        )
      }
      action={
        <button
          type="button"
          aria-label="Ort ändern"
          disabled={pending}
          onClick={() => {
            setValue(place ?? "")
            setResult(null)
            setOpen(true)
          }}
          className={BUTTON}
        >
          <MapPin aria-hidden className="size-4" />
          Ändern
        </button>
      }
    >
      <Sheet open={open} onClose={() => setOpen(false)} title="Ort der Scheibe">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            startTransition(async () => {
              const saved = await setCardPlace(cardId, value).catch((): ActionResult => ({
                error: "Der Ort ließ sich nicht speichern.",
              }))
              setResult(saved)
              if ("success" in saved) {
                setOpen(false)
                router.refresh()
              }
            })
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="card-place">Ort</Label>
            <Input
              id="card-place"
              list="card-places"
              autoComplete="off"
              maxLength={PLACE_MAX}
              placeholder="etwa Schützenhaus Musterdorf"
              value={value}
              disabled={pending}
              onChange={(e) => setValue(e.target.value)}
              {...(fieldError
                ? { "aria-invalid": true, "aria-describedby": "card-place-error" }
                : {})}
            />
            <datalist id="card-places">
              {places.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <FieldError id="card-place-error" message={fieldError} />
          </div>
          {general && (
            <p role="alert" className="text-sm text-destructive">
              {general}
            </p>
          )}
          <Button type="submit" className="h-10" disabled={pending}>
            {pending ? "Speichern…" : "Speichern"}
          </Button>
        </form>
      </Sheet>
    </ActionRow>
  )
}
