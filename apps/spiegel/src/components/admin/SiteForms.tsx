"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState, useTransition } from "react"

import { getErrorMessage, getFieldError, getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { FieldError } from "@vereinsheim/ui/field-error"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import { ConfirmDialog } from "@vereinsheim/ui/shell/ConfirmDialog"

import type { BridgeRow, SiteOverview } from "@/lib/admin/site"
import { confirmEpoch, pairBridge, revokeBridgeAction, saveSite } from "@/lib/admin/site-actions"

const CARD = "grid gap-4 rounded-2xl border border-border bg-card p-5"

/** Name und Zeitzone der Anlage; ohne Anlage legt das Formular sie an */
export function SiteForm({ site }: { site: SiteOverview["site"] }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(saveSite, null)
  // gesteuert: React setzt ein Formular mit Server Action nach dem Absenden zurück
  const [name, setName] = useState(site?.name ?? "")
  const [timeZone, setTimeZone] = useState(site?.timeZone ?? "Europe/Berlin")
  useEffect(() => {
    if (state && "success" in state) router.refresh()
  }, [state, router])
  const aria = (field: string) =>
    getFieldError(state, field)
      ? { "aria-invalid": true as const, "aria-describedby": `${field}-error` }
      : {}
  return (
    <form action={action} className={CARD}>
      <h2 className="text-[15px] font-semibold">{site ? "Anlage" : "Anlage anlegen"}</h2>
      <div className="grid gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
          {...aria("name")}
        />
        <FieldError id="name-error" message={getFieldError(state, "name")} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="timeZone">Zeitzone der Anlage</Label>
        <Input
          id="timeZone"
          name="timeZone"
          value={timeZone}
          onChange={(e) => setTimeZone(e.target.value)}
          disabled={pending}
          {...aria("timeZone")}
        />
        <p className="text-xs text-muted-foreground">
          Meyton speichert Ortszeit ohne Zone; Spiegel rechnet mit dieser Zeitzone nach UTC.
        </p>
        <FieldError id="timeZone-error" message={getFieldError(state, "timeZone")} />
      </div>
      {getGeneralError(state) && (
        <p role="alert" className="text-sm text-destructive">
          {getGeneralError(state)}
        </p>
      )}
      <Button type="submit" className="h-10 justify-self-start" disabled={pending}>
        {pending ? "Speichern…" : site ? "Speichern" : "Anlage anlegen"}
      </Button>
    </form>
  )
}

/** „Brücke koppeln“: ein Code, der nur jetzt zu sehen ist (15 Minuten gültig, einmal einlösbar) */
export function PairBridgeForm() {
  const [state, action, pending] = useActionState(pairBridge, null)
  const [name, setName] = useState("")
  const code = state && "success" in state ? state.data : undefined
  return (
    <form action={action} className={CARD}>
      <h2 className="text-[15px] font-semibold">Brücke koppeln</h2>
      <p className="text-sm text-foreground-2">
        Spiegel zeigt einen Code für ein Gerät. Ihn bei der Installation der Brücke zusammen mit der
        Adresse von Spiegel eintragen; er gilt 15 Minuten und nur einmal.
      </p>
      <div className="grid gap-1.5">
        <Label htmlFor="bridge-name">Name des Geräts</Label>
        <Input
          id="bridge-name"
          name="name"
          placeholder="Pi im Schützenhaus"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={pending}
        />
        <FieldError id="bridge-name-error" message={getFieldError(state, "name")} />
      </div>
      {state && "error" in state && typeof state.error === "string" && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {code && (
        <div
          role="status"
          className="grid gap-1 rounded-xl border border-line-strong bg-surface-2 p-4"
        >
          <span className="text-[13px] text-muted-foreground">Kopplungscode</span>
          <code className="font-mono text-2xl font-semibold tracking-widest" data-pairing-code>
            {code.code}
          </code>
          <span className="text-[13px] text-muted-foreground">gültig bis {code.until} Uhr</span>
        </div>
      )}
      <Button type="submit" className="h-10 justify-self-start" disabled={pending}>
        {pending ? "Code wird erzeugt…" : "Code erzeugen"}
      </Button>
    </form>
  )
}

const STATUS_TEXT: Record<NonNullable<BridgeRow["status"]>, string> = {
  ok: "läuft",
  delayed: "verzögert",
  "db-unreachable": "Anlage nicht erreichbar",
  "db-error": "Anlage meldet Fehler",
  "possible-reset": "Ablage geleert? Bitte prüfen",
}

/** eine Brücke mit Status und „Widerrufen“ */
export function BridgeItem({ bridge }: { bridge: BridgeRow }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const facts = [
    bridge.version && `Version ${bridge.version}`,
    bridge.lastHeartbeatAt
      ? `zuletzt online ${bridge.lastHeartbeatAt}`
      : bridge.lastSeenAt
        ? `zuletzt gesehen ${bridge.lastSeenAt}`
        : "noch kein Kontakt",
    bridge.status && STATUS_TEXT[bridge.status],
    bridge.clockOffsetSeconds !== null &&
      Math.abs(bridge.clockOffsetSeconds) >= 60 &&
      `Uhr der Anlage ${bridge.clockOffsetSeconds > 0 ? "+" : ""}${bridge.clockOffsetSeconds} s`,
    bridge.backlog ? `${bridge.backlog} Scheiben im Rückstau` : null,
  ].filter(Boolean)
  return (
    <li
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      data-bridge={bridge.id}
    >
      <span className="grid min-w-0">
        <span className="truncate text-[15px] font-semibold">
          {bridge.name}
          {bridge.revoked && <span className="text-muted-foreground"> · widerrufen</span>}
        </span>
        <span className="text-[13px] text-muted-foreground">
          gekoppelt {bridge.createdAt}
          {facts.length ? ` · ${facts.join(" · ")}` : ""}
        </span>
        {error && (
          <span role="alert" className="text-[13px] text-destructive">
            {error}
          </span>
        )}
      </span>
      {!bridge.revoked && (
        <>
          <Button
            type="button"
            variant="ghost"
            className="h-10 text-destructive"
            disabled={pending}
            onClick={() => setOpen(true)}
          >
            Widerrufen
          </Button>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            title={`„${bridge.name}“ widerrufen?`}
            description="Der Token gilt sofort nicht mehr. Um das Gerät wieder zu nutzen, es neu koppeln."
            confirmLabel="Widerrufen"
            destructive
            onConfirm={() =>
              startTransition(async () => {
                const result = await revokeBridgeAction(bridge.id)
                if ("error" in result) setError(getErrorMessage(result) ?? null)
                else router.refresh()
              })
            }
          />
        </>
      )}
    </li>
  )
}

/** eine unbestätigte Epoche bestätigen (SF-23): erst dann nimmt Spiegel aus ihr an */
export function ConfirmEpochButton({ sourceId, epoch }: { sourceId: number; epoch: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      {error && (
        <span role="alert" className="text-[13px] text-destructive">
          {error}
        </span>
      )}
      <Button
        type="button"
        variant="outline"
        className="h-10"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        Epoche {epoch} bestätigen
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Epoche ${epoch} bestätigen?`}
        description="Eine neue Epoche heißt: Die Ablage der Anlage wurde geleert oder der Meyton-Server neu aufgesetzt. Erst danach nimmt Spiegel Scheiben aus ihr an."
        confirmLabel="Bestätigen"
        onConfirm={() =>
          startTransition(async () => {
            const result = await confirmEpoch(sourceId)
            if ("error" in result) setError(getErrorMessage(result) ?? null)
            else router.refresh()
          })
        }
      />
    </>
  )
}
