"use client"

import { AppFrame as Frame, type FrameItem } from "@vereinsheim/ui/design2/app-frame"
import {
  ArrowLeftRight,
  BookOpen,
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
  diary: { label: "Tagebuch", short: "Tagebuch", Icon: BookOpen },
  scan: { label: "Scheibe holen", short: "Holen", Icon: ScanQrCode },
  progress: { label: "Fortschritt", short: "Fortschritt", Icon: ChartLine },
  compare: { label: "Vergleichen", short: "Vergleichen", Icon: ArrowLeftRight },
  profile: { label: "Profil", short: "Profil", Icon: CircleUser },
  admin: { label: "Admin", short: "Admin", Icon: Shield },
}

/** die untere und die schmale Leiste: Scheibe holen in der Mitte, Admin steckt in Profil */
const BAR: readonly Area[] = ["start", "cards", "scan", "progress", "profile"]
/** mit Tagebuch steht es statt Scheiben in der Leiste; die Scheiben stehen dann am Telefon in Profil ([[adr-033]]) */
const DIARY_BAR: readonly Area[] = ["start", "diary", "scan", "progress", "profile"]

/**
 * der Bereich, den die Leisten des Telefons markieren: Admin steckt in Profil, Vergleichen gehört zum Fortschritt, mit
 * Tagebuch stehen die Scheiben in Profil
 */
export function barAreaOf(current: Area | null, diary: boolean): Area | null {
  if (current === "admin") return "profile"
  if (current === "compare") return "progress"
  if (diary && current === "cards") return "profile"
  return current
}

export interface AppFrameProps {
  /** der Bereich der gezeigten Seite; null: keiner */
  current: Area | null
  /** wohin jeder Eintrag führt (`areaLinks`) */
  links: Record<Area, Route>
  /** Zahl der offenen Dinge am Start-Symbol */
  openCount: number
  /** nur ein Admin sieht Admin */
  isAdmin: boolean
  /** das Tagebuch ist eingeschaltet: es steht in der Leiste statt Scheiben und in der Seitenleiste nach Scheiben */
  diary?: boolean
  /** unten in der Seitenleiste, etwa die Darstellung; nicht in den Leisten des Telefons */
  sidebarFooter?: ReactNode
  children?: ReactNode
}

/**
 * Rahmen von Spiegel: der allgemeine Rahmen aus Design 2 (`@vereinsheim/ui/design2/app-frame`) mit den Bereichen
 * von Spiegel. Scheibe holen ist die Aktion in der Mitte (am Telefon nur das Symbol, der Name für Screenreader, in der
 * Seitenleiste als Pille); Admin steckt auf dem Telefon in Profil. Mit Tagebuch steht es in den Leisten des Telefons
 * statt Scheiben und in der Seitenleiste nach Scheiben ([[adr-033]]).
 */
export function AppFrame({
  current,
  links,
  openCount,
  isAdmin,
  diary = false,
  sidebarFooter,
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
      primary={(diary
        ? (["start", "cards", "diary", "progress"] as const)
        : (["start", "cards", "progress"] as const)
      ).map(item)}
      secondary={isAdmin ? [item("profile"), item("admin")] : [item("profile")]}
      action={item("scan")}
      bar={[...(diary ? DIARY_BAR : BAR)]}
      current={current}
      barCurrent={barAreaOf(current, diary)}
      renderLink={({ key }, props) => <RouteLink route={links[key as Area]} {...props} />}
      sidebarFooter={sidebarFooter}
    >
      {children}
    </Frame>
  )
}
