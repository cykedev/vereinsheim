import { Segmented } from "@vereinsheim/ui/design2/segmented"
import type { ReactNode } from "react"

export type Theme = "system" | "light" | "dark"
/** die Ansichten des Labors: die Bereiche der App (Platzhalter für Start, Scannen, Profil, Admin) und die Scheibe */
export type LaborMode = "list" | "card" | "period" | "start" | "scan" | "profile" | "admin"
/** die App im Rahmen oder die Beispielscheiben, die nur das Labor hat */
export type LaborView = "app" | "samples"

export interface LaborHeaderProps {
  commit: string
  mode: LaborMode
  view: LaborView
  onView: (view: LaborView) => void
  theme: Theme
  onTheme: (theme: Theme) => void
  /** Umschalter der Ansicht (Scheibe, Beispiel, Tippen …) */
  children?: ReactNode
  /** Hinweis zum Beispiel unter den Umschaltern */
  hint: string
  /**
   * die Adresse, die die App für diese Ansicht hätte (Plan N1). Im Artifact kommt nur ein einfacher Anker an, das
   * Labor zeigt sie deshalb nur an.
   */
  address?: string
}

/**
 * Kopf des Labors: was es ist, der Stand, App oder Beispiele, die Darstellung und je Ansicht ihre Umschalter. Die
 * Bereiche wechselt der Rahmen der App (Plan N3), nicht der Kopf.
 */
export function LaborHeader({
  commit,
  mode,
  view,
  onView,
  theme,
  onTheme,
  children,
  hint,
  address,
}: LaborHeaderProps) {
  return (
    <header className="grid gap-2.5">
      <p className="font-mono text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        Spiegel · Labor
      </p>
      <h1 className="font-display text-[clamp(1.7rem,4vw,2.3rem)] font-bold tracking-tight text-balance">
        Die Bausteine im Einsatz
      </h1>
      <p className="max-w-[46rem] text-foreground-2">
        {mode === "list"
          ? "Die Scheiben-Liste aus den echten Bausteinen, über die erfundene Saison: jeder Abend mit seinen Scheiben, neueste zuerst. Wähle Familie und Art oben, tippe auf eine Zeile, um die Scheibe zu öffnen, oder auf „Verlauf dieser Filter“."
          : mode === "card"
            ? "Alles hier sind die echten Bausteine aus packages/shot-ui, mit dem Fachkern gerechnet. Tippe auf eine Serie, um nur sie zu sehen, auf einen Treffer oder eine Zeile der Tabelle, um ihn abzulesen, oder setze im Modus „Setzen“ eigene Schüsse. Das „?“ an einer Kachel oder Karte erklärt die Zahl."
            : mode === "period"
              ? "Die Seite eines Zeitraums aus den echten Bausteinen, über eine erfundene Saison. Wähle den Zeitraum oben, tippe in den Verlauf oder auf eine Zeile der Liste, um eine Scheibe abzulesen, und öffne sie mit „Scheibe öffnen“."
              : "Der Rahmen der App aus den echten Bausteinen: am Desktop die Seitenleiste, auf dem Telefon die untere Leiste mit Scannen in der Mitte. Dieser Bereich ist noch ein Platzhalter."}
      </p>
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-xs">
          Stand {commit}
        </span>
        <span className="rounded-full border border-line-strong px-2.5 py-1 font-mono text-xs">
          Design 2
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Labor"
          value={view}
          options={[
            { value: "app", label: "App" },
            { value: "samples", label: "Beispiele" },
          ]}
          onChange={onView}
        />
        {children}
        <Segmented
          label="Darstellung"
          value={theme}
          options={[
            { value: "system", label: "System" },
            { value: "light", label: "Hell" },
            { value: "dark", label: "Dunkel" },
          ]}
          onChange={onTheme}
        />
      </div>
      <p id="sample-hint" className="max-w-[46rem] text-[13px] text-muted-foreground">
        {hint}
      </p>
      {address && (
        <p className="max-w-[46rem] text-[13px] text-muted-foreground">
          Adresse in der App:{" "}
          <code data-address className="font-mono text-xs break-all text-foreground-2">
            {address}
          </code>
        </p>
      )}
    </header>
  )
}
