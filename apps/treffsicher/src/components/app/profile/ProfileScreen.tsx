import Link from "next/link"

import { ThemeSwitch } from "@vereinsheim/ui/design2/theme-switch"

import { AREAS, type Area } from "@/components/app/shell/areas"

import { PasswordForm } from "./PasswordForm"
import { SignOutButton } from "./SignOutButton"

/** die Bereiche, die am Telefon nicht in der unteren Leiste stehen */
const MORE: readonly Area[] = ["goals", "routines", "disciplines"]

const pill =
  "inline-flex h-10 items-center gap-2 rounded-full border border-line-strong px-3.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring"

/**
 * Profil: Konto, Darstellung des Geräts, Passwort, Abmelden. Unter 1024 px dazu die Bereiche, die nicht in der unteren
 * Leiste stehen (Ziele, Ablauf, Disziplinen, Admin für Admins); ab 1024 px stehen sie in der Seitenleiste.
 */
export function ProfileScreen({
  name,
  email,
  isAdmin,
}: {
  name: string | null
  email: string | null
  isAdmin: boolean
}) {
  const more = isAdmin ? [...MORE, "admin" as const] : MORE
  return (
    <section data-profile className="grid max-w-2xl gap-6">
      <div className="grid gap-1">
        <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
          Profil
        </h1>
        <p className="text-foreground-2">{[name, email].filter(Boolean).join(" · ")}</p>
      </div>

      <nav aria-label="Weitere Bereiche" className="grid gap-3 lg:hidden">
        <h2 className="text-[15px] font-semibold">Weitere Bereiche</h2>
        <div className="flex flex-wrap gap-3">
          {more.map((area) => {
            const { href, label, Icon } = AREAS[area]
            return (
              <Link key={area} href={href} className={pill}>
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-4">
        <h2 className="text-[15px] font-semibold">Dieses Gerät</h2>
        <ThemeSwitch className="max-w-xs" />
      </div>

      <div className="grid gap-4 rounded-2xl border border-border bg-card p-4">
        <div className="grid gap-1">
          <h2 className="text-[15px] font-semibold">Passwort ändern</h2>
          <p className="text-sm text-muted-foreground">
            Nach dem Speichern meldet Treffsicher dieses Konto auf allen Geräten ab.
          </p>
        </div>
        <PasswordForm />
      </div>

      <div>
        <SignOutButton />
      </div>
    </section>
  )
}
