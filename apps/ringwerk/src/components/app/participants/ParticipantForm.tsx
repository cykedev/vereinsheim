"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@vereinsheim/ui/button"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import type { ParticipantDetail } from "@/lib/participants/types"
import type { ActionResult } from "@/lib/types"
import { getFieldError, getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { FieldError } from "@vereinsheim/ui/field-error"

interface Props {
  participant?: Pick<ParticipantDetail, "firstName" | "lastName" | "contact">
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>
  onSuccess?: () => void
}

export function ParticipantForm({ participant, action, onSuccess }: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(action, null)
  const [firstName, setFirstName] = useState<string>(participant?.firstName ?? "")
  const [lastName, setLastName] = useState<string>(participant?.lastName ?? "")
  const [contact, setContact] = useState<string>(participant?.contact ?? "")

  useEffect(() => {
    if (state && "success" in state && state.success) {
      toast.success("Teilnehmer gespeichert.")
      if (onSuccess) onSuccess()
      else router.push("/participants")
    } else if (state && "error" in state && typeof state.error === "string") {
      toast.error(state.error)
    }
  }, [state, router, onSuccess])

  const firstNameError = getFieldError(state, "firstName")
  const lastNameError = getFieldError(state, "lastName")
  const contactError = getFieldError(state, "contact")
  const generalError = getGeneralError(state)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="firstName">Vorname</Label>
        <Input
          id="firstName"
          name="firstName"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="z.B. Max"
          disabled={isPending}
          aria-invalid={firstNameError ? true : undefined}
          aria-describedby={firstNameError ? "firstName-error" : undefined}
        />
        <FieldError id="firstName-error" message={firstNameError} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="lastName">Nachname</Label>
        <Input
          id="lastName"
          name="lastName"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="z.B. Muster"
          disabled={isPending}
          aria-invalid={lastNameError ? true : undefined}
          aria-describedby={lastNameError ? "lastName-error" : undefined}
        />
        <FieldError id="lastName-error" message={lastNameError} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact">
          E-Mail / Telefon <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="contact"
          name="contact"
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="z.B. max@example.com oder +49 151 12345678"
          disabled={isPending}
          aria-invalid={contactError ? true : undefined}
          aria-describedby={contactError ? "contact-error" : undefined}
        />
        <FieldError id="contact-error" message={contactError} />
      </div>

      {generalError && <p className="text-sm text-destructive">{generalError}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Speichern…" : "Speichern"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => (onSuccess ? onSuccess() : router.back())}
          disabled={isPending}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  )
}
