"use client"

import { cn } from "@vereinsheim/lib/utils"
import type { ReactNode } from "react"

import { HelpIcon } from "../help/HelpButton"
import type { Layer, ViewState } from "../view-state"
import type { Others } from "./display"

export type { Others } from "./display"

export interface TargetControlsProps {
  state: ViewState
  others: Others
  onToggle: (layer: Layer) => void
  onView: (view: ViewState["view"]) => void
  onOthers: (others: Others) => void
  /** das „?“ oben rechts: Erklärung der Scheibe */
  onHelp: () => void
  className?: string
}

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  className: "size-4 shrink-0",
} as const

const ICONS: Readonly<Record<"zoom" | "others" | Layer, ReactNode>> = {
  zoom: (
    <svg {...svgProps}>
      <circle cx={10.5} cy={10.5} r={6.5} />
      <path d="M15.5 15.5 20 20M10.5 8v5M8 10.5h5" />
    </svg>
  ),
  // ein Schuss voll, zwei blass: die übrigen
  others: (
    <svg {...svgProps} stroke="none" fill="currentColor">
      <circle cx={12} cy={12.5} r={3.2} />
      <circle cx={5.5} cy={6.5} r={2.6} opacity={0.4} />
      <circle cx={18.5} cy={17.5} r={2.6} opacity={0.4} />
    </svg>
  ),
  // wie das Zeichen auf der Scheibe: zwei Viertel gefüllt
  mpi: (
    <svg {...svgProps}>
      <circle cx={12} cy={12} r={7.5} />
      <path
        d="M12 12V4.5A7.5 7.5 0 0 1 19.5 12ZM12 12v7.5A7.5 7.5 0 0 1 4.5 12Z"
        fill="currentColor"
      />
    </svg>
  ),
  circle: (
    <svg {...svgProps}>
      <circle cx={12} cy={12} r={8.5} />
      <g stroke="none" fill="currentColor">
        <circle cx={9.5} cy={10.5} r={1.6} />
        <circle cx={14.5} cy={9.5} r={1.6} />
        <circle cx={12.5} cy={14.5} r={1.6} />
      </g>
    </svg>
  ),
  ellipse: (
    <svg {...svgProps}>
      <ellipse
        cx={12}
        cy={12}
        rx={9}
        ry={5}
        transform="rotate(-35 12 12)"
        strokeDasharray="3 2.5"
      />
      <circle cx={12} cy={12} r={1.6} stroke="none" fill="currentColor" />
    </svg>
  ),
  numbers: (
    <svg {...svgProps}>
      <path d="M5.5 8.5 8 7v10M13 9.5a2.5 2.5 0 1 1 4.6 1.4L13 17h5.5" />
    </svg>
  ),
}

/** Name des Knopfs (auch als Tooltip) und was er schaltet */
const LAYER_LABELS: Readonly<Record<Layer, string>> = {
  mpi: "Schwerpunkt",
  circle: "Streukreis",
  ellipse: "Vertrauensellipse",
  numbers: "Nummern",
}

/** das Zeichen der Lupe: auf die Gruppe zoomen und zurück (auch beim Vergleichen) */
export const ZOOM_ICON = ICONS.zoom

/** ein runder Knopf in einer Ecke eines Bilds der Scheibe (auch das Bild beim Vergleichen) */
export function CornerButton({
  label,
  pressed,
  onPress,
  children,
  help,
}: {
  label: string
  pressed?: boolean
  onPress: () => void
  children: ReactNode
  help?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      data-help={help}
      // Knöpfe auf der Scheibe setzen und wählen keinen Schuss
      onClick={(event) => {
        event.stopPropagation()
        onPress()
      }}
      className="pointer-events-auto inline-flex size-7 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-card text-muted-foreground shadow-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
    >
      {children}
    </button>
  )
}

/**
 * Schalter in den Ecken der Scheibe, wie an einer DISAG-Anzeige: oben links
 * Ausschnitt und übrige Schüsse, oben rechts das „?“, unten links Schwerpunkt und Streukreis, unten rechts
 * Vertrauensellipse und Nummern. So braucht die Scheibe keine Leiste, die in schmalen Spalten umbricht oder
 * angeschnitten wird. Mit 28 px je Knopf und zwei je Ecke bleibt der äußere Ring im Ausschnitt „Scheibe“
 * frei, solange der Kasten mindestens 290 px breit ist. Liegt im Kasten der Scheibe (`relative`).
 */
export function TargetControls({
  state,
  others,
  onToggle,
  onView,
  onOthers,
  onHelp,
  className,
}: TargetControlsProps) {
  const layer = (key: Layer) => (
    <CornerButton
      key={key}
      label={LAYER_LABELS[key]}
      pressed={state.layers[key]}
      onPress={() => onToggle(key)}
    >
      {ICONS[key]}
    </CornerButton>
  )
  const corner = "absolute flex gap-1"
  return (
    <div
      role="group"
      aria-label="Ansicht der Scheibe"
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      <div className={cn(corner, "top-2 left-2")}>
        <CornerButton
          label="Auf Gruppe zoomen"
          pressed={state.view === "group"}
          onPress={() => onView(state.view === "group" ? "target" : "group")}
        >
          {ICONS.zoom}
        </CornerButton>
        <CornerButton
          label="Übrige Schüsse blass zeigen"
          pressed={others === "dim"}
          onPress={() => onOthers(others === "dim" ? "hide" : "dim")}
        >
          {ICONS.others}
        </CornerButton>
      </div>
      <div className={cn(corner, "top-2 right-2")}>
        <CornerButton label="Erklärung: Trefferbild" help="trefferbild" onPress={onHelp}>
          <HelpIcon />
        </CornerButton>
      </div>
      <div className={cn(corner, "bottom-2 left-2")}>{(["mpi", "circle"] as const).map(layer)}</div>
      <div className={cn(corner, "right-2 bottom-2")}>
        {(["ellipse", "numbers"] as const).map(layer)}
      </div>
    </div>
  )
}
