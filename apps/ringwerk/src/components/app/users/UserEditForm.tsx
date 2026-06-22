"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ActionResult } from "@/lib/types"
import type { UserSummary } from "@/lib/users/types"
import { getFieldError, getGeneralError } from "@/lib/forms/fieldErrors"
import { FieldError } from "@/components/ui/field-error"

interface Props {
  user: UserSummary
  action: (prevState: ActionResult | null, formData: FormData) => Promise<ActionResult>
}

export function UserEditForm({ user, action }: Props) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(action, null)
  const [showPassword, setShowPassword] = useState(false)
  const [name, setName] = useState<string>(user.name ?? "")
  const [email, setEmail] = useState<string>(user.email)
  const [role, setRole] = useState<string>(user.role)
  const [isActive, setIsActive] = useState<string>(user.isActive ? "true" : "false")
  const [tempPassword, setTempPassword] = useState<string>("")

  useEffect(() => {
    if (state && "success" in state && state.success) {
      toast.success("Nutzer gespeichert.")
      router.push("/admin/users")
    } else if (state && "error" in state && typeof state.error === "string") {
      toast.error(state.error)
    }
  }, [state, router])

  const nameError = getFieldError(state, "name")
  const emailError = getFieldError(state, "email")
  const roleError = getFieldError(state, "role")
  const tempPasswordError = getFieldError(state, "tempPassword")
  const generalError = getGeneralError(state)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name (optional)</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Vor- und Nachname"
          disabled={isPending}
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? "name-error" : undefined}
        />
        <FieldError id="name-error" message={nameError} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? "email-error" : undefined}
        />
        <FieldError id="email-error" message={emailError} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="role">Rolle</Label>
        <Select name="role" value={role} onValueChange={setRole} disabled={isPending}>
          <SelectTrigger id="role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="USER">Benutzer</SelectItem>
            <SelectItem value="MANAGER">Manager</SelectItem>
            <SelectItem value="ADMIN">Administrator</SelectItem>
          </SelectContent>
        </Select>
        <FieldError id="role-error" message={roleError} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="isActive">Status</Label>
        <Select name="isActive" value={isActive} onValueChange={setIsActive} disabled={isPending}>
          <SelectTrigger id="isActive">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Aktiv</SelectItem>
            <SelectItem value="false">Inaktiv</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tempPassword">Neues Passwort (optional)</Label>
        <div className="relative">
          <Input
            id="tempPassword"
            name="tempPassword"
            type={showPassword ? "text" : "password"}
            value={tempPassword}
            onChange={(e) => setTempPassword(e.target.value)}
            placeholder="Leer lassen = kein Wechsel"
            disabled={isPending}
            className="pr-10"
            aria-invalid={tempPasswordError ? true : undefined}
            aria-describedby={tempPasswordError ? "tempPassword-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Nur ausfüllen wenn das Passwort zurückgesetzt werden soll (mind. 12 Zeichen). Der Nutzer
          wird danach abgemeldet.
        </p>
        <FieldError id="tempPassword-error" message={tempPasswordError} />
      </div>

      {generalError && <p className="text-sm text-destructive">{generalError}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Speichern…" : "Speichern"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={isPending}>
          Abbrechen
        </Button>
      </div>
    </form>
  )
}
