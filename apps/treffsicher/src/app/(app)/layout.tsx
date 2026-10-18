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
      <Page>{children}</Page>
    </AppShell>
  )
}
