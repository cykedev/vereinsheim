"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { ArrowUpRight } from "lucide-react"
import { useState } from "react"

import { AppFrame, type FrameItem } from "@vereinsheim/ui/design2/app-frame"
import { HelpProvider, HelpSheet } from "@vereinsheim/ui/design2/help-sheet"
import { ThemeSwitch } from "@vereinsheim/ui/design2/theme-switch"
import { UndoHost } from "@vereinsheim/ui/design2/undo"

import { helpTopic } from "@/lib/help/topics"
import { MOVED_TEXTS } from "@/lib/moved/texts"

import { AREAS, BAR, PRIMARY, barAreaOf, currentArea, type Area } from "./areas"

const item = (area: Area): FrameItem => ({ key: area, ...AREAS[area] })

/** die Adresse der Statistik zum Merken: ohne die gewählte Einheit (`pick`), sie gilt nur für den Weg dorthin */
export function statisticsMemory(search: URLSearchParams): string {
  const params = new URLSearchParams(search)
  params.delete("pick")
  const query = params.toString()
  return query ? `/statistics?${query}` : "/statistics"
}

/** ein Konto, das nach Spiegel umgezogen ist, mit der Adresse von Spiegel; null: nicht umgezogen */
export type Moved = { spiegelUrl: string | null } | null

/** die Aktion in der Mitte: Neue Einheit, für ein umgezogenes Konto „Zu Spiegel“ (ohne Adresse keine) */
function actionOf(moved: Moved): FrameItem | undefined {
  if (!moved) return item("new")
  if (!moved.spiegelUrl) return undefined
  return {
    key: "new",
    label: MOVED_TEXTS.toSpiegel,
    short: MOVED_TEXTS.toSpiegelShort,
    Icon: ArrowUpRight,
  }
}

/**
 * Rahmen von Treffsicher: der Rahmen aus Design 2 mit den Bereichen der App. Neue Einheit ist die Aktion in der
 * Mitte, für ein umgezogenes Konto „Zu Spiegel“; Ziele, Ablauf, Disziplinen und Admin stecken am Telefon in Profil.
 * Dazu das Blatt der Hilfe, das jede Seite über `useHelp` öffnet, und der Hinweis „Rückgängig“ (`useUndo`).
 */
export function AppShell({
  isAdmin,
  moved,
  children,
}: {
  isAdmin: boolean
  moved: Moved
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const current = currentArea(pathname, moved !== null)
  const action = actionOf(moved)
  const search = useSearchParams()
  const [helpId, setHelpId] = useState<string | null>(null)
  // die letzte Adresse der Statistik, wie ein Reiter: „Statistik“ führt dorthin zurück (beim Rendern nachgeführt)
  const [statistics, setStatistics] = useState<string | null>(null)
  const seenStatistics = pathname === "/statistics" ? statisticsMemory(search) : null
  if (seenStatistics && seenStatistics !== statistics) setStatistics(seenStatistics)

  return (
    <HelpProvider onHelp={setHelpId}>
      <AppFrame
        brand="Treffsicher"
        primary={PRIMARY.map(item)}
        secondary={isAdmin ? [item("profile"), item("admin")] : [item("profile")]}
        action={action}
        bar={action ? [...BAR] : BAR.filter((area) => area !== "new")}
        current={current}
        barCurrent={barAreaOf(current)}
        renderLink={({ key }, props) =>
          // Spiegel ist eine andere App: ein gewöhnlicher Link im selben Tab
          key === "new" && moved?.spiegelUrl ? (
            <a href={moved.spiegelUrl} {...props} />
          ) : (
            <Link
              href={key === "statistics" && statistics ? statistics : AREAS[key as Area].href}
              {...props}
            />
          )
        }
        sidebarFooter={<ThemeSwitch />}
      >
        {/* im Rahmen, damit der Hinweis „Rückgängig“ über der unteren Leiste steht (`--app-bar`) */}
        <UndoHost>{children}</UndoHost>
      </AppFrame>
      <HelpSheet entry={helpTopic(helpId)} onClose={() => setHelpId(null)} />
    </HelpProvider>
  )
}
