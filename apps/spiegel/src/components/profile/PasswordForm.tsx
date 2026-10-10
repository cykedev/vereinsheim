"use client"

import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState } from "react"

import { getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"

import { changeOwnPassword } from "@/lib/users/password"

/**
 * Eigenes Passwort ändern. Danach sind alle Sitzungen beendet (auch diese): abmelden und mit dem neuen anmelden. Felder
 * gesteuert, damit ein Fehler sie nicht leert.
 */
export function PasswordForm() {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(changeOwnPassword, null)
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")

  useEffect(() => {
    if (state && "success" in state)
      void signOut({ redirect: false }).then(() => {
        router.replace("/login?passwordChanged=1")
        router.refresh()
      })
  }, [state, router])

  const error = getGeneralError(state)
  const aria = error ? { "aria-invalid": true as const, "aria-describedby": "password-error" } : {}
  return (
    <form
      action={formAction}
      className="grid max-w-lg gap-4 rounded-2xl border border-border bg-card p-5"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          disabled={pending}
          {...aria}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="newPassword">Neues Passwort</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          value={next}
          onChange={(event) => setNext(event.target.value)}
          disabled={pending}
          {...aria}
        />
        <p className="text-xs text-muted-foreground">Mindestens 12 Zeichen.</p>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="confirmPassword">Neues Passwort wiederholen</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          disabled={pending}
          {...aria}
        />
      </div>
      {error && (
        <p id="password-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" className="h-10 justify-self-start" disabled={pending}>
        {pending ? "Ändern…" : "Passwort ändern"}
      </Button>
    </form>
  )
}
