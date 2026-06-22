import { Navigation } from "@/components/app/shell/Navigation"
import { redirect } from "next/navigation"
import { getAuthSession } from "@/lib/auth-helpers"

// Layout für alle geschützten Seiten.
// Die Middleware (proxy.ts) stellt sicher dass nur eingeloggte Nutzer dieses Layout erreichen.
// Dieser Check ist eine zweite Absicherungsschicht.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthSession()
  if (!session) redirect("/login")

  return (
    <div className="min-h-screen bg-background">
      <Navigation role={session.user.role} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
