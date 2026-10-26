import type { ReactNode } from "react"

import type { AdminHelpId } from "@/lib/admin/help"
import type { AdminSection } from "@/lib/admin/sections"

import { AdminHelp } from "./AdminHelp"
import { AdminTabs } from "./AdminTabs"

/**
 * Kopf der Seite eines Bereichs im Admin, auf allen gleich: die Reiter, der Titel mit „?“, darunter ein Satz, rechts
 * eine Aktion wie „Neues Konto“
 */
export function AdminHeader({
  current,
  title,
  help,
  action,
  children,
}: {
  current: AdminSection
  title: string
  help?: AdminHelpId
  action?: ReactNode
  /** der Satz unter dem Titel */
  children?: ReactNode
}) {
  return (
    <div className="grid gap-3">
      <AdminTabs current={current} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="flex items-center gap-1 font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            {title}
            {help && <AdminHelp id={help} />}
          </h1>
          {children && <p className="text-foreground-2">{children}</p>}
        </div>
        {action}
      </div>
    </div>
  )
}
