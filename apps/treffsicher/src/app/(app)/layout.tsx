import { redirect } from "next/navigation"
import { Page } from "@vereinsheim/ui/design2/page"
import { AppShell } from "@/components/app/shell/AppShell"
import { getAuthSession } from "@/lib/auth-helpers"

// Layout für alle geschützten Seiten (Start, Tagebuch, Disziplinen, etc.)
// Die Middleware stellt sicher dass nur eingeloggte Nutzer dieses Layout erreichen.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  return (
    <AppShell isAdmin={session.user.role === "ADMIN"}>
      {/* eine Spalte, die nie breiter als die Seite wird: breite Tabellen scrollen in sich, nicht die Seite */}
      <Page className="grid-cols-1">{children}</Page>
    </AppShell>
  )
}
