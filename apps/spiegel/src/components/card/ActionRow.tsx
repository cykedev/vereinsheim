"use client"

import type { ReactNode } from "react"

/**
 * Eine Zeile im Kasten „Diese Scheibe“: links Titel und Zustand, rechts die Aktion; auf sehr schmalen Telefonen steht die
 * Aktion unter dem Zustand. Darunter, was zur Zeile gehört (der geteilte Link, ein Fehler). Weitere Props (`data-…`)
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
  [data: `data-${string}`]: string | number | boolean
}) {
  return (
    <div {...rest} className="@container grid gap-2 py-3 first:pt-0 last:pb-0">
      {/* ab 18 rem Breite der Zeile steht die Aktion neben dem Text, schmaler in jeder Zeile darunter */}
      <div className="grid justify-items-start gap-2 @min-[18rem]:flex @min-[18rem]:flex-wrap @min-[18rem]:items-center @min-[18rem]:justify-between @min-[18rem]:gap-x-4">
        {/* der Text bricht um, bevor die Aktion unter ihn rutscht; erst unter 9 rem für den Text rutscht sie */}
        <div className="grid min-w-36 flex-1 basis-0 gap-0.5">
          <h3 className="text-sm font-semibold">{title}</h3>
          <div className="text-[13px] text-muted-foreground">{state}</div>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}
