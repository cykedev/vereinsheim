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

import { HelpContext } from "./HelpContext"

/** die Adresse eines Bereichs ohne Abend und Abschnitt, als Schlüssel für das Gedächtnis */
const memoryKey = (route: Route | null) => (route ? urlFromRoute(route) : "")

/**
 * Rahmen der App (N7): `AppFrame` aus shot-ui mit echten Links (`next/link`, Klicks über den Router), dem Bereich der
 * Adresse und der zuletzt besuchten Adresse je Bereich (Scheiben, Fortschritt), wie Reiter einer App. Dazu das Blatt
 * der Hilfe, das jede Seite über `useHelp` öffnet.
 */
export function AppShell({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const search = useSearchParams()
  const route = useMemo(() => {
    // nicht `search.size`: fehlt in Safari vor 17 (Review)
    const qs = search.toString()
    return routeFromUrl(pathname, qs ? `?${qs}` : "", "")
  }, [pathname, search])

  // die letzte Adresse je Bereich: beim Rendern nachgeführt (Zustand aus der vorigen Darstellung, React-Muster)
  const [memory, setMemory] = useState<AreaMemory>({ cards: null, progress: null })
  if (route.page === "cards" && memoryKey(route) !== memoryKey(memory.cards))
    setMemory({ ...memory, cards: { ...route, evening: null } })
  if (route.page === "progress" && memoryKey(route) !== memoryKey(memory.progress))
    setMemory({ ...memory, progress: { ...route, section: null } })

  // die zuletzt gewählte Familie: Scheiben und Fortschritt teilen sie wie im Labor (User, 9. Oktober 2026, `areaLinks`)
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
          current={areaOf(route) ?? (pathname.startsWith("/admin/") ? "admin" : null)}
          links={areaLinks(memory, family)}
          openCount={0}
          isAdmin={isAdmin}
          sidebarFooter={<ThemeSwitch />}
        >
          {children}
        </AppFrame>
        <HelpSheet helpId={helpId} onClose={() => setHelpId(null)} />
      </HelpContext.Provider>
    </RouteLinkProvider>
  )
}
