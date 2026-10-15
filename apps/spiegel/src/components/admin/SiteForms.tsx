"use client"

import { useRouter } from "next/navigation"
import { useActionState, useEffect, useState, useTransition } from "react"

import { getErrorMessage, getFieldError, getGeneralError } from "@vereinsheim/lib/forms/fieldErrors"
import { Button } from "@vereinsheim/ui/button"
import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { FieldError } from "@vereinsheim/ui/field-error"
import { Input } from "@vereinsheim/ui/input"
import { Label } from "@vereinsheim/ui/label"
import { DecisionDialog } from "@/components/shell/DecisionDialog"
import {
  bridgeRemove,
  bridgeRevoke,
  rankingKind,
  type RankingChoice,
} from "@/lib/admin/consequences"
import type { BridgeRow, RankingRow, SiteOverview } from "@/lib/admin/site"
import {
  pairBridge,
  removeBridgeAction,
  revokeBridgeAction,
  saveSite,
  setRankingKind,
} from "@/lib/admin/site-actions"

import { AdminHelp } from "./AdminHelp"

const CARD = "grid gap-4 rounded-2xl border border-border bg-card p-5"

/** Name und Zeitzone der Anlage; ohne Anlage legt das Formular sie an */
export function SiteForm({ site }: { site: SiteOverview["site"] }) {
  const router = useRouter()
  const [state, action, pending] = useActionState(saveSite, null)
  // die Zeitzone ist fest, sobald Scheiben da sind: vorher hat sie keine Folgen, danach verschöbe sie jede Scheibe, zu
  // der noch ein Stand kommt
  const zoneLocked = !!site?.hasCards
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
          readOnly={zoneLocked}
          {...aria("timeZone")}
        />
        <p className="text-xs text-muted-foreground">
          {zoneLocked
            ? "Lässt sich nicht mehr ändern, weil schon Scheiben da sind. Sonst stünden bei ihnen falsche Uhrzeiten."
            : "Meyton speichert Uhrzeiten ohne Zeitzone. Spiegel braucht sie, um die Uhrzeit jeder Scheibe richtig zu zeigen. In Deutschland: Europe/Berlin. Sobald die erste Scheibe da ist, lässt sie sich nicht mehr ändern."}
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
        Brücke verbinden <AdminHelp id="pairingCode" />
      </h2>
      <ol className="grid list-decimal gap-1 pl-5 text-sm text-foreground-2">
        <li>Gib dem Gerät einen Namen und erzeuge einen Code.</li>
        <li>
          Trag den Code bei der Einrichtung der Brücke ein, zusammen mit der Adresse von Spiegel.
        </li>
      </ol>
      <p className="text-sm text-foreground-2">
        Der Code gilt 15 Minuten und nur einmal. Wer ihn hat, kann Scheiben an Spiegel schicken.
        Behandle ihn wie ein Passwort.
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
          <span className="text-[13px] text-muted-foreground">Code für die Brücke</span>
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
  delayed: "schickt gerade langsamer als sonst",
  "db-unreachable": "erreicht die Meyton-Anlage nicht",
  "db-error": "bekommt Fehler von der Meyton-Anlage",
  "possible-reset": "Meyton-Anlage wirkt neu aufgesetzt (Spiegel regelt das selbst)",
}

/**
 * Was der Knopf an einer Brücke tut, an einer Stelle: laufend trennen, getrennt entfernen. Text, Dialog und Action
 * kommen zusammen, der Test prüft die Zuordnung
 */
export function bridgeActionOf(bridge: { name: string; revoked: boolean }) {
  return bridge.revoked
    ? {
        label: "Entfernen",
        decision: bridgeRemove({ device: bridge.name }),
        run: removeBridgeAction,
      }
    : {
        label: "Trennen",
        decision: bridgeRevoke({ device: bridge.name }),
        run: revokeBridgeAction,
      }
}

/** eine Brücke mit Status und „Trennen“ (laufend) oder „Entfernen“ (getrennt) */
export function BridgeItem({ bridge }: { bridge: BridgeRow }) {
  const router = useRouter()
  const action = bridgeActionOf(bridge)
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
      `Uhr der Meyton-Anlage geht ${Math.abs(bridge.clockOffsetSeconds)} s ${bridge.clockOffsetSeconds > 0 ? "vor" : "nach"}`,
    bridge.backlog
      ? `${bridge.backlog === 1 ? "1 Scheibe" : `${bridge.backlog} Scheiben`} noch nicht geschickt`
      : null,
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
          {bridge.revoked && <span className="text-muted-foreground"> · getrennt</span>}
        </span>
        <span className="text-[13px] text-muted-foreground">
          verbunden am {bridge.createdAt}
          {facts.length ? ` · ${facts.join(" · ")}` : ""}
        </span>
        {error && (
          <span role="alert" className="text-[13px] text-destructive">
            {error}
          </span>
        )}
      </span>
      <Button
        type="button"
        variant="ghost"
        className="h-10 text-destructive"
        disabled={pending}
        onClick={() => setOpen(true)}
      >
        {action.label}
      </Button>
      <DecisionDialog
        decision={action.decision}
        open={open}
        onOpenChange={setOpen}
        onConfirm={() =>
          startTransition(async () => {
            const result = await action.run(bridge.id)
            if ("error" in result) setError(getErrorMessage(result) ?? null)
            else router.refresh()
          })
        }
      />
    </li>
  )
}

const RANKING_OPTIONS = [
  { value: "open", label: "Nicht festgelegt" },
  { value: "training", label: "Training" },
  { value: "competition", label: "Wettkampf" },
] as const

/**
 * eine Liste aus Meyton (`Ranking`) mit ihrer Art; gespeichert erst nach dem Dialog mit den Folgen, weil eine Wahl
 * alle Scheiben der Liste umstellt
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
        label={`Art der Liste ${ranking.name}`}
        options={RANKING_OPTIONS}
        // während gefragt und gespeichert wird, steht die Wahl da; Abbrechen zeigt wieder die gespeicherte
        value={asking || pending ? wanted : saved}
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
