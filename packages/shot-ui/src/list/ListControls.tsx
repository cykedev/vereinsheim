"use client"

import { Segmented } from "@vereinsheim/ui/design2/segmented"
import { Sheet } from "@vereinsheim/ui/design2/sheet"
import { useState } from "react"

import { CardFilters, KIND_OPTIONS } from "../controls/CardFilters"
import { RouteLink } from "../nav/RouteLink"
import type { ListQuery, ProgressRoute } from "../nav/routes"

/** Namen der Merkmale (D7); Unbekanntes mit seiner Id */
const FLAG_NAMES: Readonly<Record<string, string>> = {
  "nur-pdf": "Nur PDF",
  unvollstaendig: "Unvollständig",
  ausgenommen: "Ausgenommen",
}
export const flagName = (flag: string) => FLAG_NAMES[flag] ?? flag

/** ohne Merkmal: alle Scheiben */
const ANY = ""

export interface ListControlsProps {
  query: ListQuery
  /** die Familie, die die Liste zeigt (aus dem Modell, auch wenn die Adresse keine nennt) */
  family: string
  families: readonly { value: string; label: string }[]
  /** Merkmale der Scheiben dieser Familie; ohne keine Wahl „Merkmal“ */
  flags: readonly string[]
  /** Name des Zeitraums aus „Alle in Scheiben zeigen“ (`resolveRange`); null: alle Abende */
  rangeLabel: string | null
  onQuery: (query: ListQuery) => void
  /** „Im Fortschritt zeigen“: der Fortschritt mit Familie, Art und Zeitraum der Liste (`progressFromList`) */
  progress: ProgressRoute
}

/** Was der Chip zeigt (U5, D6): was von der Vorgabe abweicht, sonst „Alle Scheiben“ */
export function listFilterSummary({
  kind,
  flag,
  rangeLabel,
}: {
  kind: ListQuery["kind"]
  flag: string | null
  rangeLabel: string | null
}): string {
  const parts = [
    kind === "all" ? null : (KIND_OPTIONS.find((o) => o.value === kind)?.label ?? null),
    flag ? flagName(flag) : null,
    rangeLabel,
  ].filter(Boolean)
  return parts.length ? parts.join(" · ") : "Alle Scheiben"
}

/**
 * Filter der Scheiben-Liste in einer Zeile (Plan N2, D7, D8; U5, D6 wie der Fortschritt): vorn die Familie, daneben
 * ein Chip mit der Zusammenfassung. Er öffnet das Blatt „Filter“ mit Art, Merkmal (nur wenn es welche gibt), dem
 * Zeitraum aus dem Fortschritt (mit „entfernen“) und dem Weg „Im Fortschritt zeigen“. Eine Wahl im Blatt gilt sofort.
 * Ein Familienwechsel behält Art, Merkmal und Zeitraum.
 */
export function ListControls(props: ListControlsProps) {
  const [open, setOpen] = useState(false)
  return (
    <ListControlsView
      {...props}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
    />
  )
}

/** die Ansicht ohne eigenen Zustand (für Tests und für eine Seite, die das Blatt selbst führt) */
export function ListControlsView({
  query,
  family,
  families,
  flags,
  rangeLabel,
  onQuery,
  progress,
  open,
  onOpen,
  onClose,
}: ListControlsProps & { open: boolean; onOpen: () => void; onClose: () => void }) {
  return (
    <div data-list-controls className="flex flex-wrap items-center gap-2">
      <CardFilters
        family={family}
        families={families}
        onFamily={(next) => onQuery({ ...query, family: next })}
      />
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        data-list-chip
        onClick={onOpen}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-primary bg-accent-wash px-3 py-1.5 text-[13px] leading-tight font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        {listFilterSummary({ kind: query.kind, flag: query.flag, rangeLabel })}
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <Sheet open={open} onClose={onClose} title="Filter">
        <div data-list-filter className="grid gap-4">
          <div className="grid gap-1.5">
            <span className="text-[13px] font-semibold text-muted-foreground">Art</span>
            <Segmented
              label="Art"
              value={query.kind}
              options={KIND_OPTIONS}
              onChange={(kind) => onQuery({ ...query, kind })}
            />
          </div>
          {flags.length > 0 && (
            <div className="grid gap-1.5">
              <span className="text-[13px] font-semibold text-muted-foreground">Merkmal</span>
              <Segmented
                label="Merkmal"
                value={query.flag ?? ANY}
                options={[
                  { value: ANY, label: "Alle" },
                  ...flags.map((flag) => ({ value: flag, label: flagName(flag) })),
                ]}
                onChange={(flag) => onQuery({ ...query, flag: flag === ANY ? null : flag })}
              />
            </div>
          )}
          {rangeLabel && (
            <div className="grid gap-1.5">
              <span className="text-[13px] font-semibold text-muted-foreground">
                Zeitraum aus dem Fortschritt
              </span>
              <span
                data-range-chip
                className="inline-flex w-fit items-center gap-1 rounded-full border border-line-strong py-1 pr-1 pl-3 text-[13px] text-foreground-2"
              >
                {rangeLabel}
                <button
                  type="button"
                  aria-label="Zeitraum entfernen"
                  onClick={() => onQuery({ ...query, range: null })}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="size-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </span>
            </div>
          )}
          <RouteLink
            route={progress}
            data-to-progress
            className="cursor-pointer justify-self-start rounded-full border border-line-strong px-3 py-1.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
          >
            Im Fortschritt zeigen
          </RouteLink>
        </div>
      </Sheet>
    </div>
  )
}
