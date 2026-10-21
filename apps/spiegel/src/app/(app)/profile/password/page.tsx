import type { Metadata } from "next"

import { PasswordForm } from "@/components/profile/PasswordForm"
import { Page } from "@vereinsheim/ui/design2/page"
import { PAGE_SINGLE } from "@vereinsheim/shot-ui/layout/columns"
import { cn } from "@vereinsheim/lib/utils"
import { requireSession } from "@/lib/auth-helpers"

export const metadata: Metadata = { title: "Passwort ändern" }

// Die einzige Seite, die ein Passwort vom Admin zulässt: Hier ersetzt der Schütze es, bevor er Daten sieht
export default async function PasswordRoute() {
  const session = await requireSession({ passwordChange: true })
  const forced = session.user.mustChangePassword === true
  return (
    <Page>
      <section className={cn("grid gap-4", PAGE_SINGLE)}>
        <div className="grid gap-1">
          <h1 className="font-display text-[1.7rem] leading-tight font-bold tracking-tight">
            Passwort ändern
          </h1>
          <p className="text-foreground-2">
            {forced
              ? "Dein Passwort hat ein Admin vergeben. Wähle ein eigenes, dann kennt es niemand außer dir. Erst danach siehst du deine Scheiben."
              : "Danach meldest du dich mit dem neuen Passwort wieder an, auch auf deinen anderen Geräten."}
          </p>
        </div>
        <PasswordForm />
      </section>
    </Page>
  )
}
