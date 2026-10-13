"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState, useTransition } from "react"

import { getErrorMessage, getFieldError, getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { FieldError } from "@vereinsheim/ui/field-error"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"

import type { ConsentRow } from "@/lib/admin/site"
import { addSportpass, removeSportpass } from "@/lib/admin/site-actions"
import type { ActionResult } from "@/lib/types"

/**
 * SportpassIDs mit Zustimmung an einem Konto (bis SP-1.7 a vom Admin eingetragen): Nur deren Scheiben nimmt Spiegel von
 * der Brücke an ([[spiegel-privacy]]).
 */
export function SportpassSection({ userId, consents }: { userId: string; consents: ConsentRow[] }) {
  const router = useRouter()
  const [value, setValue] = useState("")
  // nach dem Eintragen ist das Feld leer; im Rückruf der Action, nicht in einem Effekt
  const [state, action, pending] = useActionState(
    async (previous: ActionResult | null, formData: FormData) => {
      const result = await addSportpass(userId, previous, formData)
      if ("success" in result) setValue("")
      return result
    },
    null
  )
  const [removing, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (state && "success" in state) router.refresh()
  }, [state, router])
  const fieldError = getFieldError(state, "sportpass")
  return (
    <section className="grid max-w-lg gap-4 rounded-2xl border border-border bg-card p-5">
      <div className="grid gap-1">
        <h2 className="text-[15px] font-semibold">SportpassIDs mit Zustimmung</h2>
        <p className="text-sm text-foreground-2">
          Nur nach der Zustimmung des Schützen eintragen. Spiegel nimmt von der Brücke nur Scheiben
          mit diesen SportpassIDs an; alle anderen verwirft es ungespeichert.
        </p>
      </div>
      {consents.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {consents.map((consent) => (
            <li key={consent.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="grid">
                <span className="font-mono tabular-nums">{consent.sportpassId}</span>
                <span className="text-[13px] text-muted-foreground">
                  {consent.siteName}
                  {consent.confirmedAt ? ` · seit ${consent.confirmedAt}` : " · nicht bestätigt"}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                className="h-10 text-destructive"
                disabled={removing}
                onClick={() =>
                  startTransition(async () => {
                    const result = await removeSportpass(consent.id)
                    if ("error" in result) setError(getErrorMessage(result) ?? null)
                    else router.refresh()
                  })
                }
              >
                Entfernen
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form action={action} className="flex flex-wrap items-end gap-2">
        <div className="grid gap-1.5">
          <Label htmlFor="sportpass">SportpassID</Label>
          <Input
            id="sportpass"
            name="sportpass"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={pending}
            {...(fieldError ? { "aria-invalid": true, "aria-describedby": "sportpass-error" } : {})}
          />
        </div>
        <Button type="submit" className="h-10" disabled={pending}>
          {pending ? "Eintragen…" : "Eintragen"}
        </Button>
      </form>
      <FieldError id="sportpass-error" message={fieldError} />
      {(getGeneralError(state) || error) && (
        <p role="alert" className="text-sm text-destructive">
          {getGeneralError(state) ?? error}
        </p>
      )}
    </section>
  )
}
