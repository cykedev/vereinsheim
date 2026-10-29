"use client"

import { Paperclip, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"

import { evidenceRemove } from "@/lib/admin/consequences"
import { attachEvidence, removeEvidence } from "@/lib/evidence/actions"
import { attachAll, reportLines } from "@/lib/evidence/attach-all"
import type { CardEvidenceInfo } from "@/lib/evidence/queries"
import { prepareEvidence } from "@/lib/evidence/shrink"
import {
  attachingText,
  EVIDENCE_LIMIT,
  EVIDENCE_REMOVE_FAILED,
  evidenceCountText,
  evidenceMeta,
  evidenceName,
} from "@/lib/evidence/texts"

import { ActionRow } from "./ActionRow"

const PICK =
  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold text-foreground peer-focus-visible:outline-2 peer-focus-visible:outline-ring peer-disabled:cursor-default peer-disabled:opacity-60 hover:bg-surface-2"

/**
 * Belege als Zeile im Kasten „Diese Scheibe“ jeder eigenen Scheibe: Fotos oder PDFs, etwa eine Ergebnisliste, bis zu
 * `EVIDENCE_LIMIT`. Je Datei Vorschaubild, Name, Art, Größe und Tag; ein Tipp öffnet die Datei, × entfernt sie (mit
 * Rückfrage). Mehrere Dateien gehen in einem Zug, je Datei eine Anfrage, nacheinander: Fotos verkleinert der Browser
 * vorher (`prepareEvidence`). Was nicht angehängt ist, steht mit Grund unter der Liste, bis zur nächsten Aktion.
 */
export function CardEvidence({
  cardId,
  when,
  evidence,
  timeZone,
}: {
  cardId: string
  /** Tag und Uhrzeit der Scheibe wie in Listen, für die Rückfrage */
  when: string
  evidence: readonly CardEvidenceInfo[]
  timeZone: string
}) {
  const router = useRouter()
  const [report, setReport] = useState<string[] | null>(null)
  const [asking, setAsking] = useState<CardEvidenceInfo | null>(null)
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState({ k: 1, n: 1 })
  const [pending, startTransition] = useTransition()
  // „…“ nur am Knopf der Aktion, die läuft; die anderen sind nur gesperrt (conventions §9)
  const [running, setRunning] = useState<"attach" | "remove" | null>(null)
  const attaching = pending && running === "attach"

  // Knopf, Fortschritt und Bericht sofort, nicht erst mit dem Ende der Transition (conventions §9)
  const attach = (files: File[]) => {
    setRunning("attach")
    setReport(null)
    setProgress({ k: 1, n: files.length })
    startTransition(async () => {
      const result = await attachAll(files, {
        free: EVIDENCE_LIMIT - evidence.length,
        prepare: prepareEvidence,
        attach: async (file) => {
          const form = new FormData()
          form.set("cardId", cardId)
          form.set("file", file)
          const answer = await attachEvidence(form)
          if (!("error" in answer)) return { success: true }
          const text = getErrorMessage(answer)
          // ohne Satz gilt es als gescheitert, mit dem Namen der Datei (`attachAll`)
          if (!text) throw new Error("ohne Satz")
          return { error: text }
        },
        onProgress: (k, n) => setProgress({ k, n }),
      })
      setReport(result.lines.length ? reportLines(result) : null)
      router.refresh()
    })
  }

  const remove = (item: CardEvidenceInfo) => {
    setRunning("remove")
    setReport(null)
    startTransition(async () => {
      let result
      try {
        result = await removeEvidence(item.id)
      } catch {
        result = { error: EVIDENCE_REMOVE_FAILED }
      }
      if ("error" in result) setReport([getErrorMessage(result) ?? EVIDENCE_REMOVE_FAILED])
      router.refresh()
    })
  }

  return (
    <ActionRow
      data-card-evidence={evidence.length}
      title="Belege"
      state={evidenceCountText(evidence.length)}
    >
      {evidence.length > 0 && (
        <ul data-evidence-list className="grid gap-1">
          {evidence.map((item) => {
            const name = evidenceName(item)
            const href = `/api/evidence/${encodeURIComponent(item.id)}`
            return (
              <li
                key={item.id}
                data-evidence-item
                data-evidence-kind={item.kind}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
              >
                <a
                  href={href}
                  target="_blank"
                  rel="noopener"
                  className="grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2.5 rounded-xl p-1 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {item.kind === "photo" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Datei des Besitzers über die eigene Route, ohne Optimierung
                    <img
                      src={href}
                      alt=""
                      width={44}
                      height={44}
                      loading="lazy"
                      decoding="async"
                      className="size-11 rounded-lg border border-border bg-surface-2 object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="grid size-11 place-items-center rounded-lg border border-border bg-surface-2 text-xs font-bold text-muted-foreground"
                    >
                      PDF
                    </span>
                  )}
                  <span className="grid min-w-0">
                    <span data-evidence-name className="truncate text-sm font-semibold">
                      {name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {evidenceMeta(item, timeZone)}
                    </span>
                  </span>
                </a>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`${name} entfernen`}
                  data-evidence-remove
                  disabled={pending}
                  onClick={() => {
                    setAsking(item)
                    setOpen(true)
                  }}
                >
                  <X aria-hidden />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      {report && (
        <div
          role="status"
          data-evidence-report
          className="grid gap-1 rounded-xl bg-warning-wash px-3 py-2 text-sm text-foreground"
        >
          {report.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
      {evidence.length < EVIDENCE_LIMIT && (
        <span>
          <input
            id="card-evidence-file"
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="peer sr-only"
            disabled={pending}
            onChange={(event) => {
              const chosen = Array.from(event.target.files ?? [])
              // dieselben Dateien noch einmal wählen löst wieder ein `change` aus
              event.target.value = ""
              if (chosen.length) attach(chosen)
            }}
          />
          <label htmlFor="card-evidence-file" className={PICK}>
            <Paperclip aria-hidden className="size-4" />
            {attaching ? attachingText(progress.k, progress.n) : "Foto oder PDF anhängen"}
          </label>
        </span>
      )}
      {asking && (
        <DecisionDialog
          decision={evidenceRemove({
            when,
            name: asking.name,
            kind: asking.kind,
            others: evidence.filter((item) => item.id !== asking.id).length,
          })}
          open={open}
          onOpenChange={setOpen}
          onConfirm={() => remove(asking)}
        />
      )}
    </ActionRow>
  )
}
