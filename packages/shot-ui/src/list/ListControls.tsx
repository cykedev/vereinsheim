"use client"

import { Segmented } from "@vereinsheim/ui/design2/segmented"

import { CardFilters } from "../controls/CardFilters"
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
  /** „Verlauf dieser Filter“: der Fortschritt mit Familie, Art und Zeitraum der Liste (`progressFromList`) */
  progress: ProgressRoute
}

/**
 * Filter der Scheiben-Liste (Plan N2, D7, D8): Familie und Art wie im Fortschritt, Merkmal nur wenn es welche gibt,
 * der Zeitraum aus dem Fortschritt als Chip mit „×“, dazu „Verlauf dieser Filter“. Ein Familienwechsel behält Art,
 * Merkmal und Zeitraum.
 */
export function ListControls({
  query,
  family,
  families,
  flags,
  rangeLabel,
  onQuery,
  progress,
}: ListControlsProps) {
  return (
    <div data-list-controls className="flex flex-wrap items-center gap-2">
      <CardFilters
        family={family}
        families={families}
        kind={query.kind}
        onFamily={(next) => onQuery({ ...query, family: next })}
        onKind={(kind) => onQuery({ ...query, kind })}
      />
      {flags.length > 0 && (
        <Segmented
          label="Merkmal"
          value={query.flag ?? ANY}
          options={[
            { value: ANY, label: "Alle" },
            ...flags.map((flag) => ({ value: flag, label: flagName(flag) })),
          ]}
          onChange={(flag) => onQuery({ ...query, flag: flag === ANY ? null : flag })}
        />
      )}
      {rangeLabel && (
        <span
          data-range-chip
          className="inline-flex items-center gap-1 rounded-full border border-line-strong py-1 pr-1 pl-3 text-[13px] text-foreground-2"
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
      )}
      <RouteLink
        route={progress}
        data-to-progress
        className="cursor-pointer rounded-full border border-line-strong px-3 py-1.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
      >
        Verlauf dieser Filter
      </RouteLink>
    </div>
  )
}
