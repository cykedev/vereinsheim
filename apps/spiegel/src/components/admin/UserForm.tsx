"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState } from "react"

import { MAX_USER_EMAIL_LENGTH } from "@vereinsheim/lib/auth/validation"
import { getFieldError, getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { FieldError } from "@vereinsheim/ui/field-error"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"

import type { ActionResult } from "@/lib/types"
import type { UserSummary } from "@/lib/users/queries"
import type { Role } from "@/lib/users/rules"

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>

/** ein Feld mit Beschriftung, Fehler und `aria-*` (Konventionen §2) */
function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  hint?: string
  children: (aria: { "aria-invalid"?: true; "aria-describedby"?: string }) => React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children(error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {})}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

/**
 * Konto anlegen oder ändern (Admin). Ohne `user` legt es an (mit vorläufigem Passwort), mit `user` ändert es Name,
 * E-Mail, Rolle, Status und setzt wahlweise ein neues Passwort (das beendet die Sitzungen des Kontos).
 */
export function UserForm({ action, user }: { action: Action; user?: UserSummary }) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(action, null)
  // gesteuert: React setzt ein Formular mit Server Action nach dem Absenden zurück, ein Fehler löschte sonst die Eingaben
  const [name, setName] = useState(user?.name ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<Role>(user?.role ?? "USER")
  const [active, setActive] = useState<"true" | "false">(
    user?.isActive === false ? "false" : "true"
  )

  useEffect(() => {
    if (state && "success" in state) {
      router.push("/admin/users")
      router.refresh()
    }
  }, [state, router])

  const general = getGeneralError(state)
  return (
    <form
      action={formAction}
      className="grid max-w-lg gap-4 rounded-2xl border border-border bg-card p-5"
    >
      <Field id="name" label="Name (freiwillig)" error={getFieldError(state, "name")}>
        {(aria) => (
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={pending}
            {...aria}
          />
        )}
      </Field>
      <Field id="email" label="E-Mail" error={getFieldError(state, "email")}>
        {(aria) => (
          <Input
            id="email"
            name="email"
            type="email"
            required
            maxLength={MAX_USER_EMAIL_LENGTH}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
            {...aria}
          />
        )}
      </Field>
      <Field
        id="tempPassword"
        label={user ? "Neues Passwort (freiwillig)" : "Vorläufiges Passwort"}
        hint={
          user
            ? "Nur ausfüllen, um das Passwort zurückzusetzen (mindestens 12 Zeichen); das Konto wird abgemeldet."
            : "Mindestens 12 Zeichen."
        }
        error={getFieldError(state, "tempPassword")}
      >
        {(aria) => (
          <Input
            id="tempPassword"
            name="tempPassword"
            type="password"
            autoComplete="new-password"
            required={!user}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
            {...aria}
          />
        )}
      </Field>
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Rolle</span>
        <input type="hidden" name="role" value={role} />
        <Segmented
          label="Rolle"
          value={role}
          options={[
            { value: "USER", label: "Schütze" },
            { value: "ADMIN", label: "Admin" },
          ]}
          onChange={setRole}
          className="justify-self-start"
        />
      </div>
      {user && (
        <div className="grid gap-1.5">
          <span className="text-sm font-medium">Status</span>
          <input type="hidden" name="isActive" value={active} />
          <Segmented
            label="Status"
            value={active}
            options={[
              { value: "true", label: "Aktiv" },
              { value: "false", label: "Deaktiviert" },
            ]}
            onChange={setActive}
            className="justify-self-start"
          />
        </div>
      )}
      {general && (
        <p role="alert" className="text-sm text-destructive">
          {general}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="h-10" disabled={pending}>
          {pending ? "Speichern…" : user ? "Speichern" : "Konto anlegen"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-10"
          onClick={() => router.back()}
          disabled={pending}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  )
}
