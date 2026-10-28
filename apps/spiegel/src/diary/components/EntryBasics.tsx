"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { Segmented } from "@vereinsheim/ui/design2/segmented"

import { ActionRow } from "@/components/card/ActionRow"

import { saveEntryBasics } from "../actions"
import type { Family } from "../queries"
import type { DiaryKindValue } from "../summaries"
import { ENTRY_TEXTS, ERRORS, KIND_CHOICES } from "../texts"

const BUTTON =
  "inline-flex h-10 cursor-pointer items-center rounded-full border border-line-strong px-3.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
const FIELD =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"

/**
 * Zeile „Tag, Art und Disziplin“ im Kasten „Dieser Eintrag“: mit Scheiben „Kommen von den Scheiben dieses Eintrags.“, ohne Scheiben
 * änderbar (Tag, Art, Disziplin; bei „Mit Scheiben“ Pflicht).
 */
export function EntryBasics({
  entryId,
  editable,
  summary,
  day,
  kind,
  familyId,
  families,
}: {
  entryId: string
  editable: boolean
  /** was gerade gilt („Fr 13.03. · Mentaltraining“) */
  summary: string
  day: string
  kind: DiaryKindValue
  familyId: number | null
  families: Family[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ day, kind, familyId })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <ActionRow
      data-entry-basics
      title={ENTRY_TEXTS.basics}
      state={editable ? summary : ENTRY_TEXTS.basicsFromCards}
      action={
        editable && !open ? (
          <button type="button" onClick={() => setOpen(true)} className={BUTTON}>
            {ENTRY_TEXTS.change}
          </button>
        ) : undefined
      }
    >
      {open && (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            startTransition(async () => {
              setError(null)
              const result = await saveEntryBasics(entryId, form)
              if ("error" in result) {
                setError(getErrorMessage(result) ?? ERRORS.failed)
                return
              }
              toast.success(ENTRY_TEXTS.basicsSaved)
              setOpen(false)
              router.refresh()
            })
          }}
        >
          <label className="grid gap-1.5 text-sm font-semibold">
            {ENTRY_TEXTS.day}
            <input
              type="date"
              value={form.day}
              onChange={(event) => setForm({ ...form, day: event.target.value })}
              className={FIELD}
            />
          </label>
          <div className="grid gap-1.5">
            <span className="text-sm font-semibold">{ENTRY_TEXTS.kind}</span>
            <Segmented
              label={ENTRY_TEXTS.kind}
              options={KIND_CHOICES}
              value={form.kind}
              onChange={(next) => setForm({ ...form, kind: next })}
              wrap
            />
          </div>
          <label className="grid gap-1.5 text-sm font-semibold">
            {ENTRY_TEXTS.family}
            <select
              value={form.familyId ?? ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  familyId: event.target.value ? Number(event.target.value) : null,
                })
              }
              className={FIELD}
            >
              <option value="">{ENTRY_TEXTS.noFamily}</option>
              {families.map((family) => (
                <option key={family.id} value={family.id}>
                  {family.name}
                </option>
              ))}
            </select>
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="inline-flex h-10 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
            >
              {pending ? "Speichern…" : "Speichern"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setForm({ day, kind, familyId })
                setError(null)
              }}
              className="inline-flex h-10 cursor-pointer items-center rounded-md px-4 text-sm font-medium hover:bg-surface-2"
            >
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </ActionRow>
  )
}
