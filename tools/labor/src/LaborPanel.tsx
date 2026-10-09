import { Sheet } from "@vereinsheim/ui/design2/sheet"
import { useState, type ReactNode } from "react"

export type Theme = "system" | "light" | "dark"
/** die Ansichten des Labors: die Bereiche der App (Start, Scheiben, Fortschritt, Platzhalter) und die Scheibe */
export type LaborMode = "list" | "card" | "period" | "start" | "scan" | "profile" | "admin"
/** die App im Rahmen oder die Beispielscheiben, die nur das Labor hat */
export type LaborView = "app" | "samples"

export interface LaborPanelProps {
  commit: string
  mode: LaborMode
  view: LaborView
  onView: (view: LaborView) => void
  /** Hinweis zum Beispiel oder zur Ansicht */
  hint: string
  /** die Adresse, die die App für diese Ansicht hätte (Plan N1); im Artifact nur angezeigt */
  address?: string
  /** Umschalter der Ansicht: Beispielscheiben, Tippen auf der Scheibe */
  children?: ReactNode
}

const ABOUT: Readonly<Record<LaborMode, string>> = {
  list: "Die Scheiben-Liste aus den echten Bausteinen, über die erfundene Saison: jeder Abend mit seinen Scheiben, neueste zuerst.",
  card: "Die Seite einer Scheibe aus den echten Bausteinen, mit dem Fachkern gerechnet. In den Beispielen lassen sich mit „Setzen“ eigene Schüsse tippen.",
  period:
    "Die Seite eines Zeitraums aus den echten Bausteinen, über eine erfundene Saison: Verlauf, Umfang, Liste, Zahlen, Analyse.",
  start:
    "Start aus den echten Bausteinen: was offen ist, der letzte Abend im Formband und die Form der letzten 90 Tage.",
  scan: "Scannen: Der QR-Code eines Meyton-Ausdrucks ordnet die Scheibe zu, mit dem Ausdruck als Beleg.",
  profile:
    "Profil mit der Darstellung (System, Hell, Dunkel); auf dem Telefon steht hier auch Admin.",
  admin:
    "Admin sieht nur ein Admin: in der Seitenleiste als letzter Eintrag, auf dem Telefon in Profil.",
}

/**
 * Die Werkzeuge des Labors (Labor näher an der App, D3): ein kleiner runder Knopf unten rechts über der Leiste öffnet
 * ein Blatt mit Stand, Adresse, Hinweis, den Beispielscheiben und dem Tippen auf der Scheibe. Die Seiten selbst sehen
 * so aus wie in der App; was nur das Labor hat, liegt hier.
 */
export function LaborPanel({
  commit,
  mode,
  view,
  onView,
  hint,
  address,
  children,
}: LaborPanelProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        data-labor-button
        aria-label="Labor-Werkzeuge"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-[calc(var(--app-bar,0px)+1rem+env(safe-area-inset-bottom))] z-40 inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-line-strong bg-card text-muted-foreground shadow-lg hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
          <path d="M8.5 2h7" />
          <path d="M7 16h10" />
        </svg>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Labor">
        <div data-labor-panel className="grid gap-4 text-[14px]">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-xs">
              Stand {commit}
            </span>
            <span className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-xs">
              Design 2
            </span>
          </div>
          <p className="text-foreground-2">{ABOUT[mode]}</p>
          <p id="sample-hint" className="text-[13px] text-muted-foreground">
            {hint}
          </p>
          {address && (
            <p className="text-[13px] text-muted-foreground">
              Adresse in der App:{" "}
              <code data-address className="font-mono text-xs break-all text-foreground-2">
                {address}
              </code>
            </p>
          )}
          {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onView(view === "samples" ? "app" : "samples")
            }}
            className="justify-self-start cursor-pointer rounded-full border border-line-strong px-3.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
          >
            {view === "samples" ? "Zurück zur App" : "Beispielscheiben öffnen"}
          </button>
        </div>
      </Sheet>
    </>
  )
}
