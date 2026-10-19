import { CircleUser, House, Shield, Target, Trophy, Users, type LucideIcon } from "lucide-react"

import { isAdminPath } from "./adminPath"

/** die Bereiche der Navigation */
export type Area = "start" | "competitions" | "participants" | "disciplines" | "profile" | "admin"

export interface AreaItem {
  label: string
  short: string
  href: string
  Icon: LucideIcon
}

export const AREAS: Readonly<Record<Area, AreaItem>> = {
  start: { label: "Start", short: "Start", href: "/", Icon: House },
  competitions: {
    label: "Wettbewerbe",
    short: "Wettbewerbe",
    href: "/competitions",
    Icon: Trophy,
  },
  participants: {
    label: "Teilnehmer",
    short: "Teilnehmer",
    href: "/participants",
    Icon: Users,
  },
  disciplines: { label: "Disziplinen", short: "Disziplinen", href: "/disciplines", Icon: Target },
  profile: { label: "Profil", short: "Profil", href: "/profile", Icon: CircleUser },
  // Ringwerk hat keine Seite `/admin`: Admin führt zu den Konten, aktiv ist es im ganzen Bereich
  admin: { label: "Admin", short: "Admin", href: "/admin/users", Icon: Shield },
}

/** darf die Rolle Teilnehmer und Disziplinen verwalten */
export const canManage = (role: string) => role === "ADMIN" || role === "MANAGER"

/** Seitenleiste oben, in dieser Reihenfolge, je Rolle */
export function primaryAreas(role: string): Area[] {
  return canManage(role)
    ? ["start", "competitions", "participants", "disciplines"]
    : ["start", "competitions"]
}

/** Seitenleiste nach dem Trenner */
export function secondaryAreas(role: string): Area[] {
  return role === "ADMIN" ? ["profile", "admin"] : ["profile"]
}

/** untere und schmale Leiste ohne Mitte; Disziplinen und Admin stecken am Telefon in Profil */
export function barAreas(role: string): Area[] {
  return canManage(role)
    ? ["start", "competitions", "participants", "profile"]
    : ["start", "competitions", "profile"]
}

/** die Bereiche, die am Telefon nicht in der unteren Leiste stehen, sondern in Profil */
export function moreAreas(role: string): Area[] {
  return [...primaryAreas(role), ...secondaryAreas(role)].filter(
    (area) => !barAreas(role).includes(area)
  )
}

const under = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

/** der Bereich einer Adresse; null: keiner */
export function areaOf(pathname: string): Area | null {
  // Start exakt: sonst wäre er auf jeder Seite aktiv
  if (pathname === AREAS.start.href) return "start"
  if (isAdminPath(pathname)) return "admin"
  // `/account` leitet auf Profil weiter
  if (under(pathname, "/account")) return "profile"
  const found = (Object.keys(AREAS) as Area[]).find(
    (area) => area !== "start" && area !== "admin" && under(pathname, AREAS[area].href)
  )
  return found ?? null
}

/** der aktive Eintrag der Leisten: was dort nicht steht, gehört am Telefon zu Profil */
export function barAreaOf(area: Area | null, role: string): Area | null {
  if (area === null) return null
  return barAreas(role).includes(area) ? area : "profile"
}
