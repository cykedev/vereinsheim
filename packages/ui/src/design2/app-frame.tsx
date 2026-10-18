"use client"

import { cn } from "@vereinsheim/lib/utils"
import type { LucideIcon } from "lucide-react"
import { Fragment, type ReactNode } from "react"

/** ein Eintrag der Navigation */
export interface FrameItem {
  key: string
  /** Name in der Seitenleiste und für Screenreader */
  label: string
  /** kurzer Name unter dem Symbol der unteren Leiste */
  short: string
  Icon: LucideIcon
  /** Zahl der offenen Dinge am Symbol; ohne oder 0: kein Zeichen */
  badge?: number
  /** Name des Eintrags, solange ein Zeichen steht (etwa „Start, 2 offen“) */
  badgeLabel?: string
}

/** was ein Link der Navigation bekommt; die App rendert damit ihren Link (`next/link`, eigener Router) */
export interface FrameLinkProps {
  "data-area": string
  "aria-current"?: "page"
  "aria-label"?: string
  className: string
  children: ReactNode
}

export interface AppFrameProps {
  /** Name der App oben in der Seitenleiste */
  brand: string
  /** Seitenleiste oben */
  primary: FrameItem[]
  /** Seitenleiste nach dem Trenner (Profil, Admin) */
  secondary: FrameItem[]
  /** Schlüssel der Einträge in der unteren und der schmalen Leiste, in ihrer Reihenfolge, höchstens fünf */
  bar: string[]
  /** die Aktion: rund in der Mitte der Leisten, als Pille in der Seitenleiste (Scannen, Neue Einheit) */
  action?: FrameItem
  /** der Eintrag der gezeigten Seite; null: keiner */
  current: string | null
  /** der aktive Eintrag der Leisten, wenn er vom Bereich abweicht (Admin steckt am Telefon in Profil) */
  barCurrent?: string | null
  renderLink: (item: FrameItem, props: FrameLinkProps) => ReactNode
  /** unten in der Seitenleiste, etwa die Darstellung; nicht in den Leisten des Telefons */
  sidebarFooter?: ReactNode
  children?: ReactNode
}

// Telefon quer heißt unter 1024 px breit und unter 500 px hoch: `max-lg:[@media(max-height:499px)]:`. Die
// Klassen stehen wörtlich da, Tailwind findet nur, was im Quelltext steht (nicht aus Konstanten zusammengesetzt).

/**
 * Rahmen der App: ab 1024 px eine Seitenleiste, darunter eine untere Leiste mit der Aktion in der
 * Mitte, im Querformat des Telefons eine schmale Leiste links. Die Wurzel setzt `--app-bar`, den Platz, den die
 * untere Leiste samt Aktion unten einnimmt; Seite, Pille und Inhalt richten sich danach.
 */
export function AppFrame({
  brand,
  primary,
  secondary,
  bar,
  action,
  current,
  barCurrent,
  renderLink,
  sidebarFooter,
  children,
}: AppFrameProps) {
  const items = new Map(
    [...primary, ...secondary, ...(action ? [action] : [])].map((item) => [item.key, item])
  )
  const barItems = bar.flatMap((key) => {
    const item = items.get(key)
    return item ? [item] : []
  })
  const inBar = barCurrent === undefined ? current : barCurrent
  const counted = (item: FrameItem) => (item.badge ?? 0) > 0
  const name = (item: FrameItem) => (counted(item) ? item.badgeLabel : undefined)
  const badge = (item: FrameItem, className: string) =>
    counted(item) ? (
      <span
        data-badge
        aria-hidden="true"
        className={cn(
          "min-w-[1.125rem] rounded-full bg-primary px-1 text-center text-xs leading-[1.125rem] font-semibold text-primary-foreground tabular-nums",
          className
        )}
      >
        {item.badge}
      </span>
    ) : null
  const link = (
    item: FrameItem,
    className: string,
    content: ReactNode,
    label?: string,
    active: string | null = current
  ) => (
    <Fragment key={item.key}>
      {renderLink(item, {
        "data-area": item.key,
        "aria-current": active === item.key ? "page" : undefined,
        "aria-label": label ?? name(item),
        className: cn(
          "cursor-pointer focus-visible:outline-2 focus-visible:outline-ring",
          className
        ),
        children: content,
      })}
    </Fragment>
  )
  const sideEntry = (item: FrameItem) => {
    const { label, Icon } = item
    return link(
      item,
      "flex items-center gap-3 rounded-lg px-3 py-2 text-[14px] font-semibold text-foreground-2 hover:bg-surface-2 aria-[current=page]:bg-accent-wash aria-[current=page]:text-foreground",
      <>
        <Icon aria-hidden="true" className="size-[18px] shrink-0" />
        <span className="flex-1">{label}</span>
        {badge(item, "")}
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
          <p className="px-3 pb-4 font-display text-xl font-bold tracking-tight">{brand}</p>
          {primary.map(sideEntry)}
          {action &&
            link(
              action,
              "mt-3 flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-[14px] font-semibold text-primary-foreground hover:opacity-90 aria-[current=page]:ring-2 aria-[current=page]:ring-ring aria-[current=page]:ring-offset-2 aria-[current=page]:ring-offset-card",
              <>
                <action.Icon aria-hidden="true" className="size-[18px]" />
                {action.label}
              </>
            )}
          <div aria-hidden="true" className="my-3 border-t border-border" />
          {secondary.map(sideEntry)}
        </nav>
        {/* Einstellungen gehören nicht in die Navigation: neben ihr, unten in der Seitenleiste */}
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
        {barItems.map((item) => {
          const { label, Icon } = item
          return link(
            item,
            item.key === action?.key
              ? "flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground aria-[current=page]:ring-2 aria-[current=page]:ring-ring aria-[current=page]:ring-offset-2 aria-[current=page]:ring-offset-card"
              : "relative flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 aria-[current=page]:bg-accent-wash aria-[current=page]:text-primary",
            <>
              <Icon aria-hidden="true" className="size-5" />
              {badge(item, "absolute top-0.5 right-0.5")}
            </>,
            name(item) ?? label,
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
        <div
          className={cn(
            "mx-auto grid h-14 max-w-lg",
            barItems.length >= 5 ? "grid-cols-5" : "grid-cols-4"
          )}
        >
          {barItems.map((item) => {
            const { short, label, Icon } = item
            if (item.key === action?.key)
              return (
                <div key={item.key} className="flex justify-center">
                  {link(
                    item,
                    "-mt-4 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background aria-[current=page]:ring-accent-wash",
                    <Icon aria-hidden="true" className="size-6" />,
                    label,
                    inBar
                  )}
                </div>
              )
            return link(
              item,
              "flex flex-col items-center justify-center gap-0.5 text-xs font-semibold text-muted-foreground aria-[current=page]:text-primary",
              <>
                <span className="relative">
                  <Icon aria-hidden="true" className="size-5" />
                  {badge(item, "absolute -top-1.5 -right-2.5")}
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
