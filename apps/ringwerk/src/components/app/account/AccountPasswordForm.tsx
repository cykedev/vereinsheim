"use client"

import { useActionState, useEffect, useState } from "react"
import { signOut } from "next-auth/react"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { changeOwnPassword } from "@/lib/users/actions"
import { getFieldError, getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { FieldError } from "@/components/ui/field-error"

export function AccountPasswordForm() {
  const [state, formAction, isPending] = useActionState(changeOwnPassword, null)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState<string>("")
  const [newPassword, setNewPassword] = useState<string>("")
  const [confirmPassword, setConfirmPassword] = useState<string>("")

  useEffect(() => {
    if (state && "success" in state && state.success) {
      toast.success("Passwort geändert.")
      signOut({ callbackUrl: "/login" })
    } else if (state && "error" in state && typeof state.error === "string") {
      toast.error(state.error)
    }
  }, [state])

  const currentPasswordError = getFieldError(state, "currentPassword")
  const newPasswordError = getFieldError(state, "newPassword")
  const confirmPasswordError = getFieldError(state, "confirmPassword")
  const generalError = getGeneralError(state)
  const isSuccess = state && "success" in state && state.success

  if (isSuccess) {
    return <p className="text-sm text-muted-foreground">Passwort geändert. Abmeldung läuft…</p>
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
        <div className="relative">
          <Input
            id="currentPassword"
            name="currentPassword"
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={isPending}
            className="pr-10"
            aria-invalid={currentPasswordError ? true : undefined}
            aria-describedby={currentPasswordError ? "currentPassword-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowCurrent((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <FieldError id="currentPassword-error" message={currentPasswordError} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">Neues Passwort</Label>
        <div className="relative">
          <Input
            id="newPassword"
            name="newPassword"
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mind. 12 Zeichen"
            disabled={isPending}
            className="pr-10"
            aria-invalid={newPasswordError ? true : undefined}
            aria-describedby={newPasswordError ? "newPassword-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <FieldError id="newPassword-error" message={newPasswordError} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Neues Passwort bestätigen</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isPending}
            className="pr-10"
            aria-invalid={confirmPasswordError ? true : undefined}
            aria-describedby={confirmPasswordError ? "confirmPassword-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <FieldError id="confirmPassword-error" message={confirmPasswordError} />
      </div>

      {generalError && <p className="text-sm text-destructive">{generalError}</p>}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Speichern…" : "Passwort ändern"}
      </Button>
    </form>
  )
}
