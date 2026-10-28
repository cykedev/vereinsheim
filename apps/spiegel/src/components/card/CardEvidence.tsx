"use client"

import { Download, Paperclip } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { formatDecimal, formatWeekdayDate } from "@vereinsheim/lib/format"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"

import { evidenceRemove } from "@/lib/admin/consequences"
import { attachEvidence, removeEvidence } from "@/lib/entered/evidence-actions"
import type { CardEvidenceInfo } from "@/lib/entered/queries"
import { prepareEvidence } from "@/lib/evidence/shrink"
import { EVIDENCE_TEXTS } from "@/lib/evidence/texts"

import { ActionRow } from "./ActionRow"

const ACTION =
  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-foreground hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
const PICK =
  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-disabled:cursor-default peer-disabled:opacity-60 hover:bg-surface-2"

/** „Foto, 1,2 MB, angehängt Di 28.10.2026“ */
export function evidenceText(evidence: CardEvidenceInfo, timeZone: string): string {
  const mb = formatDecimal(Math.max(0.1, evidence.size / 1_000_000), 1)
  const day = formatWeekdayDate(new Date(evidence.storedAtMs), timeZone)
  return `${evidence.kind === "pdf" ? "PDF" : "Foto"}, ${mb} MB, angehängt ${day}`
}

/**
 * Beleg als Zeile im Kasten „Diese Scheibe“ einer eingetragenen Scheibe: ein Foto oder PDF vom Papier. Ohne Beleg der
 * Satz und „Foto oder PDF anhängen“; mit Beleg Art, Größe und Tag, dazu Öffnen, Ersetzen und Entfernen (mit Rückfrage).
 * Fotos verkleinert der Browser vorher (`prepareEvidence`).
 */
export function CardEvidence({
  cardId,
  evidence,
  timeZone,
}: {
  cardId: string
  evidence: CardEvidenceInfo | null
  timeZone: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()

  const run = (action: () => Promise<Parameters<typeof getErrorMessage>[0]>) =>
    startTransition(async () => {
      setError(null)
      let result
      try {
        result = await action()
      } catch {
        result = { error: EVIDENCE_TEXTS.failed }
      }
      if (result && "error" in result) setError(getErrorMessage(result) ?? EVIDENCE_TEXTS.failed)
      else router.refresh()
    })

  const picker = (label: string) => (
    <span>
      <input
        id="card-evidence-file"
        type="file"
        accept="image/*,application/pdf"
        className="peer sr-only"
        disabled={pending}
        onChange={(event) => {
          const chosen = event.target.files?.[0]
          // dieselbe Datei noch einmal wählen löst wieder ein `change` aus
          event.target.value = ""
          if (!chosen) return
          run(async () => {
            const prepared = await prepareEvidence(chosen)
            if (!prepared.ok) return { error: prepared.error }
            const form = new FormData()
            form.set("cardId", cardId)
            form.set("file", prepared.file)
            return attachEvidence(form)
          })
        }}
      />
      <label htmlFor="card-evidence-file" className={PICK}>
        <Paperclip aria-hidden className="size-4" />
        {pending ? "Wird angehängt…" : label}
      </label>
    </span>
  )

  return (
    <ActionRow
      data-card-evidence={evidence ? evidence.kind : "none"}
      title="Beleg"
      state={
        evidence ? (
          <span className="font-semibold text-foreground">{evidenceText(evidence, timeZone)}</span>
        ) : (
          "Ein Foto vom Papier oder ein PDF, damit du später nachsehen kannst."
        )
      }
      action={
        evidence ? (
          <div className="flex flex-wrap items-center gap-1">
            <a
              data-evidence-file
              href={`/api/evidence/${encodeURIComponent(evidence.id)}`}
              target="_blank"
              rel="noopener"
              className={ACTION}
            >
              <Download aria-hidden className="size-4" />
              Öffnen
            </a>
            {picker("Ersetzen")}
            <button
              type="button"
              className={ACTION}
              disabled={pending}
              onClick={() => setAsking(true)}
            >
              Entfernen
            </button>
          </div>
        ) : (
          picker("Foto oder PDF anhängen")
        )
      }
    >
      {error && (
        <p role="alert" data-evidence-error className="text-sm text-destructive">
          {error}
        </p>
      )}
      {evidence && (
        <DecisionDialog
          decision={evidenceRemove({ kind: evidence.kind })}
          open={asking}
          onOpenChange={setAsking}
          onConfirm={() => run(() => removeEvidence(cardId))}
        />
      )}
    </ActionRow>
  )
}
