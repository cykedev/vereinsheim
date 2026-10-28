"use client"

import { signOut } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type ReactNode } from "react"

import { RouteLink } from "@vereinsheim/shot-ui/nav/RouteLink"
import { Button } from "@vereinsheim/ui/button"

import { Page } from "@vereinsheim/ui/design2/page"
import { ThemeSwitch } from "@vereinsheim/ui/design2/theme-switch"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { cn } from "@vereinsheim/lib/utils"
import { ADMIN_SECTIONS } from "@/lib/admin/sections"
import type { ConsentRow } from "@/lib/consent/queries"
import { CURRENT_CONSENT_VERSION } from "@/lib/consent/texts"

import { OwnData } from "./OwnData"
import { SportpassConsents } from "./SportpassConsents"

const PILL =
  "inline-flex h-10 items-center rounded-full border border-line-strong px-3.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"

/**
 * Profil: Konto, für Admins am Telefon oben die Bereiche des Admins, Zustimmung per Sportpass, Einstellung des Geräts (Darstellung), Deine Daten (Export, Konto löschen), Abmelden. Die Wertung hat jede Scheibe und jede Familie selbst (Seite der
 * Scheibe, Liste, Fortschritt). Dazu der Papierkorb.
 */
export function ProfileScreen({
  name,
  email,
  isAdmin,
  sportpass,
  trashCount,
  diary,
  lastAdmin = false,
}: {
  name: string | null
  email: string
  isAdmin: boolean
  /** die eigenen Zustimmungen per Sportpass; nur aktive bringen Scheiben von der Brücke */
  sportpass: ConsentRow[]
  /** Scheiben im Papierkorb */
  trashCount: number
  /** Platz für das Tagebuch ([[adr-033]]): der Profil-Teil kennt nur den Platz */
  diary?: ReactNode
  /** das einzige aktive Admin-Konto: Konto löschen geht nicht */
  lastAdmin?: boolean
}) {
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)

  return (
    <Page>
      <section data-profile className={cn("grid gap-6", PAGE_SINGLE)}>
        <div className="grid gap-1">
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            Profil
          </h1>
          <p className="text-foreground-2">
            {name ? `${name} · ` : ""}
            {email}
          </p>
        </div>

        {/* am Telefon steht Admin nicht in der Leiste: hier oben alle Bereiche, ab 1024 px in der Seitenleiste */}
        {isAdmin && (
          <nav aria-label="Admin" data-admin-sections className="grid gap-3 lg:hidden">
            <h2 className="text-[15px] font-semibold">Admin</h2>
            <div className="flex flex-wrap gap-3">
              {ADMIN_SECTIONS.map(({ key, href, label }) => (
                <Link key={key} href={href} className={PILL}>
                  {label}
                </Link>
              ))}
            </div>
          </nav>
        )}

        {diary}

        <SportpassConsents consents={sportpass} version={CURRENT_CONSENT_VERSION} />

        <div className="grid gap-4 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-[15px] font-semibold">Dieses Gerät</h2>
          <ThemeSwitch className="max-w-xs" />
        </div>

        <OwnData email={email} lastAdmin={lastAdmin} />

        <div className="flex flex-wrap items-center gap-3">
          <RouteLink route={{ page: "trash" }} className={PILL}>
            {trashCount ? `Papierkorb (${trashCount})` : "Papierkorb"}
          </RouteLink>
          <Link href="/profile/password" className={PILL}>
            Passwort ändern
          </Link>
          <Button
            variant="outline"
            className="h-10"
            disabled={leaving}
            onClick={async () => {
              setLeaving(true)
              // ohne Umleitung durch NextAuth: die baut sie aus NEXTAUTH_URL (ohne: localhost:3000), am Handy über die
              // Adresse im Netz ginge das ins Leere; die Anmeldung liegt auf demselben Host
              await signOut({ redirect: false })
              router.replace("/login")
              router.refresh()
            }}
          >
            {leaving ? "Abmelden…" : "Abmelden"}
          </Button>
        </div>
      </section>
    </Page>
  )
}
