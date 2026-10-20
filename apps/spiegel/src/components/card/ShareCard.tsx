"use client"

import { Copy, Send, Share2, Unlink } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, useSyncExternalStore, useTransition } from "react"

import { getErrorMessage } from "@vereinsheim/lib/forms/fieldErrors"
import { formatDateOnly } from "@vereinsheim/lib/format"

import { DecisionDialog } from "@vereinsheim/ui/design2/decision-dialog"
import { cardShare, cardShareStop } from "@/lib/admin/consequences"
import { sharePath } from "@/lib/share"
import { shareCard, stopSharingCard, type Share } from "@/lib/share-actions"

const noSubscribe = () => () => {}
/** die Herkunft der Seite für den ganzen Link; auf dem Server und beim Hydrieren leer (dann nur der Pfad) */
const useOrigin = () =>
  useSyncExternalStore(
    noSubscribe,
    () => window.location.origin,
    () => ""
  )
/** kann der Browser das Teilen-Menü des Geräts öffnen (Telefon)? Auf dem Server und beim Hydrieren nein */
const useCanSend = () =>
  useSyncExternalStore(
    noSubscribe,
    () => typeof navigator.share === "function",
    () => false
  )

const BUTTON =
  "inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"

/**
 * Teilen am Ende der Seite einer Scheibe, über dem Löschen: erstellt nach der Rückfrage einen Link, zeigt ihn mit
 * Kopieren und Senden und beendet das Teilen wieder. Den Stand hält die Seite (`onChange`, sofort aus dem Ergebnis der
 * Actions), damit auch das Löschen ihn kennt; danach rechnet sie über `router.refresh()` neu.
 */
export function ShareCard({
  cardId,
  when,
  share,
  onChange,
  timeZone,
}: {
  cardId: string
  /** Tag und Uhrzeit der Scheibe wie in Listen, für die Rückfragen */
  when: string
  share: Share | null
  /** nach dem Teilen der neue Link, nach dem Beenden null */
  onChange: (share: Share | null) => void
  timeZone: string
}) {
  // welche Rückfrage; sie bleibt beim Schließen stehen, damit der Dialog nicht im Ausblenden den Text wechselt
  const [kind, setKind] = useState<"share" | "stop">("share")
  const [open, setOpen] = useState(false)
  const ask = (next: "share" | "stop") => {
    setKind(next)
    setOpen(true)
  }
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const origin = useOrigin()
  const canSend = useCanSend()
  const link = share ? `${origin}${sharePath(share.shareId)}` : null

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    if (!link) return
    setError(null)
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch {
      setError("Der Link ließ sich nicht kopieren. Markiere ihn und kopiere ihn selbst.")
    }
  }
  const send = async () => {
    if (!link) return
    try {
      await navigator.share({ title: "Scheibe in Spiegel", url: link })
    } catch {
      // abgebrochen oder nicht erlaubt: Der Link steht weiter zum Kopieren da
    }
  }

  return (
    <section data-share-card aria-label="Teilen" className="grid justify-items-start gap-2 pt-2">
      {share ? (
        <>
          <p className="px-3.5 text-sm text-muted-foreground">
            Geteilt seit {formatDateOnly(new Date(share.sharedAtMs), timeZone)}
          </p>
          <p
            data-share-link
            className="max-w-full rounded-xl bg-surface-2 px-3.5 py-2 font-mono text-xs break-all select-all"
          >
            {link}
          </p>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={copy}
              className={`${BUTTON} text-foreground hover:bg-surface-2`}
            >
              <Copy aria-hidden className="size-4" />
              Link kopieren
            </button>
            {canSend && (
              <button
                type="button"
                onClick={send}
                className={`${BUTTON} text-foreground hover:bg-surface-2`}
              >
                <Send aria-hidden className="size-4" />
                Senden…
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => ask("stop")}
              className={`${BUTTON} text-destructive hover:bg-destructive-wash`}
            >
              <Unlink aria-hidden className="size-4" />
              {pending ? "Beenden…" : "Teilen beenden"}
            </button>
          </div>
          <p role="status" className="px-3.5 text-sm text-muted-foreground">
            {copied ? "Link kopiert" : ""}
          </p>
        </>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => ask("share")}
          className={`${BUTTON} text-foreground hover:bg-surface-2`}
        >
          <Share2 aria-hidden className="size-4" />
          {pending ? "Teilen…" : "Scheibe teilen"}
        </button>
      )}
      {error && (
        <p role="alert" className="px-3.5 text-sm text-destructive">
          {error}
        </p>
      )}
      <DecisionDialog
        decision={kind === "stop" ? cardShareStop({ evening: when }) : cardShare({ evening: when })}
        open={open}
        onOpenChange={setOpen}
        onConfirm={() => {
          const stopping = kind === "stop"
          startTransition(async () => {
            setError(null)
            if (stopping) {
              const result = await stopSharingCard(cardId)
              if ("error" in result) {
                setError(getErrorMessage(result) ?? "Das Teilen ließ sich nicht beenden.")
                return
              }
              onChange(null)
            } else {
              const result = await shareCard(cardId)
              if ("error" in result || !result.data) {
                setError(getErrorMessage(result) ?? "Der Link ließ sich nicht erstellen.")
                return
              }
              onChange(result.data)
            }
            // die Seite neu vom Server, damit Zurück und Vor den neuen Stand zeigen (der Cache von Next hielte den alten)
            router.refresh()
          })
        }}
      />
    </section>
  )
}
