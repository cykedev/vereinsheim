import {
  BookOpen,
  ChartLine,
  CircleUser,
  Goal,
  House,
  ListChecks,
  Plus,
  Shield,
  Target,
  type LucideIcon,
} from "lucide-react"

import { isAdminPath } from "@/lib/admin-path"

/** die Bereiche der Navigation */
export type Area =
  | "start"
  | "sessions"
  | "new"
  | "statistics"
  | "goals"
  | "routines"
  | "disciplines"
  | "profile"
  | "admin"

export interface AreaItem {
  label: string
  short: string
  href: string
  Icon: LucideIcon
}

export const AREAS: Readonly<Record<Area, AreaItem>> = {
  start: { label: "Start", short: "Start", href: "/dashboard", Icon: House },
  sessions: { label: "Tagebuch", short: "Tagebuch", href: "/sessions", Icon: BookOpen },
  new: { label: "Neue Einheit", short: "Neu", href: "/sessions/new", Icon: Plus },
  statistics: { label: "Statistik", short: "Statistik", href: "/statistics", Icon: ChartLine },
  goals: { label: "Ziele", short: "Ziele", href: "/goals", Icon: Goal },
  routines: { label: "Ablauf", short: "Ablauf", href: "/shot-routines", Icon: ListChecks },
  disciplines: { label: "Disziplinen", short: "Disziplinen", href: "/disciplines", Icon: Target },
  profile: { label: "Profil", short: "Profil", href: "/profile", Icon: CircleUser },
  admin: { label: "Admin", short: "Admin", href: "/admin", Icon: Shield },
}

/** Seitenleiste oben, in dieser Reihenfolge */
export const PRIMARY: readonly Area[] = [
  "start",
  "sessions",
  "statistics",
  "goals",
  "routines",
  "disciplines",
]

/** untere und schmale Leiste: Neue Einheit in der Mitte; Ziele, Ablauf, Disziplinen und Admin stecken in Profil */
export const BAR: readonly Area[] = ["start", "sessions", "new", "statistics", "profile"]

const under = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

/** der Bereich einer Adresse; null: keiner */
export function areaOf(pathname: string): Area | null {
  // Start exakt: das Dashboard hat keine Unterseiten
  if (pathname === AREAS.start.href) return "start"
  if (under(pathname, AREAS.new.href)) return "new"
  if (isAdminPath(pathname)) return "admin"
  // `/account` leitet auf Profil weiter
  if (under(pathname, "/account")) return "profile"
  const found = (Object.keys(AREAS) as Area[]).find(
    (area) => area !== "start" && under(pathname, AREAS[area].href)
  )
  return found ?? null
}

/** der aktive Eintrag der Leisten: was dort nicht steht, gehört am Telefon zu Profil */
export function barAreaOf(area: Area | null): Area | null {
  if (area === null) return null
  return BAR.includes(area) ? area : "profile"
}
