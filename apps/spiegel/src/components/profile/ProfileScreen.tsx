"use client"

import { signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import type { Scoring } from "@vereinsheim/shot-core/metrics"
import { RouteLink } from "@vereinsheim/shot-ui/nav/RouteLink"
import { Button } from "@vereinsheim/ui/button"
import { Segmented } from "@vereinsheim/ui/design2/segmented"

import { Page } from "@/components/shell/Page"
import { ThemeSwitch } from "@/components/theme/ThemeSwitch"
import { rememberScoring } from "@/lib/device-client"

/**
 * Profil: Konto, Einstellungen des Geräts (Darstellung, Wertung für Liste, Start und Fortschritt), Admin für Admins,
 * Abmelden. Zuordnung über den Sportpass, Freigaben, Export und Papierkorb kommen mit SP-1.7.
 */
export function ProfileScreen({
  name,
  email,
  isAdmin,
  scoring: initialScoring,
}: {
  name: string | null
  email: string
  isAdmin: boolean
  scoring: Scoring
}) {
  const router = useRouter()
  const [scoring, setScoring] = useState(initialScoring)
  const [leaving, setLeaving] = useState(false)

  const changeScoring = (next: Scoring) => {
    setScoring(next)
    rememberScoring(next)
    // Liste und Start rechnen auf dem Server: neu laden, damit sie der Wahl folgen
    router.refresh()
  }

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

        <div className="grid gap-4 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-[15px] font-semibold">Dieses Gerät</h2>
          <ThemeSwitch className="max-w-xs" />
          <div data-scoring-setting className="grid max-w-xs gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Wertung</span>
            <Segmented
              label="Wertung"
              value={scoring}
              options={[
                { value: "decimal", label: "Zehntel" },
                { value: "rings", label: "Ganze Ringe" },
              ]}
              onChange={changeScoring}
              className="w-full [&>button]:flex-1"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
