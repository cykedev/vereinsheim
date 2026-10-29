"use client"

import { Fragment, useEffect, useRef, type ReactNode } from "react"

import { cn } from "@vereinsheim/lib/utils"

/** ein Reiter; die App erweitert ihn um ihr Ziel (`href`, Route) und rendert den Link in `renderLink` */
export interface TabBarItem {
  key: string
  label: string
}

/** was der Link eines Reiters bekommt; die App rendert damit ihren Link (`next/link`, `RouteLink`) */
export interface TabLinkProps {
  "aria-current"?: "page" | "true"
  className: string
  children: ReactNode
}

export interface TabBarProps<T extends TabBarItem> {
  /** Name der Leiste für Screenreader (`aria-label` am `<nav>`), etwa „Admin“ */
  label: string
  items: readonly T[]
  /** Schlüssel des gezeigten Reiters; null: keiner */
  current: T["key"] | null
  /**
   * auf einer Unterseite des Reiters (ein Konto, eine Disziplin): markiert als `aria-current="true"` statt „page“, der
   * Link führt zurück zur Seite des Reiters
   */
  detail?: boolean
  renderLink: (item: T, props: TabLinkProps) => ReactNode
  /** am `<nav>`, etwa die Höhe einer Leiste (`JUMP_BAR.height`) */
  className?: string
}

/** die Leiste: eine Zeile, zu breit scrollt sie in sich, ohne sichtbare Scrollbar */
const TAB_BAR =
  "inline-flex max-w-full min-w-0 overflow-x-auto rounded-full border border-border bg-surface-2 p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

/** ein Reiter: bricht nie, schrumpft nie; gewählt in der Farbe der App wie die Wahl im Segment-Umschalter */
const TAB =
  "shrink-0 rounded-full px-3.5 py-2 text-[13px] leading-none font-semibold whitespace-nowrap text-foreground-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground"

/**
 * um wie viel die Leiste seitlich rücken muss, damit der Reiter ganz im Bild steht, mit 8 px Luft; 0, wenn er schon
 * im Bild steht
 */
export function revealOffset(
  tab: { left: number; right: number },
  bar: { left: number; right: number }
): number {
  if (tab.left < bar.left) return tab.left - bar.left - 8
  if (tab.right > bar.right) return tab.right - bar.right + 8
  return 0
}

/**
 * Reiter (Design 2): Navigation zwischen den Seiten eines Bereichs, als Links. Immer eine Zeile; ist sie breiter als ihr
 * Platz, wischt man sie seitlich, die Seite bleibt stehen. Der gezeigte Reiter rückt beim Öffnen und bei jedem Wechsel
 * ins Bild. Auswahlen sind `Segmented`, nicht `TabBar`.
 */
export function TabBar<T extends TabBarItem>({
  label,
  items,
  current,
  detail,
  renderLink,
  className,
}: TabBarProps<T>) {
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = bar.current
    const active = el?.querySelector<HTMLElement>("[aria-current]")
    if (!el || !active || el.scrollWidth <= el.clientWidth) return
    el.scrollLeft += revealOffset(active.getBoundingClientRect(), el.getBoundingClientRect())
  }, [current, detail])
  return (
    // min-w-0: als Raster- oder Flex-Kind macht die Leiste die Spalte nicht breiter als die Seite
    <nav aria-label={label} className={cn("flex max-w-full min-w-0 items-center", className)}>
      <div ref={bar} data-tab-bar className={TAB_BAR}>
        {items.map((item) => (
          <Fragment key={item.key}>
            {renderLink(item, {
              "aria-current": item.key === current ? (detail ? "true" : "page") : undefined,
              className: TAB,
              children: item.label,
            })}
          </Fragment>
        ))}
      </div>
    </nav>
  )
}
