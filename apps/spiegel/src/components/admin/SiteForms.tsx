"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect, useRef, useState, useTransition } from "react"

import { getErrorMessage, getFieldError, getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { FieldError } from "@vereinsheim/ui/field-error"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import { DecisionDialog } from "@/components/shell/DecisionDialog"
import {
  bridgeRevoke,
  rankingKind,
  siteTimeZone,
  type Decision,
  type RankingChoice,
} from "@/lib/admin/consequences"
import type { BridgeRow, RankingRow, SiteOverview } from "@/lib/admin/site"
import { pairBridge, revokeBridgeAction, saveSite, setRankingKind } from "@/lib/admin/site-actions"

import { AdminHelp } from "./AdminHelp"

const CARD = "grid gap-4 rounded-2xl border border-border bg-card p-5"

/** Name und Zeitzone der Anlage; ohne Anlage legt das Formular sie an */
export function SiteForm({ site }: { site: SiteOverview["site"] }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(saveSite, null)
  // eine geänderte Zeitzone fragt mit ihren Folgen (P2c, D8); Name allein speichert ohne Rückfrage
  const formRef = useRef<HTMLFormElement>(null)
  const confirmed = useRef(false)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [asking, setAsking] = useState(false)
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
    <form
      ref={formRef}
      action={action}
      onSubmit={(event) => {
        if (confirmed.current) {
          confirmed.current = false
          return
        }
        if (site && timeZone.trim() !== site.timeZone) {
          event.preventDefault()
          setDecision(siteTimeZone({ zone: timeZone.trim() }))
          setAsking(true)
        }
      }}
      className={CARD}
    >
      <h2 className="flex items-center gap-1 text-[15px] font-semibold">
        {site ? "Meyton-Anlage" : "Meyton-Anlage einrichten"} <AdminHelp id="site" />
      </h2>
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
        <span className="flex items-center gap-1">
          <Label htmlFor="timeZone">Zeitzone der Anlage</Label> <AdminHelp id="timeZone" />
        </span>
        <Input
          id="timeZone"
          name="timeZone"
          value={timeZone}
          onChange={(e) => setTimeZone(e.target.value)}
          disabled={pending}
          {...aria("timeZone")}
        />
        <p className="text-xs text-muted-foreground">
          Meyton speichert Uhrzeiten ohne Zone; Spiegel rechnet sie mit dieser um. In Deutschland
          Europe/Berlin.
        </p>
        <FieldError id="timeZone-error" message={getFieldError(state, "timeZone")} />
      </div>
      {getGeneralError(state) && (
        <p role="alert" className="text-sm text-destructive">
          {getGeneralError(state)}
        </p>
      )}
      <Button type="submit" className="h-10 justify-self-start" disabled={pending}>
        {pending ? "Speichern…" : site ? "Speichern" : "Anlage einrichten"}
      </Button>
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

/** „Brücke koppeln“: ein Code, der nur jetzt zu sehen ist (15 Minuten gültig, einmal einlösbar) */
export function PairBridgeForm() {
  const [state, action, pending] = useActionState(pairBridge, null)
  const [name, setName] = useState("")
  const code = state && "success" in state ? state.data : undefined
  return (
    <form action={action} className={CARD}>
      <h2 className="flex items-center gap-1 text-[15px] font-semibold">
        Brücke koppeln <AdminHelp id="pairingCode" />
      </h2>
      <p className="text-sm text-foreground-2">
        Spiegel zeigt einen Code für ein Gerät. Ihn bei der Installation der Brücke zusammen mit der
        Adresse von Spiegel eintragen. Der Code gilt 15 Minuten und nur einmal. Wer ihn eingibt,
        darf Scheiben schicken; behandle ihn wie ein Passwort.
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
    bridge.heldBack,
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
          <DecisionDialog
            decision={bridgeRevoke({ device: bridge.name })}
            open={open}
            onOpenChange={setOpen}
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

const RANKING_OPTIONS = [
  { value: "open", label: "Nicht zugeordnet (Training)" },
  { value: "training", label: "Training" },
  { value: "competition", label: "Wettkampf" },
] as const

/**
 * eine Rangliste mit ihrer Art; gespeichert erst nach dem Dialog mit den Folgen (P2c, D7), weil eine Wahl alle
 * Scheiben der Rangliste umstellt
 */
export function RankingItem({ ranking }: { ranking: RankingRow }) {
  const router = useRouter()
  const saved: RankingChoice = ranking.kind ?? "open"
  const [wanted, setWanted] = useState<RankingChoice>(saved)
  const [asking, setAsking] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <li
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
      data-ranking={ranking.id}
    >
      <span className="grid min-w-0">
        <span className="truncate text-[15px] font-semibold">{ranking.name}</span>
        <span className="text-[13px] text-muted-foreground">
          {ranking.cards === 1 ? "1 Scheibe" : `${ranking.cards} Scheiben`}
        </span>
        {error && (
          <span role="alert" className="text-[13px] text-destructive">
            {error}
          </span>
        )}
      </span>
      <Segmented
        label={`Art der Rangliste ${ranking.name}`}
        options={RANKING_OPTIONS}
        value={saved}
        onChange={(value) => {
          if (pending || value === saved) return
          setWanted(value)
          setAsking(true)
        }}
      />
      <DecisionDialog
        decision={rankingKind({ ranking: ranking.name, cards: ranking.cards, kind: wanted })}
        open={asking}
        onOpenChange={setAsking}
        onConfirm={() =>
          startTransition(async () => {
            const result = await setRankingKind(ranking.id, wanted)
            if ("error" in result) setError(getErrorMessage(result) ?? null)
            else {
              setError(null)
              router.refresh()
            }
          })
        }
      />
    </li>
  )
}
