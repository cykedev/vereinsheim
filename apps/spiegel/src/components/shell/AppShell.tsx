"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"

import { HelpSheet } from "@vereinsheim/shot-ui/help/HelpSheet"
import { AppFrame } from "@vereinsheim/shot-ui/layout/AppFrame"
import { areaLinks, areaOf, type AreaMemory } from "@vereinsheim/shot-ui/nav/areas"
import { RouteLinkProvider } from "@vereinsheim/shot-ui/nav/RouteLink"
import { routeFromUrl, urlFromRoute, type Route } from "@vereinsheim/shot-ui/nav/routes"

import { ThemeSwitch } from "@/components/theme/ThemeSwitch"
import { isAdminPath } from "@/lib/admin-path"

import { HelpContext } from "./HelpContext"
import { UndoHost } from "./UndoBar"

/** die Adresse eines Bereichs ohne Abend und Abschnitt, als Schlüssel für das Gedächtnis */
const memoryKey = (route: Route | null) => (route ? urlFromRoute(route) : "")

/**
 * Rahmen der App: `AppFrame` aus shot-ui mit echten Links (`next/link`, Klicks über den Router), dem Bereich der
 * Adresse und der zuletzt besuchten Adresse je Bereich (Scheiben, Fortschritt), wie Reiter einer App. Dazu das Blatt
 * der Hilfe, das jede Seite über `useHelp` öffnet, und der Hinweis „Rückgängig“ (`useUndo`).
 */
export function AppShell({
  isAdmin,
  openCount,
  children,
}: {
  isAdmin: boolean
  /** Zahl der offenen Dinge am Start-Symbol (wartende erste Scheiben) */
  openCount: number
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const route = useMemo(() => {
    // nicht `search.size`: fehlt in Safari vor 17
    const qs = search.toString()
    return routeFromUrl(pathname, qs ? `?${qs}` : "", "")
  }, [pathname, search])

  // die letzte Adresse je Bereich: beim Rendern nachgeführt (Zustand aus der vorigen Darstellung, React-Muster)
  const [memory, setMemory] = useState<AreaMemory>({ cards: null, progress: null })
  // die Liste ohne Abend und ohne die markierte Scheibe (`pick`): die Markierung gilt nur für den Weg, der sie setzt
  const cards =
    route.page === "cards" ? { page: "cards" as const, query: route.query, evening: null } : null
  if (cards && memoryKey(cards) !== memoryKey(memory.cards)) setMemory({ ...memory, cards })
  if (route.page === "progress" && memoryKey(route) !== memoryKey(memory.progress))
    setMemory({ ...memory, progress: { ...route, section: null } })

  // die zuletzt gewählte Familie: Scheiben und Fortschritt teilen sie (`areaLinks`)
  const [family, setFamily] = useState<string | null>(null)
  const routeFamily =
    route.page === "cards" || route.page === "progress" ? route.query.family : null
  if (routeFamily && routeFamily !== family) setFamily(routeFamily)

  const [helpId, setHelpId] = useState<string | null>(null)
  const links = useMemo(
    () => ({
      component: Link,
      navigate: (next: Route) => router.push(urlFromRoute(next)),
    }),
    [router]
  )

  return (
    <RouteLinkProvider value={links}>
      <HelpContext.Provider value={setHelpId}>
        <AppFrame
          // Unterseiten von Admin (Konten) kennt das Routen-Modell nicht; sie gehören zu Admin
          current={areaOf(route) ?? (isAdminPath(pathname) ? "admin" : null)}
          links={areaLinks(memory, family)}
          openCount={openCount}
          isAdmin={isAdmin}
          // Scannen steht ohne den QR-Weg nicht in der Navigation
          scan={false}
          sidebarFooter={<ThemeSwitch />}
        >
          {/* im Rahmen, damit der Hinweis „Rückgängig“ über der unteren Leiste steht (`--app-bar`) */}
          <UndoHost>{children}</UndoHost>
        </AppFrame>
        <HelpSheet helpId={helpId} onClose={() => setHelpId(null)} />
      </HelpContext.Provider>
    </RouteLinkProvider>
  )
}
