import { redirect } from "next/navigation"
import { Page } from "@vereinsheim/ui/design2/page"
import { AppShell } from "@/components/app/shell/AppShell"
import { getAuthSession } from "@/lib/auth-helpers"

// Layout für alle geschützten Seiten.
// Die Middleware (proxy.ts) stellt sicher dass nur eingeloggte Nutzer dieses Layout erreichen.
// Dieser Check ist eine zweite Absicherungsschicht.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  return (
    <AppShell role={session.user.role}>
      {/* eine Spalte, die nie breiter als die Seite wird: breite Tabellen scrollen in sich, nicht die Seite */}
      <Page className="grid-cols-1">{children}</Page>
    </AppShell>
  )
}
