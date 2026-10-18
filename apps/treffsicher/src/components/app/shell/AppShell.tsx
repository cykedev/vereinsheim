"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { AppFrame, type FrameItem } from "@vereinsheim/ui/design2/app-frame"
import { HelpProvider, HelpSheet } from "@vereinsheim/ui/design2/help-sheet"
import { ThemeSwitch } from "@vereinsheim/ui/design2/theme-switch"
import { UndoHost } from "@vereinsheim/ui/design2/undo"

import { helpTopic } from "@/lib/help/topics"

import { AREAS, BAR, PRIMARY, areaOf, barAreaOf, type Area } from "./areas"

const item = (area: Area): FrameItem => ({ key: area, ...AREAS[area] })

/**
 * Rahmen von Treffsicher: der Rahmen aus Design 2 mit den Bereichen der App. Neue Einheit ist die Aktion in der
 * Mitte; Ziele, Ablauf, Disziplinen und Admin stecken am Telefon in Profil. Dazu das Blatt der Hilfe, das jede Seite
 * über `useHelp` öffnet, und der Hinweis „Rückgängig“ (`useUndo`).
 */
export function AppShell({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  const pathname = usePathname()
  const current = areaOf(pathname)
  const [helpId, setHelpId] = useState<string | null>(null)

  return (
    <HelpProvider onHelp={setHelpId}>
      <AppFrame
        brand="Treffsicher"
        primary={PRIMARY.map(item)}
        secondary={isAdmin ? [item("profile"), item("admin")] : [item("profile")]}
        action={item("new")}
        bar={[...BAR]}
        current={current}
        barCurrent={barAreaOf(current)}
        renderLink={({ key }, props) => <Link href={AREAS[key as Area].href} {...props} />}
        sidebarFooter={<ThemeSwitch />}
      >
        {/* im Rahmen, damit der Hinweis „Rückgängig“ über der unteren Leiste steht (`--app-bar`) */}
        <UndoHost>{children}</UndoHost>
      </AppFrame>
      <HelpSheet entry={helpTopic(helpId)} onClose={() => setHelpId(null)} />
    </HelpProvider>
  )
}
