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
  Settings,
  LogOut,
  Menu,
  X,
  UserCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/competitions", label: "Wettbewerbe", icon: Trophy },
]

const adminNavItems = [
  { href: "/participants", label: "Teilnehmer", icon: Users },
  { href: "/disciplines", label: "Disziplinen", icon: Target },
]

interface Props {
  role: string
}

export function Navigation({ role }: Props) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const canManage = role === "ADMIN" || role === "MANAGER"
  const isAdmin = role === "ADMIN"
  const visibleNavItems = canManage ? [...navItems, ...adminNavItems] : navItems

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo + App-Name */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
            <CircleDot className="h-4 w-4 text-foreground" />
          </div>
          <span className="font-semibold">Ringwerk</span>
        </div>

        {/* Desktop-Navigation */}
        <nav className="hidden items-center gap-1 md:flex">
          {visibleNavItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                pathname === href || (href !== "/" && pathname.startsWith(href))
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Rechte Seite: Admin + Logout + Hamburger */}
        <div className="flex items-center gap-1">
          {isAdmin && (
            <Link
              href="/admin/users"
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <Settings className="h-4 w-4" />
              <span className="hidden md:inline">Admin</span>
            </Link>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
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
                <Link href="/account">
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
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden text-muted-foreground hover:text-foreground"
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
          {visibleNavItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm transition-colors",
                pathname === href || (href !== "/" && pathname.startsWith(href))
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
