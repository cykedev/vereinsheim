"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { AppFrame, type FrameItem } from "@vereinsheim/ui/design2/app-frame"
import { ThemeSwitch } from "@vereinsheim/ui/design2/theme-switch"
import { UndoHost } from "@vereinsheim/ui/design2/undo"

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
 * Disziplinen und Admin stecken am Telefon in Profil. Dazu der Hinweis „Rückgängig“ (`useUndo`).
 */
export function AppShell({ role, children }: { role: string; children: React.ReactNode }) {
  const current = areaOf(usePathname())
  return (
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
  )
}
