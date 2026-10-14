"use client"

import { signOut } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { RouteLink } from "@vereinsheim/shot-ui/nav/RouteLink"
import { Button } from "@vereinsheim/ui/button"

import { Page } from "@/components/shell/Page"
import { ThemeSwitch } from "@/components/theme/ThemeSwitch"
import type { ConsentRow } from "@/lib/consent/queries"
import { CURRENT_CONSENT_VERSION } from "@/lib/consent/texts"

import { SportpassConsents } from "./SportpassConsents"

/**
 * Profil: Konto, Zustimmung per Sportpass (SP-1.7 a), Einstellung des Geräts (Darstellung), Admin für Admins, Abmelden.
 * Die Wertung hat jede Scheibe und jede Familie selbst (Seite der Scheibe, Liste, Fortschritt). Freigaben, Export und
 * Papierkorb kommen später.
 */
export function ProfileScreen({
  name,
  email,
  isAdmin,
  sportpass,
}: {
  name: string | null
  email: string
  isAdmin: boolean
  /** die eigenen Zustimmungen per Sportpass; nur aktive bringen Scheiben von der Brücke */
  sportpass: ConsentRow[]
}) {
  const router = useRouter()
  const [leaving, setLeaving] = useState(false)

  return (
    <Page>
      <section data-profile className="grid max-w-2xl gap-6">
        <div className="grid gap-1">
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            Profil
          </h1>
          <p className="text-foreground-2">
            {name ? `${name} · ` : ""}
            {email}
          </p>
        </div>

        <SportpassConsents consents={sportpass} version={CURRENT_CONSENT_VERSION} />

        <div className="grid gap-4 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-[15px] font-semibold">Dieses Gerät</h2>
          <ThemeSwitch className="max-w-xs" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/profile/password"
            className="rounded-full border border-line-strong px-3.5 py-2 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
          >
            Passwort ändern
          </Link>
          {isAdmin && (
            <RouteLink
              route={{ page: "admin", section: null }}
              className="rounded-full border border-line-strong px-3.5 py-2 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"
            >
              Admin
            </RouteLink>
          )}
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
