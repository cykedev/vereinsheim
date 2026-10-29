"use client"

import Link from "next/link"

import { TabBar } from "@vereinsheim/ui/design2/tab-bar"

import { ADMIN_SECTIONS, type AdminSection } from "@/lib/admin/sections"

/**
 * Reiter des Admins auf jeder Admin-Seite, eine Zeile, die wischt. Auf einer Unterseite (ein Konto, eine Disziplin,
 * eine Liste) ist der Reiter ihres Bereichs markiert und führt zurück zu dessen Seite.
 */
export function AdminTabs({ current, detail }: { current: AdminSection; detail?: boolean }) {
  return (
    <TabBar
      label="Admin"
      items={ADMIN_SECTIONS}
      current={current}
      detail={detail}
      renderLink={(s, props) => <Link href={s.href} {...props} />}
    />
  )
}
