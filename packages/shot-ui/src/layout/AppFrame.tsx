"use client"

import { AppFrame as Frame, type FrameItem } from "@vereinsheim/ui/design2/app-frame"
import {
  ArrowLeftRight,
  ChartLine,
  CircleUser,
  House,
  List,
  ScanQrCode,
  Shield,
  type LucideIcon,
} from "lucide-react"
import type { ReactNode } from "react"

import type { Area } from "../nav/areas"
import { RouteLink } from "../nav/RouteLink"
import type { Route } from "../nav/routes"

const ITEMS: Readonly<Record<Area, { label: string; short: string; Icon: LucideIcon }>> = {
  start: { label: "Start", short: "Start", Icon: House },
  cards: { label: "Scheiben", short: "Scheiben", Icon: List },
  scan: { label: "QR scannen", short: "Scannen", Icon: ScanQrCode },
  progress: { label: "Fortschritt", short: "Fortschritt", Icon: ChartLine },
  compare: { label: "Vergleichen", short: "Vergleichen", Icon: ArrowLeftRight },
  profile: { label: "Profil", short: "Profil", Icon: CircleUser },
  admin: { label: "Admin", short: "Admin", Icon: Shield },
}

/** die untere und die schmale Leiste: Scannen in der Mitte, Admin steckt in Profil */
const BAR: readonly Area[] = ["start", "cards", "scan", "progress", "profile"]

export interface AppFrameProps {
  /** der Bereich der gezeigten Seite; null: keiner */
  current: Area | null
  /** wohin jeder Eintrag führt (`areaLinks`) */
  links: Record<Area, Route>
  /** Zahl der offenen Dinge am Start-Symbol */
  openCount: number
  /** nur ein Admin sieht Admin */
  isAdmin: boolean
  /** unten in der Seitenleiste, etwa die Darstellung; nicht in den Leisten des Telefons */
  sidebarFooter?: ReactNode
  /** Scannen anbieten (Vorgabe ja); eine App ohne QR-Weg blendet es aus, die untere Leiste hat dann vier Felder */
  scan?: boolean
  children?: ReactNode
}

/**
 * Rahmen von Spiegel: der allgemeine Rahmen aus Design 2 (`@vereinsheim/ui/design2/app-frame`) mit den Bereichen
 * von Spiegel. Scannen ist die Aktion in der Mitte; Admin steckt auf dem Telefon in Profil.
 */
export function AppFrame({
  current,
  links,
  openCount,
  isAdmin,
  sidebarFooter,
  scan = true,
  children,
}: AppFrameProps) {
  const item = (area: Area): FrameItem => ({
    key: area,
    ...ITEMS[area],
    ...(area === "start" && { badge: openCount, badgeLabel: `Start, ${openCount} offen` }),
    // Vergleichen steht in der Seitenleiste unter Fortschritt; in den Leisten des Telefons führt der Umschalter oben
    // im Fortschritt dorthin
    ...(area === "progress" && { sub: [item("compare")] }),
  })
  return (
    <Frame
      brand="Spiegel"
      primary={(["start", "cards", "progress"] as const).map(item)}
      secondary={isAdmin ? [item("profile"), item("admin")] : [item("profile")]}
      action={scan ? item("scan") : undefined}
      bar={scan ? [...BAR] : BAR.filter((area) => area !== "scan")}
      current={current}
      // auf dem Telefon steckt Admin in Profil: ist Admin offen, ist dort Profil der Bereich.
      // Vergleichen gehört zum Fortschritt
      barCurrent={current === "admin" ? "profile" : current === "compare" ? "progress" : current}
      renderLink={({ key }, props) => <RouteLink route={links[key as Area]} {...props} />}
      sidebarFooter={sidebarFooter}
    >
      {children}
    </Frame>
  )
}
