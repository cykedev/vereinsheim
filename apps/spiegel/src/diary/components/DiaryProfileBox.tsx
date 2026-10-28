"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"

import { ActionRow } from "@/components/card/ActionRow"

import { diaryOff, diaryOn } from "../consequences"
import { setDiaryEnabledAction } from "../settings-actions"
import { ERRORS, PROFILE_TEXTS } from "../texts"

const BUTTON =
  "inline-flex h-10 items-center rounded-full border border-line-strong px-3.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"

/**
 * Kasten „Tagebuch“ im Profil ([[adr-033]] „Tagebuch abschaltbar“): sagt, ob es an ist und was das heißt, und schaltet
 * nach einer Rückfrage um. Der Rahmen (Leiste) folgt über `revalidatePath`.
 */
export function DiaryProfileBox({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const label = enabled ? PROFILE_TEXTS.turnOff : PROFILE_TEXTS.turnOn

  return (
    <div data-diary-profile className="rounded-2xl border border-border bg-card p-4">
      <ActionRow
        title={PROFILE_TEXTS.title}
        state={enabled ? PROFILE_TEXTS.on : PROFILE_TEXTS.off}
        action={
          <button type="button" disabled={pending} onClick={() => setOpen(true)} className={BUTTON}>
            {pending ? `${label}…` : label}
          </button>
        }
      >
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DecisionDialog
          decision={enabled ? diaryOff() : diaryOn()}
          open={open}
          onOpenChange={setOpen}
          onConfirm={() =>
            startTransition(async () => {
              setError(null)
              const result = await setDiaryEnabledAction(!enabled)
              if ("error" in result) {
                setError(getErrorMessage(result) ?? ERRORS.failed)
                return
              }
              toast.success(enabled ? PROFILE_TEXTS.turnedOff : PROFILE_TEXTS.turnedOn)
            })
          }
        />
      </ActionRow>
    </div>
  )
}
