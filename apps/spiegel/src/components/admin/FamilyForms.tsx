"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage, getFieldError, getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { FieldError } from "@vereinsheim/ui/field-error"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { familyRemove } from "@/lib/admin/consequences"
import { createFamily, removeFamily, renameFamily } from "@/lib/admin/discipline-actions"
import type { FamilyRow } from "@/lib/admin/discipline-model"

import { AdminHelp } from "./AdminHelp"

const CARD = "grid gap-3 rounded-2xl border border-border bg-card p-5"

/** die Familien: umbenennen, leere entfernen, neue anlegen */
export function FamilyForms({ families }: { families: readonly FamilyRow[] }) {
  return (
    <section className={CARD} data-families>
      <h2 className="flex items-center gap-1 text-[15px] font-semibold">
        Familien <AdminHelp id="family" />
      </h2>
      <p className="text-sm text-muted-foreground">
        In einer Familie laufen Verläufe und Rekorde zusammen, etwa LG 40 und LG 40 alt.
      </p>
      {families.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {families.map((family) => (
            <FamilyItem key={family.id} family={family} />
          ))}
        </ul>
      )}
      <NewFamilyForm />
    </section>
  )
}

export function FamilyItem({ family }: { family: FamilyRow }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(family.name)
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const empty = family.disciplines === 0 && family.cards === 0
  const run = (action: () => Promise<Parameters<typeof getErrorMessage>[0]>, done: () => void) =>
    startTransition(async () => {
      const result = await action()
      if (result && "error" in result) setError(getErrorMessage(result) ?? null)
      else {
        setError(null)
        done()
        router.refresh()
      }
    })
  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3" data-family={family.id}>
      {editing ? (
        <form
          className="flex min-w-0 flex-1 flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            run(
              () => renameFamily(family.id, name),
              () => setEditing(false)
            )
          }}
        >
          <div className="grid min-w-0 flex-1 gap-1.5">
            <Label htmlFor={`family-${family.id}`}>Name</Label>
            <Input
              id={`family-${family.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
            />
          </div>
          <Button type="submit" className="h-10" disabled={pending}>
            {pending ? "Speichern…" : "Speichern"}
          </Button>
        </form>
      ) : (
        <span className="grid min-w-0 flex-1">
          <span className="truncate text-[15px] font-semibold">{family.name}</span>
          <span className="text-[13px] text-muted-foreground">
            {family.disciplines === 1 ? "1 Disziplin" : `${family.disciplines} Disziplinen`}
          </span>
        </span>
      )}
      {!editing && (
        <Button type="button" variant="ghost" className="h-10" onClick={() => setEditing(true)}>
          Umbenennen
        </Button>
      )}
      {!editing && empty && (
        <Button type="button" variant="ghost" className="h-10" onClick={() => setAsking(true)}>
          Entfernen
        </Button>
      )}
      {error && (
        <span role="alert" className="basis-full text-[13px] text-destructive">
          {error}
        </span>
      )}
      <DecisionDialog
        decision={familyRemove({ name: family.name })}
        open={asking}
        onOpenChange={setAsking}
        onConfirm={() =>
          run(
            () => removeFamily(family.id),
            () => {}
          )
        }
      />
    </li>
  )
}

/** „Neue Familie“: ein Name, die Kennung entsteht daraus */
export function NewFamilyForm() {
  const router = useRouter()
  const [state, setState] = useState<Awaited<ReturnType<typeof createFamily>> | null>(null)
  const [pending, startTransition] = useTransition()
  // gesteuert; nach dem Anlegen leer für die nächste
  const [name, setName] = useState("")
  const invalid = getFieldError(state, "name")
  return (
    <form
      className="grid gap-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        const data = new FormData(event.currentTarget)
        startTransition(async () => {
          const result = await createFamily(null, data)
          setState(result)
          if ("success" in result) {
            setName("")
            router.refresh()
          }
        })
      }}
    >
      <Label htmlFor="new-family">Neue Familie</Label>
      <div className="flex flex-wrap items-start gap-2">
        <Input
          id="new-family"
          name="name"
          className="max-w-xs"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
          {...(invalid ? { "aria-invalid": true, "aria-describedby": "new-family-error" } : {})}
        />
        <Button type="submit" className="h-10" disabled={pending}>
          {pending ? "Anlegen…" : "Anlegen"}
        </Button>
      </div>
      <FieldError id="new-family-error" message={invalid} />
      {getGeneralError(state) && (
        <p role="alert" className="text-sm text-destructive">
          {getGeneralError(state)}
        </p>
      )}
    </form>
  )
}
