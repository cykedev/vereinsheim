"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { AppFrame, type FrameItem } from "@vereinsheim/ui/design2/app-frame"
import { HelpProvider, HelpSheet } from "@vereinsheim/ui/design2/help-sheet"
import { ThemeSwitch } from "@vereinsheim/ui/design2/theme-switch"
import { UndoHost } from "@vereinsheim/ui/design2/undo"

import { helpTopic } from "@/lib/help/topics"

import {
  AREAS,
  areaOf,
  barAreaOf,
  barAreas,
  primaryAreas,
  secondaryAreas,
  type Area,
} from "./areas"

const item = (area: Area): FrameItem => ({ key: area, ...AREAS[area] })

/**
 * Rahmen von Ringwerk: der Rahmen aus Design 2 mit den Bereichen je Rolle. Die untere Leiste hat keine Mitte;
 * Disziplinen und Admin stecken am Telefon in Profil. Dazu das Blatt der Hilfe, das jedes „?“ über `useHelp` öffnet,
 * und der Hinweis „Rückgängig“ (`useUndo`).
 */
export function AppShell({ role, children }: { role: string; children: React.ReactNode }) {
  const current = areaOf(usePathname())
  const [helpId, setHelpId] = useState<string | null>(null)
  return (
    <HelpProvider onHelp={setHelpId}>
      <AppFrame
        brand="Ringwerk"
        primary={primaryAreas(role).map(item)}
        secondary={secondaryAreas(role).map(item)}
        bar={barAreas(role)}
        current={current}
        barCurrent={barAreaOf(current, role)}
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
