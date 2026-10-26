import Link from "next/link"

import { ADMIN_SECTIONS, type AdminSection } from "@/lib/admin/sections"

/**
 * Reiter des Admins auf jeder Admin-Seite. Auf einer Unterseite (ein Konto, eine Disziplin, eine Liste) ist der Reiter
 * ihres Bereichs markiert und führt zurück zu dessen Seite. Die Reiter brechen um, statt seitlich zu scrollen, damit
 * am Telefon keiner verschwindet.
 */
export function AdminTabs({ current, detail }: { current: AdminSection; detail?: boolean }) {
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-1">
      {ADMIN_SECTIONS.map(({ key, href, label }) => (
        <Link
          key={key}
          href={href}
          aria-current={current === key ? (detail ? "true" : "page") : undefined}
          className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-foreground-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground aria-[current=true]:bg-primary aria-[current=true]:text-primary-foreground"
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
