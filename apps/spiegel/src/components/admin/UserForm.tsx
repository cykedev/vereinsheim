"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useActionState, useEffect, useRef, useState } from "react"

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
import { DecisionDialog } from "@/components/shell/DecisionDialog"
import { accountChange, type Decision } from "@/lib/admin/consequences"

import { AdminHelp } from "./AdminHelp"

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

  // Kein Knopf ohne Folge (P2c, D6): ändern sich Rolle, Status oder Passwort, fragt der Dialog mit genau diesen Folgen
  const formRef = useRef<HTMLFormElement>(null)
  const confirmed = useRef(false)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [asking, setAsking] = useState(false)
  const pendingDecision = () =>
    user
      ? accountChange({
          who: user.name ?? user.email,
          changes: {
            ...(role !== user.role ? { role } : {}),
            ...((active === "true") !== user.isActive ? { active: active === "true" } : {}),
            ...(password !== "" ? { password: true } : {}),
          },
        })
      : null

  const general = getGeneralError(state)
  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={(event) => {
        if (confirmed.current) {
          confirmed.current = false
          return
        }
        const ask = pendingDecision()
        if (ask) {
          event.preventDefault()
          setDecision(ask)
          setAsking(true)
        }
      }}
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
        <span className="flex items-center gap-1 text-sm font-medium">
          Rolle <AdminHelp id="role" />
        </span>
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
        <FieldError id="role-error" message={getFieldError(state, "role")} />
      </div>
      {user && (
        <div className="grid gap-1.5">
          <span className="flex items-center gap-1 text-sm font-medium">
            Status <AdminHelp id="deactivated" />
          </span>
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
          <FieldError id="isActive-error" message={getFieldError(state, "isActive")} />
        </div>
      )}
      {general && (
        <p role="alert" className="text-sm text-destructive">
          {general}
        </p>
      )}
      {!user && (
        <p className="text-sm text-foreground-2">
          Das Konto kann sich mit dem vorläufigen Passwort anmelden und muss es zuerst ändern.
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="h-10" disabled={pending}>
          {pending ? "Speichern…" : user ? "Speichern" : "Konto anlegen"}
        </Button>
        <Link
          href="/admin/users"
          className="inline-flex h-10 items-center rounded-md px-4 text-sm font-medium text-foreground-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
        >
          Abbrechen
        </Link>
      </div>
      {decision && (
        <DecisionDialog
          decision={decision}
          open={asking}
          onOpenChange={setAsking}
          onConfirm={() => {
            confirmed.current = true
            formRef.current?.requestSubmit()
          }}
        />
      )}
    </form>
  )
}
