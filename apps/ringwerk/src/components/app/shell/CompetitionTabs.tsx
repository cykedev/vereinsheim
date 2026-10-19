"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"

import { JUMP_BAR } from "@vereinsheim/ui/design2/bar"
import { cn } from "@vereinsheim/lib/utils"

/** eine Seite eines Wettbewerbs */
export interface CompetitionTab {
  href: string
  label: string
}

/**
 * Reiter der Seiten eines Wettbewerbs in der Form des Segment-Umschalters von Design 2, als Links: eine Zeile, die in
 * sich seitlich scrollt, wenn sie breiter ist als ihr Platz. Die gezeigte Seite rückt dabei ins Bild.
 */
export function CompetitionTabs({ tabs, current }: { tabs: CompetitionTab[]; current: string }) {
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = bar.current
    const active = el?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!el || !active || el.scrollWidth <= el.clientWidth) return
    const a = active.getBoundingClientRect()
    const c = el.getBoundingClientRect()
    if (a.left < c.left) el.scrollLeft += a.left - c.left - 8
    else if (a.right > c.right) el.scrollLeft += a.right - c.right + 8
  }, [current])
  return (
    <nav aria-label="Seiten des Wettbewerbs" className={cn("flex items-center", JUMP_BAR.height)}>
      <div
        ref={bar}
        data-competition-tabs
        className="inline-flex max-w-full min-w-0 overflow-x-auto rounded-full border border-border bg-surface-2 p-[3px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.href === current ? "page" : undefined}
            className="shrink-0 rounded-full px-3.5 py-2 text-[13px] leading-none font-semibold whitespace-nowrap text-foreground-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
