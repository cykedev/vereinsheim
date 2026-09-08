"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  Target,
  Trophy,
  Users,
  LayoutDashboard,
  CircleDot,
  Shield,
  LogOut,
  Menu,
  X,
  UserCircle,
} from "lucide-react"
import { Button } from "@vereinsheim/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@vereinsheim/ui/dropdown-menu"
import { cn } from "@vereinsheim/lib/utils"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/competitions", label: "Wettbewerbe", icon: Trophy },
]

const manageNavItems = [
  { href: "/participants", label: "Teilnehmer", icon: Users },
  { href: "/disciplines", label: "Disziplinen", icon: Target },
]

const adminNavItem = { href: "/admin/users", label: "Admin", icon: Shield }
const accountLink = { href: "/account", label: "Konto", icon: UserCircle }

interface Props {
  role: string
}

export function Navigation({ role }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const canManage = role === "ADMIN" || role === "MANAGER"
  const isAdmin = role === "ADMIN"

  const navLinks = [
    ...navItems,
    ...(canManage ? manageNavItems : []),
    ...(isAdmin ? [adminNavItem] : []),
  ]

  // Im Mobil-Panel sind Hauptlinks und Konto gemeinsam sichtbar.
  const mobileLinks = [...navLinks, accountLink]

  function linkClass(href: string, layout: "horizontal" | "panel") {
    // Das Dashboard liegt auf "/" — dort muss exakt verglichen werden,
    // sonst wäre es auf jeder Seite aktiv.
    const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
    const base =
      layout === "horizontal"
        ? "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
        : "flex items-center gap-3 px-4 py-3 text-sm transition-colors"
    return cn(
      base,
      isActive
        ? "bg-secondary text-foreground"
        : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
    )
  }

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo + App-Name */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <CircleDot className="h-5 w-5 text-primary" />
          <span>Ringwerk</span>
        </Link>

        {/* Desktop-Navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={linkClass(href, "horizontal")}>
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Rechte Seite: Konto-Dropdown (Desktop) + Hamburger (Mobil) */}
        <div className="flex items-center gap-1">
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <UserCircle className="h-4 w-4" />
                  <span className="sr-only">Konto</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={accountLink.href}>
                    <UserCircle className="mr-2 h-4 w-4" />
                    Mein Konto
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground md:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Menü öffnen"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile-Menü */}
      {mobileOpen && (
        <nav className="border-t border-border md:hidden">
          {mobileLinks.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={linkClass(href, "panel")}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false)
              signOut({ callbackUrl: "/login" })
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Abmelden
          </button>
        </nav>
      )}
    </header>
  )
}
