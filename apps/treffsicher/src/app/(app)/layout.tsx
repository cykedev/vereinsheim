import { redirect } from "next/navigation"
import { Page } from "@vereinsheim/ui/design2/page"
import { MovedBannerHost } from "@/components/app/moved/MovedBanner"
import { AppShell } from "@/components/app/shell/AppShell"
import { getAuthSession } from "@/lib/auth-helpers"
import { spiegelUrl } from "@/lib/moved/rules"

// Layout für alle geschützten Seiten (Start, Tagebuch, Disziplinen, etc.)
// Die Middleware stellt sicher dass nur eingeloggte Nutzer dieses Layout erreichen.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  // ein Konto, das nach Spiegel umgezogen ist, liest nur noch: Hinweis oben auf jeder Seite, „Zu Spiegel“ im Rahmen
  const moved = session.user.movedToSpiegel
    ? { spiegelUrl: spiegelUrl(process.env.SPIEGEL_URL, process.env.NODE_ENV === "production") }
    : null

  return (
    <AppShell isAdmin={session.user.role === "ADMIN"} moved={moved}>
      {/* eine Spalte, die nie breiter als die Seite wird: breite Tabellen scrollen in sich, nicht die Seite */}
      <Page className="grid-cols-1">
        {moved && <MovedBannerHost spiegelUrl={moved.spiegelUrl} />}
        {children}
      </Page>
    </AppShell>
  )
}
