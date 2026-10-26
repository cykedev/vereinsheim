"use client"

import type { ReactNode } from "react"

/**
 * Eine Zeile im Kasten „Diese Scheibe“: links Titel und Zustand, rechts die Aktion; auf schmalen Telefonen bricht die
 * Aktion unter den Zustand. Darunter, was zur Zeile gehört (der geteilte Link, ein Fehler). Weitere Props (`data-…`)
 * landen auf der Zeile.
 */
export function ActionRow({
  title,
  state,
  action,
  children,
  ...rest
}: {
  title: string
  state: ReactNode
  action?: ReactNode
  children?: ReactNode
  [data: `data-${string}`]: unknown
}) {
  return (
    <div {...rest} className="grid gap-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {/* der Text bricht um, bevor die Aktion unter ihn rutscht; erst unter 10 rem für den Text rutscht sie */}
        <div className="grid min-w-40 flex-1 basis-0 gap-0.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          <div className="text-[13px] text-muted-foreground">{state}</div>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
