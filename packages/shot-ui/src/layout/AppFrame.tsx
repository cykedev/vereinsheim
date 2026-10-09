"use client"

import { cn } from "@vereinsheim/lib/utils"
import {
  ChartLine,
  CircleUser,
  House,
  List,
  ScanQrCode,
  Shield,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import type { Area } from "../nav/areas"
import { RouteLink } from "../nav/RouteLink"
import type { Route } from "../nav/routes"

const ITEMS: Readonly<Record<Area, { label: string; short: string; Icon: LucideIcon }>> = {
  start: { label: "Start", short: "Start", Icon: House },
  cards: { label: "Scheiben", short: "Scheiben", Icon: List },
  scan: { label: "QR scannen", short: "Scannen", Icon: ScanQrCode },
  progress: { label: "Fortschritt", short: "Fortschritt", Icon: ChartLine },
  profile: { label: "Profil", short: "Profil", Icon: CircleUser },
  admin: { label: "Admin", short: "Admin", Icon: Shield },
}

/** die untere und die schmale Leiste: Scannen in der Mitte, Admin steckt in Profil (Entscheidung 16) */
const BAR: readonly Area[] = ["start", "cards", "scan", "progress", "profile"]

// Telefon quer heißt unter 1024 px breit und unter 500 px hoch (D1): `max-lg:[@media(max-height:499px)]:`. Die
// Klassen stehen wörtlich da, Tailwind findet nur, was im Quelltext steht (nicht aus Konstanten zusammengesetzt).

export interface AppFrameProps {
  /** der Bereich der gezeigten Seite; null: keiner (etwa die Beispiele im Labor) */
  current: Area | null
  /** wohin jeder Eintrag führt (`areaLinks`) */
  links: Record<Area, Route>
  /** Zahl der offenen Dinge am Start-Symbol (Entscheidung 8) */
  openCount: number
  /** nur ein Admin sieht Admin */
  isAdmin: boolean
  /** unten in der Seitenleiste, etwa die Darstellung (Labor näher an der App, D2); nicht in den Leisten des Telefons */
  sidebarFooter?: ReactNode
  children?: ReactNode
}

/**
 * Rahmen der App (Plan N3, D1, D2): ab 1024 px eine Seitenleiste, darunter eine untere Leiste mit Scannen in der
 * Mitte, im Querformat des Telefons eine schmale Leiste links. Die Wurzel setzt `--app-bar`, den Platz, den die
 * untere Leiste samt Scan-Knopf unten einnimmt; Seite, Pille und Scheibe richten sich danach.
 */
export function AppFrame({
  current,
  links,
  openCount,
  isAdmin,
  sidebarFooter,
  children,
}: AppFrameProps) {
  const name = (area: Area) =>
    area === "start" && openCount > 0 ? `Start, ${openCount} offen` : undefined
  const badge = (area: Area, className: string) =>
    area === "start" && openCount > 0 ? (
      <span
        data-badge
        aria-hidden="true"
        className={cn(
          "min-w-[1.125rem] rounded-full bg-primary px-1 text-center text-xs leading-[1.125rem] font-semibold text-primary-foreground tabular-nums",
          className
        )}
      >
        {openCount}
      </span>
    ) : null
  // auf dem Telefon steckt Admin in Profil: ist Admin offen, ist dort Profil der Bereich (Entscheidung 16)
  const inBar = current === "admin" ? "profile" : current
  const link = (
    area: Area,
    className: string,
    content: ReactNode,
    label?: string,
    active: Area | null = current
  ) => (
    <RouteLink
      key={area}
      route={links[area]}
      data-area={area}
      aria-current={active === area ? "page" : undefined}
      aria-label={label ?? name(area)}
      className={cn("cursor-pointer focus-visible:outline-2 focus-visible:outline-ring", className)}
    >
      {content}
    </RouteLink>
  )
  const sideEntry = (area: Area) => {
    const { label, Icon } = ITEMS[area]
    return link(
      area,
      "flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-semibold text-foreground-2 hover:bg-surface-2 aria-[current=page]:bg-accent-wash aria-[current=page]:text-foreground",
      <>
        <Icon aria-hidden="true" className="size-[18px] shrink-0" />
        <span className="flex-1">{label}</span>
        {badge(area, "")}
      </>
    )
  }

  return (
    <div
      data-app-frame
      className={cn(
        "[--app-bar:72px] lg:[--app-bar:0px]",
        "max-lg:[@media(max-height:499px)]:[--app-bar:0px]"
      )}
    >
      <div
        data-app-sidebar
        className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col overflow-y-auto border-r border-border bg-card px-3 py-5 lg:flex"
      >
        <nav aria-label="Bereiche" className="flex flex-col gap-1">
          <p className="px-3 pb-4 font-display text-xl font-bold tracking-tight">Spiegel</p>
          {(["start", "cards", "progress"] as const).map(sideEntry)}
          {link(
            "scan",
            "mt-3 flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[14px] font-semibold text-primary-foreground hover:opacity-90 aria-[current=page]:ring-2 aria-[current=page]:ring-ring aria-[current=page]:ring-offset-2 aria-[current=page]:ring-offset-card",
            <>
              <ScanQrCode aria-hidden="true" className="size-[18px]" />
              QR scannen
            </>
          )}
          <div aria-hidden="true" className="my-3 border-t border-border" />
          {sideEntry("profile")}
          {isAdmin && sideEntry("admin")}
        </nav>
        {/* Einstellungen gehören nicht in die Navigation: neben ihr, unten in der Seitenleiste (Review) */}
        {sidebarFooter && (
          <div data-sidebar-footer className="mt-auto border-t border-border px-1 pt-3">
            {sidebarFooter}
          </div>
        )}
      </div>

      <nav
        aria-label="Bereiche"
        data-app-rail
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden w-[calc(4rem+env(safe-area-inset-left))] flex-col items-center gap-2 border-r border-border bg-card py-3 pl-[env(safe-area-inset-left)]",
          "max-lg:[@media(max-height:499px)]:flex"
        )}
      >
        {BAR.map((area) => {
          const { label, Icon } = ITEMS[area]
          return link(
            area,
            area === "scan"
              ? "flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground aria-[current=page]:ring-2 aria-[current=page]:ring-ring aria-[current=page]:ring-offset-2 aria-[current=page]:ring-offset-card"
              : "relative flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 aria-[current=page]:bg-accent-wash aria-[current=page]:text-primary",
            <>
              <Icon aria-hidden="true" className="size-5" />
              {badge(area, "absolute top-0.5 right-0.5")}
            </>,
            name(area) ?? label,
            inBar
          )
        })}
      </nav>

      {/* der Inhalt vor der unteren Leiste: sie steht fest unten, im Fokus und für Screenreader kommt sie danach */}
      <main
        data-app-content
        className={cn(
          "lg:pl-56",
          "max-lg:[@media(max-height:499px)]:pl-[calc(4rem+env(safe-area-inset-left))]",
          "max-lg:[@media(max-height:499px)]:pr-[env(safe-area-inset-right)]",
          "pb-[calc(var(--app-bar)+env(safe-area-inset-bottom))]"
        )}
      >
        {children}
      </main>

      <nav
        aria-label="Bereiche"
        data-app-bar
        className={cn(
          "fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden",
          "max-lg:[@media(max-height:499px)]:hidden"
        )}
      >
        <div className="mx-auto grid h-14 max-w-lg grid-cols-5">
          {BAR.map((area) => {
            const { short, label, Icon } = ITEMS[area]
            if (area === "scan")
              return (
                <div key={area} className="flex justify-center">
                  {link(
                    area,
                    "-mt-4 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background aria-[current=page]:ring-accent-wash",
                    <Icon aria-hidden="true" className="size-6" />,
                    label,
                    inBar
                  )}
                </div>
              )
            return link(
              area,
              "flex flex-col items-center justify-center gap-0.5 text-xs font-semibold text-muted-foreground aria-[current=page]:text-primary",
              <>
                <span className="relative">
                  <Icon aria-hidden="true" className="size-5" />
                  {badge(area, "absolute -top-1.5 -right-2.5")}
                </span>
                {short}
              </>,
              undefined,
              inBar
            )
          })}
        </div>
      </nav>
    </div>
  )
}
