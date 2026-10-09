"use client"

import { cn } from "@vereinsheim/lib/utils"

import { RouteLink } from "../nav/RouteLink"
import type { Route } from "../nav/routes"

export interface OpenItem {
  id: string
  title: string
  detail: string
  route: Route
}

/**
 * „Offen (n)“ oben auf Start (Plan N5, D1; Entscheidung 8): je offenes Ding ein Link. Ohne Offenes nichts. Die
 * Zahl steht auch am Start-Symbol der Navigation.
 */
export function OpenBox({ items, className }: { items: readonly OpenItem[]; className?: string }) {
  if (!items.length) return null
  return (
    <section
      data-open-box
      aria-labelledby="open-title"
      className={cn("grid gap-2 rounded-2xl border border-border bg-card p-4", className)}
    >
      <h2 id="open-title" className="flex items-center gap-2 text-[15px] font-semibold">
        Offen{" "}
        <span className="min-w-[1.375rem] rounded-full bg-primary px-1.5 text-center text-xs leading-[1.375rem] font-semibold text-primary-foreground tabular-nums">
          {items.length}
        </span>
      </h2>
      <ul className="grid gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <RouteLink
              route={item.route}
              data-open-item={item.id}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="grid min-w-0">
                <span className="text-[14px] font-semibold">{item.title}</span>
                <span className="text-[13px] text-muted-foreground">{item.detail}</span>
              </span>
              <span aria-hidden="true" className="text-muted-foreground">
                ›
              </span>
            </RouteLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
