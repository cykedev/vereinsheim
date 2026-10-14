"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState } from "react"

import { getFieldError, getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { FieldError } from "@vereinsheim/ui/field-error"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"

import { requestSportpass } from "@/lib/consent/actions"
import type { ConsentText } from "@/lib/consent/texts"
import type { ActionResult } from "@/lib/types"

/**
 * Zustimmung für eine SportpassID (SP-1.7 a, D4): Nummer, der Hinweistext ganz zu lesen, ein Haken. Den Haken prüft
 * auch die Action; ohne ihn entsteht keine Zeile. Danach wartet die Zustimmung auf einen Admin. Die Version des gezeigten
 * Texts geht mit; gilt inzwischen eine andere, legt die Action nichts an (Review).
 */
export function ConsentForm({ version, text }: { version: string; text: ConsentText }) {
  const router = useRouter()
  const [sportpass, setSportpass] = useState("")
  const [agree, setAgree] = useState(false)
  // nach dem Zustimmen ist das Formular leer; im Rückruf der Action, nicht in einem Effekt
  const [state, action, pending] = useActionState(
    async (previous: ActionResult | null, formData: FormData) => {
      const result = await requestSportpass(previous, formData)
      if ("success" in result) {
        setSportpass("")
        setAgree(false)
      }
      return result
    },
    null
  )
  useEffect(() => {
    if (state && "success" in state) router.refresh()
  }, [state, router])
  const sportpassError = getFieldError(state, "sportpass")
  const agreeError = getFieldError(state, "agree")

  return (
    <form action={action} data-consent-form className="grid gap-3">
      <input type="hidden" name="version" value={version} />
      <div className="grid gap-1.5">
        <Label htmlFor="consent-sportpass">SportpassID</Label>
        <Input
          id="consent-sportpass"
          name="sportpass"
          inputMode="numeric"
          autoComplete="off"
          className="max-w-xs"
          value={sportpass}
          onChange={(e) => setSportpass(e.target.value)}
          disabled={pending}
          {...(sportpassError
            ? { "aria-invalid": true, "aria-describedby": "consent-sportpass-error" }
            : {})}
        />
        <FieldError id="consent-sportpass-error" message={sportpassError} />
      </div>

      <div data-consent-text className="grid gap-2 rounded-xl border border-border p-3 text-sm">
        <h3 className="font-semibold">{text.title}</h3>
        {text.paragraphs.map((paragraph) => (
          <p key={paragraph} className="text-foreground-2">
            {paragraph}
          </p>
        ))}
      </div>

      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="agree"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          disabled={pending}
          className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]"
          {...(agreeError
            ? { "aria-invalid": true, "aria-describedby": "consent-agree-error" }
            : {})}
        />
        <span>Ich habe den Hinweis gelesen und stimme zu.</span>
      </label>
      <FieldError id="consent-agree-error" message={agreeError} />

      <div>
        <Button type="submit" className="h-10" disabled={pending}>
          {pending ? "Zustimmen…" : "Zustimmen"}
        </Button>
      </div>
      {getGeneralError(state) && (
        <p role="alert" className="text-sm text-destructive">
          {getGeneralError(state)}
        </p>
      )}
    </form>
  )
}
